// Controleert path.json voordat er een nieuwe unit wordt gepusht: node tests/check_path.js [bestand]
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'path.json';
const errs = [];
const err = m => errs.push(m);
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`${file} is geen geldige JSON: ${e.message}`); process.exit(1); }
const ctx = { document: { addEventListener() {} }, window: {}, performance, console, Math, Float32Array,
  NoteGame: { pick: () => ({ s: 2, pc: 9, frets: [2], name: 'A', midis: [57] }) }, Store: { settings: { names: 'sharps' } } };
vm.createContext(ctx);
const src = ['01-theory.js', '01b-theory2.js', '11-content.js'].map(f => fs.readFileSync(__dirname + '/../src/js/' + f, 'utf8')).join('\n');
vm.runInContext(src + '\nthis.C = { TOPICS, SCALES, MINOR_ROOTS, MAJOR_ROOTS, unitNodes, boxCount };', ctx);
const { TOPICS, SCALES, MINOR_ROOTS, MAJOR_ROOTS, unitNodes, boxCount } = ctx.C;
const DRILLS = ['notes', 'positions', 'intervals', 'degrees', 'scales', 'chords', 'bends', 'ear', 'challenge', 'metro', 'targets', 'earq'];
const isStr = x => typeof x === 'string' && x.trim().length > 0;
if (!data || !Array.isArray(data.units)) { console.error('path.json mist de lijst "units"'); process.exit(1); }
if (data.updated != null && !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) err('"updated" moet JJJJ-MM-DD zijn');
const seen = new Set();
data.units.forEach((u, n) => {
  const at = `unit ${n + 1}${u && u.lesson ? ` (les ${u.lesson})` : ''}`;
  if (!u || typeof u !== 'object') return err(`${at}: geen object`);
  if (!Number.isInteger(u.lesson) || u.lesson < 1) err(`${at}: "lesson" moet een positief geheel getal zijn`);
  if (seen.has(u.lesson)) err(`${at}: lesnummer ${u.lesson} komt dubbel voor`);
  seen.add(u.lesson);
  if (n > 0 && data.units[n - 1] && u.lesson <= data.units[n - 1].lesson) err(`${at}: units moeten op lesnummer oplopen`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u.date || '')) err(`${at}: "date" moet JJJJ-MM-DD zijn`);
  if (!TOPICS[u.topic]) err(`${at}: onbekend topic "${u.topic}". Kies uit: ${Object.keys(TOPICS).join(', ')}`);
  if (!isStr(u.title)) err(`${at}: "title" ontbreekt`);
  if (u.subtitle != null && typeof u.subtitle !== 'string') err(`${at}: "subtitle" moet tekst zijn`);
  if (u.doc != null && !/^https:\/\//.test(u.doc)) err(`${at}: "doc" moet een https-link zijn`);
  if (u.summary != null) {
    if (!Array.isArray(u.summary) || !u.summary.length || u.summary.length > 4) err(`${at}: "summary" moet een lijst met 1 tot 4 korte zinnen zijn`);
    else u.summary.forEach((t, i) => { if (!isStr(t)) err(`${at}: summary ${i + 1} is leeg`); else if (t.length > 170) err(`${at}: summary ${i + 1} is te lang (${t.length} tekens, maximaal 170)`); });
  }
  if (u.topic === 'scale-boxes') {
    const p = u.params || {};
    if (!SCALES[p.scale]) err(`${at}: params.scale moet een van ${Object.keys(SCALES).join(', ')} zijn`);
    else {
      const roots = SCALES[p.scale].minorish ? MINOR_ROOTS : MAJOR_ROOTS;
      if (!roots.includes(p.root)) err(`${at}: params.root "${p.root}" past niet bij ${p.scale}. Kies uit: ${roots.join(' ')}`);
    }
    const max = SCALES[p.scale] ? boxCount(p.scale) : 5;
    if (!Array.isArray(p.boxes) || !p.boxes.length || p.boxes.some(b => !Number.isInteger(b) || b < 1 || b > max)) err(`${at}: params.boxes moet een lijst met boxnummers 1 t/m ${max} zijn`);
  }
  if (u.drill != null && (!u.drill || !DRILLS.includes(u.drill.mode))) err(`${at}: drill.mode moet een van ${DRILLS.join(', ')} zijn`);
  const quiz = u.quiz || [];
  if (!Array.isArray(quiz)) err(`${at}: "quiz" moet een lijst zijn`);
  else {
    if (u.topic === 'generic' && quiz.length < 3) err(`${at}: een generic unit heeft minstens 3 quizvragen nodig`);
    if (quiz.length > 8) err(`${at}: maximaal 8 quizvragen`);
    quiz.forEach((q, i) => {
      const qa = `${at}, vraag ${i + 1}`;
      if (!q || !isStr(q.q)) return err(`${qa}: "q" ontbreekt`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) err(`${qa}: 2 tot 4 opties nodig`);
      else {
        if (q.options.some(o => !isStr(String(o)))) err(`${qa}: lege optie`);
        if (new Set(q.options.map(String)).size !== q.options.length) err(`${qa}: dubbele opties`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(`${qa}: "answer" moet de index (vanaf 0) van het goede antwoord zijn`);
      }
      if (!isStr(q.explain)) err(`${qa}: "explain" ontbreekt`);
    });
  }
  // de app moet er zonder fouten lessen van kunnen maken
  if (TOPICS[u.topic]) {
    try {
      const nodes = unitNodes(u);
      for (let k = 0; k < 30; k++) nodes.forEach((nd, i) => {
        const items = nd.gen();
        if (!items.length) throw new Error(`les ${i + 1} (${nd.title}) heeft geen vragen`);
        for (const it of items) if (!it.prompt || JSON.stringify(it).includes('undefined')) throw new Error(`les ${i + 1} (${nd.title}) maakt een ongeldige vraag`);
      });
    } catch (e) { err(`${at}: ${e.message}`); }
  }
});
if (errs.length) { console.error(errs.map(e => '- ' + e).join('\n')); console.error(`${errs.length} fout(en) in ${file}`); process.exit(1); }
console.log(`${file} ok: ${data.units.length} unit(s), laatste les ${data.units.length ? data.units[data.units.length - 1].lesson : '-'}`);
