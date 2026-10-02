const fs = require('fs'); const vm = require('vm');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/js/01-theory.js','utf8') + '\nthis.T = {scaleBox, scaleTones, chordTones, chordOk, spellFrom, parseName, spName, shapeText, INTERVALS, CHORD_ROOTS, CHORDS, MINOR_ROOTS, MAJOR_ROOTS, SCALES, boxCount};', ctx);
const T = ctx.T; let fails = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) { fails++; console.log('FAIL', msg, '\n  got ', A, '\n  want', B); } };
const frets = (box) => { const by = {}; for (const p of box) (by[p.s] = by[p.s] || []).push(p.f); return [5,4,3,2,1,0].map(s => by[s] || []); };
// A mineur pentatonisch, box 1..5 (lage E -> hoge e)
eq(frets(T.scaleBox('minpent','A',1)), [[5,8],[5,7],[5,7],[5,7],[5,8],[5,8]], 'Am pent box1');
eq(frets(T.scaleBox('minpent','A',2)), [[8,10],[7,10],[7,10],[7,9],[8,10],[8,10]], 'Am pent box2');
eq(frets(T.scaleBox('minpent','A',3)), [[10,12],[10,12],[10,12],[9,12],[10,13],[10,12]], 'Am pent box3');
eq(frets(T.scaleBox('minpent','A',4)), [[12,15],[12,15],[12,14],[12,14],[13,15],[12,15]], 'Am pent box4');
eq(frets(T.scaleBox('minpent','A',5)), [[3,5],[3,5],[2,5],[2,5],[3,5],[3,5]], 'Am pent box5 (octaaf lager)');
eq(frets(T.scaleBox('minpent','E',1)), [[0,3],[0,2],[0,2],[0,2],[0,3],[0,3]], 'Em pent box1');
// A blues box 1: + A-snaar 6 en G-snaar 8
eq(frets(T.scaleBox('blues','A',1)), [[5,8],[5,6,7],[5,7],[5,7,8],[5,8],[5,8]], 'A blues box1');
// G majeur 3NPS positie 1 (begint op G, fret 3)
eq(frets(T.scaleBox('major','G',1)), [[3,5,7],[3,5,7],[4,5,7],[4,5,7],[5,7,8],[5,7,8]], 'G majeur 3nps 1');
// alles oplopend en uniek
for (const sc of Object.keys(T.SCALES)) for (const r of (T.SCALES[sc].minorish ? T.MINOR_ROOTS : T.MAJOR_ROOTS)) for (let b = 1; b <= T.boxCount(sc); b++) {
  const bx = T.scaleBox(sc, r, b);
  for (let i = 1; i < bx.length; i++) if (bx[i].midi <= bx[i-1].midi) { fails++; console.log('FAIL niet oplopend', sc, r, b); break; }
  if (bx.some(p => p.f < 0 || p.f > 19)) { fails++; console.log('FAIL fret buiten bereik', sc, r, b, JSON.stringify(frets(bx))); }
  const span = Math.max(...bx.map(p=>p.f)) - Math.min(...bx.map(p=>p.f));
  if (span > 6) { fails++; console.log('FAIL te breed', sc, r, b, span); }
}
eq(T.scaleTones('major','F♯').map(t=>t.name), ['F♯','G♯','A♯','B','C♯','D♯','E♯'], 'F# majeur');
eq(T.scaleTones('minor','C').map(t=>t.name), ['C','D','E♭','F','G','A♭','B♭'], 'C mineur');
eq(T.scaleTones('dorian','D').map(t=>t.name), ['D','E','F','G','A','B','C'], 'D dorisch');
eq(T.scaleTones('blues','E').map(t=>t.name), ['E','G','A','B♭','B','D'], 'E blues');
eq(T.chordTones('m7','A').map(t=>t.name), ['A','C','E','G'], 'Am7');
eq(T.chordTones('dom7','B♭').map(t=>t.name), ['B♭','D','F','A♭'], 'Bb7');
eq(T.chordTones('m7b5','F♯').map(t=>t.name), ['F♯','A','C','E'], 'F#m7b5');
eq(T.chordTones('maj7','E♭').map(t=>t.name), ['E♭','G','B♭','D'], 'Ebmaj7');
eq(T.chordOk('maj','C♯'), false, 'C# majeur heeft E#'); eq(T.chordOk('min','C♯'), true, 'C#m ok'); eq(T.chordOk('min','D♭'), false, 'Dbm heeft Fb');
const okCount = Object.keys(T.CHORDS).map(t => T.CHORD_ROOTS.filter(r => T.chordOk(t, r)).length);
console.log('bruikbare grondtonen per akkoordtype', JSON.stringify(Object.keys(T.CHORDS)), JSON.stringify(okCount));
eq(T.spName(T.spellFrom(T.parseName('A'), 4, 7)), 'E', 'kwint boven A');
eq(T.spName(T.spellFrom(T.parseName('E♭'), 2, 4)), 'G', 'grote terts boven Eb');
eq(T.spName(T.spellFrom(T.parseName('D'), -2, -3)), 'B', 'kleine terts onder D');
console.log(T.shapeText(7, true)); console.log(T.shapeText(4, true)); console.log(T.shapeText(12, true)); console.log(T.shapeText(3, false));
console.log(fails ? `${fails} FOUT(EN)` : 'alle theorietests geslaagd');
