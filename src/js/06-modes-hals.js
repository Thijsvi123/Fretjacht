// ---------- Gedeeld: noten op snaren ----------
const TOL = 0.45, HOLD = 0.18, COOLDOWN = 700;
const NoteGame = {
  pool(focusKeys) {
    const s = Store.settings, pool = [];
    for (const st of s.strings) {
      const by = new Map();
      for (let f = s.minFret; f <= s.maxFret; f++) {
        const pc = mod12(OPEN[st] + f);
        if (s.naturalsOnly && !NATURAL.has(pc)) continue;
        if (!by.has(pc)) by.set(pc, []);
        by.get(pc).push(f);
      }
      for (const [pc, frets] of by) pool.push({ s: st, pc, frets });
    }
    if (focusKeys && focusKeys.length) {
      const fp = pool.filter(it => focusKeys.includes(it.s + '-' + it.pc));
      if (fp.length) return fp;
    }
    return pool;
  },
  pick(prev, focusKeys) {
    const pool = this.pool(focusKeys);
    let cands = pool.filter(it => !prev || it.pc !== prev.pc);
    if (!cands.length) cands = pool;
    const items = Store.stats.notes.items;
    const w = cands.map(it => { const st = items[it.s + '-' + it.pc]; return st && st.n ? 1 + Math.min(2.5, st.total / st.n / 4) : 1.6; });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), it = cands[cands.length - 1];
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { it = cands[i]; break; } }
    return { s: it.s, pc: it.pc, frets: it.frets, name: pcName(it.pc, Store.settings.names), midis: it.frets.map(f => OPEN[it.s] + f) };
  },
  matches(t, m) {
    if (Store.settings.strict) return t.midis.some(v => Math.abs(m - v) <= TOL);
    const d = mod12(m - t.pc);
    return Math.min(d, 12 - d) <= TOL;
  },
  fretsFor(t, m) {
    if (!Store.settings.strict) return t.frets;
    let bi = 0;
    t.midis.forEach((v, i) => { if (Math.abs(m - v) < Math.abs(m - t.midis[bi])) bi = i; });
    return [t.frets[bi]];
  },
  record(t, secs, hinted) {
    const st = Store.stats.notes, key = t.s + '-' + t.pc;
    const it = st.items[key] || (st.items[key] = { n: 0, total: 0 });
    it.n++; it.total += secs;
    st.found++; st.totalTime += secs;
    Quests.bump('notes');
    if (!hinted && (st.best == null || secs < st.best)) st.best = secs;
    if (!hinted && secs <= 5) { st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
    Store.saveStats();
  },
  // hold-meter: true zodra de juiste toon lang genoeg klinkt
  hold(state, f, dt, matchFn) {
    if (f.midi == null) state.hold = Math.max(0, state.hold - dt / 0.6);
    else if (matchFn(f.midi)) state.hold = Math.min(1, state.hold + dt / HOLD);
    else state.hold = Math.max(0, state.hold - dt / 0.25);
    return state.hold >= 1;
  }
};
const rangeCaption = () => `Oefenbereik: fret ${Store.settings.minFret} t/m ${Store.settings.maxFret} · ${Store.settings.strings.length} ${Store.settings.strings.length === 1 ? 'snaar' : 'snaren'}`;

// ---------- Noten zoeken ----------
registerMode({
  id: 'notes', group: 'hals', title: 'Noten zoeken', desc: 'Speel de gevraagde noot op de juiste snaar',
  homeStat: st => (st.notes.found ? `gemiddeld ${fmt1(st.notes.totalTime / st.notes.found)} s` : ''),
  focus: null,
  mount(view) {
    this.card = promptCard('Speel');
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { text: this.focus ? 'Focus op je zwakste plekken' : rangeCaption() }),
      actions: [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.skip() }],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.target = null; this.state = { hold: 0 };
    this.next();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); this.focus = null; },
  next() {
    clearTimeout(this.timer);
    this.target = NoteGame.pick(this.target, this.focus);
    this.elapsed = 0; this.hinted = false; this.state.hold = 0; this.done = false; this.marks = [];
    const t = this.target;
    $('.pr-note', this.card).innerHTML = bigNoteHTML(t.name);
    $('.pr-note', this.card).setAttribute('aria-label', spoken(t.name));
    $('.pr-where', this.card).innerHTML = `op de <b>${STR_NAME[t.s]}</b><small>snaar ${t.s + 1}</small>`;
    $('.pr-toast', this.card).textContent = Engine.mic ? '' : 'Druk op Start en sta de microfoon toe.';
    this.card.classList.remove('hit');
    setLeds(this.card, 0);
    this.draw();
  },
  draw() {
    const s = Store.settings;
    drawNeck(this.svg, { from: 0, to: Math.max(12, s.maxFret), highlight: [this.target.s], marks: this.marks, range: { min: s.minFret, max: s.maxFret } });
  },
  expected() { return this.done ? [] : this.target.midis; },
  hint() {
    if (this.done) return;
    this.hinted = true;
    this.marks = this.target.frets.map(f => ({ s: this.target.s, f, kind: 'hint', label: this.target.name }));
    this.draw();
    $('.pr-toast', this.card).textContent = `Hint: fret ${this.target.frets.join(' of ')}`;
  },
  skip() { if (this.done) return; Store.stats.notes.streak = 0; Store.saveStats(); this.renderStats(); this.next(); },
  onMic(on) { $('.pr-toast', this.card).textContent = on ? '' : 'Gepauzeerd. Druk op Start om verder te gaan.'; },
  onFrame(f, dt) {
    if (this.done) return;
    this.elapsed += dt;
    if (Store.settings.autoHint && !this.hinted && this.elapsed >= Store.settings.autoHint) this.hint();
    const ok = NoteGame.hold(this.state, f, dt, m => NoteGame.matches(this.target, m));
    setLeds(this.card, this.state.hold);
    if (ok) this.success(f.midi);
  },
  success(m) {
    this.done = true;
    const t = this.target, frets = NoteGame.fretsFor(t, m), secs = this.elapsed;
    this.marks = frets.map(f => ({ s: t.s, f, kind: 'found', label: t.name }));
    this.draw();
    this.card.classList.add('hit');
    setLeds(this.card, 1);
    $('.pr-toast', this.card).textContent = `Goed! Fret ${frets.join(' en ')} · ${fmt1(secs)} s`;
    NoteGame.record(t, secs, this.hinted);
    this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.next(), COOLDOWN);
  },
  renderStats() {
    const st = Store.stats.notes;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([
      { label: 'Gevonden', value: String(st.found) },
      { label: 'Gemiddeld', value: st.found ? sec(st.totalTime / st.found) : '–' },
      { label: 'Snelste', value: sec(st.best) },
      { label: 'Reeks < 5 s', value: `${st.streak}${st.bestStreak ? `<small>beste ${st.bestStreak}</small>` : ''}` },
    ]), h('a', { class: 'link', href: '#m-heatmap', text: 'Bekijk je hittekaart ›' }));
  },
});

// ---------- Alle posities ----------
registerMode({
  id: 'positions', group: 'hals', title: 'Alle posities', desc: 'Speel dezelfde noot op elke snaar',
  homeStat: st => (st.positions.done ? `${st.positions.done}× rond · snelste ${fmt1(st.positions.best)} s` : ''),
  mount(view) {
    this.card = promptCard('Speel op elke snaar');
    const s = Store.settings.positions;
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { text: rangeCaption() }),
      actions: [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.next() }],
      options: [field('Volgorde', seg([{ value: 'up', label: 'lage E → hoge e' }, { value: 'down', label: 'hoge e → lage E' }], s.order, v => { s.order = v; Store.saveSettings(); this.next(); }))],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.pc = null;
    this.next();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); },
  next() {
    clearTimeout(this.timer);
    const S = Store.settings;
    const order = S.strings.slice().sort((a, b) => (S.positions.order === 'up' ? b - a : a - b));
    let pcs = Array.from({ length: 12 }, (_, i) => i).filter(pc => !S.naturalsOnly || NATURAL.has(pc));
    if (this.pc != null) pcs = pcs.filter(pc => pc !== this.pc);
    pcs = shuffle(pcs);
    let steps = [];
    for (const pc of pcs) {
      steps = order.map(s => {
        const frets = [];
        for (let f = S.minFret; f <= S.maxFret; f++) if (mod12(OPEN[s] + f) === pc) frets.push(f);
        return { s, frets, midis: frets.map(f => OPEN[s] + f) };
      }).filter(st => st.frets.length);
      if (steps.length >= Math.min(2, order.length)) { this.pc = pc; break; }
    }
    this.steps = steps; this.idx = 0; this.marks = []; this.elapsed = 0; this.done = false; this.hinted = false; this.lastAccepted = null;
    this.name = pcName(this.pc, S.names);
    $('.pr-note', this.card).innerHTML = bigNoteHTML(this.name);
    $('.pr-note', this.card).setAttribute('aria-label', spoken(this.name));
    $('.pr-where', this.card).innerHTML = S.positions.order === 'up' ? 'van de <b>lage E</b> naar de <b>hoge e</b>' : 'van de <b>hoge e</b> naar de <b>lage E</b>';
    $('.pr-leds', this.card).hidden = true;
    this.card.classList.remove('hit');
    $('.pr-toast', this.card).textContent = Engine.mic ? '' : 'Druk op Start en sta de microfoon toe.';
    this.renderSteps();
    this.draw();
  },
  renderSteps() {
    $('.pr-extra', this.card).innerHTML = `<div class="steps">${this.steps.map((st, i) => `<span class="step${i < this.idx ? ' done' : i === this.idx && !this.done ? ' now' : ''}">${STR_LETTER[st.s]}</span>`).join('')}</div>`;
  },
  draw() {
    const S = Store.settings, cur = this.steps[this.idx];
    drawNeck(this.svg, { from: 0, to: Math.max(12, S.maxFret), highlight: cur && !this.done ? [cur.s] : [], marks: this.marks, range: { min: S.minFret, max: S.maxFret } });
  },
  expected() { const st = this.steps[this.idx]; return this.done || !st ? [] : st.midis; },
  hint() {
    const st = this.steps[this.idx];
    if (!st || this.done) return;
    this.hinted = true;
    this.marks = this.marks.filter(m => m.kind !== 'hint').concat(st.frets.map(f => ({ s: st.s, f, kind: 'hint', label: this.name })));
    this.draw();
    $('.pr-toast', this.card).textContent = `Hint: ${STR_NAME[st.s]}, fret ${st.frets.join(' of ')}`;
  },
  onOnset(o) { this.lastOnset = o.perfT; },
  onFrame(f, dt) {
    if (this.done) return;
    this.elapsed += dt;
    // zelfde toonhoogte als de vorige stap (bijv. lage E fret 5 en open A): opnieuw aanslaan telt
    const la = this.lastAccepted, st = this.steps[this.idx];
    if (!la || f.midi == null || !st || this.lastOnset === la.onset || f.t - this.lastOnset < 120) return;
    const m = Math.round(f.midi);
    if (m === la.midi && Math.abs(f.midi - m) <= TOL && (Store.settings.strict ? st.midis.includes(m) : mod12(m) === this.pc)) this.accept(m);
  },
  onNote(n) {
    if (this.done) return;
    const st = this.steps[this.idx];
    if (this.lastAccepted && n.midi === this.lastAccepted.midi && this.lastOnset === this.lastAccepted.onset) return;
    const ok = Store.settings.strict ? st.midis.some(v => v === n.midi) : mod12(n.midi) === this.pc;
    if (!ok) { $('.pr-toast', this.card).textContent = `Je speelde ${pcName(n.midi, Store.settings.names === 'flats' ? 'flats' : 'sharps')}. Zoek ${this.name} op de ${STR_NAME[st.s]}.`; return; }
    this.accept(n.midi);
  },
  accept(midi) {
    const st = this.steps[this.idx];
    const n = { midi };
    this.lastAccepted = { midi, onset: this.lastOnset };
    let bi = 0;
    st.midis.forEach((v, i) => { if (Math.abs(n.midi - v) < Math.abs(n.midi - st.midis[bi])) bi = i; });
    this.marks = this.marks.filter(m => m.kind !== 'hint').concat([{ s: st.s, f: st.frets[bi], kind: 'found', label: this.name }]);
    this.idx++;
    $('.pr-toast', this.card).textContent = this.idx < this.steps.length ? `Goed, nu de ${STR_NAME[this.steps[this.idx].s]}` : '';
    if (this.idx >= this.steps.length) return this.success();
    this.renderSteps(); this.draw();
  },
  success() {
    this.done = true;
    const ps = Store.stats.positions, secs = this.elapsed;
    ps.done++;
    if (!this.hinted && (ps.best == null || secs < ps.best)) ps.best = secs;
    Store.saveStats();
    this.card.classList.add('hit');
    $('.pr-toast', this.card).textContent = `Alle ${this.name}'s gevonden in ${fmt1(secs)} s`;
    this.renderSteps(); this.draw(); this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.next(), 1600);
  },
  renderStats() {
    const ps = Store.stats.positions;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Rondes', value: String(ps.done) }, { label: 'Snelste ronde', value: sec(ps.best) }]));
  },
});

// ---------- Intervallen ----------
registerMode({
  id: 'intervals', group: 'hals', title: 'Intervallen', desc: 'Speel een toon en dan het interval erboven of eronder',
  homeStat: st => (st.intervals.n ? `${st.intervals.n} goed · gemiddeld ${fmt1(st.intervals.total / st.intervals.n)} s` : ''),
  mount(view) {
    this.card = promptCard('Interval');
    const s = Store.settings.intervals;
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card,
      actions: [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.next() }],
      options: [
        field('Welke intervallen', chips(INTERVALS.map(i => ({ value: i.semis, label: i.name })), s.set.map(String), v => { s.set = v.map(Number); Store.saveSettings(); }, 1)),
        field('Richting', seg([{ value: 'up', label: 'omhoog' }, { value: 'down', label: 'omlaag' }, { value: 'both', label: 'beide' }], s.dir, v => { s.dir = v; Store.saveSettings(); this.next(); })),
        field('Begintonen', checkEl('natRoots', 'Alleen stamtonen als begintoon', s.naturalRoots, v => { s.naturalRoots = v; Store.saveSettings(); })),
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
    const s = Store.settings.intervals;
    let root, target, iv, up;
    for (let tries = 0; tries < 50; tries++) {
      const sm = Number(pick(s.set));
      iv = INTERVALS.find(i => i.semis === sm);
      up = s.dir === 'up' ? true : s.dir === 'down' ? false : Math.random() < 0.5;
      const pcs = Array.from({ length: 12 }, (_, i) => i).filter(pc => !s.naturalRoots || NATURAL.has(pc));
      const rn = pcName(pick(pcs), Store.settings.names);
      root = parseName(rn);
      target = spellFrom(root, up ? iv.steps : -iv.steps, up ? iv.semis : -iv.semis);
      if (isSimple(root) && isSimple(target) && (!this.root || spPc(root) !== spPc(this.root) || iv !== this.iv)) break;
    }
    Object.assign(this, { root, target, iv, up, phase: 'root', rootMidi: null, elapsed: 0, done: false, hinted: false, marks: [] });
    const rn = spName(root);
    $('.pr-note', this.card).innerHTML = bigNoteHTML(rn);
    $('.pr-note', this.card).setAttribute('aria-label', spoken(rn));
    $('.pr-where', this.card).innerHTML = `<b>${iv.name}</b> ${up ? 'erboven' : 'eronder'}`;
    $('.pr-leds', this.card).hidden = true;
    this.card.classList.remove('hit');
    $('.pr-toast', this.card).textContent = Engine.mic ? `Speel eerst ${rn}` : 'Druk op Start en sta de microfoon toe.';
    this.renderSteps();
    drawNeck(this.svg, { from: 0, to: 12, marks: [] });
  },
  renderSteps() {
    const rn = spName(this.root);
    $('.pr-extra', this.card).innerHTML = `<div class="steps wide"><span class="step${this.phase !== 'root' ? ' done' : ' now'}">1 · ${rn}</span><span class="step${this.done ? ' done' : this.phase === 'target' ? ' now' : ''}">2 · ${this.done ? spName(this.target) : '?'}</span></div>`;
  },
  example() {
    // voorbeeldvorm op de hals: grondtoon en interval op naburige snaren
    const rootPc = spPc(this.root), semis = this.iv.semis;
    const order = this.up ? [5, 4, 3, 2, 1] : [0, 1, 2, 3, 4];
    for (const s of order) {
      for (let f = 1; f <= 10; f++) {
        if (mod12(OPEN[s] + f) !== rootPc) continue;
        const goal = OPEN[s] + f + (this.up ? semis : -semis);
        const cands = this.up ? [s - 1, s - 2] : [s + 1, s + 2];
        for (const t of cands) {
          if (t < 0 || t > 5) continue;
          const tf = goal - OPEN[t];
          if (tf >= 0 && tf <= 15 && Math.abs(tf - f) <= 4) return [{ s, f, kind: 'todo root', label: spName(this.root) }, { s: t, f: tf, kind: 'found', label: spName(this.target) }];
        }
      }
    }
    return [];
  },
  expected() {
    if (this.done) return [];
    if (this.phase === 'root') return [48 + spPc(this.root)];
    return [this.rootMidi + (this.up ? this.iv.semis : -this.iv.semis)];
  },
  hint() {
    if (this.done) return;
    this.hinted = true;
    this.marks = this.example();
    drawNeck(this.svg, { from: 0, to: 12, marks: this.marks });
    $('.pr-toast', this.card).textContent = `${spName(this.target)}. ${shapeText(this.iv.semis, this.up)}`;
  },
  onFrame(f, dt) { if (!this.done) this.elapsed += dt; },
  onNote(n) {
    if (this.done) return;
    const toast = $('.pr-toast', this.card);
    const heard = pcName(n.midi, Store.settings.names === 'flats' ? 'flats' : 'sharps');
    if (this.phase === 'root') {
      if (mod12(n.midi) !== spPc(this.root)) { toast.textContent = `Je speelde ${heard}. Begin met ${spName(this.root)}.`; return; }
      this.rootMidi = n.midi; this.phase = 'target';
      toast.textContent = `Nu de ${this.iv.name} ${this.up ? 'erboven' : 'eronder'}`;
      this.renderSteps();
      return;
    }
    const want = this.rootMidi + (this.up ? this.iv.semis : -this.iv.semis);
    const octave = this.iv.semis === 12;
    if (!octave && mod12(n.midi) === spPc(this.root)) return;   // grondtoon klinkt nog
    const ok = Store.settings.strict || octave ? n.midi === want : mod12(n.midi) === mod12(want);
    if (!ok) { toast.textContent = `Je speelde ${heard}. Dat is niet de ${this.iv.name}.`; return; }
    this.done = true;
    const st = Store.stats.intervals; st.n++; st.total += this.elapsed; Store.saveStats();
    this.card.classList.add('hit');
    toast.textContent = `Goed! ${spName(this.root)} → ${spName(this.target)} · ${this.iv.name}, ${this.iv.semis} halve ${this.iv.semis === 1 ? 'toon' : 'tonen'}`;
    this.renderSteps();
    this.marks = this.example();
    drawNeck(this.svg, { from: 0, to: 12, marks: this.marks });
    this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.next(), 2200);
  },
  renderStats() {
    const st = Store.stats.intervals;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Goed', value: String(st.n) }, { label: 'Gemiddeld', value: st.n ? sec(st.total / st.n) : '–' }]));
  },
});

// ---------- Trappen in een toonsoort ----------
registerMode({
  id: 'degrees', group: 'hals', title: 'Trappen', desc: 'Speel trap 1 tot 7 in een toonsoort',
  homeStat: st => (st.degrees.n ? `${st.degrees.n} goed · gemiddeld ${fmt1(st.degrees.total / st.degrees.n)} s` : ''),
  mount(view) {
    this.card = promptCard('Toonsoort');
    const s = Store.settings.degrees;
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { text: 'De gevulde stippen zijn de grondtoon (trap 1)' }),
      actions: [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.advance(true) }],
      options: [
        field('Soort', seg([{ value: 'major', label: 'majeur' }, { value: 'minor', label: 'mineur' }], s.quality, v => { s.quality = v; Store.saveSettings(); this.newKey(); })),
        field('Toonsoorten', seg([{ value: 'easy', label: 'tot 2 ♯/♭' }, { value: 'all', label: 'alle' }], s.keys, v => { s.keys = v; Store.saveSettings(); this.newKey(); })),
        field('Ronde', checkEl('stay', 'Blijf 7 vragen in dezelfde toonsoort', s.stay, v => { s.stay = v; Store.saveSettings(); })),
      ],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.key = null;
    this.newKey();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); },
  newKey() {
    const s = Store.settings.degrees;
    const list = s.quality === 'major' ? (s.keys === 'easy' ? MAJOR_EASY : MAJOR_KEYS) : (s.keys === 'easy' ? MINOR_EASY : MINOR_KEYS);
    let k = pick(list);
    if (list.length > 1) while (k === this.key) k = pick(list);
    this.key = k;
    this.tones = scaleTones(s.quality === 'major' ? 'major' : 'minor', k);
    this.queue = shuffle([2, 3, 4, 5, 6, 7, 1]);
    this.deg = null;
    this.advance();
  },
  advance() {
    clearTimeout(this.timer);
    const s = Store.settings.degrees;
    if (this.deg != null && (!s.stay || !this.queue.length)) return this.newKey();
    if (!this.queue.length) return this.newKey();
    this.deg = this.queue.shift();
    this.elapsed = 0; this.done = false; this.hinted = false;
    const s2 = Store.settings.degrees;
    const qual = s2.quality === 'major' ? 'majeur' : 'mineur';
    $('.pr-eyebrow', this.card).textContent = `In ${this.key} ${qual}`;
    $('.pr-note', this.card).innerHTML = `<span class="deg">trap ${this.deg}</span>`;
    $('.pr-note', this.card).setAttribute('aria-label', `trap ${this.deg}`);
    const fns = s2.quality === 'major' ? DEGREE_FN_MAJOR : DEGREE_FN_MINOR;
    $('.pr-where', this.card).innerHTML = `<span class="muted">${fns[this.deg - 1]}</span>${s2.stay ? `<small>${7 - this.queue.length}/7</small>` : ''}`;
    $('.pr-leds', this.card).hidden = true;
    $('.pr-extra', this.card).innerHTML = '';
    this.card.classList.remove('hit');
    $('.pr-toast', this.card).textContent = Engine.mic ? '' : 'Druk op Start en sta de microfoon toe.';
    this.draw([]);
  },
  draw(extra) {
    const S = Store.settings, rootPc = this.tones[0].pc, marks = [];
    for (const s of S.strings) for (let f = S.minFret; f <= S.maxFret; f++) if (mod12(OPEN[s] + f) === rootPc) marks.push({ s, f, kind: 'todo root', label: '1' });
    drawNeck(this.svg, { from: 0, to: Math.max(12, S.maxFret), marks: marks.concat(extra || []), range: { min: S.minFret, max: S.maxFret } });
  },
  targetMarks(kind) {
    const S = Store.settings, t = this.tones[this.deg - 1], out = [];
    for (const s of S.strings) for (let f = S.minFret; f <= S.maxFret; f++) if (mod12(OPEN[s] + f) === t.pc) out.push({ s, f, kind, label: t.name });
    return out;
  },
  expected() { return this.done ? [] : [48 + this.tones[this.deg - 1].pc]; },
  hint() {
    if (this.done) return;
    this.hinted = true;
    this.draw(this.targetMarks('hint'));
    $('.pr-toast', this.card).textContent = `Trap ${this.deg} in ${this.key} is ${this.tones[this.deg - 1].name}`;
  },
  onFrame(f, dt) { if (!this.done) this.elapsed += dt; },
  onNote(n) {
    if (this.done) return;
    const t = this.tones[this.deg - 1];
    if (mod12(n.midi) !== t.pc) { $('.pr-toast', this.card).textContent = `Je speelde ${pcName(n.midi, Store.settings.names === 'flats' ? 'flats' : 'sharps')}. Dat is niet trap ${this.deg}.`; return; }
    this.done = true;
    const st = Store.stats.degrees; st.n++; st.total += this.elapsed; Store.saveStats();
    this.card.classList.add('hit');
    $('.pr-toast', this.card).textContent = `Goed! Trap ${this.deg} in ${this.key} = ${t.name}`;
    $('.pr-extra', this.card).innerHTML = `<div class="scale-line">${this.tones.map((x, i) => `<span class="${i === this.deg - 1 ? 'on' : ''}"><small>${i + 1}</small>${x.name}</span>`).join('')}</div>`;
    this.draw(this.targetMarks('found'));
    this.renderStats();
    Engine.ding();
    this.timer = setTimeout(() => this.advance(false), 1800);
  },
  renderStats() {
    const st = Store.stats.degrees;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Goed', value: String(st.n) }, { label: 'Gemiddeld', value: st.n ? sec(st.total / st.n) : '–' }]));
  },
});
