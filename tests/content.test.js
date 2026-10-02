const fs = require('fs'); const vm = require('vm');
const ctx = { document: { addEventListener(){} }, window: {}, performance, console, Math, Float32Array,
  NoteGame: { pick: () => ({ s: 2, pc: 9, frets: [2], name: 'A', midis: [57] }) }, Store: { settings: { names: 'sharps' } } };
vm.createContext(ctx);
const src = ['01-theory.js','01b-theory2.js','11-content.js'].map(f => fs.readFileSync('src/js/' + f, 'utf8')).join('\n');
vm.runInContext(src + '\nthis.C = { TOPICS, FASE1, unitNodes, unitMeta, G, OPEN, mod12 };', ctx);
const { TOPICS, unitNodes, OPEN, mod12 } = ctx.C;
let fails = 0, counts = {}, samples = {};
const bad = (msg, it) => { fails++; if (fails < 25) console.log('FAIL', msg, JSON.stringify(it).slice(0, 300)); };
function check(it, where) {
  counts[it.type] = (counts[it.type] || 0) + 1;
  if (!it.prompt) bad('geen prompt ' + where, it);
  if (it.type === 'mc') {
    if (it.options.length < 2 || it.options.length > 4) bad('aantal opties ' + where, it);
    if (new Set(it.options).size !== it.options.length) bad('dubbele opties ' + where, it);
    if (it.answer < 0 || it.answer >= it.options.length) bad('antwoord buiten bereik ' + where, it);
    if (it.options.some(o => o === 'undefined' || o.includes('undefined') || o.includes('NaN'))) bad('undefined in optie ' + where, it);
  } else if (it.type === 'multi') {
    if (!it.correct.length || it.correct.some(c => !it.choices.includes(c))) bad('multi juist ontbreekt ' + where, it);
    if (new Set(it.choices).size !== it.choices.length) bad('multi dubbele chips ' + where, it);
    if (it.choices.length < it.correct.length + 2) bad('multi te weinig afleiders ' + where, it);
  } else if (it.type === 'tap') {
    if (!it.valid.length) bad('tap zonder geldige plek ' + where, it);
    if (it.valid.some(p => p.f < it.from || p.f > it.to)) bad('tap buiten venster ' + where, it);
  } else if (it.type === 'play') {
    if (!it.steps.length) bad('play zonder stappen ' + where, it);
    for (const st of it.steps) {
      if (st.k === 'pc' && !(st.pc >= 0 && st.pc < 12)) bad('play pc ongeldig ' + where, it);
      if (st.k === 'rel' && !Number.isInteger(st.semis)) bad('play rel ongeldig ' + where, it);
      if (st.k === 'set' && (!st.pcs.length || st.pcs.some(p => !(p >= 0 && p < 12)))) bad('play set ongeldig ' + where, it);
    }
  } else bad('onbekend type ' + where, it);
  if (JSON.stringify(it).includes('undefined')) bad('tekst bevat undefined ' + where, it);
}
for (const topic of Object.keys(TOPICS)) {
  const unit = { topic, params: topic === 'scale-boxes' ? { scale: 'minpent', root: 'A', boxes: [1, 2] } : undefined, quiz: topic === 'generic' ? [{ q: 'Testvraag?', options: ['a', 'b', 'c'], answer: 1, explain: 'b' }] : [] };
  const nodes = unitNodes(unit);
  for (let k = 0; k < 120; k++) nodes.forEach((n, i) => {
    const items = n.gen();
    if (!items.length && !(topic === 'generic' && i === 0 && !unit.quiz.length)) bad(`lege knoop ${topic}/${i}`, n.title);
    items.forEach(it => { check(it, `${topic}/${n.title}`); if (k === 0 && i < nodes.length - 1) (samples[topic] = samples[topic] || []).push(it); });
  });
}
console.log('itemtypes', JSON.stringify(counts));
// steekproef ter controle van de muziektheorie
for (const t of ['twelve-tones', 'intervals', 'keys-circle', 'minor', 'diatonic-chords', 'progressions']) {
  for (const it of samples[t].filter(x => x.type === 'mc').slice(0, 4)) console.log(`[${t}] ${it.prompt} ${it.sub ? '(' + it.sub + ')' : ''} → ${it.options[it.answer]}  | ${it.options.join(' / ')}`);
}
for (const it of samples['major-scale'].filter(x => x.type === 'multi').slice(0, 2)) console.log('[multi]', it.prompt, '→', it.correct.join(' '), '| chips', it.choices.join(' '));
for (const it of samples['intervals'].filter(x => x.type === 'tap').slice(0, 2)) console.log('[tap]', it.prompt, it.sub, 'marks', JSON.stringify(it.marks), 'valid', JSON.stringify(it.valid));
console.log(fails ? `${fails} FOUT(EN)` : 'alle inhoudstests geslaagd');
