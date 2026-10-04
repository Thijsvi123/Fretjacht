// ---------- Leerpad: vraaggeneratoren ----------
// Itemtypes:
//  mc:    { prompt, sub, options[], answer, explain }
//  multi: { prompt, sub, choices[], correct[], explain }
//  tap:   { prompt, sub, from, to, marks[], valid[{s,f}], explain }
//  play:  { prompt, sub, big, steps[{k:'pc'|'rel'|'set', ...}], neck?, hint?, explain? }
//  learn, name, tapall: zie de Halsjacht (11b-hals.js)
const isNoteName = s => /^[A-G](♯|♭|𝄪|𝄫)?$/.test(s);
function mc(skill, prompt, correct, distractors, explain, sub) {
  const c = String(correct);
  let ds = uniq(distractors.map(String)).filter(d => d !== c);
  // noten: nooit twee opties die hetzelfde klinken (A♯ en B♭); de gewone naam gaat voor
  if (isNoteName(c) && ds.every(isNoteName)) {
    const seen = new Set([pcOf(c)]);
    ds = ds.sort((a, b) => isSimple(parseName(b)) - isSimple(parseName(a))).filter(d => !seen.has(pcOf(d)) && seen.add(pcOf(d)));
  }
  ds = shuffle(ds).slice(0, 3);
  const options = shuffle([c, ...ds]);
  return { type: 'mc', skill, prompt, sub, options, answer: options.indexOf(c), explain };
}
function multi(skill, prompt, choices, correct, explain, sub) { return { type: 'multi', skill, prompt, sub, choices, correct, explain }; }
function tapItem(skill, prompt, o) { return Object.assign({ type: 'tap', skill, prompt, from: 0, to: 12 }, o); }
function playItem(skill, prompt, o) { return Object.assign({ type: 'play', skill, prompt }, o); }
const nm = (root, steps, semis) => spName(spellFrom(parseName(root), steps, semis));
const pcOf = name => spPc(parseName(name));
// noten-chips: de juiste namen + afleiders, chromatisch gesorteerd vanaf de grondtoon
function noteChips(correct, rootName, flats, extra) {
  const used = new Set(correct.map(pcOf));
  const pool = [];
  for (let pc = 0; pc < 12; pc++) if (!used.has(pc)) pool.push((flats ? FLAT_NAMES : SHARP_NAMES)[pc]);
  const chips = correct.concat(shuffle(pool).slice(0, extra == null ? Math.max(3, 9 - correct.length) : extra));
  const r = pcOf(rootName);
  return chips.sort((a, b) => mod12(pcOf(a) - r) - mod12(pcOf(b) - r) || a.localeCompare(b));
}
function neighbours(name) {
  // namen die op de gevraagde noot lijken: zelfde letter met ander teken, en buurtonen
  const sp = parseName(name), out = [];
  for (const acc of [-1, 0, 1]) if (acc !== sp.acc) out.push(LETTERS[sp.li] + ACC_SYM[acc]);
  const pc = spPc(sp);
  out.push(pcName(pc + 1, 'sharps'), pcName(pc - 1, 'flats'), pcName(pc + 2, 'sharps'), pcName(pc - 2, 'flats'));
  // één naam per toonhoogte: E♯ en F klinken hetzelfde, dan alleen de gewone naam
  const seen = new Set();
  return uniq(out).filter(n => n !== name && pcOf(n) !== pc).sort((a, b) => isSimple(parseName(b)) - isSimple(parseName(a)))
    .filter(n => !seen.has(pcOf(n)) && seen.add(pcOf(n)));
}
// de naam van een grondtoon (kruis of mol) waarbij de toon erboven ook een gewone naam heeft: E♭ met grote terts G, niet D♯ met F𝄪
function rootName(m, steps, semis) {
  const names = uniq([SHARP_NAMES[mod12(m)], FLAT_NAMES[mod12(m)]]);
  return (steps != null && names.find(n => isSimple(spellFrom(parseName(n), steps, semis)))) || names[0];
}
// de toon een interval boven root, met de goede letter; lukt dat niet met een gewone naam (B plus tritonus), dan de naam met een kruis
const ivTarget = (root, steps, semis) => { const sp = spellFrom(parseName(root), steps, semis); return isSimple(sp) ? spName(sp) : pcName(pcOf(root) + semis, 'sharps'); };
// grondtoon op de hals voor tikvragen: lage snaren, frets 1..8, met minstens één doel binnen 0..12
function rootSpot(semis, strings, steps) {
  for (let i = 0; i < 80; i++) {
    const s = pick(strings || [5, 4, 3]), f = 1 + Math.floor(Math.random() * 8), m = OPEN[s] + f;
    const valid = positionsOf(m + semis, 0, 12).filter(p => !(p.s === s && p.f === f));
    if (valid.length) return { s, f, m, valid, name: rootName(m, steps, semis) };
  }
  return { s: 5, f: 5, m: 45, valid: positionsOf(45 + semis, 0, 12), name: 'A' };
}
const SIMPLE_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'B♭', 'E♭'];
const ivPick = set => { const sm = Number(pick(set)); return INTERVALS.find(i => i.semis === sm); };
const ivArt = iv => (iv.semis === 12 ? 'het' : 'de');
const PLAY_ROOTS = ['E', 'A', 'D', 'G', 'C', 'F', 'B'];

const G = {
  // ---- unit 1: twaalf tonen, octaaf en kwint ----
  octRatio: () => mc('oct-ratio', 'Een toon een octaaf hoger trilt…', 'twee keer zo snel', ['anderhalf keer zo snel', 'drie keer zo snel', 'even snel, maar harder'], 'Een octaaf is de verhouding 2:1. Daarom klinken 110 en 220 Hz als dezelfde noot, alleen hoger.'),
  octSemis: () => mc('oct-semis', 'Hoeveel halve tonen zitten in een octaaf?', '12', ['7', '8', '10'], 'Het octaaf is verdeeld in 12 gelijke halve tonen. Op de hals is 12 frets verder dezelfde noot een octaaf hoger.'),
  fifthRatio: () => mc('fifth-ratio', 'Welke trillingsverhouding hoort bij een reine kwint?', '3:2', ['2:1', '4:3', '5:4'], 'Een kwint is 3:2. Na het octaaf (2:1) is dat de stabielste samenklank die er is.'),
  fifthSemis: () => mc('fifth-semis', 'Hoeveel halve tonen is een reine kwint?', '7', ['5', '6', '8'], 'Een reine kwint is 7 halve tonen, bijvoorbeeld van A naar E.'),
  fifthAbove: () => {
    const r = pick(SIMPLE_ROOTS), c = nm(r, 4, 7);
    return mc('fifth-above', `Wat is de kwint boven ${r}?`, c, [nm(r, 3, 5), nm(r, 5, 9), nm(r, 2, 4), nm(r, 1, 2)], `Tel 7 halve tonen omhoog: ${r} → ${c}. Op de hals: één snaar hoger en 2 frets verder (vanaf de G-snaar 3).`);
  },
  powerNotes: () => {
    const r = pick(['E', 'A', 'D', 'G', 'C', 'F']), fifth = nm(r, 4, 7);
    const choices = noteChips([r, fifth], r, r === 'F', 4);
    return multi('power-notes', `Welke tonen zitten in een ${r}5-powerchord?`, choices, [r, fifth], `${r}5 is grondtoon ${r} plus kwint ${fifth}, vaak met het octaaf erbij. Er zit geen terts in, dus het is niet majeur en niet mineur.`);
  },
  powerWhy: () => mc('power-why', 'Waarom klinkt een powerchord niet blij en niet verdrietig?', 'Er zit geen terts in', ['Er zit geen kwint in', 'Hij heeft te weinig snaren', 'Door de distortion'], 'De terts bepaalt of iets majeur of mineur klinkt. Een powerchord heeft alleen grondtoon, kwint en octaaf.'),
  circleNext: () => {
    const i = Math.floor(Math.random() * 6), a = CIRCLE_UP[i], b = CIRCLE_UP[i + 1];
    return mc('circle-next', `Je gaat een kwint omhoog vanaf ${a}. Welke noot krijg je?`, b, [CIRCLE_UP[(i + 2) % 7], nm(a, 3, 5), nm(a, 1, 2), nm(a, 5, 9)], `${a} plus 7 halve tonen is ${b}. Zo loop je de kwintencirkel rond.`);
  },
  circleMissing: () => {
    const i = Math.floor(Math.random() * 3), seq = CIRCLE_UP.slice(i, i + 5), miss = 1 + Math.floor(Math.random() * 3), ans = seq[miss];
    return mc('circle-missing', 'Welke noot ontbreekt in deze rij kwinten?', ans, neighbours(ans).concat([nm(seq[miss - 1], 3, 5)]), `Elke noot is een kwint hoger dan de vorige: ${seq.join(' – ')}.`, seq.map((n, k) => (k === miss ? '?' : n)).join(' – '));
  },
  stackFifths: () => {
    for (let t = 0; t < 20; t++) {
      const start = pick(['C', 'G', 'D', 'F']), n = 2 + Math.floor(Math.random() * 3);
      let sp = parseName(start); const path = [start];
      for (let k = 0; k < n; k++) { sp = spellFrom(sp, 4, 7); path.push(spName(sp)); }
      if (!isSimple(sp)) continue;
      const ans = spName(sp);
      return mc('stack-fifths', `Begin op ${start} en ga ${n} kwinten omhoog. Waar kom je uit?`, ans, [path[path.length - 2], nm(ans, 4, 7), nm(start, 3, 5), ...neighbours(ans)], `${path.join(' → ')}`);
    }
    return G.circleNext();
  },
  enharmonic: () => {
    const [a, b] = pick([['E♯', 'F'], ['B♯', 'C'], ['F♭', 'E'], ['C♭', 'B'], ['F♯', 'G♭'], ['C♯', 'D♭'], ['A♯', 'B♭'], ['G♯', 'A♭'], ['D♯', 'E♭']]);
    const pc = pcOf(a);
    return mc('enharmonic', `Welke noot klinkt hetzelfde als ${a}?`, b, [pcName(pc + 1, 'sharps'), pcName(pc - 1, 'flats'), pcName(pc + 2, 'sharps'), pcName(pc - 2, 'flats')], `${a} en ${b} zijn dezelfde toets: andere naam, zelfde klank. Dat heet enharmonisch.`);
  },
  harmonic3: () => {
    const s = pick([{ n: 'A-snaar', f: 110, x3: 330, note: 'E' }, { n: 'lage E-snaar', f: 82, x3: 247, note: 'B' }, { n: 'D-snaar', f: 147, x3: 440, note: 'A' }]);
    return mc('harmonic3', `De ${s.n} trilt op ongeveer ${s.f} Hz. Welke noot is de boventoon op ${s.f} × 3 Hz?`, s.note, ['C', 'D', 'F♯', 'G', 'E', 'B', 'A'].filter(x => x !== s.note), `${s.f} × 3 ≈ ${s.x3} Hz: een ${s.note}, een octaaf plus een kwint boven de grondtoon.`);
  },
  fretShorter: () => mc('fret-shorter', 'Hoeveel korter maakt elke fret de trillende snaar ongeveer?', '6%', ['1%', '12%', '25%'], 'Elke halve toon is een verhouding van ongeveer 1,06. Daarom maakt elke fret de snaar ongeveer 6% korter, en liggen de frets richting de body steeds dichter bij elkaar.'),
  equalTemp: () => mc('equal-temp', 'Wat doet de gelijkzwevende stemming?', 'Het foutje van de kwintencirkel over alle 12 stappen verdelen', ['Alle kwinten precies zuiver maken', 'De kwint weglaten uit de toonladder', 'Alleen de open snaren stemmen'], 'Twaalf zuivere kwinten zijn iets meer dan 7 octaven. Door dat verschil over alle 12 stappen te verdelen kun je in elke toonsoort spelen.'),
  comma: () => mc('comma', 'Twaalf zuivere kwinten op elkaar zijn…', 'iets meer dan 7 octaven', ['precies 7 octaven', 'precies 12 octaven', 'iets minder dan 6 octaven'], '1,5¹² ≈ 129,7 en 2⁷ = 128. Dat kleine verschil heet de komma van Pythagoras.'),
  twelveWhy: () => mc('twelve-why', 'Waarom heeft een octaaf twaalf halve tonen?', 'Twaalf kwinten op elkaar komen bijna uit op zeven octaven', ['De majeurtoonladder heeft twaalf tonen', 'Een snaar heeft twaalf boventonen', 'Een kwint is twaalf halve tonen'], 'Ga vanaf C twaalf keer een kwint omhoog en je bent bijna precies terug bij C, zeven octaven hoger. Onderweg kom je elke toon één keer tegen: twaalf tonen.'),
  equalFifth: () => mc('equal-fifth', 'Wat hoor je van de gelijkzwevende stemming als je een kwint speelt?', 'Bijna niets: de kwint is een fractie te klein', ['De kwint klinkt duidelijk vals', 'De kwint is precies 3:2', 'Dat je maar in één toonsoort kunt spelen'], 'Het foutje van de kwintencirkel is over alle twaalf stappen verdeeld. Elke kwint is daardoor een heel klein beetje te klein, maar dat hoor je niet. Zo kun je in elke toonsoort spelen.'),
  semitoneRatio: () => mc('semitone-ratio', 'Elke fret is een halve toon hoger. Met hoeveel gaat de trilling dan omhoog?', 'ongeveer × 1,06', ['× 1,5', '× 2', 'ongeveer × 1,25'], 'Elke halve toon is dezelfde verhouding: ongeveer 1,06. Twaalf van die stappen achter elkaar geven precies 2, het octaaf.'),
  tapOctave: () => {
    const r = rootSpot(12);
    return tapItem('tap-octave', 'Tik dezelfde noot een octaaf hoger', { sub: `De ${r.name} is gemarkeerd.`, marks: [{ s: r.s, f: r.f, kind: 'todo root', label: r.name }], valid: r.valid, explain: 'Een octaaf hoger ligt twee snaren hoger en twee frets verder (over de B-snaar heen: drie), of 12 frets verder op dezelfde snaar.' });
  },
  tapFifth: () => {
    const r = rootSpot(7, [5, 4, 3, 2], 4);
    return tapItem('tap-fifth', 'Tik de kwint boven deze noot', { sub: `De ${r.name} is gemarkeerd.`, marks: [{ s: r.s, f: r.f, kind: 'todo root', label: r.name }], valid: r.valid, explain: `De kwint boven ${r.name} is ${ivTarget(r.name, 4, 7)}: één snaar hoger en 2 frets verder (vanaf de G-snaar 3).` });
  },
  playOctave: () => {
    const r = pick(['A', 'E', 'D', 'G', 'C']);
    return playItem('play-octave', `Speel een ${r}, en daarna de ${r} een octaaf hoger`, { big: r, steps: [{ k: 'pc', pc: pcOf(r), name: r }, { k: 'rel', semis: 12, name: `${r}↑` }], hint: 'Twee snaren hoger en twee frets verder (over de B-snaar: drie), of 12 frets verder op dezelfde snaar.' });
  },
  playFifth: () => {
    const r = pick(PLAY_ROOTS), f = nm(r, 4, 7);
    return playItem('play-fifth', `Speel ${r}, en daarna de kwint erboven`, { big: r, steps: [{ k: 'pc', pc: pcOf(r), name: r }, { k: 'rel', semis: 7, name: f }], hint: `De kwint boven ${r} is ${f}: één snaar hoger, 2 frets verder.` });
  },
  playPower: () => {
    const r = pick(['E', 'A', 'D', 'G']), f = nm(r, 4, 7);
    return playItem('play-power', `Speel de grondtoon en de kwint van ${r}5`, { big: `${r}5`, steps: [{ k: 'pc', pc: pcOf(r), name: r }, { k: 'rel', semis: 7, name: f }], hint: `${r} en dan ${f}, één snaar hoger en 2 frets verder.` });
  },

  // ---- unit 2: intervallen ----
  ivSemis: set => {
    const iv = ivPick(set);
    const ds = [iv.semis - 2, iv.semis - 1, iv.semis + 1, iv.semis + 2].filter(x => x >= 1 && x <= 12).map(String);
    return mc('iv-semis-' + iv.semis, `Hoeveel halve tonen is een ${iv.name}?`, String(iv.semis), ds, `Een ${iv.name} is ${iv.semis} halve ${iv.semis === 1 ? 'toon' : 'tonen'}, bijvoorbeeld C → ${nm('C', iv.steps, iv.semis)}.`);
  },
  ivName: set => {
    for (let t = 0; t < 30; t++) {
      const iv = ivPick(set), r = pick(SIMPLE_ROOTS), sp = spellFrom(parseName(r), iv.steps, iv.semis);
      if (!isSimple(sp)) continue;
      const others = INTERVALS.filter(i => i !== iv && Math.abs(i.semis - iv.semis) <= 3).map(i => i.name);
      return mc('iv-name-' + iv.semis, `Welk interval is ${r} → ${spName(sp)} (omhoog)?`, iv.name, others, `${r} → ${spName(sp)} is ${iv.semis} halve ${iv.semis === 1 ? 'toon' : 'tonen'}: een ${iv.name}.`);
    }
    return G.ivSemis(set);
  },
  ivAbove: set => {
    for (let t = 0; t < 30; t++) {
      const iv = ivPick(set), r = pick(SIMPLE_ROOTS), sp = spellFrom(parseName(r), iv.steps, iv.semis);
      if (!isSimple(sp) || iv.semis === 12) continue;
      const c = spName(sp);
      return mc('iv-above-' + iv.semis, `Wat is de ${iv.name} boven ${r}?`, c, neighbours(c), `Tel ${iv.semis} halve ${iv.semis === 1 ? 'toon' : 'tonen'} omhoog vanaf ${r}: ${c}.`);
    }
    return G.ivSemis(set);
  },
  ivTap: set => {
    const iv = ivPick(set), r = rootSpot(iv.semis, iv.semis >= 8 ? [5, 4] : [5, 4, 3], iv.steps);
    return tapItem('iv-tap-' + iv.semis, `Tik ${ivArt(iv)} ${iv.name} boven deze noot`, { sub: `De ${r.name} is gemarkeerd.`, marks: [{ s: r.s, f: r.f, kind: 'todo root', label: r.name }], valid: r.valid, explain: `${ivArt(iv) === 'het' ? 'Het' : 'De'} ${iv.name} boven ${r.name} is ${ivTarget(r.name, iv.steps, iv.semis)}. ${shapeText(iv.semis, true)}` });
  },
  ivPlay: set => {
    for (let t = 0; t < 30; t++) {
      const iv = ivPick(set), r = pick(PLAY_ROOTS), sp = spellFrom(parseName(r), iv.steps, iv.semis);
      if (!isSimple(sp)) continue;
      return playItem('iv-play-' + iv.semis, `Speel ${r}, en daarna ${ivArt(iv)} ${iv.name} erboven`, { big: r, steps: [{ k: 'pc', pc: pcOf(r), name: r }, { k: 'rel', semis: iv.semis, name: spName(sp) }], hint: `${spName(sp)}. ${shapeText(iv.semis, true)}` });
    }
    return G.playFifth();
  },
  ivThirds: () => mc('iv-thirds', 'Wat is het verschil tussen een kleine en een grote terts?', 'Eén halve toon', ['Een hele toon', 'Twee halve tonen', 'Er is geen verschil, alleen de naam'], 'Kleine terts = 3 halve tonen, grote terts = 4. Die ene halve toon bepaalt of iets mineur of majeur klinkt.'),
  // de omkering: samen een octaaf (4 + 8 = 12)
  ivInvert: () => {
    const semis = pick([1, 2, 3, 4, 5, 8, 9]), a = INTERVALS.find(i => i.semis === semis), b = INTERVALS.find(i => i.semis === 12 - semis);
    const others = INTERVALS.filter(i => i !== a && i !== b && i.semis !== 12 && Math.abs(i.semis - b.semis) <= 3).map(i => i.name);
    return mc('iv-inv-' + semis, `Wat is de omkering van ${ivArt(a)} ${a.name}?`, b.name, others, `${semis} + ${12 - semis} = 12 halve tonen: samen een octaaf. ${semis === 5 ? 'Rein blijft rein.' : 'Klein wordt groot en groot wordt klein.'} Een ${a.name} omhoog is dezelfde noot als een ${b.name} omlaag.`);
  },
  // tel de letters: van D naar A is D, E, F, G, A: vijf letters, een kwint
  ivNumber: () => {
    const names = ['secunde', 'terts', 'kwart', 'kwint', 'sext', 'septiem', 'octaaf'];
    for (let t = 0; t < 30; t++) {
      const a = Math.floor(Math.random() * 7), n = 1 + Math.floor(Math.random() * 7), letters = Array.from({ length: n + 1 }, (_, k) => LETTERS[(a + k) % 7]);
      if (mod12(LETTER_PC[(a + n) % 7] - LETTER_PC[a]) === 6) continue;   // F–B en B–F: dat is de tritonus
      const ans = names[n - 1];
      return mc('iv-number', `Van ${letters[0]} omhoog naar ${letters[n]}: wat voor interval is dat?`, ans, names.filter(x => x !== ans), `Tel de letters: ${letters.join(', ')}. Dat zijn er ${n + 1}, dus een ${ans}.`, 'Tel de letters, met de eerste en de laatste erbij');
    }
    return G.ivSemis(ALL_SEMIS);
  },
  reinWhich: () => mc('rein-which', 'Welke intervallen heten rein?', 'kwart, kwint en octaaf', ['terts, sext en septiem', 'secunde, terts en kwart', 'alleen het octaaf'], 'Kwart, kwint en octaaf klinken zo stabiel dat er maar één goede maat van bestaat. Tertsen, sexten, septiemen en secunden zijn er in klein en groot.'),
  tritone: () => mc('tritone', 'Welk interval ligt precies tussen de reine kwart en de reine kwint?', 'de tritonus', ['de grote terts', 'de kleine sext', 'het octaaf'], 'De tritonus is 6 halve tonen, drie hele tonen: precies tussen de kwart (5) en de kwint (7). Hij klinkt onrustig en wil ergens heen.'),
  // de vorm van een interval op de hals, vanaf de lage E- of A-snaar
  ivShape: () => {
    const shapes = { 3: 'één snaar hoger, twee frets terug', 4: 'één snaar hoger, één fret terug', 5: 'één snaar hoger, zelfde fret', 7: 'één snaar hoger, twee frets verder', 12: 'twee snaren hoger, twee frets verder' };
    const semis = Number(pick(Object.keys(shapes))), iv = INTERVALS.find(i => i.semis === semis), ans = shapes[semis];
    return mc('iv-shape-' + semis, `Welke vorm heeft ${ivArt(iv)} ${iv.name} op de hals?`, ans, Object.values(shapes).filter(s => s !== ans), `${ivArt(iv) === 'het' ? 'Het' : 'De'} ${iv.name}: ${ans}. Gaat de vorm over de B-snaar heen, dan schuift hij één fret op.`, 'Vanaf een noot op de lage E- of A-snaar');
  },

  // ---- unit 3: majeurtoonladder ----
  majPattern: () => mc('maj-pattern', 'Wat is het patroon van een majeurtoonladder?', 'H H h H H H h', ['H h H H h H H', 'H H H h H H h', 'h H H H h H H'], 'Hele, hele, halve, hele, hele, hele, halve toon. De halve tonen zitten tussen trap 3–4 en 7–8.', 'H = hele toon, h = halve toon'),
  majHalf: () => mc('maj-half', 'Tussen welke trappen van majeur zitten de halve toonafstanden?', '3–4 en 7–8', ['2–3 en 6–7', '4–5 en 7–8', '1–2 en 5–6'], 'In C majeur: E–F (trap 3–4) en B–C (trap 7–8). Daar zitten op de piano geen zwarte toetsen tussen.'),
  majNotes: keys => {
    const key = pick(keys || ['C', 'G', 'D', 'A', 'F', 'B♭', 'E']), tones = scaleTones('major', key).map(t => t.name);
    return multi('maj-notes', `Tik alle noten van ${key} majeur`, noteChips(tones, key, MAJOR_SIG[key] < 0, 4), tones, `${key} majeur: ${tones.join(' ')}.`);
  },
  majCount: () => mc('maj-count', 'Hoeveel verschillende tonen heeft een majeurtoonladder?', '7', ['5', '8', '12'], 'Zeven: in C majeur C D E F G A B. De achtste toon is weer C, een octaaf hoger.'),
  // hele of halve stap tussen twee buren in de toonladder; help: het patroon erbij
  majStep: (keys, help) => {
    const key = pick(keys || ['C', 'G', 'D', 'F', 'A']), t = scaleTones('major', key), d = Math.floor(Math.random() * 7);
    const a = t[d], b = t[(d + 1) % 7], half = mod12(b.pc - a.pc) === 1;
    return mc('maj-step', `In ${key} majeur: is de stap van ${a.name} naar ${b.name} een hele of een halve toon?`, half ? 'een halve toon' : 'een hele toon', [half ? 'een hele toon' : 'een halve toon'], `${a.name} is trap ${d + 1} en ${b.name} trap ${d + 2}. ${half ? 'Tussen trap 3 en 4 en tussen trap 7 en 8 zit een halve toon.' : 'Alleen tussen trap 3 en 4 en tussen trap 7 en 8 zit een halve toon; hier is het een hele.'}`, help ? 'Het patroon: H H h H H H h' : undefined);
  },
  majHalfPair: keys => {
    const key = pick(keys || ['C', 'G', 'D', 'F', 'A']), t = scaleTones('major', key).map(x => x.name);
    const pair = (a, b, c, d) => `${t[a]}–${t[b]} en ${t[c]}–${t[d]}`;
    return mc('maj-half-pair', `Tussen welke tonen van ${key} majeur zitten de halve stappen?`, pair(2, 3, 6, 0), [pair(0, 1, 4, 5), pair(1, 2, 5, 6), pair(3, 4, 6, 0), pair(2, 3, 5, 6)], `Tussen trap 3 en 4 (${t[2]}–${t[3]}) en tussen trap 7 en 8 (${t[6]}–${t[0]}).`);
  },
  leadingNote: () => {
    const key = pick(['C', 'G', 'D', 'A', 'F', 'E']), t = scaleTones('major', key), ans = t[6].name;
    return mc('leading-note', `Wat is de leidtoon van ${key} majeur?`, ans, [t[5].name, t[1].name, nm(key, 6, 10), t[4].name], `De leidtoon is trap 7. In ${key} majeur is dat ${ans}, een halve toon onder ${key}.`);
  },
  dominantNote: () => {
    const key = pick(['C', 'G', 'D', 'A', 'F', 'E']), t = scaleTones('major', key), ans = t[4].name;
    return mc('dominant-note', `Welke toon is de dominant van ${key} majeur?`, ans, [t[3].name, t[5].name, t[2].name], `De dominant is trap 5. In ${key} majeur is dat ${ans}.`);
  },
  stableDegrees: () => mc('stable-degrees', 'Welke trappen vormen samen met trap 1 het majeurakkoord?', '3 en 5', ['2 en 4', '4 en 5', '5 en 7'], 'Trap 1, 3 en 5 passen stevig bij elkaar. In C majeur zijn dat C, E en G: het C-akkoord.'),
  songEnd: () => mc('song-end', 'Op welke toon eindigt het refrein van een nummer vaak?', 'Trap 1, de grondtoon', ['Trap 7, de leidtoon', 'Trap 4', 'Trap 2'], 'Op trap 1 komt een nummer thuis. Daarom eindigen veel refreinen op de grondtoon.'),
  majChange: () => {
    const c = pick([{ key: 'G', ans: 'F wordt F♯' }, { key: 'F', ans: 'B wordt B♭' }]);
    return mc('maj-change', `Je begint de majeurtoonladder op ${c.key}. Welke toon pas je aan om het patroon te houden?`, c.ans, ['F wordt F♯', 'B wordt B♭', 'C wordt C♯', 'E wordt E♭'], `${c.key} majeur: ${scaleTones('major', c.key).map(x => x.name).join(' ')}. Alleen zo klopt H H h H H H h.`);
  },
  playLeading: () => {
    const key = pick(['C', 'G', 'D', 'A', 'E']), t = scaleTones('major', key)[6];
    return playItem('play-leading', `Speel de leidtoon van ${key} majeur`, { big: '7', sub: `in ${key} majeur`, steps: [{ k: 'pc', pc: t.pc, name: t.name }], hint: `Trap 7 is ${t.name}, een halve toon onder ${key}.` });
  },
  majDegree: keys => {
    const key = pick(keys || ['C', 'G', 'D', 'A', 'F', 'B♭']), tones = scaleTones('major', key), d = 2 + Math.floor(Math.random() * 6);
    return mc('maj-degree', `Wat is trap ${d} in ${key} majeur?`, tones[d - 1].name, tones.map(t => t.name).filter((n, i) => i !== d - 1), `${key} majeur: ${tones.map((t, i) => `${i + 1}=${t.name}`).join(' ')}.`);
  },
  majWhich: keys => {
    const key = pick(keys || ['C', 'G', 'D', 'A', 'F', 'B♭']), tones = scaleTones('major', key), d = 2 + Math.floor(Math.random() * 6);
    return mc('maj-which', `Welke trap is ${tones[d - 1].name} in ${key} majeur?`, String(d), ['2', '3', '4', '5', '6', '7'], `${key} majeur: ${tones.map((t, i) => `${i + 1}=${t.name}`).join(' ')}.`);
  },
  leading: () => mc('leading', 'Welke trap heet de leidtoon, omdat hij zo sterk naar de grondtoon trekt?', '7', ['2', '4', '5'], 'Trap 7 ligt een halve toon onder de grondtoon en wil daar graag heen. Daarom heet hij de leidtoon.'),
  playDegree: keys => {
    const key = pick(keys || ['C', 'G', 'D', 'A', 'F']), tones = scaleTones('major', key), d = 2 + Math.floor(Math.random() * 6), t = tones[d - 1];
    // keys: zonder gitaar wordt dit een vraag over dezelfde toonsoorten
    return playItem('play-degree', `Speel trap ${d} in ${key} majeur`, { big: `trap ${d}`, sub: `in ${key} majeur`, steps: [{ k: 'pc', pc: t.pc, name: t.name }], hint: `Het is ${t.name}. ${key} majeur: ${tones.map(x => x.name).join(' ')}.`, keys: keys || undefined });
  },
  playScale: (scale, key) => {
    const tones = scaleTones(scale, key), box = scaleBox(scale, key, 1);
    const steps = tones.map(t => ({ k: 'pc', pc: t.pc, name: t.name })).concat([{ k: 'pc', pc: tones[0].pc, name: tones[0].name }]);
    const lo = Math.min(...box.map(p => p.f)), hi = Math.max(...box.map(p => p.f));
    return playItem('play-scale-' + scale, `Speel ${key} ${SCALES[scale].short}, één octaaf omhoog`, { big: key, sub: SCALES[scale].short, steps, hint: tones.map(t => t.name).join(' '), hintNeck: { from: Math.max(0, lo - 1), to: hi + 1, marks: box.map(p => ({ s: p.s, f: p.f, kind: p.label === 'R' ? 'todo root' : 'todo', label: p.name })) } });
  },

  // ---- unit 4: toonsoorten en kwintencirkel ----
  sigCount: side => {
    const keys = Object.keys(MAJOR_SIG).filter(k => k !== 'G♭' && k !== 'C' && (side === 'sharp' ? MAJOR_SIG[k] > 0 : side === 'flat' ? MAJOR_SIG[k] < 0 : true));
    const key = pick(keys), n = MAJOR_SIG[key];
    const list = n > 0 ? SHARP_ORDER.slice(0, n) : FLAT_ORDER.slice(0, -n);
    return mc('sig-count', `Hoeveel kruisen of mollen heeft ${key} majeur?`, sigText(n), [n + 1, n - 1, -n, n + (n > 0 ? 2 : -2), n - (n > 0 ? 2 : -2)].filter(x => Math.abs(x) <= 7 && x !== n).map(sigText), `${key} majeur heeft ${sigText(n)}: ${list.join(' ')}.`);
  },
  keyFromSig: side => {
    const keys = Object.keys(MAJOR_SIG).filter(k => k !== 'G♭' && k !== 'C' && (side === 'sharp' ? MAJOR_SIG[k] > 0 : side === 'flat' ? MAJOR_SIG[k] < 0 : true));
    const key = pick(keys), n = MAJOR_SIG[key];
    return mc('key-from-sig', `Welke majeurtoonsoort heeft ${sigText(n)}?`, key, Object.keys(MAJOR_SIG).filter(k => k !== key && Math.abs(MAJOR_SIG[k] - n) <= 2 && k !== 'G♭'), `${sigText(n)[0].toUpperCase() + sigText(n).slice(1)}: ${key} majeur. ${n > 0 ? 'Het laatste kruis ligt een halve toon onder de grondtoon.' : 'De voorlaatste mol is de grondtoon (behalve bij F).'}`);
  },
  sharpOrder: () => mc('sharp-order', 'In welke volgorde komen de kruisen erbij?', 'F C G D A E B', ['C G D A E B F', 'B E A D G C F', 'F G A B C D E'], 'Elke volgende toonsoort met kruisen ligt een kwint hoger en krijgt er één kruis bij: F♯, C♯, G♯, D♯, A♯, E♯, B♯.'),
  flatOrder: () => mc('flat-order', 'In welke volgorde komen de mollen erbij?', 'B E A D G C F', ['F C G D A E B', 'E A D G C F B', 'B A G F E D C'], 'De mollen komen er in omgekeerde volgorde bij: B♭, E♭, A♭, D♭, G♭, C♭, F♭.'),
  keyDef: () => mc('key-def', 'Wat vertelt een toonsoort je?', 'Welke toon thuis is en welke zeven tonen je gebruikt', ['Hoe snel je speelt', 'Op welke snaren je speelt', 'Alleen met welk akkoord je begint'], 'Een nummer in G majeur gebruikt de tonen van de G-majeurtoonladder en komt thuis op G.'),
  newSharp: () => {
    const i = 1 + Math.floor(Math.random() * 5), from = CIRCLE_UP[i - 1], to = CIRCLE_UP[i], ans = SHARP_ORDER[i - 1];
    return mc('new-sharp', `Van ${from} majeur ga je een kwint omhoog naar ${to} majeur. Welk kruis komt erbij?`, ans, SHARP_ORDER.slice(0, 6).filter(x => x !== ans), `Het nieuwe kruis is trap 7 van ${to} majeur: ${ans}, een halve toon onder ${to}.`);
  },
  newFlat: () => {
    const i = 1 + Math.floor(Math.random() * 4), from = CIRCLE_DOWN[i - 1], to = CIRCLE_DOWN[i], ans = FLAT_ORDER[i - 1];
    return mc('new-flat', `Van ${from} majeur ga je een kwint omlaag naar ${to} majeur. Welke mol komt erbij?`, ans, FLAT_ORDER.slice(0, 6).filter(x => x !== ans), `De nieuwe mol is trap 4 van ${to} majeur: ${ans}.`);
  },
  // tik de voortekens van een toonsoort; de knoppen staan op lettervolgorde, niet in de volgorde van de voortekens
  sigNotes: side => {
    const flat = side === 'flat', key = pick(flat ? ['F', 'B♭', 'E♭', 'A♭'] : ['G', 'D', 'A', 'E']), n = Math.abs(MAJOR_SIG[key]);
    const order = flat ? FLAT_ORDER : SHARP_ORDER, list = order.slice(0, n);
    const choices = order.slice().sort((a, b) => LETTERS.indexOf(a[0]) - LETTERS.indexOf(b[0]));
    return multi('sig-notes-' + side, `Tik ${flat ? 'de mollen' : 'de kruisen'} van ${key} majeur`, choices, list, `${key} majeur heeft ${sigText(MAJOR_SIG[key])}: ${list.join(' ')}. Ze komen er altijd in deze volgorde bij: ${flat ? 'B E A D G C F' : 'F C G D A E B'}.`);
  },
  circleDir: () => mc('circle-dir', 'Je gaat in de kwintencirkel één stap rechtsom. Wat gebeurt er?', 'Je gaat een kwint omhoog en er komt een kruis bij', ['Je gaat een kwint omlaag en er komt een kruis bij', 'Je gaat een halve toon omhoog en er komt een mol bij', 'Je komt bij de relatieve mineur'], 'Rechtsom gaat elke stap een kwint omhoog: C, G, D, A … en bij elke stap komt er een kruis bij. Linksom komt er een mol bij.'),
  guitarKeys: () => mc('guitar-keys', 'Waarom liggen E, A, D en G zo lekker op de gitaar?', 'De belangrijkste tonen en akkoorden liggen op open snaren', ['Die toonsoorten hebben geen voortekens', 'Die toonsoorten hebben mollen', 'Daar liggen de frets verder uit elkaar'], 'De open snaren zijn E, A, D, G, B en E. In A majeur bijvoorbeeld zijn A, D en E (I, IV en V) allemaal open snaren én open akkoorden.'),
  guitarHorns: () => mc('guitar-horns', 'In welke toonsoorten spelen blazers graag?', 'Met mollen, zoals F, B♭ en E♭', ['Met kruisen, zoals E, A en D', 'Alleen in C majeur', 'Alleen in mineur'], 'Trompet en saxofoon zijn gestemd in B♭ of E♭. Speel je met blazers, zoals in soul en jazz, dan kom je die toonsoorten vaker tegen.'),
  relMinor: () => {
    const key = pick(['C', 'G', 'D', 'A', 'F', 'B♭', 'E♭', 'E']), m = relMinorOf(key);
    return mc('rel-minor', `Wat is de relatieve mineur van ${key} majeur?`, m + 'm', [nm(key, 2, 4) + 'm', nm(key, 1, 2) + 'm', key + 'm', nm(key, 4, 7) + 'm'], `Trap 6 van ${key} majeur is ${m}. ${m} mineur heeft dezelfde voortekens als ${key} majeur.`);
  },
  relShare: () => mc('rel-share', 'Wat hebben een majeurtoonsoort en zijn relatieve mineur gemeen?', 'Dezelfde voortekens en dezelfde noten', ['Dezelfde grondtoon', 'Dezelfde akkoorden in dezelfde volgorde', 'Niets, ze zijn elkaars tegenpool'], 'C majeur en A mineur gebruiken precies dezelfde zeven noten. Alleen het middelpunt is anders.'),
  neighboursQ: () => {
    const up = Math.random() < 0.5, arr = up ? CIRCLE_UP : CIRCLE_DOWN, i = 1 + Math.floor(Math.random() * 5), key = arr[i];
    const ans = `${arr[i - 1]} en ${arr[i + 1]}`;
    return mc('circle-nb', `Welke toonsoorten liggen naast ${key} in de kwintencirkel?`, ans, [`${arr[i + 1]} en ${arr[(i + 2) % 7] || 'C'}`, `${nm(key, 1, 2)} en ${nm(key, 6, 10)}`, `${nm(key, 2, 4)} en ${nm(key, 5, 9)}`], `Buren in de kwintencirkel liggen een kwint uit elkaar en verschillen maar één voorteken: ${arr[i - 1]} – ${key} – ${arr[i + 1]}.`);
  },
  playKeyRoot: () => {
    const key = pick(['G', 'D', 'A', 'E', 'F', 'B♭', 'E♭']), n = MAJOR_SIG[key];
    return playItem('play-key-root', `Speel de grondtoon van de majeurtoonsoort met ${sigText(n)}`, { big: '?', sub: sigText(n), steps: [{ k: 'pc', pc: pcOf(key), name: key }], hint: `Dat is ${key} majeur.` });
  },

  // ---- unit 5: mineur ----
  minPattern: () => mc('min-pattern', 'Wat is het patroon van natuurlijk mineur?', 'H h H H h H H', ['H H h H H H h', 'H h H H H h H', 'h H H h H H H'], 'Hele, halve, hele, hele, halve, hele, hele toon. Dat is majeur, maar dan beginnend op trap 6.', 'H = hele toon, h = halve toon'),
  minThird: () => mc('min-third', 'Welke toon maakt een toonladder mineur in plaats van majeur?', 'De kleine terts (♭3)', ['De kwint', 'De kleine secunde', 'Het octaaf'], 'Mineur heeft een kleine terts: 3 halve tonen boven de grondtoon. Die geeft de donkere klank.'),
  minNotes: kind => {
    const key = pick(['A', 'E', 'D', 'G', 'B', 'C']);
    let tones = scaleTones('minor', key).map(t => t.name);
    if (kind !== 'natural') tones[6] = nm(key, 6, 11);
    if (kind === 'melodic') tones[5] = nm(key, 5, 9);
    const label = kind === 'harmonic' ? 'harmonisch mineur' : kind === 'melodic' ? 'melodisch mineur (omhoog)' : 'natuurlijk mineur';
    return multi('min-notes-' + kind, `Tik alle noten van ${key} ${label}`, noteChips(tones, key, ['D', 'G', 'C'].includes(key), 4), tones, `${key} ${label}: ${tones.join(' ')}.`);
  },
  harm7: () => {
    const key = pick(['A', 'E', 'D', 'G', 'C', 'B']), raised = nm(key, 6, 11), nat = nm(key, 6, 10);
    return mc('harm7', `Trap 7 gaat omhoog in ${key} harmonisch mineur. Welke noot krijg je?`, raised, [nat, nm(key, 5, 9), nm(key, 2, 4), nm(key, 5, 8)], `Trap 7 gaat een halve toon omhoog: ${nat} wordt ${raised}. Zo krijg je weer een leidtoon naar ${key}.`);
  },
  melodic: () => mc('melodic', 'Wat is er anders aan melodisch mineur (omhoog)?', 'Trap 6 en 7 zijn verhoogd', ['Alleen trap 7 is verhoogd', 'Trap 3 is verhoogd', 'Er zijn maar vijf tonen'], 'Melodisch mineur verhoogt omhoog trap 6 en 7, zodat de grote sprong tussen 6 en 7 verdwijnt. Omlaag speel je vaak gewoon natuurlijk mineur.'),
  relMajor: () => {
    const key = pick(['A', 'E', 'B', 'D', 'G', 'C', 'F♯']), maj = relMajorOf(key);
    return mc('rel-major', `Wat is de relatieve majeur van ${key} mineur?`, maj, [nm(key, 4, 7), nm(key, 3, 5), nm(key, 1, 2), nm(key, 5, 8)], `Tel een kleine terts omhoog vanaf ${key}: ${maj}. ${key} mineur en ${maj} majeur delen dezelfde noten.`);
  },
  parallel: () => mc('parallel', 'Wat is het verschil tussen A mineur en C majeur?', 'Zelfde noten, ander middelpunt', ['Andere noten, zelfde middelpunt', 'A mineur heeft één kruis meer', 'Er is geen enkel verschil'], 'A mineur en C majeur gebruiken dezelfde zeven noten. Het verschil is de grondtoon waar de muziek naartoe trekt.'),
  playHarm7: () => {
    const key = pick(['A', 'E', 'D']), raised = nm(key, 6, 11);
    return playItem('play-harm7', `Speel de verhoogde 7e trap van ${key} harmonisch mineur`, { big: '7', sub: `${key} harmonisch mineur`, steps: [{ k: 'pc', pc: pcOf(raised), name: raised }], hint: `Het is ${raised}, een halve toon onder ${key}.` });
  },
  minFlats: () => mc('min-flats', 'Welke trappen liggen in natuurlijk mineur een halve toon lager dan in majeur?', '3, 6 en 7', ['2, 3 en 4', '3, 5 en 7', '4, 6 en 7'], 'Vergelijk A majeur (A B C♯ D E F♯ G♯) met A mineur (A B C D E F G): de 3, de 6 en de 7 zakken een halve toon.'),
  minPent: () => mc('min-pent', 'Welke twee trappen laat de mineurpentatoniek weg uit natuurlijk mineur?', '2 en 6', ['3 en 7', '4 en 5', '1 en 5'], 'Natuurlijk mineur is 1 2 ♭3 4 5 ♭6 ♭7. Zonder de 2 en de ♭6 hou je 1 ♭3 4 5 ♭7 over: de mineurpentatoniek.'),
  harmV: () => {
    const key = pick(['A', 'E', 'D']), t = scaleTones('minor', key), v = t[4].name;
    return mc('harm-v', `Welk akkoord krijg je op trap 5 van ${key} harmonisch mineur?`, v, [v + 'm', t[3].name + 'm', t[2].name], `De verhoogde 7 maakt het akkoord op trap 5 majeur: ${v} in plaats van ${v}m. Dat trekt sterk naar ${key} mineur.`);
  },
  minKind: () => {
    const key = pick(['A', 'E', 'D']), tones = scaleTones('minor', key).map(t => t.name), kind = pick(['natural', 'harmonic', 'melodic']);
    if (kind !== 'natural') tones[6] = nm(key, 6, 11);
    if (kind === 'melodic') tones[5] = nm(key, 5, 9);
    const label = { natural: 'natuurlijk mineur', harmonic: 'harmonisch mineur', melodic: 'melodisch mineur' };
    const why = kind === 'natural' ? 'Niets verhoogd: natuurlijk mineur.' : kind === 'harmonic' ? `Alleen trap 7 is verhoogd (${tones[6]}): harmonisch mineur.` : `Trap 6 en 7 zijn verhoogd (${tones[5]} en ${tones[6]}): melodisch mineur.`;
    return mc('min-kind', 'Welke mineur is dit?', label[kind], Object.values(label), why, tones.concat([key]).join(' '));
  },

  // ---- unit 6: akkoorden bouwen ----
  triadFormula: kinds => {
    const all = [{ k: 'maj', n: 'majeurakkoord', f: '1 3 5' }, { k: 'min', n: 'mineurakkoord', f: '1 ♭3 5' }, { k: 'dim', n: 'verminderd akkoord', f: '1 ♭3 ♭5' }, { k: 'aug', n: 'overmatig akkoord', f: '1 3 ♯5' }, { k: 'sus4', n: 'sus4-akkoord', f: '1 4 5' }];
    const t = pick(all.filter(x => (kinds || ['maj', 'min', 'dim', 'sus4']).includes(x.k)));
    return mc('triad-formula', `Uit welke trappen bestaat een ${t.n}?`, t.f, ['1 3 5', '1 ♭3 5', '1 ♭3 ♭5', '1 4 5', '1 3 ♯5'], 'Majeur 1 3 5, mineur 1 ♭3 5, verminderd 1 ♭3 ♭5, overmatig 1 3 ♯5, sus4 1 4 5.');
  },
  chordNotes: types => {
    for (let i = 0; i < 40; i++) {
      const type = pick(types), root = pick(['C', 'D', 'E', 'F', 'G', 'A', 'B♭', 'E♭']);
      if (!chordOk(type, root)) continue;
      const tones = chordTones(type, root);
      return multi('chord-notes-' + type, `Tik de noten van ${chordName(root, type)}`, noteChips(tones.map(t => t.name), root, root.includes('♭') || root === 'F', 4), tones.map(t => t.name), `${chordName(root, type)}: ${tones.map(t => `${t.name} (${t.label})`).join(', ')}.`);
    }
    return G.triadFormula();
  },
  whichChord: types => {
    for (let i = 0; i < 40; i++) {
      const type = pick(types), root = pick(['C', 'D', 'E', 'F', 'G', 'A']);
      if (!chordOk(type, root)) continue;
      const names = chordTones(type, root).map(t => t.name).join(' ');
      // alleen akkoorden met evenveel tonen, anders verraadt het aantal het antwoord
      const alts = Object.keys(CHORDS).filter(k => k !== type && chordOk(k, root) && CHORDS[k].tones.length === CHORDS[type].tones.length).map(k => chordName(root, k));
      return mc('which-chord', `Welk akkoord bestaat uit ${names}?`, chordName(root, type), alts, `${names} = ${chordName(root, type)}: ${CHORDS[type].name}.`);
    }
    return G.triadFormula();
  },
  seventhDiff: () => mc('seventh-diff', 'Wat is het verschil tussen Cmaj7 en C7?', 'De septiem: B in Cmaj7, B♭ in C7', ['De terts: E in Cmaj7, E♭ in C7', 'De kwint: G in Cmaj7, G♭ in C7', 'Er is geen verschil'], 'maj7 heeft een grote septiem (B), een dominant 7 een kleine septiem (B♭). Die kleine septiem geeft de onrustige, bluesy klank.'),
  thirdMakes: () => mc('third-makes', 'Welke toon maakt het verschil tussen C en Cm?', 'De terts: E of E♭', ['De grondtoon', 'De kwint: G of G♭', 'De septiem'], 'C = C E G, Cm = C E♭ G. Alleen de terts verschilt.'),
  stackThirds: () => mc('stack-thirds', 'Hoe bouw je een drieklank?', 'Je stapelt twee tertsen op de grondtoon', ['Je stapelt twee kwinten op de grondtoon', 'Je neemt drie tonen naast elkaar uit de toonladder', 'Je neemt de grondtoon, de kwart en het octaaf'], 'Neem een toon, sla de volgende over en neem die daarna: C, (D), E, (F), G. Zo krijg je grondtoon, terts en kwint.'),
  seventhFeel: () => {
    const all = ['dominant 7 (C7)', 'groot 7 (Cmaj7)', 'mineur 7 (Cm7)', 'halfverminderd (Cm7♭5)'];
    const q = pick([['bluesy en onaf, alsof het verder wil', 0], ['zacht en dromerig', 1], ['warm en soulvol', 2], ['donker en gespannen', 3]]);
    return mc('seventh-feel', `Welk septiemakkoord klinkt ${q[0]}?`, all[q[1]], all, 'maj7 klinkt zacht en dromerig, 7 bluesy en onaf, m7 warm en soulvol, m7♭5 donker en gespannen.');
  },
  // akkoordnamen lezen: symbool naar naam, of andersom
  chordSymbol: () => {
    const triads = [['C', 'C majeur'], ['Cm', 'C mineur'], ['C°', 'C verminderd'], ['C+', 'C overmatig'], ['Csus4', 'C sus4']];
    const sevens = [['Cmaj7', 'C groot 7'], ['C7', 'C dominant 7'], ['Cm7', 'C mineur 7'], ['Cm7♭5', 'C halfverminderd']];
    const root = pick(['C', 'D', 'E', 'G', 'A']), seven = Math.random() < 0.6, group = seven ? sevens : triads, [sym, name] = pick(group);
    const r = s => s.replace('C', root), toName = Math.random() < 0.5;
    const pool = group.concat([pick(seven ? triads : sevens)]);
    const why = `${r(sym)} is ${r(name)}. Een 7 zonder “maj” betekent een kleine septiem: ${r('C7')} heeft een kleine, ${r('Cmaj7')} een grote septiem.`;
    return toName ? mc('chord-symbol', `Wat betekent ${r(sym)}?`, r(name), pool.map(x => r(x[1])), why)
      : mc('chord-symbol', `Hoe schrijf je ${r(name)}?`, r(sym), pool.map(x => r(x[0])), why);
  },
  playChordTones: types => {
    for (let i = 0; i < 40; i++) {
      const type = pick(types), root = pick(['E', 'A', 'D', 'G', 'C']);
      if (!chordOk(type, root)) continue;
      const tones = chordTones(type, root);
      return playItem('play-chord-' + type, `Speel de tonen van ${chordName(root, type)}`, { big: chordName(root, type), sub: 'in elke volgorde', steps: [{ k: 'set', pcs: tones.map(t => t.pc), names: tones.map(t => t.name), labels: tones.map(t => t.label) }], hint: tones.map(t => t.name).join(' ') });
    }
    return G.playFifth();
  },

  // ---- unit 7: akkoorden binnen een toonsoort ----
  diaQuality: () => {
    const d = 1 + Math.floor(Math.random() * 7), q = ['majeur', 'mineur', 'mineur', 'majeur', 'majeur', 'mineur', 'verminderd'][d - 1];
    return mc('dia-quality', `Wat voor akkoord staat op trap ${d} in een majeurtoonsoort?`, q, ['majeur', 'mineur', 'verminderd'], 'In een majeurtoonsoort zijn de akkoorden op trap 1, 4 en 5 majeur, op trap 2, 3 en 6 mineur en op trap 7 verminderd.');
  },
  // byTrap: met trapnummers in plaats van Romeinse cijfers (die komen pas in stap 2)
  diaChord: byTrap => {
    const key = pick(['C', 'G', 'D', 'A', 'F']), d = pick([2, 3, 4, 5, 6]), c = diatonic(key, false, d), all = [1, 2, 3, 4, 5, 6, 7].map(x => diatonic(key, false, x));
    const alts = [1, 2, 3, 4, 5, 6].filter(x => x !== d).map(x => diatonic(key, false, x).name).concat([c.root + (c.type === 'min' ? '' : 'm')]);
    return byTrap ? mc('dia-chord-trap', `Welk akkoord staat op trap ${d} in ${key} majeur?`, c.name, alts, `In ${key} majeur: ${all.map((x, i) => `${i + 1}=${x.name}`).join(' ')}.`)
      : mc('dia-chord', `Wat is het ${c.roman}-akkoord in ${key} majeur?`, c.name, alts, `In ${key} majeur: ${all.map(x => `${x.roman}=${x.name}`).join(' ')}.`);
  },
  romanOf: () => {
    const key = pick(['C', 'G', 'D', 'A', 'F']), d = pick([2, 3, 4, 5, 6]), c = diatonic(key, false, d);
    return mc('roman-of', `Welke trap is ${c.name} in ${key} majeur?`, c.roman, ROMAN_MAJOR.filter(r => r !== c.roman), `In ${key} majeur: ${[1, 2, 3, 4, 5, 6, 7].map(x => diatonic(key, false, x)).map(x => `${x.roman}=${x.name}`).join(' ')}.`);
  },
  functionOf: () => {
    const d = pick([1, 4, 5]);
    return mc('function-of', `Welke functie heeft het ${ROMAN_MAJOR[d - 1]}-akkoord?`, FUNCTION_OF[d], ['tonica', 'subdominant', 'dominant', 'mediant'], 'I is de tonica (thuis), IV de subdominant (weg van huis) en V de dominant (wil terug naar I).');
  },
  v7: () => {
    const key = pick(['C', 'G', 'D', 'A', 'E', 'F']), v = scaleTones('major', key)[4].name;
    return mc('v7', `Wat is het V7-akkoord in ${key} majeur?`, v + '7', [v + 'maj7', key + '7', v + 'm7', nm(key, 3, 5) + '7'], `Trap 5 in ${key} is ${v}. Met een kleine septiem erbij wordt dat ${v}7, het dominantseptiemakkoord.`);
  },
  whyV: () => mc('why-v', 'Waarom wil het V7-akkoord zo graag naar I?', 'De leidtoon in V7 wil een halve toon omhoog naar de grondtoon', ['Omdat het het hardste akkoord is', 'Omdat het altijd mineur is', 'Omdat er geen terts in zit'], 'In G7 zit B, de leidtoon van C. B wil naar C en F wil naar E: zo valt alles op zijn plek in C.'),
  playDiaRoot: ds => {
    const key = pick(['C', 'G', 'D', 'A']), d = pick(ds || [2, 4, 5, 6]), c = diatonic(key, false, d);
    return playItem('play-dia-root', `Speel de grondtoon van het ${c.roman}-akkoord in ${key} majeur`, { big: c.roman, sub: `in ${key} majeur`, steps: [{ k: 'pc', pc: pcOf(c.root), name: c.root }], hint: `Het ${c.roman}-akkoord is ${c.name}.` });
  },
  playDiaChord: (ds, byTrap) => {
    const key = pick(['C', 'G', 'D', 'A']), d = pick(ds || [1, 4, 5, 6]), c = diatonic(key, false, d), tones = chordTones(c.type, c.root);
    const set = [{ k: 'set', pcs: tones.map(t => t.pc), names: tones.map(t => t.name), labels: tones.map(t => t.label) }], hint = `${c.name}: ${tones.map(t => t.name).join(' ')}`;
    return byTrap ? playItem('play-dia-chord-trap', `Speel de tonen van het akkoord op trap ${d} in ${key} majeur`, { big: `trap ${d}`, sub: `in ${key} majeur, elke volgorde`, steps: set, hint })
      : playItem('play-dia-chord', `Speel de tonen van het ${c.roman}-akkoord in ${key} majeur`, { big: c.roman, sub: `in ${key} majeur, elke volgorde`, steps: set, hint });
  },
  // de grondtoon van de subdominant of de dominant: zonder gitaar een vraag over de functies
  playFunctionRoot: () => {
    const key = pick(['C', 'G', 'D', 'A']), d = pick([4, 5]), c = diatonic(key, false, d), fn = FUNCTION_OF[d];
    return playItem('play-function-root', `Speel de grondtoon van de ${fn} in ${key} majeur`, { big: c.roman, sub: `in ${key} majeur`, steps: [{ k: 'pc', pc: pcOf(c.root), name: c.root }], hint: `De ${fn} is het ${c.roman}-akkoord: ${c.name}.` });
  },
  romanCase: () => mc('roman-case', 'Wat betekent een kleine letter in een Romeins cijfer, zoals ii of vi?', 'Een mineurakkoord', ['Een majeurakkoord', 'Een verminderd akkoord', 'Een septiemakkoord'], 'Een hoofdletter is majeur (I, IV, V), een kleine letter mineur (ii, iii, vi) en ° verminderd (vii°).'),
  substitute: () => {
    const q = pick([{ q: 'Welk akkoord deelt twee tonen met I en klinkt als een donkere versie van thuis?', a: 'vi', o: ['ii', 'IV', 'V'] }, { q: 'Welk mineurakkoord kan het werk van IV doen?', a: 'ii', o: ['iii', 'vii°', 'V'] }]);
    return mc('substitute', q.q, q.a, q.o, 'vi deelt twee tonen met I: in C delen Am en C de tonen C en E. ii deelt twee tonen met IV: Dm en F delen F en A.');
  },
  tritoneV7: () => {
    const key = pick(['C', 'G', 'D', 'F']), t = scaleTones('major', key).map(x => x.name), v = t[4];
    return mc('tritone-v7', `Welke twee tonen in ${v}7 vormen samen een tritonus?`, `${t[6]} en ${t[3]}`, [`${v} en ${t[1]}`, `${v} en ${t[6]}`, `${t[1]} en ${t[3]}`], `${v}7 is ${v} ${t[6]} ${t[1]} ${t[3]}. ${t[6]} en ${t[3]} liggen drie hele tonen uit elkaar: ${t[6]} wil omhoog naar ${key}, ${t[3]} zakt naar ${t[2]}.`);
  },
  playV7: () => {
    const key = pick(['C', 'G', 'D', 'A']), v = scaleTones('major', key)[4].name, tones = chordTones('dom7', v);
    return playItem('play-v7', `Speel de tonen van het V7-akkoord in ${key} majeur`, { big: 'V7', sub: `in ${key} majeur, elke volgorde`, steps: [{ k: 'set', pcs: tones.map(t => t.pc), names: tones.map(t => t.name), labels: tones.map(t => t.label) }], hint: `${v}7: ${tones.map(t => t.name).join(' ')}` });
  },
  minorDia: () => {
    const key = pick(['A', 'E', 'D']), d = pick([1, 3, 4, 5, 6, 7]), c = diatonic(key, true, d);
    const alts = [1, 3, 4, 5, 6, 7].filter(x => x !== d).map(x => diatonic(key, true, x).name).concat([c.type === 'min' ? c.root : c.root + 'm']);
    return mc('minor-dia', `Wat is het ${c.roman}-akkoord in ${key} mineur?`, c.name, alts, `In ${key} mineur: ${[1, 2, 3, 4, 5, 6, 7].map(x => diatonic(key, true, x)).map(x => `${x.roman}=${x.name}`).join(' ')}.`);
  },
  rockProg: () => {
    const key = pick(['A', 'E', 'D']), ch = [1, 7, 6].map(d => diatonic(key, true, d).name);
    return mc('rock-prog', `Wat is i–VII–VI in ${key} mineur?`, ch.join(' – '), [[1, 6, 7], [1, 4, 5], [1, 3, 7]].map(ds => ds.map(d => diatonic(key, true, d).name).join(' – ')), `In ${key} mineur is i ${ch[0]}, VII ${ch[1]} en VI ${ch[2]}. Hoor het in All Along the Watchtower.`);
  },
  harmV7: () => mc('harm-v7', 'In A mineur hoor je op trap 5 vaak E of E7 in plaats van Em. Waarom?', 'Harmonisch mineur verhoogt trap 7, zo komt er een leidtoon in', ['Trap 5 is in mineur altijd majeur', 'Em past niet in A mineur', 'E is een open snaar'], 'In A harmonisch mineur wordt G een G♯. Het akkoord op trap 5 wordt E G♯ B: E majeur, met G♯ als leidtoon naar A.'),
  playMinorRoot: () => {
    const key = pick(['A', 'E', 'D']), d = pick([3, 4, 6, 7]), c = diatonic(key, true, d);
    return playItem('play-minor-root', `Speel de grondtoon van het ${c.roman}-akkoord in ${key} mineur`, { big: c.roman, sub: `in ${key} mineur`, steps: [{ k: 'pc', pc: pcOf(c.root), name: c.root }], hint: `Het ${c.roman}-akkoord is ${c.name}.` });
  },

  // ---- unit 8: progressies ----
  prog145: () => {
    const key = pick(['E', 'A', 'D', 'G', 'C']), ch = [1, 4, 5].map(d => diatonic(key, false, d).name);
    return mc('prog-145', `Wat zijn I, IV en V in ${key} majeur?`, ch.join(' – '), [[1, 2, 5], [1, 4, 6], [1, 3, 5], [2, 4, 5]].map(ds => ds.map(d => diatonic(key, false, d).name).join(' – ')), `Tel de trappen: ${key} (1), ${ch[1]} (4), ${ch[2]} (5).`);
  },
  prog251: () => {
    const key = pick(['C', 'G', 'D', 'F', 'B♭']), ch = [2, 5, 1].map(d => diatonic(key, false, d).name);
    return mc('prog-251', `Wat is ii–V–I in ${key} majeur?`, ch.join(' – '), [[2, 4, 1], [6, 5, 1], [2, 5, 6]].map(ds => ds.map(d => diatonic(key, false, d).name).join(' – ')).concat([`${ch[0].replace('m', '')} – ${ch[1]} – ${ch[2]}`]), `ii–V–I in ${key}: ${ch.join(' – ')}. Het meest gebruikte slot in jazz.`);
  },
  blues12: () => {
    const q = pick([{ q: 'Welk akkoord speel je in maat 5 van een 12-maten blues?', a: 'IV' }, { q: 'Welk akkoord speel je in maat 9 van een 12-maten blues?', a: 'V' }, { q: 'Welk akkoord speel je in maat 10 van een 12-maten blues?', a: 'IV' }, { q: 'Hoeveel maten begint een standaard 12-maten blues op I?', a: '4' }]);
    return mc('blues12', q.q, q.a, q.a === '4' ? ['2', '3', '6'] : ['I', 'IV', 'V', 'vi'], 'De basisvorm: I I I I | IV IV I I | V IV I I.');
  },
  bluesKey: () => {
    const key = pick(['A', 'E', 'G', 'D', 'C']), ch = [1, 4, 5].map(d => scaleTones('major', key)[d - 1].name + '7');
    return mc('blues-key', `Welke drie akkoorden gebruik je voor een blues in ${key}?`, ch.join(' – '), [[1, 4, 5].map(d => scaleTones('major', key)[d - 1].name).join(' – ') + 'm', [1, 2, 5].map(d => scaleTones('major', key)[d - 1].name + '7').join(' – '), [1, 4, 6].map(d => scaleTones('major', key)[d - 1].name + '7').join(' – ')], `I, IV en V, alle drie als dominant 7: ${ch.join(', ')}.`);
  },
  prog1564: () => {
    const key = pick(['C', 'G', 'D', 'A']), ch = [1, 5, 6, 4].map(d => diatonic(key, false, d).name);
    return mc('prog-1564', `Wat is I–V–vi–IV in ${key} majeur?`, ch.join(' – '), [[1, 4, 6, 5], [1, 5, 3, 4], [6, 4, 1, 5]].map(ds => ds.map(d => diatonic(key, false, d).name).join(' – ')), `I–V–vi–IV in ${key}: ${ch.join(' – ')}. Een van de meest gebruikte akkoordenschema's in pop.`);
  },
  // grondtonen van een akkoordenschema; zonder gitaar een vraag over hetzelfde schema (skill play-prog-145 enz.)
  playProg: progs => {
    const key = pick(['C', 'G', 'D', 'A', 'E']), prog = pick(progs || [[1, 4, 5], [2, 5, 1], [1, 5, 6, 4], [1, 6, 4, 5]]);
    const ch = prog.map(d => diatonic(key, false, d));
    return playItem('play-prog-' + prog.join(''), `Speel de grondtonen van ${ch.map(c => c.roman).join('–')} in ${key} majeur`, { big: ch.map(c => c.roman).join('–'), sub: `in ${key} majeur`, steps: ch.map(c => ({ k: 'pc', pc: pcOf(c.root), name: c.root })), hint: ch.map(c => c.name).join(' – ') });
  },
  prog6415: () => {
    const key = pick(['C', 'G', 'D', 'A']), ch = [6, 4, 1, 5].map(d => diatonic(key, false, d).name);
    return mc('prog-6415', `Wat is vi–IV–I–V in ${key} majeur?`, ch.join(' – '), [[1, 5, 6, 4], [6, 5, 4, 1], [2, 4, 1, 5]].map(ds => ds.map(d => diatonic(key, false, d).name).join(' – ')), `vi–IV–I–V in ${key}: ${ch.join(' – ')}. Hetzelfde rondje als I–V–vi–IV, maar het begint op vi en klinkt daardoor donkerder.`);
  },
  whyWorks: () => mc('why-works', 'Waarom klinkt V7 naar I als thuiskomen?', 'V7 bouwt spanning op die in I oplost', ['V7 en I hebben geen enkele toon gemeen', 'I is altijd een mineurakkoord', 'V7 is altijd het laatste akkoord'], 'In V7 zit de leidtoon, die een halve toon omhoog wil naar de grondtoon. Spanning en ontspanning: dat is eigenlijk het hele verhaal van harmonie.'),
  findHome: () => mc('find-home', 'Hoe vind je het I-akkoord van een nummer?', 'Kijk op welk akkoord het refrein eindigt', ['Het is altijd het eerste akkoord van het couplet', 'Het is het akkoord dat het snelst wisselt', 'Het is altijd een mineurakkoord'], 'Thuis is waar het refrein tot rust komt. Meestal is dat I, of i als het nummer in mineur staat.'),
  progFunction: () => {
    const q = pick([{ q: 'Het nummer gaat weg van huis, maar zonder veel spanning. Welk akkoord is dat waarschijnlijk?', a: 'IV' }, { q: 'Het voelt alsof het nummer naar huis wil. Welk akkoord is dat waarschijnlijk?', a: 'V' }, { q: 'Het refrein komt tot rust op dit akkoord. Welk akkoord is dat waarschijnlijk?', a: 'I' }]);
    return mc('prog-function', q.q, q.a, ['I', 'IV', 'V', 'vi'], 'I is thuis, IV gaat op pad zonder veel spanning en V wil terug naar I.');
  },

  // ---- latere onderwerpen ----
  playBox: (scale, root, box) => {
    const pos = scaleBox(scale, root, box);
    const lo = Math.min(...pos.map(p => p.f)), hi = Math.max(...pos.map(p => p.f));
    return playItem(`play-box-${scale}-${box}`, `Speel ${root} ${SCALES[scale].short}, box ${box}, omhoog`, { big: root, sub: `${SCALES[scale].short} · box ${box}`, steps: pos.map(p => ({ k: 'pc', pc: p.pc, name: p.name, pos: { s: p.s, f: p.f } })), neck: { from: Math.max(0, lo - 1), to: hi + 1, marks: pos.map(p => ({ s: p.s, f: p.f, kind: p.label === 'R' ? 'todo root' : 'todo', label: p.name })) } });
  },
  scaleNotesQ: (scale, root) => {
    const tones = scaleTones(scale, root).map(t => t.name);
    return multi('scale-notes-' + scale, `Tik alle noten van ${root} ${SCALES[scale].short}`, noteChips(tones, root, root.includes('♭') || ['F', 'D', 'G', 'C'].includes(root) && scale !== 'major', 3), tones, `${root} ${SCALES[scale].short}: ${tones.join(' ')}.`);
  },
  scaleFormulaQ: scale => {
    const f = SCALES[scale].degs.map(d => d.label.replace('R', '1')).join(' ');
    const others = Object.keys(SCALES).filter(k => k !== scale).map(k => SCALES[k].degs.map(d => d.label.replace('R', '1')).join(' '));
    return mc('scale-formula-' + scale, `Welke trappen heeft ${SCALES[scale].short}?`, f, others, `${SCALES[scale].name}: ${f}.`);
  },
  notePlay: () => {
    const t = NoteGame.pick(null);
    return playItem('note-play', `Speel ${t.name} op de ${STR_NAME[t.s]}`, { big: t.name, sub: `op de ${STR_NAME[t.s]}`, steps: [{ k: 'pc', pc: t.pc, name: t.name, string: t.s, frets: t.frets }], highlight: [t.s], hint: `Fret ${t.frets.join(' of ')}` });
  },
};

// ---------- Units ----------
const ALL_SEMIS = INTERVALS.map(i => i.semis);
// Elke stap begint met de kaartjes die bij die stap horen (step in 11c-course.js); daarna komen alleen
// oefeningen over hetzelfde onderwerp. Een stap met gitaar speel je, zonder gitaar wordt hij tikken.
const TOPICS = {
  'twelve-tones': {
    title: 'Waarom 12 tonen', subtitle: 'Octaaf, kwint en de kwintencirkel', drill: { mode: 'intervals', set: { set: [7, 12] } },
    nodes: [
      { title: 'Het octaaf', gen: () => [G.octRatio(), G.octSemis(), G.harmonic3(), G.tapOctave(), G.playOctave(), G.playOctave()] },
      { title: 'De kwint', gen: () => [G.fifthRatio(), G.fifthSemis(), G.fifthAbove(), G.tapFifth(), G.playFifth(), G.playFifth()] },
      { title: 'Powerchords', gen: () => [G.powerNotes(), G.powerWhy(), G.powerNotes(), G.playPower(), G.playPower()] },
      { title: 'Kwinten stapelen', gen: () => [G.circleNext(), G.circleNext(), G.circleMissing(), G.stackFifths(), G.stackFifths(), G.enharmonic()] },
      { title: 'De stemming', gen: () => [G.comma(), G.twelveWhy(), G.equalTemp(), G.equalFifth(), G.semitoneRatio(), G.fretShorter()] },
    ],
  },
  'intervals': {
    title: 'Intervallen', subtitle: 'Halve tonen tellen, namen en vormen op de hals', drill: { mode: 'intervals' },
    nodes: [
      { title: 'Halve tonen tellen', gen: p => [G.ivSemis(p.set), G.ivSemis(p.set), G.ivNumber(), G.ivNumber(), G.ivName(p.set), G.ivName(p.set)] },
      { title: 'Tertsen', gen: () => [G.ivThirds(), G.ivAbove([3, 4]), G.ivAbove([3, 4]), G.ivName([3, 4]), G.ivTap([3, 4]), G.ivPlay([3, 4]), G.ivPlay([3, 4])] },
      { title: 'Kwart, kwint, octaaf', gen: () => [G.reinWhich(), G.tritone(), G.ivAbove([5, 7]), G.ivTap([5, 7, 12]), G.ivTap([5, 7]), G.ivPlay([5, 7]), G.ivPlay([5, 7, 12])] },
      { title: 'Sexten en septiemen', gen: () => [G.ivInvert(), G.ivInvert(), G.ivSemis([8, 9, 10, 11]), G.ivAbove([8, 9, 10, 11]), G.ivAbove([9, 10]), G.ivTap([9, 10]), G.ivPlay([9, 10])] },
      { title: 'Op de hals', gen: p => [G.ivShape(), G.ivShape(), G.ivTap(p.set), G.ivTap(p.set), G.ivPlay(p.set), G.ivPlay(p.set)] },
    ],
  },
  'major-scale': {
    title: 'De majeurtoonladder', subtitle: 'Het patroon, de trappen en de leidtoon', drill: { mode: 'scales', set: { scale: 'major', root: 'G', box: 1 } },
    nodes: [
      { title: 'Het patroon', gen: () => [G.majPattern(), G.majCount(), G.majNotes(['C']), G.majStep(['C'], true), G.majStep(['C'], true)] },
      { title: 'Trappen', gen: () => [G.majDegree(['C', 'G', 'A']), G.majDegree(['C', 'G', 'A']), G.majWhich(['C', 'G', 'A']), G.majWhich(['C', 'G', 'A']), G.playDegree(['C', 'G', 'A']), G.playDegree(['C', 'G', 'A'])] },
      { title: 'De halve stappen', gen: () => [G.majHalf(), G.majHalfPair(['C', 'G', 'D', 'A']), G.majHalfPair(['C', 'G', 'D', 'A']), G.majStep(['C', 'G', 'D', 'A']), G.majStep(['C', 'G', 'D', 'A'])] },
      { title: 'Rust en spanning', gen: () => [G.leading(), G.leadingNote(), G.dominantNote(), G.stableDegrees(), G.songEnd(), G.playLeading()] },
      { title: 'Elke toonsoort', gen: () => [G.majChange(), G.majNotes(['G', 'D', 'F']), G.majNotes(['A', 'B♭', 'E']), G.playScale('major', pick(['C', 'G', 'D'])), G.playScale('major', pick(['A', 'F', 'G']))] },
    ],
  },
  'keys-circle': {
    title: 'Toonsoorten', subtitle: 'Voortekens en de kwintencirkel', drill: { mode: 'degrees' },
    nodes: [
      { title: 'Kruisen', gen: () => [G.keyDef(), G.sigCount('sharp'), G.sigCount('sharp'), G.keyFromSig('sharp'), G.newSharp(), G.newSharp()] },
      { title: 'Mollen', gen: () => [G.sigCount('flat'), G.sigCount('flat'), G.keyFromSig('flat'), G.keyFromSig('flat'), G.newFlat()] },
      { title: 'De volgorde', gen: () => [G.sharpOrder(), G.flatOrder(), G.sigNotes('sharp'), G.sigNotes('flat'), G.keyFromSig()] },
      { title: 'De kwintencirkel', gen: () => [G.circleDir(), G.neighboursQ(), G.neighboursQ(), G.circleNext(), G.circleNext()] },
      { title: 'Op de hals', gen: () => [G.guitarKeys(), G.guitarHorns(), G.playKeyRoot(), G.playKeyRoot(), G.playKeyRoot()] },
    ],
  },
  'minor': {
    title: 'Mineur', subtitle: 'Natuurlijk, harmonisch en melodisch', drill: { mode: 'scales', set: { scale: 'minor', root: 'A', box: 1 } },
    nodes: [
      { title: 'Relatief', gen: () => [G.relMinor(), G.relMinor(), G.relMajor(), G.relMajor(), G.relShare(), G.parallel()] },
      { title: 'Natuurlijk mineur', gen: () => [G.minPattern(), G.minThird(), G.minFlats(), G.minNotes('natural'), G.minNotes('natural'), G.minPent()] },
      { title: 'Harmonisch mineur', gen: () => [G.harm7(), G.harm7(), G.minNotes('harmonic'), G.minNotes('harmonic'), G.harmV()] },
      { title: 'Melodisch mineur', gen: () => [G.melodic(), G.minNotes('melodic'), G.minNotes('melodic'), G.minKind(), G.minKind()] },
      { title: 'Mineur op de hals', gen: () => [G.playScale('minor', pick(['A', 'E'])), G.playScale('minor', pick(['D', 'A'])), G.playHarm7(), G.playHarm7()] },
    ],
  },
  'chord-building': {
    title: 'Akkoorden bouwen', subtitle: 'Drieklanken en septiemakkoorden', drill: { mode: 'chords' },
    nodes: [
      { title: 'Drieklanken', gen: () => [G.stackThirds(), G.triadFormula(['maj', 'min', 'dim', 'aug']), G.triadFormula(['maj', 'min', 'dim', 'aug']), G.chordNotes(['maj', 'min']), G.whichChord(['maj', 'min', 'dim'])] },
      { title: 'Majeur en mineur', gen: () => [G.thirdMakes(), G.triadFormula(['maj', 'min', 'sus4']), G.chordNotes(['maj', 'min']), G.whichChord(['maj', 'min']), G.playChordTones(['maj', 'min']), G.playChordTones(['maj', 'min'])] },
      { title: 'Septiemakkoorden', gen: () => [G.seventhDiff(), G.seventhFeel(), G.chordNotes(['dom7', 'maj7', 'm7']), G.chordNotes(['dom7', 'maj7', 'm7']), G.whichChord(['dom7', 'maj7', 'm7', 'm7b5'])] },
      { title: 'Akkoordnamen lezen', gen: () => [G.chordSymbol(), G.chordSymbol(), G.chordSymbol(), G.whichChord(['maj', 'min', 'dom7']), G.whichChord(['m7', 'm7b5', 'maj7'])] },
      { title: 'Akkoordtonen op de hals', gen: () => [G.playChordTones(['maj', 'min']), G.playChordTones(['dom7', 'm7']), G.playChordTones(['maj', 'min', 'dom7']), G.playChordTones(['maj7', 'm7'])] },
    ],
  },
  'diatonic-chords': {
    title: 'Akkoorden in een toonsoort', subtitle: 'Trappen, Romeinse cijfers en functies', drill: { mode: 'chords' },
    nodes: [
      { title: 'Akkoorden per trap', gen: () => [G.diaQuality(), G.diaQuality(), G.diaQuality(), G.diaChord(true), G.playDiaChord([1, 4, 5, 6], true)] },
      { title: 'Romeinse cijfers', gen: () => [G.romanCase(), G.romanOf(), G.romanOf(), G.diaChord(), G.playDiaRoot([2, 4, 5, 6])] },
      { title: 'Thuis, weg en spanning', gen: () => [G.functionOf(), G.functionOf(), G.substitute(), G.substitute(), G.playFunctionRoot()] },
      { title: 'Het V7-akkoord', gen: () => [G.v7(), G.v7(), G.whyV(), G.tritoneV7(), G.playV7()] },
      { title: 'In mineur', gen: () => [G.minorDia(), G.minorDia(), G.rockProg(), G.harmV7(), G.playMinorRoot()] },
    ],
  },
  'progressions': {
    title: 'Progressies', subtitle: 'I–IV–V, ii–V–I en de 12-maten blues', drill: { mode: 'chords' },
    nodes: [
      { title: 'I – IV – V', gen: () => [G.prog145(), G.prog145(), G.prog145(), G.playProg([[1, 4, 5]]), G.playProg([[1, 4, 5]])] },
      { title: 'De 12-maten blues', gen: () => [G.blues12(), G.blues12(), G.blues12(), G.bluesKey(), G.bluesKey()] },
      { title: 'Popschema\'s', gen: () => [G.prog1564(), G.prog1564(), G.prog6415(), G.playProg([[1, 5, 6, 4]]), G.playProg([[6, 4, 1, 5]])] },
      { title: 'ii – V – I', gen: () => [G.prog251(), G.prog251(), G.prog251(), G.v7(), G.playProg([[2, 5, 1]])] },
      { title: 'Zelf herkennen', gen: () => [G.findHome(), G.progFunction(), G.progFunction(), G.whyWorks(), G.playProg()] },
    ],
  },
  'scale-boxes': {
    title: 'Toonladder op de hals', subtitle: 'Boxen spelen en onthouden', drill: { mode: 'scales' },
    nodes: [
      { title: 'De noten', gen: p => [G.scaleFormulaQ(p.scale), G.scaleNotesQ(p.scale, p.root), G.scaleNotesQ(p.scale, p.root)] },
      { title: 'Box ' + 1, gen: p => [G.playBox(p.scale, p.root, p.boxes[0]), G.playBox(p.scale, p.root, p.boxes[0])] },
      { title: 'Volgende box', gen: p => [G.playBox(p.scale, p.root, p.boxes[1] || p.boxes[0]), G.playBox(p.scale, p.root, p.boxes[1] || p.boxes[0])] },
      { title: 'Afwisselen', gen: p => [G.playBox(p.scale, p.root, pick(p.boxes)), G.scaleNotesQ(p.scale, p.root), G.playBox(p.scale, p.root, pick(p.boxes))] },
    ],
  },
  'generic': {
    title: 'Les', subtitle: '', drill: { mode: 'notes' },
    nodes: [
      { title: 'Theorie', gen: () => [] },
      { title: 'Op de hals', gen: () => [G.notePlay(), G.notePlay(), G.notePlay(), G.notePlay()] },
    ],
  },
};
// ---------- Wanneer een les opengaat ----------
// Les 1 opende op 2 oktober. Daarna opent elke les op zondag: de eerste zondag nadat je de unittoets van de
// vorige les haalde, en minstens een dag na de opening van die vorige. Zo komt er hooguit één les per week bij,
// en nooit een stapel lessen als je even niet oefent.
const COURSE_START = '2026-10-02';
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dayKey(d); };
const sundayOnOrAfter = key => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + (7 - d.getDay()) % 7); return dayKey(d); };
// passed[k] = dag waarop de unittoets van les k+1 voor het eerst gehaald is (of null).
// Geeft per les de openingsdatum: alle open lessen, plus hooguit één volgende (een datum in de toekomst,
// of null zolang de toets van de vorige les nog niet gehaald is).
function courseDates(passed, today, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) { out.push(COURSE_START); if (COURSE_START > today) break; continue; }
    if (!passed[k - 1]) { out.push(null); break; }
    const prev = out[k - 1], next = sundayOnOrAfter(passed[k - 1] > plusDays(prev, 1) ? passed[k - 1] : plusDays(prev, 1));
    out.push(next);
    if (next > today) break;
  }
  return out;
}
// eigen vragen uit de les (quiz): bij stap q.step, zonder step bij stap def (de laatste, of de eerste als
// de les geen eigen onderwerp heeft). step null: alle eigen vragen.
function authoredItems(unit, step, n, def) {
  return (unit.quiz || []).filter(q => q && q.q && Array.isArray(q.options) && q.options.length >= 2 && q.options[q.answer] != null)
    .filter(q => step == null || clamp(Math.round(q.step || def || 1), 1, n || 1) === step).map(q => {
      const options = shuffle(q.options.map(String));
      return { type: 'mc', skill: 'authored', prompt: q.q, sub: q.sub, options, answer: options.indexOf(String(q.options[q.answer])), explain: q.explain || '' };
    });
}
// de stappen van een unit en de unittoets. Elke stap heeft zijn eigen kaartjes (cards, uit de les) en
// oefeningen (gen) over hetzelfde onderwerp; de toets begint met het slotkaartje Onthoud.
// De stappen houden hun nummer (L1-0 … L1-4, toets L1-5), zodat je voortgang blijft kloppen.
function unitNodes(unit) {
  if (unit.track === 'hals') return halsNodes(unit);
  if (unit.track === 'gehoor') return gehoorNodes(unit);
  const generic = !TOPICS[unit.topic] || unit.topic === 'generic', tp = generic ? TOPICS.generic : TOPICS[unit.topic];
  const p = Object.assign({ set: ALL_SEMIS, scale: 'minpent', root: 'A', boxes: [1, 2] }, unit.params || {});
  const n = tp.nodes.length, def = generic ? 1 : n, { steps, sum } = stepCards(unit, n);
  const nodes = tp.nodes.map((nd, i) => ({ title: nd.title, cards: steps[i], gen: () => {
    const base = nd.gen(p), own = authoredItems(unit, i + 1, n, def);
    return own.length ? shuffle(base.concat(own)) : base;
  } }));
  if (generic) {
    // een les zonder eigen onderwerp: de eigen vragen heten "Uit de les"; zonder eigen vragen of kaartjes valt die stap weg
    if (authoredItems(unit, 1, n, def).length) nodes[0].title = 'Uit de les';
    else if (!nodes[0].cards.length) nodes.shift();
  }
  const practice = nodes.slice();
  nodes.push({ title: 'Unittoets', test: true, cards: sum, gen: () => {
    let all = [];
    for (const nd of practice) all = all.concat(nd.gen());
    all = shuffle(all);
    const plays = all.filter(x => x.type === 'play').slice(0, 3), rest = all.filter(x => x.type !== 'play').slice(0, 10 - plays.length);
    return shuffle(rest.concat(plays));
  } });
  return nodes;
}
// ---------- Uitlegkaartje: de kern van de les in een paar zinnen ----------
const TOPIC_SUMMARY = {
  'twelve-tones': [
    'Een octaaf hoger is dezelfde noot met de dubbele frequentie (2:1).',
    'De kwint (3:2) is na het octaaf de sterkste samenklank. Grondtoon, kwint en octaaf samen vormen een powerchord.',
    'Twaalf kwinten op elkaar komen bijna uit op zeven octaven. Daarom delen we het octaaf in twaalf halve tonen.',
  ],
  'intervals': [
    'Een interval is de afstand tussen twee tonen, geteld in halve tonen. Op de gitaar is één fret één halve toon.',
    'Kleine terts 3, grote terts 4, reine kwart 5, reine kwint 7 en octaaf 12 halve tonen.',
    'Elk interval heeft een vaste vorm op de hals. Alleen over de B-snaar schuift die vorm één fret op.',
  ],
  'major-scale': [
    'De majeurtoonladder volgt het patroon heel, heel, half, heel, heel, heel, half.',
    'Elke toon heeft een trapnummer: 1 is de grondtoon, 5 de dominant en 7 de leidtoon.',
    'De leidtoon ligt een halve toon onder de grondtoon en trekt er sterk naartoe.',
  ],
  'keys-circle': [
    'De voortekens van een toonsoort vertellen welke noten een ♯ of ♭ krijgen.',
    'Op de kwintencirkel ga je rechtsom telkens een kwint omhoog. Bij elke stap komt er één kruis bij.',
    'Kruisen komen in de volgorde F♯ C♯ G♯ D♯ A♯ E♯ B♯, mollen precies andersom: B♭ E♭ A♭ D♭ G♭ C♭ F♭.',
  ],
  'minor': [
    'Natuurlijk mineur is majeur vanaf trap 6: A mineur heeft dezelfde tonen als C majeur.',
    'Harmonisch mineur verhoogt de 7, zodat er weer een leidtoon naar de grondtoon is.',
    'Melodisch mineur verhoogt de 6 en de 7 (in de klassieke muziek alleen omhoog).',
  ],
  'chord-building': [
    'Een drieklank stapelt twee tertsen: grondtoon, terts en kwint.',
    'Grote terts plus kleine terts is majeur. Kleine terts plus grote terts is mineur.',
    'Een septiemakkoord zet er nog een terts bovenop: dominant 7 krijgt een kleine septiem, groot 7 een grote.',
  ],
  'diatonic-chords': [
    'Op elke trap van de majeurtoonladder ligt een drieklank: I ii iii IV V vi vii°.',
    'Hoofdletters zijn majeur, kleine letters mineur en ° is verminderd.',
    'I is de tonica (rust), IV de subdominant (beweging) en V de dominant (spanning naar I).',
  ],
  'progressions': [
    'I, IV en V zijn de basis van rock en blues. De 12-maten blues gebruikt alleen deze drie akkoorden.',
    'ii–V–I is de kern van jazz: elke stap gaat een kwint omlaag, terug naar huis.',
    'Een V7 wil oplossen naar I: de leidtoon gaat een halve toon omhoog naar de grondtoon.',
  ],
};
function unitSummary(unit) {
  if (unit.track === 'hals') return halsSummary(unit);
  if (unit.track === 'gehoor') return gehoorSummary(unit);
  if (Array.isArray(unit.summary) && unit.summary.some(x => typeof x === 'string' && x.trim())) return unit.summary.filter(x => typeof x === 'string' && x.trim()).slice(0, 4);
  if (unit.topic === 'scale-boxes') {
    const p = Object.assign({ scale: 'minpent', root: 'A', boxes: [1, 2] }, unit.params || {});
    if (!SCALES[p.scale]) return [];
    const tones = scaleTones(p.scale, p.root);
    return [
      `${SCALES[p.scale].name} in ${p.root}: ${tones.map(t => t.name).join(' ')} (${tones.map(t => t.label).join(' ')}).`,
      'Een box is een vast patroon van toonladdertonen op één plek op de hals. Zoek eerst de grondtonen: dat zijn je ankers.',
      `Box ${p.boxes.join(' en ')} sluiten op elkaar aan. Samen dekken ze een groot stuk van de hals.`,
    ];
  }
  return TOPIC_SUMMARY[unit.topic] || [];
}
function unitMeta(unit) {
  if (unit.track === 'hals') { const L = HALS_LEVELS[unit.idx]; return { title: unit.title, subtitle: unit.subtitle, drill: { mode: 'noteq', set: { kind: 'name', strings: L.strings.slice(), nat: L.nat } } }; }
  if (unit.track === 'gehoor') return { title: unit.title, subtitle: unit.subtitle, drill: gehoorPractice(unit) };
  const tp = TOPICS[unit.topic] || TOPICS.generic;
  let drill = unit.drill || tp.drill;
  if (!unit.drill && unit.topic === 'scale-boxes') {
    const p = Object.assign({ scale: 'minpent', root: 'A', boxes: [1, 2] }, unit.params || {});
    drill = { mode: 'scales', set: { scale: p.scale, root: p.root, box: p.boxes[0] } };
  }
  return { title: unit.title || tp.title, subtitle: unit.subtitle != null ? unit.subtitle : tp.subtitle, drill };
}
