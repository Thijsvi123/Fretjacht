(() => {
  const C = window.AudioContext;
  let fctx = null, dest = null, cur = [];
  function ensure() { if (!fctx) { fctx = new C(); dest = fctx.createMediaStreamDestination(); } return fctx; }
  function tone(f0, n, sr, opt) {
    const b = fctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const p = opt.p || 0.18, fund = opt.fund == null ? 0.7 : opt.fund, H = Math.min(30, Math.floor(7000 / f0));
    for (let h = 1; h <= H; h++) {
      const amp = Math.abs(Math.sin(h * Math.PI * p)) / (h * h) * (h === 1 ? fund : 1), dec = 1.2 + 0.9 * h, ph = Math.random() * 6.28, fh = f0 * h;
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] += Math.min(1, t / 0.004) * amp * Math.exp(-dec * t) * Math.sin(6.283185307 * fh * t + ph); }
    }
    let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
    for (let i = 0; i < n; i++) d[i] = d[i] / mx * (opt.gain || 0.3) + (opt.noise || 0.002) * (Math.random() * 2 - 1);
    return b;
  }
  window.__fake = {
    play(midi, opt) {
      opt = opt || {}; const ctx = ensure();
      const f0 = 440 * Math.pow(2, (midi - 69 + (opt.cents || 0) / 100) / 12), sr = ctx.sampleRate;
      const b = tone(f0, Math.floor(sr * (opt.dur || 1.2)), sr, opt);
      if (!opt.keep) { for (const s of cur) try { s.stop(); } catch (e) {} cur = []; }
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(dest); s.start(); cur.push(s);
    },
    glide(m0, semis, holdMs, glideMs, topMs) {
      const ctx = ensure(), t = ctx.currentTime + 0.02, f0 = 440 * Math.pow(2, (m0 - 69) / 12), f1 = f0 * Math.pow(2, semis / 12);
      const end = t + (holdMs + glideMs + topMs) / 1000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.setValueAtTime(0.25, end - 0.05); g.gain.linearRampToValueAtTime(0, end); g.connect(dest);
      [1, 2, 3, 4].forEach((h, i) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); og.gain.value = [1, 0.5, 0.3, 0.15][i];
        o.frequency.setValueAtTime(f0 * h, t);
        o.frequency.setValueAtTime(f0 * h, t + holdMs / 1000);
        o.frequency.linearRampToValueAtTime(f1 * h, t + (holdMs + glideMs) / 1000);
        o.connect(og); og.connect(g); o.start(t); o.stop(end + 0.05);
      });
    },
    silence() { for (const s of cur) try { s.stop(); } catch (e) {} cur = []; }
  };
  navigator.mediaDevices.getUserMedia = async () => { ensure(); await fctx.resume(); return dest.stream; };
})();
