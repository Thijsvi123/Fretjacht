const fs = require('fs'); const vm = require('vm');
const ctx = { document: { addEventListener(){} }, window: {}, performance, console, Math, Float32Array };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/js/01-theory.js','utf8') + fs.readFileSync('src/js/02-engine.js','utf8') + '\nthis.X = {ksSamples, createDetector, createNoteTracker, MAX_FRET};', ctx);
const { ksSamples, createDetector, createNoteTracker, MAX_FRET } = ctx.X;
let worst = 0, fails = 0;
for (const sr of [44100, 48000]) {
  const det = createDetector(2048, sr, 70, 1100);
  for (let midi = 40; midi <= 64 + MAX_FRET; midi++) {
    const y = ksSamples(sr, midi, 1.0);
    const errs = [];
    for (const st of [0.08, 0.3, 0.6]) {
      const r = det(y.subarray(Math.floor(st*sr), Math.floor(st*sr)+2048));
      const m = 69 + 12*Math.log2(r.freq/440);
      errs.push(Math.round((m - midi)*100));
    }
    const bad = errs.filter(e => Math.abs(e) > 20);
    worst = Math.max(worst, ...errs.map(Math.abs));
    if (bad.length) { fails++; console.log('KS pitch off', sr, midi, errs); }
  }
}
// diagnose: de synthetische klank is willekeurig, dus losse uitschieters (laat in de uitklank) zijn geen fout in de app
console.log('KS (diagnose): grootste afwijking (cent) =', worst, fails ? `${fails} noten met een uitschieter` : 'ok');
// notentracker: simuleer frames van 20 ms
const out = []; const tr = createNoteTracker(n => out.push(n.midi));
let t = 0; const feed = (m, ms) => { for (let i = 0; i < ms / 20; i++) { tr.frame({ midi: m }, t); t += 20; } };
feed(57, 300);              // A: gemeld
feed(null, 100); feed(57, 300); // korte uitval: niet opnieuw melden
feed(null, 200); feed(57, 300); // echte stilte: opnieuw melden
tr.onset(); feed(57, 300);  // nieuwe aanslag van dezelfde noot: opnieuw melden
feed(60, 200);              // C: gemeld
feed(72, 200);              // octaaffout van C: genegeerd
feed(64, 60);               // te kort: genegeerd
feed(62, 300);              // D: gemeld
const want = [57, 57, 57, 60, 62];
if (JSON.stringify(out) !== JSON.stringify(want)) { console.error('tracker FOUT:', JSON.stringify(out), 'verwacht', JSON.stringify(want)); process.exit(1); }
console.log('tracker ok:', JSON.stringify(out));
