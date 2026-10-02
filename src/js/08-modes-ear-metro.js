// ---------- Op gehoor naspelen ----------
const EAR_KEYS = {
  'minpent-A': { label: 'A mineur pentatonisch', scale: 'minpent', root: 'A', rootMidi: 57, fam: 'minor' },
  'minpent-E': { label: 'E mineur pentatonisch', scale: 'minpent', root: 'E', rootMidi: 52, fam: 'minor' },
  'blues-A': { label: 'A blues', scale: 'blues', root: 'A', rootMidi: 57, fam: 'minor' },
  'major-C': { label: 'C majeur', scale: 'major', root: 'C', rootMidi: 60, fam: 'major' },
  'major-G': { label: 'G majeur', scale: 'major', root: 'G', rootMidi: 55, fam: 'major' },
};
const LICKS = {
  minor: [[0, 3, 5, 3, 0], [7, 5, 3, 0], [0, 3, 5, 6, 5, 3], [10, 7, 5, 7, 3, 0], [12, 10, 7, 5, 7], [-5, -2, 0, 3, 0], [7, 6, 5, 3, 0], [5, 7, 10, 12, 10, 7], [3, 5, 3, 0, -2, 0], [0, -2, -5, -2, 0], [12, 10, 12, 7, 10, 7]],
  major: [[0, 2, 4, 7, 4], [9, 7, 4, 2, 0], [4, 2, 0, -3, 0], [7, 9, 12, 9, 7, 4], [0, 4, 7, 9, 7], [12, 9, 7, 4, 2, 0], [2, 4, 2, 0, -3, -5], [-5, -3, 0, 2, 4, 2]],
};
const EAR_LEVELS = ['', 'Eén noot', 'Twee noten', 'Drie noten', 'Loopje van 4 à 5 noten', 'Blueslicks'];
registerMode({
  id: 'ear', group: 'gehoor', title: 'Op gehoor naspelen', desc: 'De app speelt iets voor, jij zoekt het op de hals',
  homeStat: st => { const ok = Object.values(st.ear.ok).reduce((a, b) => a + b, 0); return ok ? `${ok} keer goed nagespeeld` : ''; },
  mount(view) {
    this.card = promptCard('Luister en speel na');
    this.statsEl = h('div', { class: 'card' });
    const s = Store.settings.ear;
    const L = exLayout(view, {
      prompt: this.card, neck: false,
      actions: [
        { id: 'replayBtn', label: 'Herhaal', key: 'r', onClick: () => this.play() },
        { id: 'revealBtn', label: 'Laat zien', key: 'h', onClick: () => this.reveal() },
        { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.next(true) },
      ],
      options: [
        field('Niveau', seg([1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })), s.level, v => { s.level = Number(v); Store.saveSettings(); this.next(true); }, 'tight'), '1 één noot · 2 twee noten · 3 drie noten · 4 een loopje van 4 à 5 noten · 5 blueslicks'),
        field('Toonsoort', selectEl('earKey', Object.keys(EAR_KEYS).map(k => ({ value: k, label: EAR_KEYS[k].label })), s.key, v => { s.key = v; Store.saveSettings(); this.next(true); }), null, 'earKey'),
        h('div', { class: 'field' },
          checkEl('earHelp', 'Hulp: zeg of ik hoger of lager moet zoeken', s.help, v => { s.help = v; Store.saveSettings(); }),
          checkEl('earSlow', 'Langzaam voorspelen', s.slow, v => { s.slow = v; Store.saveSettings(); })),
      ],
      stats: this.statsEl,
    });
    this.keys = L.keys;
    $('.pr-leds', this.card).hidden = true;
    this.next(false);
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); clearTimeout(this.playTimer); },
  pool() {
    const k = EAR_KEYS[Store.settings.ear.key];
    const pcs = new Set(scaleTones(k.scale, k.root).map(t => t.pc));
    const out = [];
    for (let m = k.rootMidi - 5; m <= k.rootMidi + 12; m++) if (pcs.has(mod12(m))) out.push(m);
    return out;
  },
  makePhrase() {
    const s = Store.settings.ear, k = EAR_KEYS[s.key], pool = this.pool(), R = k.rootMidi;
    const pcs = new Set(scaleTones(k.scale, k.root).map(t => t.pc));
    if (s.level === 1) { let m; do { m = pick(pool); } while (this.phrase && this.phrase.length === 1 && m === this.phrase[0]); return [m]; }
    if (s.level === 5) {
      const licks = LICKS[k.fam].filter(l => l.every(x => pcs.has(mod12(R + x))));
      let l; do { l = pick(licks); } while (licks.length > 1 && this.lastLick === l);
      this.lastLick = l;
      return l.map(x => R + x);
    }
    const len = s.level === 2 ? 2 : s.level === 3 ? 3 : 4 + Math.floor(Math.random() * 2);
    const anchors = pool.filter(m => [0, 7].includes(mod12(m - R)) || (k.fam === 'minor' && mod12(m - R) === 3));
    let idx = pool.indexOf(pick(anchors));
    const out = [pool[idx]];
    while (out.length < len) {
      const step = s.level === 2 ? pick([-3, -2, -1, 1, 2, 3]) : pick([-2, -1, -1, 1, 1, 2]);
      const j = idx + step;
      if (j < 0 || j >= pool.length) continue;
      idx = j; out.push(pool[idx]);
    }
    return out;
  },
  next(manual) {
    clearTimeout(this.timer);
    if (manual && this.phrase && !this.done) { const st = Store.stats.ear, lv = Store.settings.ear.level; st.tries[lv] = (st.tries[lv] || 0) + 1; Store.saveStats(); this.renderStats(); }
    this.phrase = this.makePhrase();
    this.idx = 0; this.done = false; this.revealed = false; this.wrong = 0;
    const lv = Store.settings.ear.level;
    $('.pr-eyebrow', this.card).textContent = `Niveau ${lv} · ${EAR_LEVELS[lv]}`;
    const first = pcName(this.phrase[0], 'sharps');
    $('.pr-note', this.card).innerHTML = lv === 1 ? '<span class="deg">?</span>' : bigNoteHTML(first) + '<span class="sym">…</span>';
    $('.pr-where', this.card).innerHTML = lv === 1 ? 'Zoek de noot die je hoort' : `Het begint op <b>${first}</b>. Zoek de rest op gehoor.`;
    this.card.classList.remove('hit');
    this.renderSlots();
    if (Engine.mic) this.playTimer = setTimeout(() => this.play(), 500);
    else $('.pr-toast', this.card).textContent = 'Druk op Start. Je hoort dan meteen het eerste fragment.';
  },
  onMic(on) { if (on) this.playTimer = setTimeout(() => this.play(), 400); },
  play() {
    if (!this.phrase) return;
    const slow = Store.settings.ear.slow, lv = Store.settings.ear.level;
    const unit = slow ? 0.55 : 0.36;
    const notes = this.phrase.map((m, i) => ({ midi: m, dur: lv === 5 && i < this.phrase.length - 1 ? unit * (i % 2 ? 0.75 : 1.25) : unit }));
    Engine.ensureCtx();
    const ms = Engine.playPhrase(notes);
    $('.pr-toast', this.card).textContent = 'Luister…';
    clearTimeout(this.listenTimer);
    this.listenTimer = setTimeout(() => { if (!this.done) $('.pr-toast', this.card).textContent = this.phrase.length === 1 ? 'Speel de noot' : this.idx ? `Verder bij noot ${this.idx + 1}` : 'Speel het na'; }, ms);
  },
  renderSlots() {
    $('.pr-extra', this.card).innerHTML = `<div class="slots">${this.phrase.map((m, i) => {
      const known = i < this.idx || this.revealed || (i === 0 && Store.settings.ear.level > 1);
      return `<span class="slot${i < this.idx ? ' on' : ''}${i === this.idx && !this.done ? ' now' : ''}"><small>${i + 1}</small><b>${known ? pcName(m, 'sharps') : '?'}</b></span>`;
    }).join('')}</div>`;
  },
  expected() { return this.done ? [] : [this.phrase[this.idx]]; },
  reveal() { this.revealed = true; this.renderSlots(); },
  onNote(n) {
    if (this.done || !this.phrase) return;
    const exp = this.phrase[this.idx];
    const ok = Store.settings.strict ? n.midi === exp : mod12(n.midi) === mod12(exp);
    if (!ok) {
      if (this.idx > 0 && mod12(n.midi) === mod12(this.phrase[this.idx - 1])) return;   // vorige noot klinkt nog
      this.wrong++;
      const heard = pcName(n.midi, 'sharps');
      let tip = '';
      if (Store.settings.ear.help) {
        const d = exp - n.midi;
        tip = Math.abs(d) >= 12 && mod12(d) === 0 ? ' Goede noot, ander octaaf.' : d > 0 ? ' Zoek hoger ↑' : ' Zoek lager ↓';
      }
      $('.pr-toast', this.card).textContent = `Je speelde ${heard}.${tip}`;
      return;
    }
    this.idx++;
    $('.pr-toast', this.card).textContent = this.idx < this.phrase.length ? `Goed! Nu noot ${this.idx + 1}` : '';
    this.renderSlots();
    if (this.idx >= this.phrase.length) this.success();
  },
  success() {
    this.done = true;
    const st = Store.stats.ear, lv = Store.settings.ear.level;
    st.tries[lv] = (st.tries[lv] || 0) + 1;
    if (!this.revealed) st.ok[lv] = (st.ok[lv] || 0) + 1;
    Store.saveStats();
    this.card.classList.add('hit');
    $('.pr-note', this.card).innerHTML = this.phrase.length === 1 ? bigNoteHTML(pcName(this.phrase[0], 'sharps')) : $('.pr-note', this.card).innerHTML.replace('<span class="sym">…</span>', '');
    $('.pr-toast', this.card).textContent = this.revealed ? 'Gelukt, met hulp.' : this.wrong ? `Goed! Na ${this.wrong} keer zoeken.` : 'In één keer goed!';
    this.renderSlots(); this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.next(false), 1600);
  },
  renderStats() {
    const st = Store.stats.ear, lv = Store.settings.ear.level;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: `Niveau ${lv}` }), statFigs([
      { label: 'Goed zonder hulp', value: String(st.ok[lv] || 0) },
      { label: 'Pogingen', value: String(st.tries[lv] || 0) },
      { label: 'Score', value: st.tries[lv] ? `${Math.round(100 * (st.ok[lv] || 0) / st.tries[lv])}<small>%</small>` : '–' },
    ]));
    if ((st.ok[lv] || 0) >= 10 && lv < 5 && st.ok[lv] / st.tries[lv] >= 0.8) this.statsEl.append(h('p', { class: 'help', text: `Je hebt dit niveau goed onder de knie. Probeer niveau ${lv + 1} via Opties.` }));
  },
});

// ---------- Metronoom ----------
registerMode({
  id: 'metro', group: 'handig', title: 'Metronoom', desc: 'Met tap tempo, en meten of je precies op de tel speelt',
  homeStat: () => `${Store.settings.metro.bpm} bpm`,
  mount(view) {
    const s = Store.settings.metro;
    this.hits = [];
    this.bpmEl = h('div', { class: 'bpm', text: String(s.bpm) });
    this.dotsEl = h('div', { class: 'beats' });
    const slider = h('input', { type: 'range', id: 'bpmRange', min: '30', max: '240', step: '1', value: String(s.bpm), oninput: e => this.setBpm(Number(e.target.value)) });
    this.slider = slider;
    const card = h('div', { class: 'card prompt metro' },
      h('p', { class: 'eyebrow', text: 'Tempo' }),
      h('div', { class: 'bpm-row' }, h('button', { type: 'button', class: 'round', 'aria-label': 'Langzamer', text: '−', onclick: () => this.setBpm(Store.settings.metro.bpm - 1) }), h('div', {}, this.bpmEl, h('div', { class: 'bpm-unit', text: 'slagen per minuut' })), h('button', { type: 'button', class: 'round', 'aria-label': 'Sneller', text: '+', onclick: () => this.setBpm(Store.settings.metro.bpm + 1) })),
      slider, this.dotsEl);
    this.card = card;
    this.timing = h('div', { class: 'card timing', hidden: !s.onbeat });
    const L = exLayout(view, {
      prompt: card, neck: false, mic: false,
      actions: [
        { id: 'metroBtn', label: 'Start', cls: 'primary', onClick: () => this.toggle() },
        { id: 'tapBtn', label: 'Tik tempo', key: 't', onClick: () => this.tap() },
      ],
      middle: this.timing,
      options: [
        field('Maatsoort', seg([2, 3, 4, 6].map(n => ({ value: n, label: `${n}/${n === 6 ? 8 : 4}` })), s.beats, v => { s.beats = Number(v); Metronome.beats = s.beats; Store.saveSettings(); this.renderDots(); }, 'tight')),
        h('div', { class: 'field' },
          checkEl('accent', 'Eerste tel harder', s.accent, v => { s.accent = v; Metronome.accent = v; Store.saveSettings(); }),
          checkEl('onbeat', 'Meet of ik op de tel speel (microfoon)', s.onbeat, v => { s.onbeat = v; Store.saveSettings(); this.timing.hidden = !v; if (v && !Engine.mic) Engine.startMic(); }),
          checkEl('phones', 'Ik gebruik oordopjes', s.phones, v => { s.phones = v; Store.saveSettings(); }, 'Met oordopjes hoort de microfoon de klik niet; dan telt elke aanslag mee. Zonder oordopjes telt alleen een aanslag met een duidelijke toon.')),
        field('Correctie voor vertraging', h('div', { class: 'row' }, h('input', { type: 'range', id: 'corr', min: '-150', max: '150', step: '5', value: String(s.corr), oninput: e => { s.corr = Number(e.target.value); this.corrText.textContent = `${s.corr > 0 ? '+' : ''}${s.corr} ms`; Store.saveSettings(); } }), this.corrText = h('span', { class: 'help', text: `${s.corr > 0 ? '+' : ''}${s.corr} ms` })), 'Zit je altijd ongeveer even veel te laat of te vroeg, ook als het strak voelt? Dan is dat vertraging van je telefoon. Schuif die hier weg.'),
      ],
    });
    this.keys = L.keys;
    this.metroBtn = $('#metroBtn', L.ctrl);
    Metronome.bpm = s.bpm; Metronome.beats = s.beats; Metronome.accent = s.accent;
    Metronome.onBeat = i => this.flash(i);
    this.renderDots();
    this.renderTiming();
    this.voiced = [];
  },
  unmount() { Metronome.stop(); Metronome.onBeat = null; clearTimeout(this.tapReset); },
  setBpm(v) {
    const s = Store.settings.metro;
    s.bpm = clamp(Math.round(v), 30, 240);
    Metronome.bpm = s.bpm;
    this.bpmEl.textContent = String(s.bpm); this.slider.value = String(s.bpm);
    Store.saveSettings();
  },
  toggle() {
    if (Metronome.on) { Metronome.stop(); this.metroBtn.textContent = 'Start'; this.metroBtn.classList.remove('stop'); this.renderTiming(); return; }
    Engine.ensureCtx();
    Metronome.start();
    this.metroBtn.textContent = 'Stop'; this.metroBtn.classList.add('stop');
    if (Store.settings.metro.onbeat && !Engine.mic) Engine.startMic();
    this.hits = [];
    this.renderTiming();
  },
  tap() {
    const now = performance.now();
    this.taps = (this.taps || []).filter(t => now - t < 2500);
    this.taps.push(now);
    if (this.taps.length >= 2) {
      const iv = []; for (let i = 1; i < this.taps.length; i++) iv.push(this.taps[i] - this.taps[i - 1]);
      const avg = iv.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, iv.length);
      this.setBpm(60000 / avg);
    }
  },
  renderDots() { this.dotsEl.innerHTML = Array.from({ length: Store.settings.metro.beats }, (_, i) => `<span class="${i === 0 && Store.settings.metro.accent ? 'acc' : ''}"></span>`).join(''); },
  flash(i) {
    const dots = $$('span', this.dotsEl);
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => dots.forEach(d => d.classList.remove('on')), 120);
  },
  onFrame(f) {
    if (f.midi != null || f.clarity >= 0.6 && f.db >= Store.settings.gateDb) { this.voiced.push(f.t); if (this.voiced.length > 60) this.voiced.shift(); }
  },
  onOnset(o) {
    const s = Store.settings.metro;
    if (!s.onbeat || !Metronome.on || !Engine.ctx) return;
    const lat = Engine.latency();
    const b = Metronome.nearest(o.audioT - lat);
    if (!b) return;
    const spb = 60 / Metronome.bpm;
    const offMs = (o.audioT - b.t - lat) * 1000 - s.corr;
    if (Math.abs(offMs) > spb * 500) return;
    const commit = () => { this.hits.push(offMs); if (this.hits.length > 32) this.hits.shift(); const r = Store.stats.rhythm.recent; r.push(Math.round(offMs)); while (r.length > 100) r.shift(); Store.saveStats(); this.renderTiming(); };
    if (s.phones) return commit();
    setTimeout(() => { if (this.voiced.some(t => t >= o.perfT - 30 && t <= o.perfT + 160)) commit(); }, 180);
  },
  renderTiming() {
    const hs = this.hits;
    const last = hs[hs.length - 1];
    const avg = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
    const sd = hs.length ? Math.sqrt(hs.reduce((a, b) => a + (b - avg) * (b - avg), 0) / hs.length) : 0;
    const tight = hs.length ? Math.round(100 * hs.filter(v => Math.abs(v) <= 25).length / hs.length) : 0;
    const word = v => (Math.abs(v) <= 10 ? 'precies op de tel' : `${Math.round(Math.abs(v))} ms ${v < 0 ? 'te vroeg' : 'te laat'}`);
    const pos = v => clamp(50 + v / 2, 1, 99);
    this.timing.innerHTML = '';
    this.timing.append(
      h('p', { class: 'eyebrow', text: 'Op de tel' }),
      h('div', { class: 'last-hit' + (last == null ? '' : Math.abs(last) <= 25 ? ' good' : Math.abs(last) <= 50 ? ' near' : ' off'), text: last == null ? (Metronome.on ? 'Speel mee met de klik' : 'Start de metronoom en speel mee') : word(last) }),
      h('div', { class: 'strip', html: `<span class="zone"></span><span class="mid"></span>${hs.map((v, i) => `<i class="${i === hs.length - 1 ? 'last' : ''}" style="left:${pos(v).toFixed(1)}%"></i>`).join('')}<em class="l">te vroeg</em><em class="r">te laat</em>` }),
      statFigs([
        { label: 'Gemiddeld', value: hs.length ? `${Math.round(Math.abs(avg))}<small>ms ${avg < 0 ? 'vroeg' : 'laat'}</small>` : '–' },
        { label: 'Spreiding', value: hs.length ? `±${Math.round(sd)}<small>ms</small>` : '–' },
        { label: 'Strak', value: hs.length ? `${tight}<small>%</small>` : '–' },
      ]));
  },
});
