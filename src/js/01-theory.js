// ---------- Muziektheorie ----------
const OPEN = [64, 59, 55, 50, 45, 40];              // snaar 1 (hoge E) t/m 6 (lage E), MIDI
const STR_LETTER = ['e', 'B', 'G', 'D', 'A', 'E'];
const STR_NAME = ['hoge E-snaar', 'B-snaar', 'G-snaar', 'D-snaar', 'A-snaar', 'lage E-snaar'];
const GAUGE = [10, 13, 17, 26, 36, 46];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11]);
const ACC_SYM = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
const MAX_FRET = 19;

const mod12 = n => ((n % 12) + 12) % 12;
const octaveOf = midi => Math.floor(midi / 12) - 1;
const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

function pcName(pc, pref) {
  pc = mod12(pc);
  if (NATURAL.has(pc) || pref === 'sharps' || !pref) return SHARP_NAMES[pc];
  if (pref === 'flats') return FLAT_NAMES[pc];
  return Math.random() < 0.5 ? SHARP_NAMES[pc] : FLAT_NAMES[pc];
}
const pcLabel = (pc, pref) => {
  pc = mod12(pc);
  if (NATURAL.has(pc)) return SHARP_NAMES[pc];
  return pref === 'flats' ? FLAT_NAMES[pc] : pref === 'both' ? `${SHARP_NAMES[pc]}/${FLAT_NAMES[pc]}` : SHARP_NAMES[pc];
};

// Gespelde noot: {li: letterindex 0..6, acc: -2..2}
const spPc = sp => mod12(LETTER_PC[sp.li] + sp.acc);
const spName = sp => LETTERS[sp.li] + (ACC_SYM[sp.acc] ?? '');
function parseName(name) {
  const li = LETTERS.indexOf(name[0]);
  const a = name.slice(1);
  const acc = a === '♯' ? 1 : a === '♭' ? -1 : a === '𝄪' ? 2 : a === '𝄫' ? -2 : 0;
  return { li, acc };
}
function spellFrom(root, steps, semis) {
  const li = (((root.li + steps) % 7) + 7) % 7;
  const target = mod12(spPc(root) + semis);
  let acc = target - LETTER_PC[li];
  acc = mod12(acc + 6) - 6;
  return { li, acc };
}
// eenvoudige spelling: hooguit één ♯/♭ en geen E♯, B♯, F♭, C♭
const isSimple = sp => Math.abs(sp.acc) <= 1 && !(sp.acc === 1 && (sp.li === 2 || sp.li === 6)) && !(sp.acc === -1 && (sp.li === 3 || sp.li === 0));

const DG = (steps, semis, label) => ({ steps, semis, label });

const SCALES = {
  minpent: { name: 'Mineur pentatonisch', short: 'mineur pentatonisch', degs: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(3, 5, '4'), DG(4, 7, '5'), DG(6, 10, '♭7')], perString: 2, minorish: true },
  majpent: { name: 'Majeur pentatonisch', short: 'majeur pentatonisch', degs: [DG(0, 0, 'R'), DG(1, 2, '2'), DG(2, 4, '3'), DG(4, 7, '5'), DG(5, 9, '6')], perString: 2 },
  blues: { name: 'Blues', short: 'blues', degs: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(3, 5, '4'), DG(4, 6, '♭5'), DG(4, 7, '5'), DG(6, 10, '♭7')], base: 'minpent', minorish: true },
  major: { name: 'Majeur (ionisch)', short: 'majeur', degs: [DG(0, 0, 'R'), DG(1, 2, '2'), DG(2, 4, '3'), DG(3, 5, '4'), DG(4, 7, '5'), DG(5, 9, '6'), DG(6, 11, '7')], perString: 3 },
  minor: { name: 'Mineur (eolisch)', short: 'mineur', degs: [DG(0, 0, 'R'), DG(1, 2, '2'), DG(2, 3, '♭3'), DG(3, 5, '4'), DG(4, 7, '5'), DG(5, 8, '♭6'), DG(6, 10, '♭7')], perString: 3, minorish: true },
  dorian: { name: 'Dorisch', short: 'dorisch', degs: [DG(0, 0, 'R'), DG(1, 2, '2'), DG(2, 3, '♭3'), DG(3, 5, '4'), DG(4, 7, '5'), DG(5, 9, '6'), DG(6, 10, '♭7')], perString: 3, minorish: true },
  mixo: { name: 'Mixolydisch', short: 'mixolydisch', degs: [DG(0, 0, 'R'), DG(1, 2, '2'), DG(2, 4, '3'), DG(3, 5, '4'), DG(4, 7, '5'), DG(5, 9, '6'), DG(6, 10, '♭7')], perString: 3 },
};
const MINOR_ROOTS = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D', 'G', 'C', 'F', 'B♭', 'E♭'];
const MAJOR_ROOTS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭'];
const rootsFor = scaleId => (SCALES[scaleId].minorish ? MINOR_ROOTS : MAJOR_ROOTS);

function scaleTones(scaleId, rootName) {
  const root = parseName(rootName);
  return SCALES[scaleId].degs.map(d => {
    const sp = spellFrom(root, d.steps, d.semis);
    return { pc: spPc(sp), name: spName(sp), label: d.label, semis: d.semis };
  });
}

// Box/positie: opeenvolgende toonladdertonen, 2 (pentatonisch) of 3 (diatonisch) per snaar,
// beginnend op de lage E bij de (box-1)e toon boven de grondtoon.
function scaleBox(scaleId, rootName, box) {
  const sc = SCALES[scaleId];
  const baseId = sc.base || scaleId;
  const base = SCALES[baseId];
  const tones = scaleTones(baseId, rootName);
  const n = tones.length;
  const rootPc = tones[0].pc;
  const rf = mod12(rootPc - 4);                       // grondtoon op de lage E (open E = pc 4)
  let k = (box - 1) % n;
  let midi = OPEN[5] + rf + base.degs[k].semis;
  if (midi - OPEN[5] > 12) midi -= 12;
  const pos = [];
  for (let s = 5; s >= 0; s--) {
    for (let j = 0; j < base.perString; j++) {
      const t = tones[k];
      pos.push({ s, f: midi - OPEN[s], midi, pc: t.pc, name: t.name, label: t.label });
      const cur = base.degs[k].semis;
      k = (k + 1) % n;
      const next = base.degs[k].semis;
      midi += mod12(next - cur) || 12;
    }
  }
  if (pos.some(p => p.f < 0)) for (const p of pos) { p.midi += 12; p.f += 12; }   // past niet in open positie: octaaf hoger
  if (sc.base) {
    // blues: voeg de ♭5 toe binnen het bereik van de box
    const all = scaleTones(scaleId, rootName);
    const extra = all.filter(t => !tones.some(b => b.pc === t.pc));
    const lo = Math.min(...pos.map(p => p.f)), hi = Math.max(...pos.map(p => p.f));
    for (const t of extra) {
      for (let s = 0; s < 6; s++) {
        for (let f = lo; f <= hi; f++) {
          if (mod12(OPEN[s] + f) === t.pc) pos.push({ s, f, midi: OPEN[s] + f, pc: t.pc, name: t.name, label: t.label });
        }
      }
    }
  }
  pos.sort((a, b) => a.midi - b.midi || b.s - a.s);
  // dubbele toonhoogtes (zelfde noot op twee snaren) houden we maar één keer: de eerste
  const out = [];
  for (const p of pos) if (!out.some(q => q.midi === p.midi)) out.push(p);
  return out;
}
const boxCount = scaleId => SCALES[SCALES[scaleId].base || scaleId].degs.length;

const CHORDS = {
  maj: { sym: '', name: 'majeur', tones: [DG(0, 0, 'R'), DG(2, 4, '3'), DG(4, 7, '5')] },
  min: { sym: 'm', name: 'mineur', tones: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(4, 7, '5')] },
  dom7: { sym: '7', name: 'dominant 7', tones: [DG(0, 0, 'R'), DG(2, 4, '3'), DG(4, 7, '5'), DG(6, 10, '♭7')] },
  maj7: { sym: 'maj7', name: 'groot 7', tones: [DG(0, 0, 'R'), DG(2, 4, '3'), DG(4, 7, '5'), DG(6, 11, '7')] },
  m7: { sym: 'm7', name: 'mineur 7', tones: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(4, 7, '5'), DG(6, 10, '♭7')] },
  m7b5: { sym: 'm7♭5', name: 'half-verminderd', tones: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(4, 6, '♭5'), DG(6, 10, '♭7')] },
  dim: { sym: '°', name: 'verminderd', tones: [DG(0, 0, 'R'), DG(2, 3, '♭3'), DG(4, 6, '♭5')] },
  sus4: { sym: 'sus4', name: 'sus4', tones: [DG(0, 0, 'R'), DG(3, 5, '4'), DG(4, 7, '5')] },
};
const CHORD_ROOTS = ['C', 'C♯', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
function chordTones(type, rootName) {
  const root = parseName(rootName);
  return CHORDS[type].tones.map(d => {
    const sp = spellFrom(root, d.steps, d.semis);
    return { pc: spPc(sp), name: spName(sp), label: d.label, simple: isSimple(sp) };
  });
}
const chordOk = (type, rootName) => isSimple(parseName(rootName)) && chordTones(type, rootName).every(t => t.simple);

const INTERVALS = [
  { semis: 1, steps: 1, name: 'kleine secunde', short: 'k2' },
  { semis: 2, steps: 1, name: 'grote secunde', short: 'g2' },
  { semis: 3, steps: 2, name: 'kleine terts', short: 'k3' },
  { semis: 4, steps: 2, name: 'grote terts', short: 'g3' },
  { semis: 5, steps: 3, name: 'reine kwart', short: '4' },
  { semis: 6, steps: 3, name: 'tritonus', short: 'tt' },
  { semis: 7, steps: 4, name: 'reine kwint', short: '5' },
  { semis: 8, steps: 5, name: 'kleine sext', short: 'k6' },
  { semis: 9, steps: 5, name: 'grote sext', short: 'g6' },
  { semis: 10, steps: 6, name: 'kleine septiem', short: 'k7' },
  { semis: 11, steps: 6, name: 'grote septiem', short: 'g7' },
  { semis: 12, steps: 7, name: 'octaaf', short: '8' },
];
const fretWord = n => (Math.abs(n) === 1 ? 'fret' : 'frets');
function shapeText(semis, up) {
  // vorm op de hals, van een snaar naar de volgende hogere (omhoog) of lagere (omlaag) snaar
  const sign = up ? 1 : -1;
  const move = d => (d === 0 ? 'zelfde fret' : d > 0 ? `${d} ${fretWord(d)} verder` : `${-d} ${fretWord(d)} terug`);
  if (semis === 12) {
    return up ? 'Twee snaren hoger, 2 frets verder. Ga je over de B-snaar heen, dan 3 frets verder.'
      : 'Twee snaren lager, 2 frets terug. Ga je over de B-snaar heen, dan 3 frets terug.';
  }
  const d = sign * (semis - 5), dgb = sign * (semis - 4);
  let t = `${up ? 'Eén snaar hoger' : 'Eén snaar lager'}: ${move(d)}. Tussen G- en B-snaar: ${move(dgb)}.`;
  if (semis <= 5) t = `Op dezelfde snaar: ${semis} ${fretWord(semis)} ${up ? 'verder' : 'terug'}. ` + t;
  return t;
}

const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭'];
const MAJOR_EASY = ['C', 'G', 'D', 'F', 'B♭'];
const MINOR_KEYS = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D', 'G', 'C', 'F', 'B♭', 'E♭'];
const MINOR_EASY = ['A', 'E', 'B', 'D', 'G'];
const DEGREE_FN_MAJOR = ['tonica', 'supertonica', 'mediant', 'subdominant', 'dominant', 'submediant', 'leidtoon'];
const DEGREE_FN_MINOR = ['tonica', 'supertonica', 'mediant', 'subdominant', 'dominant', 'submediant', 'subtonica'];

// ---------- Hulpjes ----------
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt1 = s => s.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
