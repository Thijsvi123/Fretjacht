// ---------- Gedeelde namen ----------
const DEG_NAME = { R: 'de grondtoon', '♭2': 'de kleine secunde', 2: 'de grote secunde', '♭3': 'de kleine terts', 3: 'de grote terts', 4: 'de kwart', '♭5': 'de verminderde kwint', 5: 'de kwint', '♭6': 'de kleine sext', 6: 'de grote sext', '♭7': 'de kleine septiem', 7: 'de grote septiem' };
const degName = label => DEG_NAME[label] || label;
const pcOfName = n => spPc(parseName(n));

// ---------- Halsverkenner ----------
const EXP_ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
function expRootName(kind, type, pc) {
  if (kind === 'scale') return rootsFor(type).find(x => pcOfName(x) === pc) || EXP_ROOTS[pc];
  return CHORD_ROOTS.find(x => pcOfName(x) === pc && chordOk(type, x)) || CHORD_ROOTS.find(x => pcOfName(x) === pc) || EXP_ROOTS[pc];
}
registerMode({
  id: 'explorer', group: 'handig', title: 'Halsverkenner', desc: 'Alle noten van een toonladder of akkoord op de hals',
  homeStat: () => MODES.explorer.label(),
  root() { const s = Store.settings.explorer; return expRootName(s.kind, s.kind === 'scale' ? s.scale : s.chord, pcOfName(s.root)); },
  tones() { const s = Store.settings.explorer; return s.kind === 'scale' ? scaleTones(s.scale, this.root()) : chordTones(s.chord, this.root()); },
  semis() { const s = Store.settings.explorer; return (s.kind === 'scale' ? SCALES[s.scale].degs : CHORDS[s.chord].tones).map(d => d.semis); },
  label() { const s = Store.settings.explorer, r = this.root(); return s.kind === 'scale' ? `${r} ${SCALES[s.scale].short}` : `${r}${CHORDS[s.chord].sym} (${r} ${CHORDS[s.chord].name})`; },
  range() { return Store.settings.explorer.range === 'high' ? [7, 19] : [0, 12]; },
  mount(view) {
    this.card = h('div', { class: 'card exp-card' });
    this.info = h('span', { class: 'exp-info', 'aria-live': 'polite', text: 'Tik op een noot om hem te horen.' });
    const tip = h('div', { class: 'card' }, h('h2', { class: 'card-h', text: 'Zo gebruik je hem' }),
      h('p', { class: 'help', text: 'Zoek eerst de grondtonen: dat zijn je ankers. Speel de toonladder rond één grondtoon en schuif dan naar de volgende. Bij improviseren klinken de grondtoon, de terts en de kwint het stevigst; daar kun je een zin goed op laten eindigen.' }));
    const L = exLayout(view, { prompt: this.card, mic: false, caption: this.info, actions: [{ id: 'playBtn', label: 'Speel af', cls: 'primary', key: 'p', onClick: () => this.playAll() }], stats: tip });
    this.svg = L.svg; this.keys = L.keys;
    this.svg.addEventListener('click', e => this.tap(e));
    this.renderControls();
    this.draw();
  },
  unmount() { (this.timers || []).forEach(clearTimeout); this.timers = []; },
  save() { Store.saveSettings(); this.renderControls(); this.draw(); },
  renderControls() {
    const s = Store.settings.explorer, rootPc = pcOfName(s.root);
    const roots = h('div', { class: 'seg exp-roots', role: 'group' }, EXP_ROOTS.map((n, pc) => h('button', { type: 'button', 'aria-pressed': String(pc === rootPc), text: n, onclick: () => { s.root = n; this.save(); } })));
    const typeSel = s.kind === 'scale'
      ? selectEl('expType', Object.keys(SCALES).map(k => ({ value: k, label: SCALES[k].name })), s.scale, v => { s.scale = v; this.save(); })
      : selectEl('expType', Object.keys(CHORDS).map(k => ({ value: k, label: `${CHORDS[k].name}${CHORDS[k].sym ? ` (${CHORDS[k].sym})` : ''}` })), s.chord, v => { s.chord = v; this.save(); });
    this.slots = h('div', { class: 'slots exp-slots' });
    this.card.innerHTML = '';
    this.card.append(
      h('div', { class: 'exp-head' }, h('div', { class: 'exp-fret', html: Mascot.svg('hals') }),
        h('div', { class: 'exp-titles' }, h('p', { class: 'eyebrow', text: s.kind === 'scale' ? 'Toonladder' : 'Akkoord' }), h('h2', { class: 'exp-title', text: this.label() }))),
      seg([{ value: 'scale', label: 'Toonladder' }, { value: 'chord', label: 'Akkoord' }], s.kind, v => { s.kind = v; this.save(); }, 'exp-kind'),
      field('Grondtoon', roots),
      field(s.kind === 'scale' ? 'Welke toonladder' : 'Welk akkoord', typeSel, null, 'expType'),
      h('div', { class: 'exp-row' },
        field('Op de stippen', seg([{ value: 'names', label: 'Namen' }, { value: 'degrees', label: 'Trappen' }], s.labels, v => { s.labels = v; this.save(); })),
        field('Stuk van de hals', seg([{ value: 'low', label: 'Fret 0–12' }, { value: 'high', label: 'Fret 7–19' }], s.range, v => { s.range = v; this.save(); }))),
      this.slots);
  },
  draw(hl) {
    const s = Store.settings.explorer, [from, to] = this.range(), tones = this.tones(), marks = [];
    for (let st = 0; st < 6; st++) for (let f = from; f <= to; f++) {
      const t = tones.find(x => x.pc === mod12(OPEN[st] + f));
      if (t) marks.push({ s: st, f, kind: 'ex' + (t.label === 'R' ? ' root' : '') + (hl && hl.s === st && hl.f === f ? ' hit' : ''), label: s.labels === 'names' ? t.name : t.label });
    }
    if (hl && !tones.find(x => x.pc === mod12(OPEN[hl.s] + hl.f))) marks.push({ s: hl.s, f: hl.f, kind: 'wrong', label: '' });
    drawNeck(this.svg, { from, to, marks, tap: true });
    this.slots.innerHTML = tones.map(t => `<span class="slot${t.label === 'R' ? ' on' : ''}"><small>${t.label}</small><b>${t.name}</b></span>`).join('');
  },
  tap(e) {
    const c = e.target.closest && e.target.closest('.cell');
    if (!c) return;
    const st = Number(c.dataset.s), f = Number(c.dataset.f), midi = OPEN[st] + f, pc = mod12(midi);
    const ctx = Engine.ensureCtx();
    Engine.pluck(midi, ctx.currentTime + 0.01, 1.3, 0.75);
    const t = this.tones().find(x => x.pc === pc), where = `op de ${STR_NAME[st]}${f ? `, fret ${f}` : ', los'}`;
    this.info.textContent = t ? `${t.name}, ${degName(t.label)}, ${where}` : `${pcName(pc, Store.settings.names === 'flats' ? 'flats' : 'sharps')} ${where}: hoort niet bij ${this.label()}`;
    this.draw({ s: st, f });
    clearTimeout(this.hlT); this.hlT = setTimeout(() => this.draw(), 900);
    Activity.ping();
  },
  // speel de toonladder op en neer (of het akkoord als arpeggio) en laat de stippen meelopen
  playAll() {
    (this.timers || []).forEach(clearTimeout); this.timers = [];
    const s = Store.settings.explorer, rootPc = pcOfName(this.root()), [from, to] = this.range();
    let root = 45 + mod12(rootPc - 9);   // vanaf A2
    if (from >= 7) root += 12;
    const up = this.semis().map(x => root + x).concat([root + 12]);
    const seq = s.kind === 'scale' ? up.concat(up.slice(0, -1).reverse()) : up;
    const step = s.kind === 'scale' ? 0.24 : 0.3;
    Engine.playPhrase(seq.map(m => ({ midi: m, dur: step })));
    if (s.kind === 'chord') {
      const ctx = Engine.ctx, t0 = ctx.currentTime + 0.1 + seq.length * step + 0.25;
      up.slice(0, -1).forEach((m, i) => Engine.pluck(m, t0 + i * 0.03, 1.4, 0.55));
    }
    let lastF = null;
    seq.forEach((m, i) => this.timers.push(setTimeout(() => {
      const opts = positionsOf(m, from, to);
      if (!opts.length) return;
      const p = lastF == null ? opts[opts.length - 1] : opts.reduce((a, b) => (Math.abs(b.f - lastF) < Math.abs(a.f - lastF) ? b : a));
      lastF = p.f;
      this.draw(p);
    }, 80 + i * step * 1000)));
    this.timers.push(setTimeout(() => this.draw(), 200 + seq.length * step * 1000 + 600));
    Activity.ping();
  },
});

// ---------- Doeltonen over akkoordwissels ----------
const PROGS = {
  blues: { name: '12-maten blues', keys: ['A', 'E', 'G', 'C', 'D'], bars: [[1, 'dom7'], [1, 'dom7'], [1, 'dom7'], [1, 'dom7'], [4, 'dom7'], [4, 'dom7'], [1, 'dom7'], [1, 'dom7'], [5, 'dom7'], [4, 'dom7'], [1, 'dom7'], [5, 'dom7']] },
  rock: { name: 'I, IV, V, IV', keys: ['G', 'D', 'A', 'E', 'C'], bars: [[1, 'maj'], [4, 'maj'], [5, 'maj'], [4, 'maj']] },
  pop: { name: 'I, V, vi, IV', keys: ['C', 'G', 'D', 'A'], bars: [[1, 'maj'], [5, 'maj'], [6, 'min'], [4, 'maj']] },
  jazz: { name: 'ii, V, I', keys: ['C', 'F', 'B♭', 'G'], bars: [[2, 'm7'], [5, 'dom7'], [1, 'maj7'], [1, 'maj7']] },
  mineur: { name: 'i, iv, v in mineur', keys: ['A', 'E', 'D', 'B'], minor: true, bars: [[1, 'min'], [4, 'min'], [5, 'min'], [1, 'min']] },
};
const TARGET_NAME = { R: 'grondtoon', 3: 'terts', 5: 'kwint', 7: 'septiem', mix: 'wisselende toon' };
const tgKey = label => (label === 'R' ? 'R' : label.replace(/[♭♯]/g, '')[0]);
registerMode({
  id: 'targets', group: 'solo', title: 'Doeltonen', desc: 'Speel op elk akkoord de terts, grondtoon, kwint of septiem',
  homeStat: st => (st.targets && st.targets.hits ? `${st.targets.hits} doeltonen geraakt` : ''),
  prog() { const s = Store.settings.targets; return PROGS[s.prog] || PROGS.blues; },
  key() { const s = Store.settings.targets, P = this.prog(); return P.keys.includes(s.key) ? s.key : P.keys[0]; },
  // in je eigen tempo vallen herhalingen van hetzelfde akkoord samen
  steps() {
    const P = this.prog(), tempo = Store.settings.targets.tempo > 0;
    return tempo ? P.bars.slice() : P.bars.filter((b, i, a) => i === 0 || b[0] !== a[i - 1][0] || b[1] !== a[i - 1][1]);
  },
  mount(view) {
    const s = Store.settings.targets;
    this.card = promptCard('Doeltoon');
    this.statsEl = h('div', { class: 'card' });
    const tempo = s.tempo > 0;
    const L = exLayout(view, {
      prompt: this.card,
      caption: h('span', { class: 'neck-legend', html: 'De oranje stippen zijn je doeltoon, de witte de andere akkoordtonen.' }),
      actions: tempo ? [{ id: 'tgGo', label: 'Speel mee', cls: 'primary', onClick: () => (this.running ? this.stopTempo() : this.startTempo()) }, { id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }]
        : [{ id: 'hintBtn', label: 'Hint', key: 'h', onClick: () => this.hint() }, { id: 'skipBtn', label: 'Overslaan', key: 's', onClick: () => this.skip() }],
      options: [
        field('Akkoordenreeks', selectEl('tgProg', Object.keys(PROGS).map(k => ({ value: k, label: PROGS[k].name })), s.prog, v => { s.prog = v; s.key = PROGS[v].keys[0]; Store.saveSettings(); Router.render(); }), null, 'tgProg'),
        field('Toonsoort', seg(this.prog().keys.map(k => ({ value: k, label: k + (this.prog().minor ? 'm' : '') })), this.key(), v => { s.key = v; Store.saveSettings(); this.restart(); })),
        field('Doeltoon', seg(['R', '3', '5', '7', 'mix'].map(k => ({ value: k, label: k === 'mix' ? 'Wisselend' : TARGET_NAME[k][0].toUpperCase() + TARGET_NAME[k].slice(1) })), s.target, v => { s.target = v; Store.saveSettings(); this.restart(); }), 'Op een akkoord zonder septiem speel je dan de terts.'),
        field('Tempo', seg([{ value: 0, label: 'Eigen tempo' }, { value: 60, label: '60' }, { value: 80, label: '80' }, { value: 100, label: '100' }], s.tempo, v => { s.tempo = Number(v); Store.saveSettings(); Router.render(); }), 'Met tempo wisselt het akkoord elke maat van vier tellen.'),
        field('Hulp op de hals', seg([{ value: 'all', label: 'Alle akkoordtonen' }, { value: 'roots', label: 'Grondtonen' }, { value: 'none', label: 'Niets' }], s.help || 'all', v => { s.help = v; Store.saveSettings(); this.drawNeck(); })),
        field('Akkoord', checkEl('tgStrum', 'Laat het akkoord klinken bij elke wissel', s.strum !== false, v => { s.strum = v; Store.saveSettings(); })),
      ],
      optSummary: `${this.prog().name} in ${this.key()}${this.prog().minor ? ' mineur' : ''}`,
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    L.wrap.classList.toggle('mode-targets-own', !tempo);
    this.restart();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); this.stopTempo(); },
  restart() {
    clearTimeout(this.timer); this.stopTempo();
    this.idx = -1; this.last = null; this.streak = 0;
    if (Store.settings.targets.tempo > 0) {
      this.target = null; this.chord = null;
      $('.pr-note', this.card).innerHTML = '<span class="deg">Klaar?</span>';
      $('.pr-where', this.card).innerHTML = `Druk op Speel mee. Elke maat van vier tellen komt er een nieuw akkoord.`;
      $('.pr-toast', this.card).textContent = Engine.mic ? '' : 'Zet ook de microfoon aan.';
      this.renderProg(); this.drawNeck(); setLeds(this.card, 0);
    } else this.next();
  },
  next() {
    clearTimeout(this.timer);
    const s = Store.settings.targets, steps = this.steps(), P = this.prog();
    this.idx = (this.idx + 1) % steps.length;
    const [deg, type] = steps[this.idx];
    const root = scaleTones(P.minor ? 'minor' : 'major', this.key())[deg - 1].name;
    const tones = chordTones(type, root);
    let want = s.target === 'mix' ? pick(tones.map(t => tgKey(t.label)).filter(k => k !== (this.want || ''))) : s.target;
    let tone = tones.find(t => tgKey(t.label) === want);
    this.no7 = false;
    if (!tone) { this.no7 = true; want = '3'; tone = tones.find(t => tgKey(t.label) === '3'); }
    this.chord = { root, type, tones, name: chordName(root, type) };
    this.want = want; this.target = tone; this.hit = false; this.hinted = false; this.t0 = performance.now();
    const st = Store.stats.targets; st.tries++; st.by[want] = st.by[want] || { h: 0, t: 0 }; st.by[want].t++;
    Store.saveStats();
    this.card.classList.remove('hit', 'miss');
    $('.pr-eyebrow', this.card).textContent = `${P.name} in ${this.key()}${P.minor ? ' mineur' : ''}`;
    $('.pr-note', this.card).innerHTML = `${bigNoteHTML(root)}<span class="sym">${CHORDS[type].sym}</span>`;
    $('.pr-note', this.card).setAttribute('aria-label', `${spoken(root)} ${CHORDS[type].name}`);
    this.renderWhere();
    $('.pr-toast', this.card).textContent = this.no7 ? `${this.chord.name} heeft geen septiem: speel de terts.` : Engine.mic ? '' : 'Druk op Start en sta de microfoon toe.';
    this.renderProg(); this.drawNeck();
    if (s.strum !== false) this.strum();
  },
  renderWhere() {
    const s = Store.settings.targets, show = (s.help || 'all') !== 'none' || this.hinted || this.hit;
    $('.pr-where', this.card).innerHTML = `Speel de <b>${TARGET_NAME[this.want]}</b>${show ? `: <b>${this.target.name}</b>` : ''}`;
  },
  renderProg() {
    const P = this.prog(), steps = this.steps(), key = this.key();
    const names = steps.map(([deg, type]) => chordName(scaleTones(P.minor ? 'minor' : 'major', key)[deg - 1].name, type));
    $('.pr-extra', this.card).innerHTML = `<div class="prog${steps.length > 6 ? ' long' : ''}">${names.map((n, i) => `<span class="${i === this.idx ? 'now' : i < this.idx ? 'past' : ''}">${n}</span>`).join('')}</div>`;
  },
  drawNeck(found) {
    if (!this.svg) return;
    if (!this.chord) { drawNeck(this.svg, { from: 0, to: 12, marks: [] }); return; }
    const help = Store.settings.targets.help || 'all', marks = [];
    for (let st = 0; st < 6; st++) for (let f = 0; f <= 12; f++) {
      const pc = mod12(OPEN[st] + f), t = this.chord.tones.find(x => x.pc === pc);
      if (!t) continue;
      const isT = pc === this.target.pc;
      if (found && isT) marks.push({ s: st, f, kind: 'found', label: t.label });
      else if (isT && (help === 'all' || this.hinted)) marks.push({ s: st, f, kind: 'next', label: t.label });
      else if (help === 'all' || (help === 'roots' && t.label === 'R')) marks.push({ s: st, f, kind: 'todo' + (t.label === 'R' ? ' root' : ''), label: t.label });
    }
    drawNeck(this.svg, { from: 0, to: 12, marks });
  },
  strum() {
    const ctx = Engine.ensureCtx(), root = 48 + mod12(pcOfName(this.chord.root) - 0);
    const midis = CHORDS[this.chord.type].tones.map(d => root + d.semis);
    midis.forEach((m, i) => Engine.pluck(m, ctx.currentTime + 0.03 + i * 0.03, 0.9, 0.42));
    Engine.block(650);
  },
  hint() { if (!this.target || this.hit) return; this.hinted = true; this.renderWhere(); this.drawNeck(); },
  skip() { if (Store.settings.targets.tempo > 0) return; this.streak = 0; this.next(); },
  expected() { return !this.target || this.hit ? [] : [48 + this.target.pc]; },
  onNote(n) {
    if (!this.target || this.hit) return;
    const pc = mod12(n.midi), toast = $('.pr-toast', this.card);
    if (pc === this.target.pc) {
      this.hit = true;
      const st = Store.stats.targets, secs = (performance.now() - this.t0) / 1000, near = this.last != null && Math.abs(n.midi - this.last) <= 2;
      this.last = n.midi; this.streak++;
      st.hits++; st.time += secs; if (near) st.near++; st.best = Math.max(st.best || 0, this.streak); st.by[this.want].h++;
      Store.saveStats();
      Quests.bump('targets');
      this.card.classList.remove('miss'); this.card.classList.add('hit');
      toast.textContent = near ? 'Raak, en een kleine stap vanaf de vorige. Zo klinkt een solo melodisch.' : `Raak! ${fmt1(secs)} s`;
      this.renderWhere(); this.drawNeck(true); this.renderStats();
      Engine.ding();
      if (!(Store.settings.targets.tempo > 0)) this.timer = setTimeout(() => this.next(), 1100);
      return;
    }
    const t = this.chord.tones.find(x => x.pc === pc), heard = pcName(pc, Store.settings.names === 'flats' ? 'flats' : 'sharps');
    toast.textContent = t ? `${t.name} is ${degName(t.label)} van ${this.chord.name}. Zoek de ${TARGET_NAME[this.want]}.` : `${heard} zit niet in ${this.chord.name}.`;
  },
  startTempo() {
    const s = Store.settings.targets;
    if (!Engine.mic) Engine.startMic();
    this.idx = -1; this.running = true; this.started = false;
    Metronome.bpm = s.tempo; Metronome.beats = 4; Metronome.accent = true;
    Metronome.onBeat = i => this.beat(i);
    Metronome.start();
    const b = $('#tgGo'); if (b) { b.textContent = 'Pauze'; b.classList.add('stop'); }
  },
  stopTempo() {
    if (!this.running) return;
    this.running = false;
    Metronome.stop(); Metronome.onBeat = null;
    const b = $('#tgGo'); if (b) { b.textContent = 'Speel mee'; b.classList.remove('stop'); }
  },
  beat(i) {
    if (!this.running) return;
    if (i === 0) {
      const missed = this.started && !this.hit;
      const msg = missed ? `Te laat: de ${TARGET_NAME[this.want]} van ${this.chord.name} was ${this.target.name}.` : '';
      if (missed) this.streak = 0;
      this.started = true;
      this.next();
      if (missed) { this.card.classList.add('miss'); $('.pr-toast', this.card).textContent = msg; }
    }
    setLeds(this.card, (i + 1) / 4);
  },
  renderStats() {
    const st = Store.stats.targets;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('h2', { class: 'card-h', text: 'Scores' }), statFigs([
      { label: 'Geraakt', value: String(st.hits) },
      { label: 'Raak', value: st.tries ? `${Math.round(100 * st.hits / st.tries)}<small>%</small>` : '–' },
      { label: 'Gemiddeld', value: st.hits ? sec(st.time / st.hits) : '–' },
      { label: 'Kleine stappen', value: String(st.near || 0) },
    ]));
  },
});

// ---------- Gehoortraining zonder gitaar ----------
const IV_HINT = { 1: 'het thema van Jaws', 2: 'Vader Jacob', 3: 'de riff van Smoke on the Water', 4: 'When the Saints Go Marching In', 5: 'het begin van het Wilhelmus', 6: 'de tune van The Simpsons', 7: 'Star Wars, of Altijd is Kortjakje ziek', 9: 'My Bonnie Lies over the Ocean', 10: 'Somewhere uit West Side Story', 12: 'Somewhere over the Rainbow' };
const CHORD_FEEL = { maj: 'helder en open', min: 'donker en weemoedig', dom7: 'bluesy: hij wil verder', maj7: 'zacht en dromerig', m7: 'zacht en soulvol', m7b5: 'donker en gespannen', dim: 'gespannen en onrustig', sus4: 'zwevend: hij wil oplossen' };
const earName = k => (k.startsWith('iv-') ? (INTERVALS.find(i => i.semis === Number(k.slice(3))) || {}).name || k : CHORDS[k.slice(3)] ? CHORDS[k.slice(3)].name : k);
registerMode({
  id: 'earq', group: 'gehoor', title: 'Gehoortraining', desc: 'Intervallen en akkoorden herkennen, zonder gitaar', noMic: true,
  homeStat: st => { const n = Object.values(st.earq.n).reduce((a, b) => a + b, 0), ok = Object.values(st.earq.ok).reduce((a, b) => a + b, 0); return n ? `${ok} van ${n} goed` : ''; },
  mount(view) {
    const s = Store.settings.earq;
    this.card = h('div', { class: 'card prompt eq-card' });
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card, neck: false, mic: false,
      actions: [{ id: 'replayBtn', label: 'Nog een keer', key: 'r', onClick: () => this.play() }, { id: 'nextBtn', label: 'Volgende', key: 'n', onClick: () => this.next() }],
      options: [
        field('Intervallen', chips(INTERVALS.map(i => ({ value: i.semis, label: i.name })), s.ivs.map(String), v => { s.ivs = v.map(Number).sort((a, b) => a - b); Store.saveSettings(); }, 2)),
        field('Richting', seg([{ value: 'up', label: 'Omhoog' }, { value: 'down', label: 'Omlaag' }, { value: 'both', label: 'Beide' }, { value: 'harm', label: 'Tegelijk' }], s.dir, v => { s.dir = v; Store.saveSettings(); })),
        field('Akkoorden', chips(Object.keys(CHORDS).map(k => ({ value: k, label: CHORDS[k].name })), s.chords, v => { s.chords = v; Store.saveSettings(); }, 2)),
      ],
      optSummary: s.kind === 'iv' ? `${s.ivs.length} intervallen` : `${s.chords.length} akkoordsoorten`,
      stats: this.statsEl,
    });
    this.keys = L.keys;
    this.renderShell();
    this.next();
  },
  unmount() { clearTimeout(this.timer); },
  renderShell() {
    const s = Store.settings.earq;
    this.card.innerHTML = '';
    this.optsEl = h('div', { class: 'ls-opts eq-opts' });
    this.fbEl = h('div', { class: 'eq-fb', 'aria-live': 'polite' });
    this.card.append(
      seg([{ value: 'iv', label: 'Intervallen' }, { value: 'ch', label: 'Akkoorden' }], s.kind, v => { s.kind = v; Store.saveSettings(); this.renderShell(); this.next(); }, 'eq-kind'),
      h('div', { class: 'eq-stage' },
        h('div', { class: 'eq-fret', html: Mascot.svg('luister') }),
        h('div', { class: 'eq-ask' },
          h('button', { class: 'eq-play', type: 'button', 'aria-label': 'Speel af', html: ICONS.play, onclick: () => this.play() }),
          this.askEl = h('p', { class: 'eq-q', text: s.kind === 'iv' ? 'Welk interval hoor je?' : 'Welk akkoord hoor je?' }))),
      this.optsEl, this.fbEl);
  },
  next() {
    clearTimeout(this.timer);
    const s = Store.settings.earq;
    let q;
    for (let i = 0; i < 20; i++) {
      if (s.kind === 'iv') {
        const semis = pick(s.ivs), dir = s.dir === 'both' ? pick(['up', 'down']) : s.dir;
        const base = dir === 'down' ? 55 + Math.floor(Math.random() * 10) : 47 + Math.floor(Math.random() * 12);
        q = { kind: 'iv', key: 'iv-' + semis, semis, dir, base };
      } else {
        const type = pick(s.chords);
        q = { kind: 'ch', key: 'ch-' + type, type, base: 48 + Math.floor(Math.random() * 8) };
      }
      if (!this.q || q.key !== this.q.key || i > 10) break;
    }
    this.q = q; this.answered = false;
    const opts = s.kind === 'iv' ? s.ivs.map(n => ({ key: 'iv-' + n, label: earName('iv-' + n) })) : s.chords.map(t => ({ key: 'ch-' + t, label: `${CHORDS[t].name}${CHORDS[t].sym ? ` (${CHORDS[t].sym})` : ''}` }));
    this.optsEl.innerHTML = '';
    this.optsEl.classList.toggle('grid2', opts.length > 3);
    opts.forEach(o => this.optsEl.append(h('button', { type: 'button', class: 'opt', 'data-k': o.key, text: o.label, onclick: () => this.answer(o.key) })));
    this.fbEl.innerHTML = '';
    this.fbEl.className = 'eq-fb';
    this.play();
  },
  // speelt de vraag (of ter vergelijking een ander antwoord) op dezelfde grondtoon
  play(key) {
    const q = this.q;
    if (!q) return;
    const ctx = Engine.ensureCtx(), t = ctx.currentTime + 0.05;
    const k = key || q.key;
    if (k.startsWith('iv-')) {
      const semis = Number(k.slice(3)), second = q.dir === 'down' ? q.base - semis : q.base + semis;
      Engine.pluck(q.base, t, 1.1, 0.7);
      Engine.pluck(second, q.dir === 'harm' ? t : t + 0.7, 1.3, 0.7);
    } else {
      const type = k.slice(3);
      CHORDS[type].tones.forEach((d, i) => Engine.pluck(q.base + d.semis, t + i * 0.035, 1.6, 0.55));
    }
    Engine.block(1800);
    Activity.ping();
  },
  answer(key) {
    if (this.answered || !this.q) return;
    this.answered = true;
    const q = this.q, ok = key === q.key, st = Store.stats.earq;
    st.n[q.key] = (st.n[q.key] || 0) + 1;
    if (ok) st.ok[q.key] = (st.ok[q.key] || 0) + 1;
    Store.saveStats();
    $$('.opt', this.optsEl).forEach(b => { b.disabled = true; b.classList.toggle('right', b.dataset.k === q.key); b.classList.toggle('wrong', b.dataset.k === key && !ok); if (b.dataset.k === q.key && ok) b.classList.add('pop'); });
    const hint = q.kind === 'iv' ? (IV_HINT[q.semis] ? `Geheugensteun: ${IV_HINT[q.semis]}.` : '') : `Klinkt ${CHORD_FEEL[q.type] || ''}.`;
    this.fbEl.className = 'eq-fb ' + (ok ? 'ok' : 'bad');
    this.fbEl.innerHTML = '';
    this.fbEl.append(h('p', {}, h('b', { text: ok ? pick(PRAISE) : `Het was ${q.kind === 'iv' ? 'een ' : ''}${earName(q.key)}.` }), ' ', hint));
    if (!ok) this.fbEl.append(h('div', { class: 'eq-cmp' },
      h('button', { type: 'button', text: `Hoor ${earName(key)}`, onclick: () => this.play(key) }),
      h('button', { type: 'button', class: 'primary', text: `Hoor ${earName(q.key)}`, onclick: () => this.play(q.key) })));
    if (ok) { Quests.bump('earq'); Sfx.play('right'); this.timer = setTimeout(() => this.next(), 1700); }
    else { Sfx.play('wrong'); this.shake(); }
    this.renderStats();
    Activity.ping();
  },
  shake() { const b = $('.opt.wrong', this.optsEl); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } },
  renderStats() {
    const s = Store.settings.earq, st = Store.stats.earq;
    const keys = s.kind === 'iv' ? s.ivs.map(n => 'iv-' + n) : s.chords.map(t => 'ch-' + t);
    const rows = keys.map(k => ({ k, n: st.n[k] || 0, ok: st.ok[k] || 0 })).sort((a, b) => (a.n ? a.ok / a.n : 2) - (b.n ? b.ok / b.n : 2));
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('h2', { class: 'card-h', text: s.kind === 'iv' ? 'Hoe goed herken je ze?' : 'Hoe goed herken je ze?' }),
      h('p', { class: 'help', text: 'Het lastigste staat bovenaan.' }),
      h('ul', { class: 'eq-list' }, rows.map(r => h('li', {}, h('span', { text: earName(r.k) }), h('span', { class: 'eq-bar' }, h('i', { style: `width:${r.n ? (100 * r.ok / r.n).toFixed(0) : 0}%` })), h('small', { text: r.n ? `${r.ok} van ${r.n}` : 'nog niet' })))));
  },
});
