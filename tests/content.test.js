// Test: alle vragen die de app zelf maakt, de lessen van de cursus en het schuifje met of zonder gitaar
const fs = require('fs'); const vm = require('vm');
const ctx = { document: { addEventListener(){} }, window: {}, performance, console, Math, Float32Array,
  NoteGame: { pick: () => ({ s: 2, pc: 9, frets: [2], name: 'A', midis: [57] }) },
  Store: { settings: { names: 'sharps', guitar: true }, stats: {}, saveStats() {} },
  ICONS: new Proxy({}, { get: () => '<svg></svg>' }) };
vm.createContext(ctx);
const src = ['01-theory.js', '01b-theory2.js', '05d-fretquiz.js', '11-content.js', '11b-hals.js', '11c-course.js', '11d-guitar.js'].map(f => fs.readFileSync('src/js/' + f, 'utf8')).join('\n');
vm.runInContext(src + '\nthis.C = { TOPICS, COURSE, unitNodes, unitMeta, G, OPEN, mod12, fitMode, noteMidi, HalsData, FretQuiz, NATURAL, SHARP_NAMES };', ctx);
const { TOPICS, COURSE, unitNodes, OPEN, mod12, fitMode, noteMidi, HalsData, FretQuiz } = ctx.C;
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
      if (st.k === 'pc' && st.frets && st.string != null && st.frets.some(f => mod12(OPEN[st.string] + f) !== st.pc)) bad('play fret klopt niet met de noot ' + where, it);
      if (st.k === 'rel' && !Number.isInteger(st.semis)) bad('play rel ongeldig ' + where, it);
      if (st.k === 'set' && (!st.pcs.length || st.pcs.some(p => !(p >= 0 && p < 12)))) bad('play set ongeldig ' + where, it);
    }
  } else if (it.type === 'name') {
    if (!(it.s >= 0 && it.s < 6) || mod12(OPEN[it.s] + it.f) !== it.pc) bad('name: plek en noot kloppen niet ' + where, it);
  } else if (it.type === 'tapall') {
    if (!it.valid.length || it.valid.some(p => mod12(OPEN[p.s] + p.f) !== it.pc)) bad('tapall: plekken kloppen niet ' + where, it);
  } else if (it.type === 'learn') {
    if (!Array.isArray(it.text)) bad('learn zonder tekst ' + where, it);
  } else bad('onbekend type ' + where, it);
  if (JSON.stringify(it).includes('undefined')) bad('tekst bevat undefined ' + where, it);
}
// zet om naar met en zonder gitaar, en weer terug
function checkModes(items, where) {
  const met = fitMode(items, true), zonder = fitMode(items, false);
  met.forEach(it => check(it, where + ' (met gitaar)'));
  zonder.forEach(it => check(it, where + ' (zonder gitaar)'));
  if (met.some(it => ['tap', 'name', 'tapall'].includes(it.type))) bad('met gitaar nog tikken ' + where, met.map(x => x.type));
  if (zonder.some(it => it.type === 'play')) bad('zonder gitaar nog spelen ' + where, zonder.map(x => x.type));
  if (items.length && !met.length) bad('met gitaar leeg ' + where, items.map(x => x.type));
  if (items.length && !zonder.length) bad('zonder gitaar leeg ' + where, items.map(x => x.type));
  const terug = fitMode(met, false);
  if (terug.some(it => it.type === 'play')) bad('terugzetten mislukt ' + where, terug.map(x => x.type));
  for (const it of met) if (it._orig && it._orig.type === 'play') bad('_orig wijst naar een speelvraag ' + where, it);
  return { met, zonder };
}
const modeCounts = { met: {}, zonder: {} };
for (const topic of Object.keys(TOPICS)) {
  const unit = { topic, params: topic === 'scale-boxes' ? { scale: 'minpent', root: 'A', boxes: [1, 2] } : undefined, quiz: topic === 'generic' ? [{ q: 'Testvraag?', options: ['a', 'b', 'c'], answer: 1, explain: 'b' }] : [] };
  const nodes = unitNodes(unit);
  for (let k = 0; k < 120; k++) nodes.forEach((n, i) => {
    const items = n.gen();
    if (!items.length && !(topic === 'generic' && i === 0 && !unit.quiz.length)) bad(`lege knoop ${topic}/${i}`, n.title);
    items.forEach(it => { check(it, `${topic}/${n.title}`); if (k === 0 && i < nodes.length - 1) (samples[topic] = samples[topic] || []).push(it); });
    if (k < 30) {
      const { met, zonder } = checkModes(items, `${topic}/${n.title}`);
      met.forEach(x => { modeCounts.met[x.type] = (modeCounts.met[x.type] || 0) + 1; });
      zonder.forEach(x => { modeCounts.zonder[x.type] = (modeCounts.zonder[x.type] || 0) + 1; });
    }
  });
}
// de Halsjacht: alle niveaus en stappen, met en zonder gitaar
for (const u of HalsData.units()) {
  const nodes = unitNodes(u);
  for (let k = 0; k < 25; k++) nodes.forEach(n => {
    const items = n.gen();
    items.forEach(it => check(it, `hals ${u.title}/${n.title}`));
    const { met, zonder } = checkModes(items, `hals ${u.title}/${n.title}`);
    met.forEach(x => { modeCounts.met[x.type] = (modeCounts.met[x.type] || 0) + 1; });
    zonder.forEach(x => { modeCounts.zonder[x.type] = (modeCounts.zonder[x.type] || 0) + 1; });
  });
}
console.log('itemtypes', JSON.stringify(counts));
console.log('met gitaar', JSON.stringify(modeCounts.met), '| zonder gitaar', JSON.stringify(modeCounts.zonder));

// ---- de cursus: acht lessen in kaartjes ----
const NOTE = /^[A-G][♯♭]?$/;
const pcOf = name => mod12({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]] + (name[1] === '♯' ? 1 : name[1] === '♭' ? -1 : 0));
if (COURSE.length !== 8) bad('cursus heeft geen 8 lessen', COURSE.length);
let cards = 0, listens = 0, marks = 0;
COURSE.forEach((c, k) => {
  const at = `les ${k + 1}`;
  if (c.lesson !== k + 1) bad(at + ': lesnummer', c.lesson);
  if (!TOPICS[c.topic]) bad(at + ': onbekend onderwerp', c.topic);
  if (!c.title || !c.subtitle) bad(at + ': titel of ondertitel ontbreekt', c);
  if (c.cards.length < 6 || c.cards.length > 12) bad(at + ': aantal kaartjes', c.cards.length);
  if (k > 0 && c.cards[0].t !== 'Terugblik') bad(at + ': begint niet met een terugblik', c.cards[0].t);
  if (!c.cards[c.cards.length - 1].sum) bad(at + ': eindigt niet met Onthoud', c.cards[c.cards.length - 1].t);
  for (const q of c.quiz || []) if (!q.q || !Array.isArray(q.options) || q.options[q.answer] == null) bad(at + ': quizvraag', q);
  c.cards.forEach((card, i) => {
    const w = `${at}, kaartje ${i + 1} (${card.t})`;
    cards++;
    if (!card.t) bad(w + ': geen titel', card);
    if (!(card.p || []).length && !card.list && !card.table && !card.sum) bad(w + ': geen inhoud', card);
    for (const sp of card.play || []) {
      listens++;
      if (!sp.l) bad(w + ': geluidsknop zonder label', sp);
      const groups = sp.ch || [sp.n];
      for (const g of groups) for (const tok of String(g).trim().split(/\s+/)) if (noteMidi(tok) == null) bad(w + `: onbekende noot "${tok}"`, sp);
    }
    if (card.neck) {
      const nk = card.neck;
      if (!(nk.from >= 0 && nk.to > nk.from && nk.to <= 15)) bad(w + ': halsbereik', nk);
      for (const m of nk.marks) {
        marks++;
        if (!(m.s >= 0 && m.s < 6) || m.f < nk.from && m.f !== 0 || m.f > nk.to) bad(w + ': stip buiten de hals', m);
        // een stip met een notennaam moet ook echt die noot zijn
        if (NOTE.test(m.label) && pcOf(m.label) !== FretQuiz.pcAt(m.s, m.f)) bad(w + `: stip ${m.label} op snaar ${m.s}, fret ${m.f} klopt niet (${FretQuiz.nameAt(m.s, m.f)})`, m);
      }
      if (!nk.marks.length) bad(w + ': hals zonder stippen', nk);
    }
    if (card.table) for (const r of card.table.r) if (r.length !== card.table.h.length) bad(w + ': tabelrij heeft niet evenveel kolommen', r);
  });
  // de lesknoop: eerst, met evenveel kaartjes, daarna de oefeningen met hun oude nummers
  const unit = Object.assign({}, c), nodes = unitNodes(unit);
  if (!nodes[0].lesson || nodes[0].title !== 'Les') bad(at + ': de les staat niet vooraan', nodes[0].title);
  const items = nodes[0].gen();
  if (items.length !== c.cards.length || items.some(x => x.type !== 'learn' || !x.course)) bad(at + ': lesknoop geeft niet alle kaartjes', items.map(x => x.type));
  if (items[0].kicker !== `Les ${k + 1} · 1 van ${c.cards.length}`) bad(at + ': kicker', items[0].kicker);
  const sum = items[items.length - 1];
  if (!Array.isArray(sum.list) || sum.list.length < 2) bad(at + ': Onthoud zonder samenvatting', sum.list);
  if (!nodes[nodes.length - 1].test) bad(at + ': laatste knoop is geen unittoets', nodes[nodes.length - 1].title);
  for (let r = 0; r < 20; r++) {
    const t = nodes[nodes.length - 1].gen();
    if (t.some(x => x.type === 'learn')) bad(at + ': unittoets bevat lesuitleg', t.map(x => x.type));
    if (t.length < 5) bad(at + ': unittoets te kort', t.length);
  }
  // dezelfde unit zonder kaartjes heeft één knoop minder
  const plain = unitNodes(Object.assign({}, c, { cards: [] }));
  if (plain.length !== nodes.length - 1) bad(at + ': aantal knopen', [plain.length, nodes.length]);
});
console.log(`cursus: ${COURSE.length} lessen, ${cards} kaartjes, ${listens} geluidsknoppen, ${marks} stippen op de hals`);

// steekproef ter controle van de muziektheorie
for (const t of ['twelve-tones', 'intervals', 'keys-circle', 'minor', 'diatonic-chords', 'progressions']) {
  for (const it of samples[t].filter(x => x.type === 'mc').slice(0, 3)) console.log(`[${t}] ${it.prompt} ${it.sub ? '(' + it.sub + ')' : ''} → ${it.options[it.answer]}  | ${it.options.join(' / ')}`);
}
for (const it of samples['major-scale'].filter(x => x.type === 'multi').slice(0, 2)) console.log('[multi]', it.prompt, '→', it.correct.join(' '), '| chips', it.choices.join(' '));
// met gitaar: een tikvraag wordt spelen
const tapQ = samples['intervals'].find(x => x.type === 'tap');
if (tapQ) { const p = fitMode([tapQ], true)[0]; console.log('[tik → speel]', tapQ.prompt, '→', p.prompt, '| stappen', JSON.stringify(p.steps.map(s => s.k + ':' + (s.k === 'rel' ? s.semis : s.pc)))); }
const playQ = samples['twelve-tones'].find(x => x.type === 'play');
if (playQ) { const a = fitMode([playQ], false)[0]; console.log('[speel → vraag]', playQ.prompt, '→', a ? `${a.type}: ${a.prompt}` : 'valt weg'); }
console.log(fails ? `${fails} FOUT(EN)` : 'alle inhoudstests geslaagd');
process.exit(fails ? 1 : 0);
