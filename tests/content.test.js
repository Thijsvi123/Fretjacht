// Test: alle vragen die de app zelf maakt, de lessen van de cursus (per stap), het pad Gehoor en het schuifje met of zonder gitaar
const fs = require('fs'); const vm = require('vm');
const ctx = { document: { addEventListener(){} }, window: {}, performance, console, Math, Float32Array,
  NoteGame: { pick: () => ({ s: 2, pc: 9, frets: [2], name: 'A', midis: [57] }) },
  Store: { settings: { names: 'sharps', guitar: true }, stats: {}, saveStats() {} },
  ICONS: new Proxy({}, { get: () => '<svg></svg>' }) };
vm.createContext(ctx);
const src = ['01-theory.js', '01b-theory2.js', '05d-fretquiz.js', '11-content.js', '11b-hals.js', '11c-course.js', '11d-guitar.js', '11e-gehoor.js'].map(f => fs.readFileSync('src/js/' + f, 'utf8')).join('\n');
vm.runInContext(src + '\nthis.C = { TOPICS, COURSE, unitNodes, unitMeta, G, OPEN, mod12, fitMode, noteMidi, HalsData, FretQuiz, NATURAL, SHARP_NAMES, GehoorData, GEHOOR_LEVELS, cardItem, Listen, unitSummary, authoredItems, parseName, spPc };', ctx);
const { TOPICS, COURSE, unitNodes, OPEN, mod12, fitMode, noteMidi, HalsData, FretQuiz, GehoorData, GEHOOR_LEVELS, cardItem, Listen, unitSummary } = ctx.C;
let fails = 0, counts = {}, samples = {};
const bad = (msg, it) => { fails++; if (fails < 25) console.log('FAIL', msg, JSON.stringify(it).slice(0, 300)); };
function check(it, where) {
  counts[it.type] = (counts[it.type] || 0) + 1;
  // dubbele kruisen en mollen komen in de lessen niet voor: die mogen ook niet in een vraag, uitleg of hint staan
  if (/𝄪|𝄫/.test(JSON.stringify([it.prompt, it.sub, it.options, it.choices, it.explain, it.hint, it.steps && it.steps.map(s => s.name)]))) bad('dubbel kruis of dubbele mol ' + where, it);
  if (!it.prompt) bad('geen prompt ' + where, it);
  if (it.type === 'mc') {
    if (it.options.length < 2 || it.options.length > 4) bad('aantal opties ' + where, it);
    if (new Set(it.options).size !== it.options.length) bad('dubbele opties ' + where, it);
    if (it.answer < 0 || it.answer >= it.options.length) bad('antwoord buiten bereik ' + where, it);
    if (it.options.some(o => o === 'undefined' || o.includes('undefined') || o.includes('NaN'))) bad('undefined in optie ' + where, it);
    // noten als opties: nooit twee die hetzelfde klinken, zoals A♯ en B♭
    if (it.options.every(o => /^[A-G](♯|♭|𝄪|𝄫)?$/.test(o)) && new Set(it.options.map(o => ctx.C.spPc(ctx.C.parseName(o)))).size !== it.options.length) bad('twee opties klinken hetzelfde ' + where, it);
    if (it.hear) {
      checkSound(it.hear, where, it);
      if (!it.hearBy || it.options.some(o => !it.hearBy[o])) bad('luistervraag: niet elk antwoord heeft een geluid ' + where, it);
      else for (const o of it.options) checkSound(it.hearBy[o], where, it);
      if (JSON.stringify(it.hearBy[it.options[it.answer]]) !== JSON.stringify(it.hear)) bad('luistervraag: het goede antwoord klinkt anders dan de vraag ' + where, it);
    }
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
    if (it.hear) checkSound(it.hear, where, it);
    if (it.pad) checkPad(it, where);
  } else if (it.type === 'name') {
    if (!(it.s >= 0 && it.s < 6) || mod12(OPEN[it.s] + it.f) !== it.pc) bad('name: plek en noot kloppen niet ' + where, it);
  } else if (it.type === 'tapall') {
    if (!it.valid.length || it.valid.some(p => mod12(OPEN[p.s] + p.f) !== it.pc)) bad('tapall: plekken kloppen niet ' + where, it);
  } else if (it.type === 'learn') {
    if (!Array.isArray(it.text)) bad('learn zonder tekst ' + where, it);
  } else bad('onbekend type ' + where, it);
  if (JSON.stringify(it).includes('undefined')) bad('tekst bevat undefined ' + where, it);
}
// een geluid zoals een play-knop: noten na elkaar (n), samen (c) of akkoorden na elkaar (ch)
function checkSound(sp, where, it) {
  const groups = sp && (sp.ch || [sp.n]);
  if (!groups || !groups.length) return bad('geluid ontbreekt ' + where, it);
  for (const g of groups) { const toks = String(g || '').trim().split(/\s+/); if (!g || toks.some(t => noteMidi(t) == null)) bad(`onbekende noot in geluid "${g}" ` + where, it); }
}
// naspelen op de toetsen: met de toetsen moet elke stap te spelen zijn, en wat klonk moet kloppen met de stappen
function checkPad(it, where) {
  const { lo, hi } = it.pad, keys = [];
  if (!(lo >= 28 && hi <= 88 && hi - lo >= 5 && hi - lo <= 16)) bad('toetsen: bereik ' + where, it.pad);
  for (let m = lo; m <= hi; m++) keys.push(m);
  let last = null;
  for (const st of it.steps) {
    if (st.k === 'set') { if (st.pcs.some(pc => !keys.some(m => mod12(m) === pc))) bad('toetsen: akkoordtoon ontbreekt ' + where, it); continue; }
    if (st.k === 'rel') { const want = last + st.semis; if (last == null || !keys.includes(want)) bad('toetsen: interval valt buiten de toetsen ' + where, it); last = want; continue; }
    const k = keys.find(m => mod12(m) === st.pc);
    if (k == null) bad('toetsen: noot ontbreekt ' + where, it);
    if (st.midi != null && mod12(st.midi) !== st.pc) bad('naspelen: midi en noot verschillen ' + where, st);
    if (last != null && mod12(last) === st.pc) bad('naspelen: twee keer dezelfde noot achter elkaar (de app negeert de tweede) ' + where, it);
    last = st.given || last == null ? (keys.find(m => m === st.midi) != null ? st.midi : k) : k;
  }
  if (!it.steps.length || (it.steps.length > 1 && !it.steps[0].given)) bad('naspelen: de eerste toon is niet gegeven ' + where, it);
  // het geluid speelt dezelfde tonen als de stappen (bij intervallen en melodieën)
  if (it.hear && it.hear.n && !it.hear.c) {
    const heard = Listen.notes(it.hear.n), pcs = it.steps.map(st => st.k === 'rel' ? null : st.pc);
    if (heard.length !== it.steps.length || heard.some((m, i) => pcs[i] != null && mod12(m) !== pcs[i])) bad('naspelen: geluid en stappen verschillen ' + where, it);
  }
}
// zet om naar met en zonder gitaar, en weer terug
function checkModes(items, where) {
  const met = fitMode(items, true), zonder = fitMode(items, false);
  met.forEach(it => check(it, where + ' (met gitaar)'));
  zonder.forEach(it => check(it, where + ' (zonder gitaar)'));
  if (met.some(it => ['tap', 'name', 'tapall'].includes(it.type))) bad('met gitaar nog tikken ' + where, met.map(x => x.type));
  if (zonder.some(it => it.type === 'play' && !it.pad)) bad('zonder gitaar nog spelen ' + where, zonder.map(x => x.type));
  if (items.length && !met.length) bad('met gitaar leeg ' + where, items.map(x => x.type));
  if (items.length && !zonder.length) bad('zonder gitaar leeg ' + where, items.map(x => x.type));
  const terug = fitMode(met, false);
  if (terug.some(it => it.type === 'play' && !it.pad)) bad('terugzetten mislukt ' + where, terug.map(x => x.type));
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
// het pad Gehoor: tien niveaus, elk Leren, Herkennen en Toepassen, met en zonder gitaar
if (GEHOOR_LEVELS.length !== 10) bad('Gehoor heeft geen 10 niveaus', GEHOOR_LEVELS.length);
const earKinds = {};
for (const u of GehoorData.units()) {
  const nodes = unitNodes(u), L = GEHOOR_LEVELS[u.idx];
  if (nodes.map(n => n.title).join() !== 'Leren,Herkennen,Toepassen') bad('Gehoor: stappen ' + u.title, nodes.map(n => n.title));
  if (!(L.cards || []).length) bad('Gehoor: geen uitleg ' + u.title, L);
  for (const c of L.cards || []) for (const sp of c.play || []) checkSound(sp, `gehoor ${u.title}, kaartje ${c.t}`, sp);
  if (!unitSummary(u).length) bad('Gehoor: geen samenvatting ' + u.title, u);
  for (let k = 0; k < 25; k++) nodes.forEach((n, i) => {
    const items = n.gen();
    items.forEach(it => { check(it, `gehoor ${u.title}/${n.title}`); earKinds[it.skill || it.type] = (earKinds[it.skill || it.type] || 0) + 1; });
    if (i === 0 && (items.filter(x => x.type === 'learn').length !== L.cards.length || items.filter(x => x.type === 'mc').length !== 3)) bad('Gehoor Leren: uitleg en drie vragen ' + u.title, items.map(x => x.type));
    if (i === 1 && (items.length !== 10 || items.some(x => x.type !== 'mc' || !x.hear))) bad('Gehoor Herkennen: tien luistervragen ' + u.title, items.map(x => x.type));
    if (i === 2 && (items.length < 5 || items.some(x => x.type !== 'play' || !x.pad || !x.hear))) bad('Gehoor Toepassen: naspelen ' + u.title, items.map(x => x.type));
    const { met, zonder } = checkModes(items, `gehoor ${u.title}/${n.title}`);
    if (JSON.stringify(met.map(x => x.type)) !== JSON.stringify(items.map(x => x.type)) || JSON.stringify(zonder.map(x => x.type)) !== JSON.stringify(items.map(x => x.type))) bad('Gehoor: met en zonder gitaar dezelfde vragen ' + u.title, [met.map(x => x.type), zonder.map(x => x.type)]);
  });
}
console.log('gehoor', JSON.stringify(earKinds));
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
  // per stap eerst de uitleg: elke stap heeft kaartjes, ze staan op volgorde, en Onthoud komt voor de unittoets
  const unit = Object.assign({}, c), nodes = unitNodes(unit), steps = nodes.slice(0, -1), test = nodes[nodes.length - 1];
  if (nodes.some(n => n.lesson || n.title === 'Les')) bad(at + ': nog een aparte lesstap', nodes.map(n => n.title));
  if (steps.length !== 5) bad(at + ': aantal stappen', steps.length);
  if (!test.test) bad(at + ': laatste knoop is geen unittoets', test.title);
  let prev = 0;
  for (const card of c.cards) { if (card.sum) continue; if (!(card.step >= 1 && card.step <= steps.length)) bad(at + `: kaartje ${card.t} zonder geldige stap`, card.step); if (card.step < prev) bad(at + `: kaartje ${card.t} staat niet op volgorde`, card.step); prev = card.step; }
  steps.forEach((n, i) => {
    if (!n.cards || !n.cards.length) bad(at + `: stap ${i + 1} (${n.title}) zonder uitleg`, n.title);
    const items = n.cards.map((cd, k) => cardItem(cd, unit, k, n.cards.length, 'step'));
    if (items.some(x => x.type !== 'learn' || !x.course)) bad(at + ': stapkaartjes', items.map(x => x.type));
    if (items[0].kicker !== `Les ${k + 1} · uitleg${n.cards.length > 1 ? ` 1 van ${n.cards.length}` : ''}`) bad(at + ': kicker van stap ' + (i + 1), items[0].kicker);
    if (items[items.length - 1].go !== 'Naar de oefeningen') bad(at + ': knop na de uitleg', items[items.length - 1].go);
    for (let r = 0; r < 10; r++) { const g = n.gen(); if (!g.length || g.some(x => x.type === 'learn')) bad(at + `: oefeningen van stap ${i + 1}`, g.map(x => x.type)); }
  });
  if (steps.reduce((a, n) => a + n.cards.length, 0) + test.cards.length !== c.cards.length) bad(at + ': niet elk kaartje hoort bij een stap', c.cards.length);
  if (test.cards.length !== 1 || !test.cards[0].sum) bad(at + ': unittoets begint niet met Onthoud', test.cards.map(x => x.t));
  const sum = cardItem(test.cards[0], unit, 0, 1, 'test');
  if (!Array.isArray(sum.list) || sum.list.length < 2) bad(at + ': Onthoud zonder samenvatting', sum.list);
  if (sum.go !== 'Naar de toets' || !sum.text.join(' ').includes('unittoets')) bad(at + ': Onthoud voor de toets', [sum.go, sum.text]);
  const read = c.cards.map((cd, i) => cardItem(cd, unit, i, c.cards.length, 'read'));
  if (read[0].kicker !== `Les ${k + 1} · 1 van ${c.cards.length}`) bad(at + ': kicker bij Lees de les', read[0].kicker);
  for (const q of c.quiz || []) if (q.step != null && !(q.step >= 1 && q.step <= steps.length)) bad(at + ': quizvraag met ongeldige stap', q);
  for (let r = 0; r < 20; r++) {
    const t = test.gen();
    if (t.some(x => x.type === 'learn')) bad(at + ': unittoets bevat lesuitleg', t.map(x => x.type));
    if (t.length < 5) bad(at + ': unittoets te kort', t.length);
  }
});
// les 1: de eigen vragen staan bij hun stap (powerchords bij Powerchords)
{
  const n1 = unitNodes(Object.assign({}, COURSE[0])), has = (i, txt) => { for (let r = 0; r < 5; r++) if (n1[i].gen().some(x => x.prompt.includes(txt))) return true; return false; };
  if (!has(2, 'Smells Like Teen Spirit') || has(4, 'Smells Like Teen Spirit')) bad('les 1: de vraag over Smells Like Teen Spirit hoort bij Powerchords', n1.map(n => n.title));
  if (!has(1, 'Kortjakje')) bad('les 1: Kortjakje hoort bij De kwint', n1[1].title);
  if (n1[2].cards.map(x => x.t).join() !== 'Powerchords') bad('les 1: de stap Powerchords begint met het kaartje Powerchords', n1[2].cards.map(x => x.t));
}
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
