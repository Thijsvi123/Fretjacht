// ---------- Gehoor: leren naspelen op gehoor, met of zonder gitaar ----------
// Tien niveaus: intervallen per paar, dan akkoordsoorten, dan I–IV–V herkennen, dan korte melodietjes naspelen.
// Elk niveau heeft drie stappen, net als de Halsjacht:
//  Leren:     uitleg met voorbeelden om te beluisteren, daarna drie makkelijke vragen
//  Herkennen: tien keer: wat hoor je? Met 80% goed haal je de stap. Bij een fout hoor je het verschil.
//  Toepassen: speel na wat je hoort (80% goed). Met gitaar luistert de app mee; zonder gitaar tik je het na
//             op toetsen in de app, die klinken als je erop tikt.
// Vraagtypes in de lesspeler (12-lesson.js):
//  mc met hear (het geluid, zoals een play-knop van een kaartje) en hearBy (per antwoord een geluid om te vergelijken)
//  play met hear en pad: { lo, hi } (de toetsen, midi). Stappen zoals bij spelen: pc, rel of set; given: deze
//  toon krijg je (de eerste noot), midi: de toon die klonk (voor "hoger" of "lager" bij een foute noot).
const tok = m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mod12(m)] + (Math.floor(m / 12) - 1);
const toks = ms => ms.map(tok).join(' ');
const ivBy = s => INTERVALS.find(i => i.semis === s);
const capFirst = s => s[0].toUpperCase() + s.slice(1);
const IV_FEEL = { 1: 'schurend en dichtbij', 2: 'een gewone stap', 3: 'donker, zoals mineur', 4: 'blij en open, zoals majeur', 5: 'open, alsof er iets begint', 6: 'onrustig: hij wil ergens heen', 7: 'open en stevig, de klank van een powerchord', 8: 'zacht en wat weemoedig', 9: 'zonnig en wijd', 10: 'spannend, alsof er nog iets komt', 11: 'scherp, net onder het octaaf', 12: 'dezelfde noot, alleen hoger' };
const ivExplain = semis => `${capFirst(ivBy(semis).name)}: ${IV_FEEL[semis]}.${IV_HINT[semis] ? ` Denk aan ${IV_HINT[semis]}.` : ''}`;

const GEHOOR_LEVELS = [
  { kind: 'iv', set: [7, 12], title: 'Kwint en octaaf', sub: 'De stevigste sprongen', cards: [
    { t: 'Luisteren', p: ['In dit pad train je je oren. Zo leer je nummers naspelen zonder akkoordenschema: je hoort wat er gebeurt en je vindt het op je gitaar.', 'Je begint met twee sprongen die je kent uit les 1: het octaaf en de kwint.'],
      play: [{ l: 'Probeer het geluid', n: 'A2 E3 A3', gap: 0.6 }], tip: 'Hoor je niets? Zet het geluid van je telefoon harder. Op een iPhone moet ook de stille modus uit.' },
    { t: 'Het octaaf', p: ['Bij een octaaf klinkt de tweede toon als dezelfde noot, alleen hoger. Het voelt alsof er niets verandert behalve de hoogte.', 'Denk aan het begin van Somewhere over the Rainbow: “Some-where” is een octaaf omhoog.'],
      play: [{ l: 'A en de A erboven', n: 'A2 A3', gap: 0.75 }, { l: 'D en de D erboven', n: 'D3 D4', gap: 0.75 }] },
    { t: 'De kwint', p: ['De kwint klinkt open en stevig, maar je hoort echt twee verschillende tonen. Samen zijn ze een powerchord.', 'Denk aan Altijd is Kortjakje ziek: na de eerste twee tonen springt de melodie een kwint omhoog. Of aan de lange tonen van Star Wars.'],
      play: [{ l: 'A en de kwint E', n: 'A2 E3', gap: 0.75 }, { l: 'Samen: A5', n: 'A2 E3', c: true }],
      tip: 'Klinkt de tweede toon als dezelfde noot, dan is het een octaaf. Klinkt hij anders maar stevig, dan is het een kwint.' },
  ] },
  { kind: 'iv', set: [4, 3], title: 'Grote en kleine terts', sub: 'Blij of donker', cards: [
    { t: 'Twee tertsen', p: ['De grote terts (4 halve tonen) klinkt blij en open. De kleine terts (3 halve tonen) klinkt donkerder. Het scheelt maar één fret, maar je hoort het verschil.', 'Grote terts: het begin van When the Saints Go Marching In (“Oh when”). Kleine terts: het begin van de riff van Smoke on the Water.'],
      play: [{ l: 'Grote terts', n: 'C3 E3', gap: 0.75 }, { l: 'Kleine terts', n: 'C3 Eb3', gap: 0.75 }] },
    { t: 'Majeur en mineur', p: ['Die terts hoor je terug in akkoorden. Met een grote terts is een akkoord majeur, met een kleine terts mineur.'],
      play: [{ l: 'A majeur', n: 'A2 E3 A3 C#4 E4', c: true }, { l: 'A mineur', n: 'A2 E3 A3 C4 E4', c: true }],
      tip: 'Neurie de tweede toon na. Voelt hij vrolijk, dan is het de grote terts.' },
  ] },
  { kind: 'iv', set: [5, 7], down: 2, title: 'Kwart en kwint', sub: 'Twee open sprongen die op elkaar lijken', cards: [
    { t: 'De kwart', p: ['De kwart (5 halve tonen) klinkt open, alsof er iets begint. Het Wilhelmus begint met een kwart omhoog, net als de trouwmars Here Comes the Bride.', 'De kwint is twee halve tonen groter en klinkt wijder. Ze lijken op elkaar, dus luister goed.'],
      play: [{ l: 'Kwart', n: 'E3 A3', gap: 0.75 }, { l: 'Kwint', n: 'E3 B3', gap: 0.75 }] },
    { t: 'Omhoog en omlaag', p: ['Vanaf nu hoor je soms een interval omlaag: de tweede toon is lager. Het is hetzelfde interval, alleen de andere kant op. Bij de vraag staat of het omhoog of omlaag gaat.'],
      play: [{ l: 'Kwart omhoog', n: 'E3 A3', gap: 0.75 }, { l: 'Kwart omlaag', n: 'A3 E3', gap: 0.75 }, { l: 'Kwint omlaag', n: 'B3 E3', gap: 0.75 }],
      tip: 'Zing een sprong omlaag eens andersom, van laag naar hoog. Dan hoor je makkelijker welke sprong het is.' },
  ] },
  { kind: 'iv', set: [1, 2], down: 3, title: 'Halve en hele toon', sub: 'De kleine stapjes van een melodie', cards: [
    { t: 'Kleine stapjes', p: ['Een halve toon is één fret, een hele toon twee frets. Melodieën bestaan vooral uit zulke stapjes.', 'Halve toon: het thema van Jaws, dicht op elkaar en spannend. Hele toon: het begin van Vader Jacob (“Va-der”).'],
      play: [{ l: 'Halve toon', n: 'E3 F3', gap: 0.75 }, { l: 'Hele toon', n: 'C3 D3', gap: 0.75 }, { l: 'Jaws', n: 'E2 F2 E2 F2 E2 F2', gap: 0.42 }] },
    { t: 'Stap voor stap', p: ['In een toonladder zitten ze allebei. De majeurtoonladder is H H h H H H h: de halve stappen zitten tussen trap 3 en 4 en tussen trap 7 en 8.'],
      play: [{ l: 'C majeur', n: 'C3 D3 E3 F3 G3 A3 B3 C4', gap: 0.4 }],
      tip: 'Een halve toon klinkt schurend, alsof de toon net naast de vorige ligt. Een hele toon klinkt als een gewone stap.' },
  ] },
  { kind: 'iv', set: [8, 9], down: 2, title: 'Sexten', sub: 'Grote sprongen die zingen', cards: [
    { t: 'Twee sexten', p: ['Een sext is een grote sprong die toch zingt. De grote sext (9 halve tonen) klinkt zonnig en wijd: denk aan My Bonnie (“My Bon-nie”).', 'De kleine sext (8 halve tonen) klinkt zachter en wat weemoedig: denk aan de sprong na het loopje aan het begin van The Entertainer.'],
      play: [{ l: 'Grote sext', n: 'C3 A3', gap: 0.75 }, { l: 'Kleine sext', n: 'C3 Ab3', gap: 0.75 }] },
    { t: 'Omgekeerde tertsen', p: ['Een sext is een omgekeerde terts (les 2). Een grote sext omhoog komt uit op dezelfde noot als een kleine terts omlaag. Een kleine sext omhoog op dezelfde noot als een grote terts omlaag.'],
      play: [{ l: 'C, grote sext omhoog', n: 'C3 A3', gap: 0.75 }, { l: 'C, kleine terts omlaag', n: 'C3 A2', gap: 0.75 }],
      tip: 'Twijfel je tussen de twee? Zing My Bonnie. Past de sprong, dan is het de grote sext.' },
  ] },
  { kind: 'iv', set: [10, 11, 6], down: 2, title: 'Septiemen en tritonus', sub: 'Spanning die ergens heen wil', cards: [
    { t: 'Twee septiemen', p: ['De kleine septiem (10 halve tonen) klinkt spannend, alsof er nog iets komt: het begin van Somewhere uit West Side Story (“There’s a place”).', 'De grote septiem (11 halve tonen) ligt een halve toon onder het octaaf en klinkt scherp. Je hoort hem aan het begin van het refrein van Take On Me.'],
      play: [{ l: 'Kleine septiem', n: 'C3 Bb3', gap: 0.75 }, { l: 'Grote septiem', n: 'C3 B3', gap: 0.75 }, { l: 'Octaaf', n: 'C3 C4', gap: 0.75 }],
      tip: 'Wil de tweede toon nog een stapje omhoog naar het octaaf? Dan is het de grote septiem.' },
    { t: 'De tritonus', p: ['Precies tussen de kwart en de kwint ligt de tritonus: zes halve tonen, drie hele tonen. Hij klinkt onrustig en wil ergens heen.', 'Je hoort hem aan het begin van de tune van The Simpsons, en in Maria uit West Side Story.'],
      play: [{ l: 'Tritonus', n: 'C3 F#3', gap: 0.75 }, { l: 'Kwart, tritonus, kwint', n: 'C3 F3 C3 F#3 C3 G3', gap: 0.55 }],
      tip: 'Wil de tweede toon nog een halve toon omhoog, naar de kwint? Dan is het de tritonus.' },
  ] },
  { kind: 'ch', set: ['maj', 'min'], title: 'Majeur en mineur', sub: 'Hoor de terts in een akkoord', cards: [
    { t: 'Blij of donker', p: ['Een akkoord klinkt majeur (helder, blij) of mineur (donker, weemoedig). Het verschil zit in één toon: de terts. Dat weet je nog uit les 6.'],
      play: [{ l: 'E majeur', n: 'E2 B2 E3 G#3 B3', c: true }, { l: 'E mineur', n: 'E2 B2 E3 G3 B3', c: true }, { l: 'A majeur', n: 'A2 E3 A3 C#4 E4', c: true }, { l: 'A mineur', n: 'A2 E3 A3 C4 E4', c: true }] },
    { t: 'Hoor de terts', p: ['Luister naar de tonen los. De middelste toon is de terts: die maakt het verschil.'],
      play: [{ l: 'A majeur los', n: 'A2 C#3 E3', gap: 0.5 }, { l: 'A mineur los', n: 'A2 C3 E3', gap: 0.5 }],
      tip: 'Neurie de terts van het akkoord. Klinkt hij vrolijk, dan is het majeur.' },
  ] },
  { kind: 'ch', set: ['maj', 'min', 'dom7'], title: 'Majeur, mineur en 7', sub: 'Het bluesy septiemakkoord', cards: [
    { t: 'Het 7-akkoord', p: ['Zet een kleine septiem op een majeurakkoord en je hebt een dominant 7, zoals A7. Het klinkt bluesy en onaf, alsof het verder wil: meestal naar het akkoord een kwint lager.', 'In de blues is vaak elk akkoord een 7, zoals A7, D7 en E7.'],
      play: [{ l: 'A', n: 'A2 E3 A3 C#4 E4', c: true }, { l: 'A7', n: 'A2 E3 G3 C#4 E4', c: true }, { l: 'E7 naar A', ch: ['E2 B2 D3 G#3 B3', 'A2 E3 A3 C#4 E4'] }] },
    { t: 'Drie kleuren', p: ['Majeur klinkt helder, mineur donker, en een 7-akkoord bluesy met een randje spanning. Vergelijk ze op dezelfde grondtoon.'],
      play: [{ l: 'D', n: 'D3 A3 D4 F#4 A4', c: true }, { l: 'Dm', n: 'D3 A3 D4 F4 A4', c: true }, { l: 'D7', n: 'D3 A3 C4 F#4 A4', c: true }],
      tip: 'Hoor je iets wat schuurt en verder wil? Dan is het een 7-akkoord.' },
  ] },
  { kind: 'prog', title: 'I, IV en V', sub: 'Thuis, weg van huis en spanning', cards: [
    { t: 'Thuis, weg en spanning', p: ['In een nummer is I thuis. IV voelt als weg van huis, ontspannen. V geeft spanning en wil terug naar I. Dat ken je uit les 7 en 8.'],
      play: [{ l: 'I – IV – V – I in A', ch: ['A2 E3 A3 C#4 E4', 'D3 A3 D4 F#4', 'E2 B2 E3 G#3 B3', 'A2 E3 A3 C#4 E4'], gap: 1.2 }] },
    { t: 'Zo hoor je het verschil', p: ['Na I klinkt IV open en rustig, alsof je een stap opzij zet. V klinkt alsof er nog iets moet komen.', 'Zing de grondtoon mee: bij IV gaat hij een kwart omhoog, bij V een kwint omhoog of een kwart omlaag.'],
      play: [{ l: 'I naar IV', ch: ['A2 E3 A3 C#4 E4', 'D3 A3 D4 F#4'], gap: 1.2 }, { l: 'I naar V', ch: ['A2 E3 A3 C#4 E4', 'E2 B2 E3 G#3 B3'], gap: 1.2 }],
      tip: 'Kun je de grondtonen meezingen, dan kun je ze ook spelen. Dat doe je bij Toepassen.' },
  ] },
  { kind: 'mel', title: 'Korte melodietjes', sub: 'Speel na wat je hoort', cards: [
    { t: 'Stap of sprong', p: ['Een melodie gaat omhoog of omlaag, met stapjes (een halve of hele toon) of met sprongen (een terts of meer). Vraag je bij elke noot af: hoger of lager, stap of sprong?'],
      play: [{ l: 'Stapjes omhoog', n: 'C4 D4 E4 F4', gap: 0.5 }, { l: 'Met een sprong', n: 'C4 E4 D4 C4', gap: 0.5 }] },
    { t: 'Zo speel je na', p: ['Zing de melodie eerst in je hoofd. De eerste noot krijg je van de app. Zoek daarna noot voor noot verder: stap of sprong, omhoog of omlaag.', 'De melodietjes blijven in één toonladder, zoals C majeur. Je hoeft dus niet alle tonen te proberen.'],
      play: [{ l: 'Voorbeeld in C', n: 'E4 D4 C4 D4 E4', gap: 0.5 }],
      tip: 'Een foute noot is niet erg: zo zoek je hem. Na een foute noot hoor je of je hoger of lager moet zoeken.' },
  ] },
];

// ---- intervallen ----
const IV_ROOTS_UP = [45, 47, 48, 50, 52, 53, 55, 57];       // A2 tot A3, alleen stamtonen
const IV_ROOTS_DOWN = [57, 59, 60, 62, 64, 65, 67, 69];     // A3 tot A4
const ivSound = (base, semis, dir) => ({ n: toks([base, dir === 'down' ? base - semis : base + semis]), gap: 0.75 });
// alle intervallen tot en met niveau idx
const learnedIvs = idx => uniq(GEHOOR_LEVELS.slice(0, idx + 1).filter(L => L.kind === 'iv').flatMap(L => L.set)).sort((a, b) => a - b);
// welk interval hoor je? opts: de keuzes (halve tonen); dirLabel: zeg of het omhoog of omlaag gaat
function earIv(semis, opts, dir, dirLabel) {
  const base = pick(dir === 'down' ? IV_ROOTS_DOWN : IV_ROOTS_UP), hearBy = {};
  for (const s of opts) hearBy[ivBy(s).name] = ivSound(base, s, dir);
  const options = shuffle(opts.map(s => ivBy(s).name));
  return { type: 'mc', skill: 'ear-iv-' + semis, eq: 'iv-' + semis, prompt: 'Welk interval hoor je?', sub: dirLabel ? (dir === 'down' ? 'Omlaag: de tweede toon is lager' : 'Omhoog: de tweede toon is hoger') : undefined,
    options, answer: options.indexOf(ivBy(semis).name), hear: ivSound(base, semis, dir), hearBy, explain: ivExplain(semis) };
}
// keuzes voor een herhaalvraag: het goede interval en de twee die er het meest op lijken
function ivChoices(semis, pool) {
  return [semis].concat(pool.filter(s => s !== semis).sort((a, b) => Math.abs(a - semis) - Math.abs(b - semis)).slice(0, 2)).sort((a, b) => a - b);
}
// speel na: de eerste toon krijg je, de tweede zoek je op gehoor
function earIvPlay(semis) {
  const base = pick(IV_ROOTS_UP), iv = ivBy(semis), root = SHARP_NAMES[mod12(base)];
  const target = spName(spellFrom(parseName(root), iv.steps, iv.semis));
  return { type: 'play', skill: 'ear-play-iv-' + semis, prompt: 'Speel na wat je hoort', big: root, sub: `De eerste toon is ${root}. Welke toon komt erna?`, pad: { lo: base, hi: base + 12 },
    steps: [{ k: 'pc', pc: mod12(base), name: root, midi: base, given: true }, { k: 'rel', semis, name: target, midi: base + semis }],
    hear: ivSound(base, semis, 'up'), hint: `Het is ${ivWord(semis)}${IV_HINT[semis] ? `: denk aan ${IV_HINT[semis]}` : ''}.`, explain: `${root} → ${target}: ${ivWord(semis)}, ${IV_FEEL[semis]}.` };
}

// ---- akkoorden: open liggingen zoals op de gitaar (grondtoon, kwint, octaaf, terts, kwint) ----
const CH_ROOTS = [40, 43, 45, 48, 50, 52];                  // E2 G2 A2 C3 D3 E3
const VOICING = { maj: [0, 7, 12, 16, 19], min: [0, 7, 12, 15, 19], dom7: [0, 7, 10, 16, 19] };
const chordSound = (root, type) => ({ n: toks(VOICING[type].map(d => root + d)), c: true });
const CH_LABEL = { maj: 'majeur', min: 'mineur', dom7: '7-akkoord' };
const CH_EXPLAIN = {
  maj: 'Majeur: helder en open. Het verschil met mineur zit in de terts, die is groot.',
  min: 'Mineur: donker en weemoedig. Het verschil met majeur zit in de terts, die is klein.',
  dom7: 'Een 7-akkoord klinkt bluesy en onaf, alsof het verder wil. Het is een majeurakkoord met een kleine septiem erbij.',
};
const chExplain = type => CH_EXPLAIN[type];
function earChord(type, set) {
  const root = pick(CH_ROOTS), hearBy = {};
  for (const t of set) hearBy[CH_LABEL[t]] = chordSound(root, t);
  const options = shuffle(set.map(t => CH_LABEL[t]));
  return { type: 'mc', skill: 'ear-ch-' + type, eq: 'ch-' + type, prompt: 'Welk akkoord hoor je?', options, answer: options.indexOf(CH_LABEL[type]), hear: chordSound(root, type), hearBy, explain: chExplain(type) };
}
// speel de terts: de grondtoon krijg je, de terts hoor je
function earThirdPlay() {
  const type = pick(['maj', 'min']), root = pick([43, 45, 48, 50, 52]), name = SHARP_NAMES[mod12(root)], third = chordTones(type, name)[1], semis = type === 'maj' ? 4 : 3;
  return { type: 'play', skill: 'ear-play-third', prompt: 'Speel de terts die je hoort', big: name, sub: `Een akkoord op ${name}. De grondtoon heb je al: welke terts hoor je?`, pad: { lo: root, hi: root + 12 },
    steps: [{ k: 'pc', pc: mod12(root), name, midi: root, given: true }, { k: 'pc', pc: third.pc, name: third.name, midi: root + semis }],
    hear: chordSound(root, type), hint: type === 'maj' ? `Het klinkt majeur: de grote terts, 4 halve tonen boven ${name}.` : `Het klinkt mineur: de kleine terts, 3 halve tonen boven ${name}.`,
    explain: `${chordName(name, type)}: de terts is ${third.name}, ${type === 'maj' ? 'groot' : 'klein'}.` };
}
// speel alle tonen die je hoort, in elke volgorde
function earChordPlay(types) {
  const type = pick(types), root = pick([43, 45, 48, 50, 52]), name = SHARP_NAMES[mod12(root)], tones = chordTones(type, name);
  return { type: 'play', skill: 'ear-play-chord', prompt: 'Speel alle tonen die je hoort', big: name, sub: `Een akkoord op ${name}. Speel elke toon die erin zit, in elke volgorde.`, pad: { lo: root, hi: root + 12 },
    steps: [{ k: 'set', pcs: tones.map(t => t.pc), names: tones.map(t => t.name), labels: tones.map(() => '') }],
    hear: chordSound(root, type), hint: `Het is ${type === 'dom7' ? 'een 7-akkoord: grondtoon, grote terts, kwint en kleine septiem' : type === 'maj' ? 'majeur: grondtoon, grote terts en kwint' : 'mineur: grondtoon, kleine terts en kwint'}.`,
    explain: `${chordName(name, type)}: ${tones.map(t => t.name).join(' ')}.` };
}

// ---- I, IV en V: eerst thuis, dan het akkoord ----
const PROG_KEYS = [{ key: 'A', r: 45 }, { key: 'E', r: 40 }, { key: 'D', r: 50 }, { key: 'G', r: 43 }, { key: 'C', r: 48 }];
const PROG_SEQS = [['I', 'IV', 'V', 'I'], ['I', 'V', 'IV', 'I'], ['I', 'IV', 'I', 'V'], ['I', 'V', 'I', 'IV'], ['I', 'IV', 'V', 'IV'], ['I', 'V', 'IV', 'V']];
const DEG = { I: 0, IV: 5, V: 7 };
// grondtoon in de bas: IV een kwart en V een kwint boven I, met kwint, octaaf en terts erboven
function progBass(K, rn) { return K.r + DEG[rn]; }
const progChord = (K, rn) => { const b = progBass(K, rn); return toks([b, b + 7, b + 12, b + 16]); };
const progSound = (K, seq) => ({ ch: seq.map(rn => progChord(K, rn)), gap: 1.2 });
const progNames = (K, seq) => seq.map(rn => spName(spellFrom(parseName(K.key), rn === 'I' ? 0 : rn === 'IV' ? 3 : 4, DEG[rn])));
const PROG_FEEL = { IV: 'IV klinkt als weg van huis: open en ontspannen. De grondtoon gaat een kwart omhoog.', V: 'V klinkt gespannen en wil terug naar I. De grondtoon gaat een kwint omhoog of een kwart omlaag.' };
function earProgOne() {
  const K = pick(PROG_KEYS), x = pick(['IV', 'V']), hearBy = { IV: progSound(K, ['I', 'IV']), V: progSound(K, ['I', 'V']) };
  return { type: 'mc', skill: 'ear-prog-' + x, prompt: 'Je hoort eerst I, thuis. Welk akkoord komt daarna?', sub: `In ${K.key} majeur`, options: ['IV', 'V'], answer: x === 'IV' ? 0 : 1, hear: progSound(K, ['I', x]), hearBy, explain: PROG_FEEL[x] };
}
function earProgSeq() {
  const K = pick(PROG_KEYS), seq = pick(PROG_SEQS), label = s => s.join(' – '), hearBy = {};
  const opts = [seq].concat(shuffle(PROG_SEQS.filter(s => s !== seq)).slice(0, 2));
  for (const s of opts) hearBy[label(s)] = progSound(K, s);
  const options = shuffle(opts.map(label));
  return { type: 'mc', skill: 'ear-prog-seq', prompt: 'Welk rondje hoor je?', sub: `Vier akkoorden in ${K.key} majeur. Het eerste is I.`, options, answer: options.indexOf(label(seq)), hear: progSound(K, seq), hearBy,
    explain: `${label(seq)}: ${progNames(K, seq).join(' – ')}. I is thuis, IV ontspannen en V wil terug naar huis.` };
}
// speel de grondtonen mee
function earProgPlay() {
  const K = pick(PROG_KEYS), seq = pick(PROG_SEQS), names = progNames(K, seq);
  return { type: 'play', skill: 'ear-play-prog', prompt: 'Speel de grondtonen mee', big: K.key, sub: `Vier akkoorden in ${K.key} majeur. Het eerste is ${K.key}, thuis.`, pad: { lo: K.r, hi: K.r + 12 },
    steps: seq.map((rn, i) => ({ k: 'pc', pc: mod12(K.r + DEG[rn]), name: names[i], midi: progBass(K, rn), given: i === 0 })),
    hear: progSound(K, seq), hint: `Het rondje is ${seq.join(' – ')}.`, explain: `${seq.join(' – ')}: ${names.join(' – ')}.` };
}

// ---- melodietjes in een majeurtoonladder ----
const MEL_KEYS = [{ key: 'C', r: 60 }, { key: 'G', r: 55 }, { key: 'D', r: 62 }, { key: 'A', r: 57 }];
// de toonladdertonen van r-3 tot r+9; begint op trap 1, 3 of 5 en loopt vooral in stapjes
function melPool(K) {
  const tones = scaleTones('major', K.key), out = [];
  for (let m = K.r - 3; m <= K.r + 9; m++) { const t = tones.find(x => x.pc === mod12(m)); if (t) out.push({ m, name: t.name }); }
  return out;
}
function melody(len, K) {
  K = K || pick(MEL_KEYS);
  const pool = melPool(K), start = pick([K.r, K.r + 4, K.r + 7]);
  let idx = pool.findIndex(p => p.m === start);
  const notes = [pool[idx]];
  for (let t = 0; notes.length < len && t < 200; t++) {
    const j = idx + pick([-2, -1, -1, 1, 1, 2]);
    if (j < 0 || j >= pool.length) continue;
    idx = j; notes.push(pool[idx]);
  }
  return { K, pool, notes };
}
const melSound = notes => ({ n: toks(notes.map(x => x.m)), gap: 0.55 });
const melLabel = notes => notes.map(x => x.name).join(' – ');
// hoe de melodie loopt: "omhoog in stapjes", "eerst een sprong omhoog, dan omlaag"
function melShape(notes) {
  const parts = [];
  for (let i = 1; i < notes.length; i++) { const d = notes[i].m - notes[i - 1].m; parts.push(`${d > 0 ? 'omhoog' : 'omlaag'} (${Math.abs(d) <= 2 ? 'stap' : 'sprong'})`); }
  return parts.join(', ');
}
// andere melodieën die er net op lijken: één noot een stapje anders (de eerste blijft)
function melVariants(mel, n) {
  const out = [], seen = new Set([melLabel(mel.notes)]);
  for (let t = 0; t < 60 && out.length < n; t++) {
    const i = 1 + Math.floor(Math.random() * (mel.notes.length - 1)), at = mel.pool.findIndex(p => p.m === mel.notes[i].m), j = at + pick([-1, 1, 2, -2]);
    if (j < 0 || j >= mel.pool.length) continue;
    const v = mel.notes.slice(); v[i] = mel.pool[j];
    if (v.some((x, k) => k && x.m === v[k - 1].m)) continue;   // nooit twee keer dezelfde noot achter elkaar
    const l = melLabel(v);
    if (!seen.has(l)) { seen.add(l); out.push(v); }
  }
  return out;
}
// gaat het omhoog of omlaag?
function earContour() {
  const K = pick(MEL_KEYS), pool = melPool(K), up = Math.random() < 0.5;
  const start = up ? 1 + Math.floor(Math.random() * (pool.length - 4)) : 3 + Math.floor(Math.random() * (pool.length - 4));
  const notes = up ? pool.slice(start, start + 3) : pool.slice(start - 2, start + 1).reverse();
  return { type: 'mc', skill: 'ear-contour', prompt: 'Gaat deze melodie omhoog of omlaag?', options: ['omhoog', 'omlaag'], answer: up ? 0 : 1, hear: melSound(notes),
    hearBy: { omhoog: melSound(up ? notes : notes.slice().reverse()), omlaag: melSound(up ? notes.slice().reverse() : notes) }, explain: `${melLabel(notes)}: in stapjes ${up ? 'omhoog' : 'omlaag'}.` };
}
function earMelQ(len) {
  for (let t = 0; t < 20; t++) {
    const mel = melody(len), vs = melVariants(mel, 2);
    if (vs.length < 2) continue;
    const opts = [mel.notes].concat(vs), hearBy = {};
    for (const v of opts) hearBy[melLabel(v)] = melSound(v);
    const options = shuffle(opts.map(melLabel));
    return { type: 'mc', skill: 'ear-mel', prompt: 'Welke melodie hoor je?', sub: `In ${mel.K.key} majeur. De eerste toon is ${mel.notes[0].name}.`, options, answer: options.indexOf(melLabel(mel.notes)), hear: melSound(mel.notes), hearBy,
      explain: `${melLabel(mel.notes)}: ${melShape(mel.notes)}.` };
  }
  return earContour();
}
// speel de melodie na; de eerste noot krijg je
function earMelPlay(len) {
  const mel = melody(len), lo = mel.pool[0].m, hi = mel.pool[mel.pool.length - 1].m;
  return { type: 'play', skill: 'ear-play-mel', prompt: 'Speel de melodie na', big: mel.notes[0].name, sub: `In ${mel.K.key} majeur. De eerste toon is ${mel.notes[0].name}.`, pad: { lo, hi },
    steps: mel.notes.map((x, i) => ({ k: 'pc', pc: mod12(x.m), name: x.name, midi: x.m, given: i === 0 })),
    hear: melSound(mel.notes), hint: `De melodie gaat ${melShape(mel.notes)}.`, explain: `${melLabel(mel.notes)}: ${melShape(mel.notes)}.` };
}

// ---- de drie stappen van een niveau ----
const earCard = c => ({ type: 'learn', prompt: c.t, text: c.p || [], listen: c.play, tip: c.tip, go: 'Naar de vragen' });
function gehoorLearn(L, i) {
  const out = L.cards.map(earCard);
  for (let k = 0; k < 3; k++) {
    if (L.kind === 'iv') out.push(earIv(L.set[k % L.set.length], L.set, 'up', !!L.down));
    else if (L.kind === 'ch') out.push(earChord(L.set[k % L.set.length], L.set));
    else if (L.kind === 'prog') out.push(earProgOne());
    else out.push(earContour());
  }
  // de makkelijke vragen in willekeurige volgorde, na de uitleg
  return out.slice(0, L.cards.length).concat(shuffle(out.slice(L.cards.length)));
}
function gehoorRecognize(L, i) {
  const items = [];
  if (L.kind === 'iv') {
    const before = learnedIvs(i).filter(s => !L.set.includes(s)), n = before.length ? 7 : 10;
    for (let k = 0; k < n; k++) items.push(earIv(L.set[k % L.set.length], L.set, k < (L.down || 0) ? 'down' : 'up', !!L.down));
    // drie herhaalvragen uit de niveaus ervoor, met de intervallen die erop lijken
    for (let k = 0; k < 10 - n; k++) { const s = pick(before); items.push(earIv(s, ivChoices(s, learnedIvs(i)), 'up', !!L.down)); }
  } else if (L.kind === 'ch') for (let k = 0; k < 10; k++) items.push(earChord(L.set[k % L.set.length], L.set));
  else if (L.kind === 'prog') { for (let k = 0; k < 6; k++) items.push(earProgOne()); for (let k = 0; k < 4; k++) items.push(earProgSeq()); }
  else for (let k = 0; k < 10; k++) items.push(earMelQ(k < 5 ? 3 : 4));
  return shuffle(items);
}
function gehoorApply(L, i) {
  if (L.kind === 'iv') {
    const before = learnedIvs(i).filter(s => !L.set.includes(s)), items = [];
    for (let k = 0; k < 5; k++) items.push(earIvPlay(L.set[k % L.set.length]));
    items.push(earIvPlay(before.length ? pick(before) : pick(L.set)));
    return shuffle(items);
  }
  if (L.kind === 'ch') return L.set.includes('dom7') ? Array.from({ length: 5 }, () => earChordPlay(L.set)) : Array.from({ length: 6 }, () => earThirdPlay());
  if (L.kind === 'prog') return Array.from({ length: 5 }, () => earProgPlay());
  return [3, 4, 4, 5, 5].map(earMelPlay);
}
// ---- niveaus als units op het leerpad ----
const GehoorData = {
  units() { return GEHOOR_LEVELS.map((L, i) => ({ lesson: 'G' + (i + 1), track: 'gehoor', topic: 'gehoor', idx: i, title: L.title, subtitle: L.sub })); },
};
function gehoorNodes(unit) {
  const L = GEHOOR_LEVELS[unit.idx], i = unit.idx;
  return [
    { title: 'Leren', icon: ICONS.book, info: 'Uitleg met voorbeelden om te beluisteren, daarna drie korte vragen. Ongeveer 3 minuten. Zet het geluid van je telefoon aan.', gen: () => gehoorLearn(L, i) },
    { title: 'Herkennen', icon: ICONS.ear, pass: 0.8, info: 'Tien keer: wat hoor je? Met 80% goed haal je deze stap. Heb je het fout, dan hoor je het verschil.', gen: () => gehoorRecognize(L, i) },
    { title: 'Toepassen', icon: ICONS.target, pass: 0.8, get info() { return Guitar.on() ? 'Speel na wat je hoort, op je gitaar. De app luistert mee. Met 80% goed heb je dit niveau beheerst.' : 'Speel na wat je hoort, op de toetsen in de app. Elke toets klinkt. Met 80% goed heb je dit niveau beheerst.'; }, gen: () => gehoorApply(L, i) },
  ];
}
const GEHOOR_SUMMARY = [
  ['Octaaf: dezelfde noot, alleen hoger (Somewhere over the Rainbow).', 'Kwint: open en stevig, de klank van een powerchord (Kortjakje, Star Wars).'],
  ['Grote terts: blij en open (When the Saints).', 'Kleine terts: donkerder (Smoke on the Water).'],
  ['Kwart: open, alsof er iets begint (het Wilhelmus).', 'Kwint: wijder en steviger (Star Wars).', 'Omlaag is het hetzelfde interval, alleen de andere kant op.'],
  ['Halve toon: één fret, schurend (Jaws).', 'Hele toon: twee frets, een gewone stap (Vader Jacob).'],
  ['Grote sext: zonnig en wijd (My Bonnie).', 'Kleine sext: zachter en wat weemoedig (The Entertainer).', 'Een sext omhoog komt uit op dezelfde noot als een terts omlaag.'],
  ['Kleine septiem: spannend, er komt nog iets (Somewhere uit West Side Story).', 'Grote septiem: scherp, net onder het octaaf (Take On Me).', 'Tritonus: onrustig, precies tussen kwart en kwint (The Simpsons).'],
  ['Majeur klinkt helder, mineur donker.', 'Het verschil zit in de terts: groot (4 halve tonen) of klein (3).'],
  ['Een 7-akkoord klinkt bluesy en onaf: het wil verder.', 'In de blues is vaak elk akkoord een 7.'],
  ['I is thuis, IV gaat weg van huis en is rustig, V geeft spanning en wil terug naar I.', 'Zing de grondtoon mee: bij IV een kwart omhoog, bij V een kwint omhoog.'],
  ['Vraag je bij elke noot af: hoger of lager, stap of sprong?', 'Zoek de eerste noot, en zoek daarna noot voor noot verder.'],
];
const gehoorSummary = unit => GEHOOR_SUMMARY[unit.idx] || [];
const gehoorLevelDone = i => { const u = GehoorData.units()[i]; return !!u && [0, 1, 2].every(k => nodeDone(u, k)); };
const gehoorDoneCount = () => GEHOOR_LEVELS.filter((L, i) => gehoorLevelDone(i)).length;
function nextGehoor() {
  const units = GehoorData.units();
  for (let u = 0; u < units.length; u++) {
    const nodes = unitNodes(units[u]);
    for (let i = 0; i < nodes.length; i++) if (nodeState(units[u], nodes, i) === 'open') return { unit: units[u], index: i, node: nodes[i], unitNo: u + 1 };
  }
  return null;
}
// Vrij oefenen bij een niveau: Gehoortraining met dezelfde intervallen of akkoorden, of met gitaar Op gehoor naspelen
function gehoorPractice(u) {
  const L = GEHOOR_LEVELS[u.idx];
  if (!L) return null;
  if (L.kind === 'iv') return { mode: 'earq', set: { kind: 'iv', ivs: learnedIvs(u.idx), dir: L.down ? 'both' : 'up' } };
  if (L.kind === 'ch') return { mode: 'earq', set: { kind: 'ch', chords: L.set.slice() } };
  if (L.kind === 'mel' && Guitar.on()) return { mode: 'ear', set: { level: 3, key: 'major-C' } };
  return null;
}
function practiceGehoor(u) {
  const p = gehoorPractice(u);
  if (!p) return;
  try { Engine.ensureCtx(); } catch (e) {}   // geluid aan binnen de tik, ook op een iPhone
  TempSettings.apply(p.mode, p.set);
  const go = () => { location.hash = '#m-' + p.mode; };
  if (p.mode !== 'ear' || Engine.mic) go(); else Loader.run({ title: 'Op gehoor naspelen', sub: 'Microfoon aanzetten…', mood: 'luister', wait: Engine.startMic() }, go);
}
