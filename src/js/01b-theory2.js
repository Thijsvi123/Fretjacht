// ---------- Theorie: toonsoorten en akkoorden per trap ----------
const MAJOR_SIG = { 'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F♯': 6, 'F': -1, 'B♭': -2, 'E♭': -3, 'A♭': -4, 'D♭': -5, 'G♭': -6 };
const SHARP_ORDER = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯'];
const FLAT_ORDER = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭', 'F♭'];
const CIRCLE_UP = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯'];
const CIRCLE_DOWN = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭'];
const relMinorOf = maj => spName(spellFrom(parseName(maj), 5, 9));
const relMajorOf = min => spName(spellFrom(parseName(min), 2, 3));
const TRIADS_MAJOR = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const TRIADS_MINOR = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const FUNCTION_OF = { 1: 'tonica', 4: 'subdominant', 5: 'dominant' };
const chordName = (root, type) => root + CHORDS[type].sym;
function diatonic(key, minor, d) {
  const tones = scaleTones(minor ? 'minor' : 'major', key);
  const root = tones[d - 1].name;
  const type = (minor ? TRIADS_MINOR : TRIADS_MAJOR)[d - 1];
  return { root, type, name: chordName(root, type), roman: (minor ? ROMAN_MINOR : ROMAN_MAJOR)[d - 1] };
}
const sigText = n => (n === 0 ? 'geen kruisen of mollen' : n > 0 ? `${n} ${n === 1 ? 'kruis' : 'kruisen'}` : `${-n} ${n === -1 ? 'mol' : 'mollen'}`);
const uniq = arr => Array.from(new Set(arr));
// geheugensteuntjes: een liedje dat met het interval begint (Gehoortraining en het pad Gehoor)
const IV_HINT = { 1: 'het thema van Jaws', 2: 'Vader Jacob', 3: 'de riff van Smoke on the Water', 4: 'When the Saints Go Marching In', 5: 'het begin van het Wilhelmus', 6: 'de tune van The Simpsons', 7: 'de lange tonen van Star Wars, of Altijd is Kortjakje ziek', 8: 'de sprong na het loopje aan het begin van The Entertainer', 9: 'My Bonnie Lies over the Ocean', 10: 'Somewhere uit West Side Story', 11: 'het begin van het refrein van Take On Me', 12: 'Somewhere over the Rainbow' };
const CHORD_FEEL = { maj: 'helder en open', min: 'donker en weemoedig', dom7: 'bluesy: hij wil verder', maj7: 'zacht en dromerig', m7: 'zacht en soulvol', m7b5: 'donker en gespannen', dim: 'gespannen en onrustig', sus4: 'zwevend: hij wil oplossen' };
const intervalByName = n => INTERVALS.find(i => i.name === n);
// alle plekken van een toonhoogte binnen een fretbereik
function positionsOf(midi, from, to) {
  const out = [];
  for (let s = 0; s < 6; s++) { const f = midi - OPEN[s]; if (f >= from && f <= to) out.push({ s, f }); }
  return out;
}
