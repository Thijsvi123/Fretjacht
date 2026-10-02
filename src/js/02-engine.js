// ---------- Toonhoogte (McLeod Pitch Method) ----------
function createDetector(N, sr, minF, maxF) {
  const maxTau = Math.min(Math.floor(sr / minF) + 2, N - 2);
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const nsdf = new Float32Array(maxTau + 2);
  const x = new Float32Array(N), sq = new Float32Array(N);
  return function detect(buf) {
    let mean = 0;
    for (let i = 0; i < N; i++) mean += buf[i];
    mean /= N;
    let energy = 0;
    for (let i = 0; i < N; i++) { const v = buf[i] - mean; x[i] = v; sq[i] = v * v; energy += sq[i]; }
    const rms = Math.sqrt(energy / N);
    if (energy <= 1e-12) return { freq: 0, clarity: 0, rms };
    let m = 2 * energy;
    for (let tau = 0; tau <= maxTau + 1; tau++) {
      if (tau > 0) m -= sq[tau - 1] + sq[N - tau];
      let r = 0;
      const lim = N - tau;
      for (let j = 0; j < lim; j++) r += x[j] * x[j + tau];
      nsdf[tau] = m > 1e-12 ? (2 * r) / m : 0;
    }
    let tau = 1;
    while (tau <= maxTau && nsdf[tau] > 0) tau++;
    const peaks = [];
    let best = -1, bestV = -Infinity;
    for (; tau <= maxTau; tau++) {
      const v = nsdf[tau];
      if (v > 0) { if (v > bestV) { bestV = v; best = tau; } }
      else if (best >= 0) { peaks.push(best); best = -1; bestV = -Infinity; }
    }
    if (best >= 0 && best < maxTau) peaks.push(best);
    let highest = 0;
    for (const p of peaks) if (p >= minTau && nsdf[p] > highest) highest = nsdf[p];
    if (highest <= 0) return { freq: 0, clarity: 0, rms };
    const thr = 0.9 * highest;
    let t = -1;
    for (const p of peaks) if (p >= minTau && nsdf[p] >= thr) { t = p; break; }
    const a = nsdf[t - 1], b = nsdf[t], c = nsdf[t + 1];
    const den = a - 2 * b + c;
    const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
    return { freq: sr / (t + shift), clarity: b - 0.25 * (a - c) * shift, rms };
  };
}

// ---------- Nootvolger: maakt losse noten van de stroom toonhoogtes ----------
const NOTE_MIN_MS = 100;
function createNoteTracker(emit) {
  let cand = null, candStart = 0, emitted = null, lastVoiced = -1e9;
  return {
    reset() { cand = null; emitted = null; },
    onset() { cand = null; emitted = null; },
    frame(f, now) {
      if (f.midi == null) { if (now - lastVoiced > 160) { cand = null; emitted = null; } return; }
      lastVoiced = now;
      const n = Math.round(f.midi);
      if (Math.abs(f.midi - n) > 0.42) { cand = null; return; }
      if (n !== cand) { cand = n; candStart = now; return; }
      if (now - candStart < NOTE_MIN_MS || n === emitted) return;
      if (emitted != null && Math.abs(n - emitted) === 12) return;   // octaaffout van dezelfde noot
      emitted = n;
      emit({ midi: n, midiF: f.midi, t: now });
    }
  };
}

// ---------- Gitaarklank (Karplus-Strong) ----------
function ksSamples(sr, midi, dur) {
  const n = Math.floor(sr * dur), y = new Float32Array(n);
  const f0 = m2f(midi), P = sr / f0 - 0.5;
  const L = Math.min(n, Math.ceil(P) + 2);
  let prev = 0;
  for (let i = 0; i < L; i++) { const w = Math.random() * 2 - 1; prev = prev * 0.45 + w * 0.55; y[i] = prev; }
  const loss = midi < 52 ? 0.997 : 0.995;
  for (let i = L; i < n; i++) {
    const d = i - P, i0 = Math.floor(d), fr = d - i0;
    const a = y[i0] * (1 - fr) + y[i0 + 1] * fr;
    const b = y[i0 - 1] * (1 - fr) + y[i0] * fr;
    y[i] = loss * 0.5 * (a + b);
  }
  let mx = 0;
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(y[i]));
  if (mx > 0) for (let i = 0; i < n; i++) y[i] *= 0.9 / mx;
  return y;
}

// ---------- Aanslagdetectie (AudioWorklet) ----------
const ONSET_WORKLET = `
class FjOnset extends AudioWorkletProcessor {
  constructor() { super(); this.slow = 1e-7; this.last = -1; this.minE = 4e-6; this.port.onmessage = e => { if (e.data && e.data.minE) this.minE = e.data.minE; }; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let e = 0;
    for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i];
    e /= ch.length;
    const t = currentTime;
    if (e > this.minE && e > 4 * this.slow && t - this.last > 0.09) { this.last = t; this.port.postMessage({ t: t, e: e }); }
    this.slow = this.slow * 0.97 + e * 0.03;
    return true;
  }
}
registerProcessor('fj-onset', FjOnset);`;

// ---------- Geluidsmotor ----------
const Engine = {
  ctx: null, stream: null, nodes: null, analyser: null, buf: null, detect: null, onsetNode: null, workletReady: false,
  mic: false, starting: false, raf: 0, lastTs: 0, prevDb: -120, blockUntil: 0, sink: null, wakeLock: null,
  heardHist: [], ksCache: new Map(), noiseBuf: null,
  tracker: null,

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  async startMic() {
    if (this.mic || this.starting) return this.mic;
    UI.hideMsg();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.showMsg('Deze browser geeft de pagina geen toegang tot de microfoon. Open de link in Safari (iPhone) of Chrome (Android).');
      return false;
    }
    const ctx = this.ensureCtx();
    this.starting = true; UI.micState();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      this.starting = false; UI.micState();
      const n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError') UI.showMsg('De microfoon is geblokkeerd. Sta de microfoon toe voor deze site en druk opnieuw op Start. Op een iPhone: Instellingen › Apps › Safari › Microfoon.');
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') UI.showMsg('Er is geen microfoon gevonden. Controleer je instellingen en probeer het opnieuw.');
      else if (n === 'NotReadableError') UI.showMsg('De microfoon wordt al door een andere app gebruikt. Sluit die app en probeer het opnieuw.');
      else UI.showMsg(`De microfoon kon niet starten (${n || 'onbekende fout'}). Herlaad de pagina en probeer het opnieuw.`);
      return false;
    }
    await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(this.stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = ctx.sampleRate > 50000 ? 4096 : 2048;
    analyser.smoothingTimeConstant = 0;
    const mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(analyser); analyser.connect(mute); mute.connect(ctx.destination);
    this.onsetNode = null;
    try {
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        if (!this.workletReady) {
          const url = URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'application/javascript' }));
          await ctx.audioWorklet.addModule(url);
          this.workletReady = true;
        }
        const node = new AudioWorkletNode(ctx, 'fj-onset', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        node.port.onmessage = e => this.onOnset(e.data);
        lp.connect(node); node.connect(mute);
        this.onsetNode = node;
        this.syncGate();
      }
    } catch (e) { this.onsetNode = null; }
    this.nodes = { src, hp, lp, analyser, mute };
    this.analyser = analyser;
    this.buf = new Float32Array(analyser.fftSize);
    this.detect = createDetector(analyser.fftSize, ctx.sampleRate, 70, 1100);
    this.tracker = createNoteTracker(n => { if (this.sink && this.sink.onNote) this.sink.onNote(n); });
    this.mic = true; this.starting = false; this.lastTs = performance.now(); this.heardHist = [];
    UI.micState();
    this.requestWake();
    this.raf = requestAnimationFrame(t => this.loop(t));
    if (this.sink && this.sink.onMic) this.sink.onMic(true);
    return true;
  },

  stopMic() {
    if (!this.mic) return;
    this.mic = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.nodes) { try { this.nodes.src.disconnect(); this.nodes.lp.disconnect(); this.nodes.analyser.disconnect(); } catch (e) {} }
    if (this.onsetNode) { try { this.onsetNode.disconnect(); } catch (e) {} this.onsetNode = null; }
    this.stream = null; this.nodes = null; this.analyser = null;
    if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
    this.heardHist = [];
    UI.micState(); UI.updateLevel(-120); UI.updateHeard(null);
    if (this.sink && this.sink.onMic) this.sink.onMic(false);
  },

  syncGate() {
    if (this.onsetNode) this.onsetNode.port.postMessage({ minE: Math.pow(10, (Store.settings.gateDb - 3) / 10) });
  },

  async requestWake() {
    try { if (navigator.wakeLock && this.mic) this.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { this.wakeLock = null; }
  },

  block(ms) { this.blockUntil = Math.max(this.blockUntil, performance.now() + ms); if (this.tracker) this.tracker.reset(); },

  loop(ts) {
    if (!this.mic) return;
    this.raf = requestAnimationFrame(t => this.loop(t));
    if (ts - this.lastTs < 18) return;
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.analyser.getFloatTimeDomainData(this.buf);
    const r = this.detect(this.buf);
    const db = r.rms > 0 ? 20 * Math.log10(r.rms) : -120;
    const voiced = db >= Store.settings.gateDb && r.freq > 0 && r.clarity >= 0.8;
    const now = performance.now();
    const f = { midi: voiced ? 69 + 12 * Math.log2(r.freq / 440) : null, freq: r.freq, clarity: r.clarity, db, t: now };
    if (!this.onsetNode && db >= Store.settings.gateDb && db - this.prevDb > 9) this.onOnset({ t: this.ctx.currentTime, fallback: true });
    this.prevDb = db;
    UI.updateLevel(db);
    this.heardHist.push(f.midi);
    if (this.heardHist.length > 5) this.heardHist.shift();
    const vals = this.heardHist.filter(v => v !== null);
    UI.updateHeard(vals.length >= 3 ? { midi: vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)], freq: r.freq } : null);
    if (now < this.blockUntil) return;
    this.tracker.frame(f, now);
    if (this.sink && this.sink.onFrame) this.sink.onFrame(f, dt);
  },

  onsetLog: [],
  onOnset(d) {
    if (!this.mic) return;
    const now = performance.now();
    this.onsetLog.push({ t: d.t, perf: now, blocked: now < this.blockUntil });
    if (this.onsetLog.length > 40) this.onsetLog.shift();
    if (now < this.blockUntil) return;
    if (this.tracker) this.tracker.onset();
    if (this.sink && this.sink.onOnset) this.sink.onOnset({ audioT: d.t, perfT: now });
  },

  // --- afspelen ---
  ksBuffer(midi) {
    const ctx = this.ensureCtx();
    if (!this.ksCache.has(midi)) {
      const y = ksSamples(ctx.sampleRate, midi, 1.6);
      const b = ctx.createBuffer(1, y.length, ctx.sampleRate);
      b.getChannelData(0).set(y);
      this.ksCache.set(midi, b);
    }
    return this.ksCache.get(midi);
  },
  pluck(midi, when, dur, gain) {
    const ctx = this.ensureCtx();
    const s = ctx.createBufferSource(); s.buffer = this.ksBuffer(midi);
    const g = ctx.createGain();
    const end = when + Math.min(dur, 1.5);
    g.gain.setValueAtTime(gain || 0.7, when);
    g.gain.setValueAtTime(gain || 0.7, Math.max(when, end - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    s.connect(g); g.connect(ctx.destination);
    s.start(when); s.stop(end + 0.02);
  },
  // notes: [{midi, dur}] in seconden. Blokkeert de microfoon tot het geluid weg is.
  playPhrase(notes) {
    const ctx = this.ensureCtx();
    let t = ctx.currentTime + 0.08, total = 0.08;
    notes.forEach((n, i) => {
      const last = i === notes.length - 1;
      this.pluck(n.midi, t, last ? Math.max(n.dur, 0.9) : n.dur + 0.05, 0.75);
      t += n.dur; total += n.dur;
    });
    const lastDur = Math.max(notes[notes.length - 1].dur, 0.9);
    const ms = (total - notes[notes.length - 1].dur + lastDur + 0.3) * 1000;
    this.block(ms);
    return ms;
  },
  click(when, accent) {
    const ctx = this.ensureCtx();
    if (!this.noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 0.04), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
      this.noiseBuf = b;
    }
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = accent ? 5200 : 3600; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = accent ? 2.4 : 1.5;
    s.connect(bp); bp.connect(g); g.connect(ctx.destination);
    s.start(when);
  },
  ding() {
    if (!Store.settings.sound || !this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [1568, 2093].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.07;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
    });
    this.block(450);
  },
  blip() {
    if (!Store.settings.sound || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 1760;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
    this.block(140);
  },
  chime() {
    // signaal voor het einde van een routineblok
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [1047, 1319, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.12;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.45);
    });
    this.block(800);
  },
  latency() {
    const ctx = this.ctx;
    if (!ctx) return 0;
    let inLat = 0.01;
    try { const tr = this.stream && this.stream.getAudioTracks()[0]; const s = tr && tr.getSettings ? tr.getSettings() : null; if (s && typeof s.latency === 'number') inLat = s.latency; } catch (e) {}
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + inLat;
  }
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Engine.mic && !Engine.wakeLock) Engine.requestWake(); });

// ---------- Metronoom ----------
const Metronome = {
  on: false, bpm: 80, beats: 4, accent: true, next: 0, beatIdx: 0, timer: 0, onBeat: null, recent: [],
  start() {
    const ctx = Engine.ensureCtx();
    this.on = true; this.beatIdx = 0; this.next = ctx.currentTime + 0.12; this.recent = [];
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  },
  stop() { this.on = false; clearInterval(this.timer); },
  tick() {
    const ctx = Engine.ctx;
    if (!this.on || !ctx) return;
    const spb = 60 / this.bpm;
    while (this.next < ctx.currentTime + 0.12) {
      const idx = this.beatIdx % this.beats, accent = this.accent && idx === 0;
      Engine.click(this.next, accent);
      this.recent.push({ t: this.next, idx });
      if (this.recent.length > 32) this.recent.shift();
      const delay = Math.max(0, (this.next - ctx.currentTime) * 1000);
      if (this.onBeat) setTimeout(() => this.on && this.onBeat && this.onBeat(idx), delay);
      this.next += spb; this.beatIdx++;
    }
  },
  nearest(t) {
    let best = null;
    for (const b of this.recent) if (!best || Math.abs(b.t - t) < Math.abs(best.t - t)) best = b;
    return best;
  }
};
