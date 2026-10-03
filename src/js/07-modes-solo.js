// ---------- Toonladders en boxen ----------
registerMode({
  id: 'scales', group: 'solo', title: 'Toonladders', desc: 'Pentatonische boxen, blues, majeur, mineur en modi',
  homeStat: st => (st.scales.runs ? `${st.scales.runs}× gespeeld` : ''),
  mount(view) {
    this.card = promptCard('Toonladder');
    this.statsEl = h('div', { class: 'card' });
    const s = Store.settings.scales;
    this.rootSel = h('div');
    this.boxSel = h('div');
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { class: 'neck-legend', html: '<i class="lg root"></i>grondtoon <i class="lg next"></i>volgende <i class="lg done"></i>gespeeld' }),
      actions: [{ id: 'againBtn', label: 'Opnieuw', key: 'r', onClick: () => this.reset() }, { id: 'nextBox', label: 'Volgende', key: 's', onClick: () => this.nextBox() }],
      options: [
        field('Toonladder', selectEl('scaleSel', Object.keys(SCALES).map(k => ({ value: k, label: SCALES[k].name })), s.scale, v => {
          s.scale = v;
          if (!rootsFor(v).includes(s.root)) s.root = rootsFor(v)[0];
          s.box = Math.min(s.box, boxCount(v));
          Store.saveSettings(); this.buildPickers(); this.reset();
        }), null, 'scaleSel'),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Grondtoon' }), this.rootSel),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Box' }), this.boxSel),
        field('Richting', seg([{ value: 'up', label: 'omhoog' }, { value: 'updown', label: 'omhoog en omlaag' }], s.order, v => { s.order = v; Store.saveSettings(); this.reset(); })),
        field('Op de hals', seg([{ value: 'names', label: 'notenamen' }, { value: 'degrees', label: 'trappen' }, { value: 'none', label: 'uit je hoofd' }], s.labels, v => { s.labels = v; Store.saveSettings(); this.draw(); }), 'Uit je hoofd: de box staat niet op de hals, alleen wat je al gespeeld hebt.'),
      ],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.buildPickers();
    this.reset();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); },
  buildPickers() {
    const s = Store.settings.scales;
    this.rootSel.innerHTML = '';
    this.rootSel.append(seg(rootsFor(s.scale).map(r => ({ value: r, label: r })), s.root, v => { s.root = v; Store.saveSettings(); this.reset(); }, 'tight'));
    this.boxSel.innerHTML = '';
    this.boxSel.append(seg(Array.from({ length: boxCount(s.scale) }, (_, i) => ({ value: i + 1, label: String(i + 1) })), s.box, v => { s.box = Number(v); Store.saveSettings(); this.reset(); }, 'tight'));
  },
  nextBox() {
    const s = Store.settings.scales;
    s.box = (s.box % boxCount(s.scale)) + 1;
    Store.saveSettings(); this.buildPickers(); this.reset();
  },
  reset() {
    clearTimeout(this.timer);
    const s = Store.settings.scales;
    this.box = scaleBox(s.scale, s.root, s.box);
    this.seq = s.order === 'updown' ? this.box.concat(this.box.slice(0, -1).reverse()) : this.box.slice();
    this.idx = 0; this.errors = 0; this.t0 = null; this.done = false; this.played = [];
    $('.pr-note', this.card).innerHTML = bigNoteHTML(s.root);
    $('.pr-note', this.card).setAttribute('aria-label', spoken(s.root));
    $('.pr-where', this.card).innerHTML = `<b>${SCALES[s.scale].short}</b><small>box ${s.box}</small>`;
    $('.pr-leds', this.card).hidden = true;
    this.card.classList.remove('hit');
    $('.pr-toast', this.card).textContent = Engine.mic ? 'Begin bij de laagste noot' : 'Druk op Start en sta de microfoon toe.';
    this.renderProgress();
    this.draw();
  },
  renderProgress() {
    const s = Store.settings.scales, best = Store.stats.scales.best[`${s.scale}-${s.root}-${s.box}-${s.order}`];
    $('.pr-extra', this.card).innerHTML = `<div class="progress"><span style="width:${(100 * this.idx / this.seq.length).toFixed(1)}%"></span></div><div class="prog-text">${this.idx}/${this.seq.length} noten${this.errors ? ` · ${this.errors} mis` : ''}${best ? ` · record ${fmt1(best)} s` : ''}</div>`;
  },
  draw() {
    const s = Store.settings.scales;
    const lo = Math.min(...this.box.map(p => p.f)), hi = Math.max(...this.box.map(p => p.f));
    const from = Math.max(0, lo - 1), to = Math.max(from + 5, hi + 1);
    const cur = this.done ? null : this.seq[this.idx];
    const marks = [];
    for (const p of this.box) {
      const isPlayed = this.played.some(q => q.s === p.s && q.f === p.f);
      const isCur = cur && cur.s === p.s && cur.f === p.f;
      if (s.labels === 'none' && !isPlayed) continue;
      const label = s.labels === 'degrees' ? p.label : p.name;
      let kind = isPlayed ? 'found' : 'todo';
      if (isCur) kind = 'next';
      if (p.label === 'R') kind += ' root';
      marks.push({ s: p.s, f: p.f, kind, label });
    }
    drawNeck(this.svg, { from, to, marks, highlight: cur && s.labels !== 'none' ? [cur.s] : [] });
  },
  expected() { return this.done ? [] : [this.seq[this.idx].midi]; },
  onNote(n) {
    if (this.done) return;
    const exp = this.seq[this.idx];
    const ok = Store.settings.strict ? n.midi === exp.midi : mod12(n.midi) === exp.pc;
    if (!ok) {
      const prev = this.seq[this.idx - 1];
      if (prev && (n.midi === prev.midi || (!Store.settings.strict && mod12(n.midi) === prev.pc))) return;   // vorige noot klinkt nog
      this.errors++;
      $('.pr-toast', this.card).textContent = Store.settings.scales.labels === 'none' ? 'Mis. Probeer het nog eens.' : `Je speelde ${pcName(n.midi, 'sharps')}, de volgende is ${exp.name}`;
      this.renderProgress();
      return;
    }
    if (this.t0 == null) this.t0 = n.t;
    this.played.push(exp);
    this.idx++;
    $('.pr-toast', this.card).textContent = '';
    if (this.idx >= this.seq.length) return this.success(n.t);
    if (Store.settings.scales.order === 'updown' && this.idx === this.box.length) this.played = [exp];   // terugweg: opnieuw kleuren
    this.renderProgress(); this.draw();
  },
  success(t) {
    this.done = true;
    const s = Store.settings.scales, secs = (t - this.t0) / 1000;
    const st = Store.stats.scales, key = `${s.scale}-${s.root}-${s.box}-${s.order}`;
    st.runs++;
    Quests.bump('scales');
    const rec = !this.errors && (st.best[key] == null || secs < st.best[key]);
    if (rec) st.best[key] = secs;
    Store.saveStats();
    this.card.classList.add('hit');
    $('.pr-toast', this.card).textContent = `Klaar in ${fmt1(secs)} s${this.errors ? ` met ${this.errors} mis` : rec ? ' · nieuw record' : ''}. Nog een keer!`;
    this.renderProgress(); this.draw(); this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.reset(), 2200);
  },
  renderStats() {
    const st = Store.stats.scales, s = Store.settings.scales;
    this.statsEl.innerHTML = '';
    const best = st.best[`${s.scale}-${s.root}-${s.box}-${s.order}`];
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Keer gespeeld', value: String(st.runs) }, { label: 'Record deze box', value: sec(best) }]));
  },
});

// ---------- Akkoordtonen ----------
registerMode({
  id: 'chords', group: 'solo', title: 'Akkoordtonen', desc: 'Speel alle tonen van een akkoord, in elke volgorde',
  homeStat: st => (st.chords.n ? `${st.chords.n} akkoorden · gemiddeld ${fmt1(st.chords.total / st.chords.n)} s` : ''),
  mount(view) {
    this.card = promptCard('Akkoordtonen');
    this.statsEl = h('div', { class: 'card' });
    const s = Store.settings.chords;
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { class: 'neck-legend', html: 'Na afloop zie je waar de akkoordtonen liggen. <i class="lg root"></i>grondtoon' }),
      actions: [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.next() }],
      options: [
        field('Akkoordsoorten', chips(Object.keys(CHORDS).map(k => ({ value: k, label: `${CHORDS[k].name}${CHORDS[k].sym ? ` <small>(${CHORDS[k].sym})</small>` : ''}` })), s.types, v => { s.types = v; Store.saveSettings(); }, 1)),
        field('Weergave', checkEl('showNames', 'Laat de notenamen meteen zien', s.show, v => { s.show = v; Store.saveSettings(); this.renderSlots(); }), 'Uit: je ziet alleen de functies (R, 3, 5, 7) en moet de namen zelf bedenken.'),
      ],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.next();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); },
  next() {
    clearTimeout(this.timer);
    const s = Store.settings.chords;
    let type, root;
    for (let i = 0; i < 60; i++) {
      type = pick(s.types); root = pick(CHORD_ROOTS);
      if (chordOk(type, root) && (!this.root || root !== this.root || type !== this.type)) break;
    }
    this.type = type; this.root = root;
    this.tones = chordTones(type, root);
    this.found = new Set(); this.elapsed = 0; this.done = false; this.hinted = false;
    const sym = CHORDS[type].sym;
    $('.pr-note', this.card).innerHTML = `${bigNoteHTML(root)}<span class="sym">${sym}</span>`;
    $('.pr-note', this.card).setAttribute('aria-label', `${spoken(root)} ${CHORDS[type].name}`);
    $('.pr-where', this.card).innerHTML = `<span class="muted">${root} ${CHORDS[type].name}</span>`;
    $('.pr-leds', this.card).hidden = true;
    this.card.classList.remove('hit');
    $('.pr-toast', this.card).textContent = Engine.mic ? 'Speel de tonen, in elke volgorde en octaaf' : 'Druk op Start en sta de microfoon toe.';
    this.renderSlots();
    drawNeck(this.svg, { from: 0, to: 12, marks: [] });
  },
  renderSlots() {
    if (!this.tones) return;
    const show = Store.settings.chords.show || this.hinted || this.done;
    $('.pr-extra', this.card).innerHTML = `<div class="slots">${this.tones.map(t => `<span class="slot${this.found.has(t.pc) ? ' on' : ''}"><small>${t.label}</small><b>${this.found.has(t.pc) || show ? t.name : '?'}</b></span>`).join('')}</div>`;
  },
  mapMarks() {
    const marks = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) {
      const t = this.tones.find(x => x.pc === mod12(OPEN[s] + f));
      if (t) marks.push({ s, f, kind: t.label === 'R' ? 'found root' : 'found', label: t.label });
    }
    return marks;
  },
  expected() { return this.done ? [] : this.tones.filter(t => !this.found.has(t.pc)).map(t => 48 + t.pc); },
  hint() {
    if (this.done) return;
    this.hinted = true;
    this.renderSlots();
    drawNeck(this.svg, { from: 0, to: 12, marks: this.mapMarks().map(m => ({ ...m, kind: m.kind.replace('found', 'hint') })) });
  },
  onFrame(f, dt) { if (!this.done) this.elapsed += dt; },
  onNote(n) {
    if (this.done) return;
    const pc = mod12(n.midi), t = this.tones.find(x => x.pc === pc);
    if (!t) { $('.pr-toast', this.card).textContent = `${pcName(pc, 'sharps')} zit niet in ${this.root}${CHORDS[this.type].sym}`; return; }
    if (this.found.has(pc)) return;
    this.found.add(pc);
    $('.pr-toast', this.card).textContent = `${t.name} is de ${t.label === 'R' ? 'grondtoon' : t.label}`;
    this.renderSlots();
    if (this.found.size === this.tones.length) this.success();
  },
  success() {
    this.done = true;
    const st = Store.stats.chords; st.n++; st.total += this.elapsed; Store.saveStats();
    this.card.classList.add('hit');
    $('.pr-toast', this.card).textContent = `Goed! ${this.tones.map(t => t.name).join(' ')} in ${fmt1(this.elapsed)} s`;
    this.renderSlots();
    drawNeck(this.svg, { from: 0, to: 12, marks: this.mapMarks() });
    this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.next(), 2600);
  },
  renderStats() {
    const st = Store.stats.chords;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Akkoorden', value: String(st.n) }, { label: 'Gemiddeld', value: st.n ? sec(st.total / st.n) : '–' }]));
  },
});

// ---------- Bends ----------
registerMode({
  id: 'bends', group: 'solo', title: 'Bends', desc: 'Bend zuiver naar de juiste toonhoogte, met een live lijn',
  homeStat: st => { const r = st.bends.recent; return r.length ? `gemiddeld ${Math.round(r.reduce((a, b) => a + Math.abs(b), 0) / r.length)} cent ernaast` : ''; },
  mount(view) {
    this.card = promptCard('Bend');
    this.canvas = h('canvas', { class: 'bend-canvas', 'aria-label': 'Toonhoogte tijdens het benden' });
    this.statsEl = h('div', { class: 'card' });
    const s = Store.settings.bends;
    const L = exLayout(view, {
      prompt: this.card, neck: false,
      middle: h('figure', { class: 'card graph' }, this.canvas, h('figcaption', { class: 'neck-cap', text: 'Probeer de G-snaar fret 7 of de B-snaar fret 8. Speel de noot, bend hem en houd hem even vast.' })),
      actions: [{ id: 'resetBtn', label: 'Nieuwe noot', key: 'r', onClick: () => this.toIdle(true) }],
      options: [
        field('Hoe ver', seg([{ value: 1, label: 'halve toon' }, { value: 2, label: 'hele toon' }, { value: 3, label: 'anderhalve toon' }], s.semis, v => { s.semis = Number(v); Store.saveSettings(); this.setTitle(); this.drawGraph(); })),
        field('Hoe streng', seg([{ value: 10, label: '±10 cent' }, { value: 15, label: '±15 cent' }, { value: 25, label: '±25 cent' }], s.tol, v => { s.tol = Number(v); Store.saveSettings(); this.drawGraph(); })),
      ],
      stats: this.statsEl,
    });
    this.keys = L.keys;
    this.trace = []; this.base = null; this.state = 'idle'; this.lastVoiced = 0;
    this.colors();
    this.mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.onScheme = () => { this.colors(); this.drawGraph(); };
    this.mq.addEventListener && this.mq.addEventListener('change', this.onScheme);
    this.onResize = () => this.drawGraph();
    window.addEventListener('resize', this.onResize);
    this.setTitle();
    $('.pr-leds', this.card).hidden = true;
    $('.pr-toast', this.card).textContent = Engine.mic ? 'Speel een noot' : 'Druk op Start en sta de microfoon toe.';
    this.drawGraph();
    this.renderStats();
  },
  unmount() { window.removeEventListener('resize', this.onResize); this.mq && this.mq.removeEventListener && this.mq.removeEventListener('change', this.onScheme); },
  colors() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    this.c = { ink: g('--ink'), muted: g('--muted'), line: g('--line'), accent: g('--accent'), ok: g('--ok'), bad: g('--bad'), surface: g('--surface') };
  },
  setTitle() {
    const s = Store.settings.bends;
    $('.pr-note', this.card).innerHTML = `<span class="deg">${['', '½ toon', '1 toon', '1½ toon'][s.semis]}</span>`;
    $('.pr-where', this.card).innerHTML = 'Speel een noot en <b>bend hem omhoog</b>';
  },
  toIdle(manual) {
    this.state = 'idle'; this.base = null;
    if (manual) { this.trace = []; $('.pr-toast', this.card).textContent = 'Speel een noot'; this.card.classList.remove('hit', 'miss'); }
    this.drawGraph();
  },
  expected() { return []; },
  onMic(on) { $('.pr-toast', this.card).textContent = on ? 'Speel een noot' : 'Gepauzeerd'; },
  onOnset() { if (this.state !== 'bending') { this.state = 'idle'; this.base = null; } },
  recent(ms) { const now = performance.now(); return this.trace.filter(p => p.m != null && now - p.t <= ms).map(p => p.m); },
  onFrame(f) {
    const now = f.t;
    this.trace.push({ t: now, m: f.midi });
    while (this.trace.length && now - this.trace[0].t > 4500) this.trace.shift();
    if (f.midi == null) {
      if (now - this.lastVoiced > 400 && this.state !== 'idle') this.toIdle(false);
      this.drawGraph(); return;
    }
    this.lastVoiced = now;
    const s = Store.settings.bends;
    if (this.state === 'idle') {
      const w = this.recent(220);
      if (w.length >= 6 && Math.max(...w) - Math.min(...w) < 0.25) {
        this.base = w.reduce((a, b) => a + b, 0) / w.length;
        this.state = 'armed';
        const n = Math.round(this.base);
        $('.pr-toast', this.card).textContent = `Basis ${pcName(n, 'sharps')}${octaveOf(n)}. Bend nu naar ${pcName(n + s.semis, 'sharps')}.`;
        this.card.classList.remove('hit', 'miss');
      }
    } else if (this.state === 'armed') {
      if (f.midi < this.base - 0.6 || f.midi > this.base + s.semis + 1.5) this.toIdle(false);
      else if (f.midi > this.base + 0.35) this.state = 'bending';
    } else if (this.state === 'bending') {
      const w = this.recent(260);
      const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1);
      if (w.length >= 7 && Math.max(...w) - Math.min(...w) < 0.4 && mean > this.base + 0.5) this.evaluate(mean);
      else if (f.midi < this.base + 0.2) this.state = 'armed';
    } else if (this.state === 'done') {
      if (f.midi < this.base + 0.3) this.state = 'armed';
    }
    this.drawGraph();
  },
  evaluate(mean) {
    const s = Store.settings.bends;
    const cents = Math.round(((mean - this.base) - s.semis) * 100);
    this.state = 'done';
    this.last = cents;
    const r = Store.stats.bends.recent; r.push(cents); while (r.length > 20) r.shift(); Store.saveStats();
    const ok = Math.abs(cents) <= s.tol;
    this.card.classList.toggle('hit', ok); this.card.classList.toggle('miss', !ok);
    $('.pr-toast', this.card).textContent = ok ? `Zuiver! ${cents === 0 ? 'Precies goed' : `${Math.abs(cents)} cent ${cents < 0 ? 'te laag' : 'te hoog'}`}` : `${Math.abs(cents)} cent ${cents < 0 ? 'te laag, bend verder door' : 'te hoog, iets minder ver'}`;
    if (ok) Engine.ding();
    this.renderStats();
  },
  drawGraph() {
    const cv = this.canvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300, H = cv.clientHeight || 220;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const s = Store.settings.bends, c = this.c;
    const top = s.semis * 100 + 90, bot = -60;
    const L = 46, R = W - 10, T = 10, B = H - 22;
    const Y = v => T + (top - v) / (top - bot) * (B - T);
    const now = performance.now(), X = t => R - (now - t) / 4000 * (R - L);
    // doelband
    g.fillStyle = c.ok; g.globalAlpha = 0.16;
    g.fillRect(L, Y(s.semis * 100 + s.tol), R - L, Y(s.semis * 100 - s.tol) - Y(s.semis * 100 + s.tol));
    g.globalAlpha = 1;
    g.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    g.textBaseline = 'middle';
    const lines = [[0, 'start'], [100, '½'], [200, '1'], [300, '1½']].filter(([v]) => v <= top - 20);
    for (const [v, lbl] of lines) {
      g.strokeStyle = v === s.semis * 100 ? c.ok : c.line; g.lineWidth = v === s.semis * 100 ? 1.5 : 1;
      g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(R, Y(v)); g.stroke();
      g.fillStyle = v === s.semis * 100 ? c.ink : c.muted;
      g.fillText(lbl, 6, Y(v));
    }
    g.fillStyle = c.muted; g.fillText('−4 s', L, H - 9); g.textAlign = 'right'; g.fillText('nu', R, H - 9); g.textAlign = 'left';
    if (this.base == null) {
      g.fillStyle = c.muted; g.textAlign = 'center'; g.font = '13px ' + getComputedStyle(document.body).getPropertyValue('--body');
      g.fillText(Engine.mic ? 'Speel een noot om te beginnen' : 'Druk op Start', (L + R) / 2, (T + B) / 2); g.textAlign = 'left';
      return;
    }
    g.strokeStyle = c.accent; g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    let pen = false, last = null;
    for (const p of this.trace) {
      if (p.m == null) { pen = false; continue; }
      const v = clamp((p.m - this.base) * 100, bot, top);
      const x = X(p.t), y = Y(v);
      if (x < L) continue;
      if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
      last = { x, y };
    }
    g.stroke();
    if (last) { g.fillStyle = c.accent; g.beginPath(); g.arc(last.x, last.y, 5, 0, Math.PI * 2); g.fill(); }
  },
  renderStats() {
    const r = Store.stats.bends.recent, tol = Store.settings.bends.tol;
    this.statsEl.innerHTML = '';
    const avg = r.length ? Math.round(r.reduce((a, b) => a + Math.abs(b), 0) / r.length) : null;
    const hits = r.filter(v => Math.abs(v) <= tol).length;
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Laatste 20 bends' }), statFigs([
      { label: 'Gemiddeld ernaast', value: avg == null ? '–' : `${avg}<small>cent</small>` },
      { label: 'Zuiver', value: r.length ? `${hits}<small>van ${r.length}</small>` : '–' },
      { label: 'Neiging', value: r.length ? (r.reduce((a, b) => a + b, 0) / r.length < -5 ? 'te laag' : r.reduce((a, b) => a + b, 0) / r.length > 5 ? 'te hoog' : 'goed') : '–' },
    ]));
  },
});
