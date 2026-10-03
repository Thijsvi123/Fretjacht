// ---------- Opslag ----------
const DEFAULT_SETTINGS = {
  gateDb: -48, strict: false, sound: true, haptics: true, names: 'sharps', goal: 15, cantPlayUntil: 0,
  strings: [0, 1, 2, 3, 4, 5], minFret: 0, maxFret: 12, naturalsOnly: false, autoHint: 0,
  positions: { order: 'up' },
  intervals: { set: [3, 4, 5, 7, 10, 12], dir: 'up', naturalRoots: true },
  degrees: { quality: 'major', keys: 'easy', stay: true },
  scales: { scale: 'minpent', root: 'A', box: 1, order: 'up', labels: 'names' },
  chords: { types: ['maj', 'min', 'dom7', 'm7', 'maj7'], show: false },
  bends: { semis: 2, tol: 15 },
  ear: { level: 1, key: 'minpent-A', help: true, slow: false },
  metro: { bpm: 80, beats: 4, accent: true, onbeat: false, phones: false, corr: 0 },
  explorer: { root: 'A', kind: 'scale', scale: 'minpent', chord: 'm7', labels: 'names', range: 'low' },
  targets: { prog: 'blues', key: 'A', target: '3', tempo: 0, show: true },
  earq: { kind: 'iv', ivs: [3, 4, 5, 7, 12], dir: 'up', chords: ['maj', 'min', 'dom7'] },
  noteq: { kind: 'name', strings: [5, 4, 3, 2, 1, 0], nat: true, to: 12 },
};
const DEFAULT_STATS = () => ({
  notes: { items: {}, found: 0, totalTime: 0, best: null, streak: 0, bestStreak: 0 },
  challenge: { best: 0, runs: 0, last: 0 },
  positions: { done: 0, best: null },
  intervals: { n: 0, total: 0 },
  degrees: { n: 0, total: 0 },
  scales: { runs: 0, best: {} },
  chords: { n: 0, total: 0 },
  ear: { ok: {}, tries: {} },
  bends: { recent: [] },
  rhythm: { recent: [], sessions: 0 },
  xp: 0, days: {}, path: { nodes: {} }, badges: {}, bin: [], binCleared: 0, srsDone: 0, modeDays: {}, bestCombo: 0,
  fb: { items: {}, found: 0, n: 0, ok: 0, best: 0 },
  topics: {}, skills: {}, freezes: 0, frozen: {},
  targets: { hits: 0, tries: 0, time: 0, near: 0, best: 0, by: {} },
  earq: { ok: {}, n: {} },
});
function deepMerge(base, over) {
  if (base === null) return over === undefined ? null : over;
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = deepMerge(base[k], over && typeof over === 'object' ? over[k] : undefined);
    if (over && typeof over === 'object') for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
    return out;
  }
  return over === undefined || over === null || typeof over !== typeof base ? base : over;
}
const Store = {
  get(k, d) { try { const v = localStorage.getItem('fretjacht.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  put(k, v) { try { localStorage.setItem('fretjacht.' + k, JSON.stringify(v)); } catch (e) {} },
  settings: null, stats: null,
  load() {
    this.settings = deepMerge(DEFAULT_SETTINGS, this.get('settings', {}));
    const s = this.settings;
    s.strings = (s.strings || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 5);
    if (!s.strings.length) s.strings = [0, 1, 2, 3, 4, 5];
    s.minFret = clamp(s.minFret | 0, 0, MAX_FRET - 1);
    s.maxFret = clamp(s.maxFret | 0, s.minFret + 1, MAX_FRET);
    s.gateDb = clamp(Number(s.gateDb) || -48, -70, -20);
    if (!['sharps', 'flats', 'both'].includes(s.names)) s.names = 'sharps';
    if (!SCALES[s.scales.scale]) s.scales.scale = 'minpent';
    if (!rootsFor(s.scales.scale).includes(s.scales.root)) s.scales.root = rootsFor(s.scales.scale)[0];
    s.scales.box = clamp(s.scales.box | 0, 1, boxCount(s.scales.scale));
    s.chords.types = s.chords.types.filter(t => CHORDS[t]);
    if (!s.chords.types.length) s.chords.types = ['maj', 'min'];
    s.intervals.set = s.intervals.set.filter(n => n >= 1 && n <= 12);
    if (!s.intervals.set.length) s.intervals.set = [7];
    s.ear.level = clamp(s.ear.level | 0, 1, 5);
    s.metro.bpm = clamp(s.metro.bpm | 0, 30, 240);
    if (![10, 15, 20, 30].includes(Number(s.goal))) s.goal = 15;
    s.earq.ivs = (s.earq.ivs || []).filter(n => n >= 1 && n <= 12);
    if (s.earq.ivs.length < 2) s.earq.ivs = [3, 4, 5, 7, 12];
    s.earq.chords = (s.earq.chords || []).filter(t => CHORDS[t]);
    if (s.earq.chords.length < 2) s.earq.chords = ['maj', 'min', 'dom7'];
    s.noteq.strings = (s.noteq.strings || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 5);
    if (!s.noteq.strings.length) s.noteq.strings = [5, 4, 3, 2, 1, 0];
    if (![5, 7, 12].includes(Number(s.noteq.to))) s.noteq.to = 12;
    if (!['name', 'find'].includes(s.noteq.kind)) s.noteq.kind = 'name';
    if (!SCALES[s.explorer.scale]) s.explorer.scale = 'minpent';
    if (!CHORDS[s.explorer.chord]) s.explorer.chord = 'm7';
    this.stats = deepMerge(DEFAULT_STATS(), this.get('stats', {}));
  },
  saveSettings() { this.put('settings', this.settings); },
  saveStats() { this.put('stats', this.stats); },
};
