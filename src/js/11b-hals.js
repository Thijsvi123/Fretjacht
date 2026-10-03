// ---------- Halsjacht: de hals leren kennen, zonder gitaar ----------
// Acht niveaus. Elk niveau heeft drie stappen:
//  Leren:     uitleg met de hals erbij ("dit is een C"), daarna drie makkelijke vragen
//  Herkennen: welke noot is dit? (snelheid en kennis), 80% goed om te halen
//  Toepassen: tik zelf alle plekken van een noot aan (de hals echt zien), 80% goed om te halen
// Itemtypes in de lesspeler: learn { title, text[], neck, big }, name { s, f, pc, all }, tapall { pc, name, strings, valid[] }
const HALS_LEVELS = [
  { title: 'Lage E-snaar', sub: 'De stamtonen op snaar 6, de dikste', strings: [5], nat: true, anchors: [3, 5, 7],
    anchorText: 'Fret 3 is G, fret 5 is A en fret 7 is B. Op fret 5 klinkt dezelfde noot als de volgende snaar los: A.' },
  { title: 'A-snaar', sub: 'De stamtonen op snaar 5', strings: [4], nat: true, anchors: [3, 5, 7],
    anchorText: 'Fret 3 is C, fret 5 is D en fret 7 is E. Op fret 5 klinkt D, de volgende snaar los.',
    link: 'Wat je al kent: de noot op de A-snaar ligt op de lage E vijf frets verder. A-snaar fret 3 (C) is lage E fret 8.', ex: [[4, 3], [5, 8]] },
  { title: 'D-snaar', sub: 'De stamtonen op snaar 4', strings: [3], nat: true, anchors: [3, 5, 7],
    anchorText: 'Fret 3 is F, fret 5 is G en fret 7 is A. Op fret 5 klinkt G, de volgende snaar los.',
    link: 'De octaafvorm: elke noot op de lage E vind je op de D-snaar twee frets verder, een octaaf hoger. Lage E fret 3 (G) wordt D-snaar fret 5.', ex: [[5, 3], [3, 5]] },
  { title: 'G-snaar', sub: 'De stamtonen op snaar 3', strings: [2], nat: true, anchors: [2, 4, 5, 7],
    anchorText: 'Fret 2 is A, fret 5 is C en fret 7 is D. Let op: de B van de volgende snaar ligt hier al op fret 4. Tussen G en B zitten maar vier frets.',
    link: 'De octaafvorm: elke noot op de A-snaar vind je op de G-snaar twee frets verder. A-snaar fret 3 (C) wordt G-snaar fret 5.', ex: [[4, 3], [2, 5]] },
  { title: 'B-snaar', sub: 'De stamtonen op snaar 2', strings: [1], nat: true, anchors: [1, 3, 5],
    anchorText: 'Fret 1 is C, fret 3 is D en fret 5 is E, de volgende snaar los.',
    link: 'Over de B-snaar heen schuift de octaafvorm één fret op: een noot op de D-snaar vind je op de B-snaar drie frets verder. D-snaar los (D) wordt B-snaar fret 3.', ex: [[3, 0], [1, 3]] },
  { title: 'Hoge e-snaar', sub: 'Snaar 1: dezelfde noten als de lage E', strings: [0], nat: true, anchors: [3, 5, 7],
    anchorText: 'Precies dezelfde noten als de lage E-snaar, twee octaven hoger: G op 3, A op 5 en B op 7.',
    link: 'Wat je op de lage E kent, ken je hier al. Daarom gaat deze snaar het snelst.', ex: [[5, 5], [0, 5]] },
  { title: 'Kruizen en mollen', sub: 'De noten tussen de stamtonen', strings: [5, 4, 3, 2, 1, 0], nat: false },
  { title: 'De hele hals', sub: 'Alle noten op alle snaren, tot fret 12', strings: [5, 4, 3, 2, 1, 0], nat: false, final: true },
];
const HALS_DONE_WORD = ['niet', 'Leren', 'Herkennen', 'Toepassen'];
// "de lage E-snaar", "de lage E- en A-snaar", "de hele hals"
function stringsPhrase(strings) {
  if (strings.length === 6) return 'de hele hals';
  if (strings.length === 1) return 'de ' + STR_NAME[strings[0]];
  const parts = strings.slice().sort((a, b) => b - a).map(s => STR_NAME[s].replace('-snaar', ''));
  return `de ${parts.slice(0, -1).map(p => p + '-').join(', ')} en ${parts[parts.length - 1]}-snaar`;
}
const lmk = (s, f, kind, label) => ({ s, f, kind: 'lrn' + (kind ? ' ' + kind : ''), label: label != null ? label : FretQuiz.nameAt(s, f) });
const learnCard = (title, text, neck, big) => ({ type: 'learn', prompt: title, text: [].concat(text), neck, big });
function naturalsOn(s, from = 0, to = 12) {
  const out = [];
  for (let f = from; f <= to; f++) if (NATURAL.has(FretQuiz.pcAt(s, f))) out.push(f);
  return out;
}
// ---- vraagtypes ----
function nameItem(s, f, all) {
  const pc = FretQuiz.pcAt(s, f), lo = SHARP_NAMES[mod12(pc - 1)], hi = SHARP_NAMES[mod12(pc + 1)];
  const explain = NATURAL.has(pc) ? `In de buurt: ${FretQuiz.near(s, f)}.` : `${FretQuiz.both(pc)} ligt één fret boven ${NATURAL.has(mod12(pc - 1)) ? lo : FLAT_NAMES[mod12(pc - 1)]} en één fret onder ${hi}.`;
  return { type: 'name', skill: 'hals-name', prompt: 'Welke noot is dit?', sub: FretQuiz.label(s, f), s, f, pc, all: !!all, explain };
}
function findItem(pc, strings, flats) {
  const valid = FretQuiz.spots(pc, strings, 0, 12), name = (flats ? FLAT_NAMES : SHARP_NAMES)[pc];
  const where = valid.map(p => `${STR_LETTER[p.s]}-snaar ${p.f === 0 ? 'los' : 'fret ' + p.f}`).join(', ');
  return { type: 'tapall', skill: 'hals-find', prompt: valid.length > 1 ? `Tik alle ${name}'s op ${stringsPhrase(strings)}` : `Tik de ${name} op ${stringsPhrase(strings)}`, sub: valid.length > 1 ? `Er zijn er ${valid.length}, tussen fret 0 en 12.` : 'Tik op de hals.', pc, name, strings, valid, explain: `${name} ligt op: ${where}.` };
}
// ---- Leren ----
function halsLearnItems(L, i) {
  const out = [];
  if (!L.nat) {
    if (!L.final) {
      out.push(learnCard('Kruis en mol', ['Een ♯ (kruis) maakt een noot één fret hoger, een ♭ (mol) één fret lager.', 'A♯ en B♭ zijn dus dezelfde fret: twee namen voor één noot.'], { from: 0, to: 5, highlight: [4], marks: [lmk(4, 0), lmk(4, 1, 'acc', 'A♯'), lmk(4, 2)] }));
      out.push(learnCard('Twaalf noten op een snaar', ['Tussen stamtonen die twee frets uit elkaar liggen, zit één noot met twee namen: C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭ en A♯/B♭.', 'Zo krijg je twaalf noten, en op fret 12 begint het opnieuw.'], { from: 0, to: 12, highlight: [5], marks: Array.from({ length: 13 }, (_, f) => lmk(5, f, NATURAL.has(FretQuiz.pcAt(5, f)) ? '' : 'acc')) }));
      out.push(learnCard('Niets tussen E en F, en tussen B en C', ['Daar liggen de stamtonen al naast elkaar. E♯ is gewoon F en B♯ is C.', 'Op de piano zie je het ook: daar zit geen zwarte toets.'], { from: 0, to: 9, highlight: [5], marks: [lmk(5, 0, 'pair'), lmk(5, 1, 'pair'), lmk(5, 7, 'pair'), lmk(5, 8, 'pair')] }));
      out.push(nameItem(5, 2, true), nameItem(4, 1, true), nameItem(3, 4, true));
    } else {
      out.push(learnCard('De octaafvorm', ['Elke noot vind je terug met de octaafvorm: twee snaren hoger en twee frets verder.', 'Ga je over de B-snaar heen, dan is het drie frets.'], { from: 0, to: 12, highlight: [], marks: [lmk(5, 8, 'hi'), lmk(3, 10, 'hi'), lmk(4, 3, 'hi'), lmk(2, 5, 'hi'), lmk(0, 8, 'hi')] }));
      out.push(learnCard('Alle C\'s op de hals', ['Tussen fret 0 en 12 zit de C zes keer. Zie je de vormen? Twee snaren, twee frets.', 'Bij Toepassen zoek je zo zelf elke noot.'], { from: 0, to: 12, marks: FretQuiz.spots(0, [5, 4, 3, 2, 1, 0], 0, 12).map(p => lmk(p.s, p.f, 'hi')) }));
      out.push(learnCard('Je ankers op fret 5', ['Op fret 5 klinkt bijna altijd de volgende snaar los: A, D, G en E. Alleen de G-snaar wijkt af: daar is het fret 4.', 'Bij Herkennen telt ook je snelheid. Kijk eerst naar een anker en tel van daaruit.'], { from: 0, to: 9, marks: [lmk(5, 5, 'hi'), lmk(4, 5, 'hi'), lmk(3, 5, 'hi'), lmk(2, 4, 'hi'), lmk(1, 5, 'hi')] }));
      out.push(nameItem(4, 7, true), nameItem(2, 9, true), nameItem(1, 6, true));
    }
    return out;
  }
  const s = L.strings[0], open = FretQuiz.nameAt(s, 0), nats = naturalsOn(s);
  const pairs = nats.filter(f => { const pc = FretQuiz.pcAt(s, f); return pc === 4 || pc === 5 || pc === 11 || pc === 0; });
  out.push(learnCard(`De ${STR_NAME[s]}`, [`Snaar ${s + 1}${s === 5 ? ', de dikste' : s === 0 ? ', de dunste' : ''}. Los klinkt een ${open}. Op fret 12 klinkt weer een ${open}, een octaaf hoger.`, 'Daartussen liggen alle andere noten.'],
    { from: 0, to: 12, highlight: [s], marks: [lmk(s, 0, 'hi'), lmk(s, 12, 'hi')] }, open));
  out.push(learnCard('Twee frets per stap', ['Van de ene stamtoon naar de volgende is het twee frets.', 'Behalve tussen E en F en tussen B en C (paars): die liggen naast elkaar, één fret.'],
    { from: 0, to: 12, highlight: [s], marks: nats.map(f => lmk(s, f, pairs.includes(f) ? 'pair' : '')) }));
  out.push(learnCard('Je ankers', [L.anchorText, 'Zoek je een andere noot, tel dan vanaf het dichtstbijzijnde anker.'],
    { from: 0, to: 12, highlight: [s], marks: nats.map(f => lmk(s, f, L.anchors.includes(f) ? 'hi' : '')) }));
  if (L.ex) {
    const [[s1, f1], [s2, f2]] = L.ex;
    out.push(learnCard('Wat je al weet', [L.link], { from: 0, to: 12, highlight: [s1, s2], marks: [lmk(s1, f1, 'hi'), lmk(s2, f2, 'hi')] }));
  }
  // drie makkelijke vragen: de ankers
  for (const f of shuffle(L.anchors).slice(0, 3)) out.push(nameItem(s, f, false));
  return out;
}
// ---- Herkennen: welke noot is dit? ----
function halsRecognize(L, i) {
  const items = [];
  if (L.nat) {
    const s = L.strings[0];
    // elke stamtoon één keer (E op een E-snaar los of op 12), en drie herhaalvragen van eerdere snaren
    const byPc = new Map();
    for (const f of shuffle(naturalsOn(s))) if (!byPc.has(FretQuiz.pcAt(s, f))) byPc.set(FretQuiz.pcAt(s, f), f);
    for (const f of byPc.values()) items.push(nameItem(s, f, false));
    const before = HALS_LEVELS.slice(0, i).filter(x => x.nat).map(x => x.strings[0]);
    for (let k = 0; k < 3; k++) {
      const s2 = before.length ? pick(before) : s, sp = FretQuiz.pickSpot([s2], 0, 12, true);
      items.push(nameItem(s2, sp.f, false));
    }
    return shuffle(items);
  }
  let prev = null;
  if (!L.final) {
    // zeven noten tussen de stamtonen en drie stamtonen, met alle twaalf toetsen
    for (let k = 0; k < 7; k++) { const sp = FretQuiz.pickSpot(L.strings, 1, 11, 'acc', prev); prev = sp; items.push(nameItem(sp.s, sp.f, true)); }
    for (let k = 0; k < 3; k++) { const sp = FretQuiz.pickSpot(L.strings, 0, 12, 'nat', prev); prev = sp; items.push(nameItem(sp.s, sp.f, true)); }
    return shuffle(items);
  }
  for (let k = 0; k < 12; k++) { const sp = FretQuiz.pickSpot(L.strings, 0, 12, false, prev); prev = sp; items.push(nameItem(sp.s, sp.f, true)); }
  return items;
}
// ---- Toepassen: tik alle plekken ----
function halsApply(L, i) {
  const items = [];
  if (L.nat) {
    const s = L.strings[0], learned = HALS_LEVELS.slice(0, i + 1).filter(x => x.nat).map(x => x.strings[0]);
    for (const pc of shuffle([...new Set(naturalsOn(s).map(f => FretQuiz.pcAt(s, f)))]).slice(0, learned.length > 1 ? 4 : 6)) items.push(findItem(pc, [s]));
    if (learned.length > 1) {
      // over de snaren die je al kent: zo ga je de hals als geheel zien
      const set = learned.length > 3 ? shuffle(learned).slice(0, 3) : learned;
      for (const pc of shuffle(LETTER_PC).slice(0, 2)) items.push(findItem(pc, set));
    }
    return items;
  }
  const acc = [1, 3, 6, 8, 10];
  if (!L.final) {
    for (const pc of shuffle(acc).slice(0, 4)) items.push(findItem(pc, [pick(L.strings)], Math.random() < 0.5));
    for (const pc of shuffle(acc).slice(0, 2)) items.push(findItem(pc, [5, 4], Math.random() < 0.5));
    return items;
  }
  for (const pc of shuffle(LETTER_PC).slice(0, 3)) items.push(findItem(pc, L.strings));
  items.push(findItem(pick(acc), L.strings, Math.random() < 0.5));
  return items;
}
// ---- Niveaus als units op het leerpad ----
const HalsData = {
  units() { return HALS_LEVELS.map((L, i) => ({ lesson: 'H' + (i + 1), track: 'hals', topic: 'hals', idx: i, title: L.title, subtitle: L.sub })); },
};
function halsNodes(unit) {
  const L = HALS_LEVELS[unit.idx], i = unit.idx;
  return [
    { title: 'Leren', icon: ICONS.book, info: 'Uitleg met de hals erbij, daarna drie korte vragen. Zonder gitaar, ongeveer 2 minuten.', gen: () => halsLearnItems(L, i) },
    { title: 'Herkennen', icon: ICONS.eye, pass: 0.8, info: `${L.final ? 'Twaalf' : 'Tien'} keer: welke noot is dit? Met 80% goed haal je deze stap. Ook je snelheid telt mee.`, gen: () => halsRecognize(L, i) },
    { title: 'Toepassen', icon: ICONS.target, pass: 0.8, info: 'Zoek de noot zelf: tik alle plekken aan op de hals. Met 80% goed heb je dit niveau beheerst.', gen: () => halsApply(L, i) },
  ];
}
function halsSummary(unit) {
  const L = HALS_LEVELS[unit.idx];
  if (L.nat) return [L.anchorText, 'Van stamtoon naar stamtoon is het twee frets, behalve E–F en B–C: die liggen naast elkaar.'].concat(L.link ? [L.link] : []);
  if (!L.final) return ['Een ♯ is één fret hoger, een ♭ één fret lager. A♯ en B♭ zijn dezelfde fret.', 'Tussen E en F en tussen B en C zit geen fret: E♯ is F en B♯ is C.'];
  return ['De octaafvorm: twee snaren hoger, twee frets verder. Over de B-snaar heen drie frets.', 'Op fret 5 klinkt bijna altijd de volgende snaar los. Op de G-snaar is dat fret 4.'];
}
const halsLevelDone = i => { const u = HalsData.units()[i]; return u && [0, 1, 2].every(k => nodeDone(u, k)); };
const halsDoneCount = () => HALS_LEVELS.filter((L, i) => halsLevelDone(i)).length;
function nextHals() {
  const units = HalsData.units();
  for (let u = 0; u < units.length; u++) {
    const nodes = unitNodes(units[u]);
    for (let i = 0; i < nodes.length; i++) if (nodeState(units[u], nodes, i) === 'open') return { unit: units[u], index: i, node: nodes[i], unitNo: u + 1 };
  }
  return null;
}
