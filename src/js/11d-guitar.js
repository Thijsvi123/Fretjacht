// ---------- Met of zonder gitaar ----------
// Eén schuifje bepaalt hoe je oefent. Met gitaar speel je alles wat over noten op de hals gaat (de app luistert);
// theorievragen beantwoord je met één tik. Zonder gitaar wordt elke speelopdracht een vraag op je telefoon.
// Zo hoef je nooit je gitaar weg te leggen om iets aan te tikken, of hem te pakken voor één noot.
const Guitar = {
  on() { return Store.settings.guitar !== false; },
  set(v) {
    Store.settings.guitar = !!v; Store.saveSettings();
    $$('.gsw').forEach(el => el._paint && el._paint());
  },
};
// de schakelaar; onChange(met) na een wissel
function guitarSwitch(onChange) {
  const el = h('div', { class: 'gsw', role: 'group', 'aria-label': 'Oefenen met of zonder gitaar' });
  const btn = (met, icon, label) => h('button', { type: 'button', 'data-v': met ? 'met' : 'zonder', onclick: () => {
    if (Guitar.on() === met) return;
    Guitar.set(met); Sfx.play('tap');
    if (onChange) onChange(met);
  } }, h('span', { html: icon }), h('span', { text: label }));
  el.append(btn(true, ICONS.guitar, 'Met gitaar'), btn(false, ICONS.phone, 'Zonder gitaar'));
  el._paint = () => $$('button', el).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === 'met') === Guitar.on())));
  el._paint();
  return el;
}
// moet de microfoon aan voor deze vragen?
const needsMic = items => Guitar.on() && items.some(x => ['play', 'tap', 'name', 'tapall'].includes(x.type));

// de naam van een interval van n halve tonen, met lidwoord: "de kwint", "het octaaf"
function ivWord(semis) {
  if (semis === 12) return 'het octaaf';
  const iv = INTERVALS.find(x => x.semis === semis);
  return iv ? `de ${iv.name.replace('reine ', '')}` : `${semis} halve tonen hoger`;
}
// neem eigenschappen van het origineel mee: id in de les, plek in Herhalen, onderwerp
function carry(from, to) {
  for (const k of Object.keys(from)) if (k[0] === '_' && k !== '_orig') to[k] = from[k];
  to._orig = from._orig || from;
  to.skill = to.skill || from.skill;
  return to;
}
// ---- met gitaar: tikken op de hals wordt spelen ----
function playFromTap(it) {
  const r = (it.marks || [])[0], v = (it.valid || [])[0];
  if (!r || !v) return null;
  const m0 = OPEN[r.s] + r.f, semis = OPEN[v.s] + v.f - m0;
  let target = pcName(m0 + semis, 'sharps');
  try { const iv = INTERVALS.find(x => x.semis === semis); if (iv) target = spName(spellFrom(parseName(r.label), iv.steps, iv.semis)); } catch (e) {}
  return carry(it, { type: 'play', skill: it.skill, prompt: `Speel ${r.label}, en daarna ${ivWord(semis)} erboven`, big: r.label, sub: `${r.label} ligt op de ${STR_NAME[r.s]}, ${r.f ? 'fret ' + r.f : 'los'}`,
    steps: [{ k: 'pc', pc: mod12(m0), name: r.label, pos: { s: r.s, f: r.f } }, { k: 'rel', semis, name: target }],
    neck: { from: Math.max(0, r.f - 3), to: Math.min(15, r.f + 6), marks: [{ s: r.s, f: r.f, kind: 'todo root', label: r.label }] },
    hint: it.explain || '', explain: it.explain });
}
// Halsjacht, Herkennen: in plaats van "welke noot is dit?" speel je de noot op de snaar
function playFromName(it) {
  const name = SHARP_NAMES[it.pc], both = FretQuiz.both(it.pc), frets = FretQuiz.spots(it.pc, [it.s], 0, 12).map(p => p.f);
  return carry(it, { type: 'play', skill: 'hals-play', prompt: `Speel ${both} op de ${STR_NAME[it.s]}`, big: name, sub: `op de ${STR_NAME[it.s]}`,
    steps: [{ k: 'pc', pc: it.pc, name, string: it.s, frets }], highlight: [it.s], hint: `Fret ${frets.join(' of ')}`, explain: it.explain, _spot: { s: it.s, f: it.f } });
}
// Halsjacht, Toepassen: in plaats van alle plekken aantikken speel je de noot op elke snaar
function playFromTapAll(it) {
  const by = {};
  for (const p of it.valid) (by[p.s] = by[p.s] || []).push(p.f);
  const strs = Object.keys(by).map(Number).sort((a, b) => b - a);
  if (!strs.length) return null;
  if (strs.length === 1) {
    const s = strs[0], frets = by[s].sort((a, b) => a - b);
    return carry(it, { type: 'play', skill: 'hals-play-all', prompt: frets.length > 1 ? `Speel alle ${it.name}'s op de ${STR_NAME[s]}, van laag naar hoog` : `Speel de ${it.name} op de ${STR_NAME[s]}`, big: it.name, sub: `op de ${STR_NAME[s]}`,
      // geen fretnummers in de vakjes: die moet je zelf vinden (Hint geeft ze)
      steps: frets.map((f, i) => (i ? { k: 'rel', semis: f - frets[i - 1], name: it.name } : { k: 'pc', pc: it.pc, name: it.name, string: s, frets: [f] })),
      highlight: [s], hint: `Fret ${frets.join(' en ')}`, explain: it.explain });
  }
  return carry(it, { type: 'play', skill: 'hals-play-all', prompt: `Speel de ${it.name} op elke snaar`, big: it.name, sub: `van de ${STR_NAME[strs[0]]} naar de ${STR_NAME[strs[strs.length - 1]]}`,
    steps: strs.map(s => ({ k: 'pc', pc: it.pc, name: it.name, label: STR_LETTER[s], string: s, frets: by[s] })),
    highlight: [strs[0]], hint: strs.map(s => `${STR_LETTER[s]}: ${by[s].join(' of ')}`).join(', '), explain: it.explain });
}
// ---- zonder gitaar: een speelopdracht wordt een vraag over dezelfde stof ----
function askFromPlay(it) {
  const sk = it.skill || '', m = /^play-(scale|chord|box)-([a-z0-9]+)/.exec(sk);
  let alt = null;
  if (sk === 'play-octave') alt = G.tapOctave();
  else if (sk === 'play-fifth' || sk === 'play-power') alt = pick([G.tapFifth, G.fifthAbove])();
  else if (sk.startsWith('iv-play-')) alt = G.ivTap([Number(sk.slice(8)) || 7]);
  else if (sk === 'play-degree') alt = G.majDegree();
  else if (m && m[1] === 'scale') alt = m[2] === 'major' ? G.majNotes() : m[2] === 'minor' ? G.minNotes('natural') : SCALES[m[2]] ? G.scaleNotesQ(m[2], it.big || 'A') : null;
  else if (m && m[1] === 'chord') alt = CHORDS[m[2]] ? G.chordNotes([m[2]]) : G.triadFormula();
  else if (sk.startsWith('play-box-')) { const sc = sk.split('-')[2]; alt = SCALES[sc] ? G.scaleNotesQ(sc, it.big || 'A') : null; }
  else if (sk === 'play-key-root') alt = G.keyFromSig();
  else if (sk === 'play-harm7') alt = G.harm7();
  else if (sk === 'play-dia-root') alt = G.romanOf();
  else if (sk === 'play-dia-chord') alt = G.diaChord();
  else if (sk === 'play-prog') alt = pick([G.prog145, G.prog251, G.prog1564])();
  else if (sk === 'note-play' && it.steps && it.steps[0] && it.steps[0].string != null) alt = findItem(it.steps[0].pc, [it.steps[0].string]);
  else if (sk === 'hals-play' || sk === 'hals-play-all') alt = null;   // komt uit de Halsjacht: het origineel gebruiken
  return alt ? carry(it, alt) : null;
}
// zet één vraag om naar de stand van het schuifje (null: geen goede vervanger, dan valt hij weg)
function fitItem(it, guitar) {
  // een eerder omgezette vraag eerst terug naar het origineel
  if (it._orig && (it.type === 'play') !== guitar) it = Object.assign({}, it._orig, Object.fromEntries(Object.entries(it).filter(([k]) => k[0] === '_' && k !== '_orig')));
  if (guitar) {
    if (it.type === 'tap') return playFromTap(it);
    if (it.type === 'name') return playFromName(it);
    if (it.type === 'tapall') return playFromTapAll(it);
    return it;
  }
  if (it.type === 'play') return askFromPlay(it);
  return it;
}
function fitMode(items, guitar = Guitar.on()) { return items.map(it => fitItem(it, guitar)).filter(Boolean); }
