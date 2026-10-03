// ---------- Oefenen: het pedalboard ----------
const HUB = [
  { title: 'De hals', ids: ['notes', 'positions', 'intervals', 'degrees'] },
  { title: 'Solo’s en gehoor', ids: ['scales', 'chords', 'bends', 'ear'] },
  { title: 'Uitdaging', ids: ['challenge', 'heatmap'] },
  { title: 'Gereedschap', ids: ['metro', 'tuner'], tools: true },
];
const PEDAL_SUB = {
  notes: 'Vind de noot op de snaar', positions: 'Eén noot, elke snaar', intervals: 'Van toon naar toon', degrees: 'Trap 1 tot 7 in een toonsoort',
  scales: 'Boxen en patronen', chords: 'Alle tonen van een akkoord', bends: 'Zuiver omhoog buigen', ear: 'Luister en speel na',
  challenge: 'Zoveel noten in één minuut', heatmap: 'Waar zit je zwakke plek?', metro: 'Strak op de tel', tuner: 'Stem je gitaar',
};
const PEDAL_TIP = {
  notes: 'Speel de noot op de snaar die oplicht.', positions: 'Speel dezelfde noot op elke snaar, van laag naar hoog.',
  intervals: 'Eerst de grondtoon, dan het interval.', degrees: 'Trap 1 is de grondtoon van de toonsoort.',
  scales: 'Speel de box van laag naar hoog.', chords: 'Speel alle tonen van het akkoord, in elke volgorde.',
  bends: 'Bend tot de lijn het doel raakt, en houd hem even vast.', ear: 'Luister goed en zoek de noot op de hals.',
  challenge: 'Eén minuut, zoveel mogelijk noten.', tuner: 'Speel één snaar tegelijk en laat hem uitklinken.',
};
const NO_MIC = ['metro', 'heatmap'];
// vaste knopstand per pedaal, zodat het bord er elke keer hetzelfde uitziet
const knobAngle = (id, k) => { let x = 7; for (const c of id + k) x = (x * 31 + c.charCodeAt(0)) % 997; return -130 + (x % 260); };
// pedaal intrappen: lampje aan, klik, microfoon aan en dan naar de oefening
function stomp(e, id, before) {
  e.preventDefault();
  const el = e.currentTarget, href = '#m-' + id, m = MODES[id];
  if (el.classList.contains('stomp')) return;
  el.classList.add('stomp');
  Sfx.play('tap');
  if (before) before();
  const mic = !NO_MIC.includes(id) && !Engine.mic ? Engine.startMic() : null;
  const go = () => { if (location.hash === href) Router.render(); else location.hash = href; };
  setTimeout(() => (NO_MIC.includes(id) ? go() : Loader.run({ title: m.title, sub: mic ? 'Microfoon aanzetten…' : PEDAL_TIP[id] || '', mood: 'luister', wait: mic, min: 650 }, go)), reducedMotion() ? 0 : 200);
}
function drillSub(d) {
  if (d.mode === 'intervals' && d.set && d.set.set) return 'Met ' + d.set.set.map(n => (INTERVALS.find(i => i.semis === n) || {}).name).filter(Boolean).join(' en ');
  if (d.mode === 'scales' && d.set && SCALES[d.set.scale]) return `${SCALES[d.set.scale].name} in ${d.set.root}, box ${d.set.box || 1}`;
  return PEDAL_SUB[d.mode] || '';
}
function pedal(id, o = {}) {
  const m = MODES[id];
  if (!m) return null;
  const st = Store.stats, today = (st.modeDays || {})[id] === todayKey();
  const stat = m.homeStat ? m.homeStat(st) : '';
  const color = o.color || MODE_COLOR[id] || 'leisteen';
  return h('a', { class: `pedal c-${color}${today ? ' on' : ''}${o.wide ? ' wide' : ''}`, href: '#m-' + id, 'data-mode': id, onclick: e => stomp(e, id, o.before) },
    h('span', { class: 'pd-top', 'aria-hidden': 'true' },
      h('i', { class: 'knob', style: `--a:${knobAngle(id, 'a')}deg` }), h('i', { class: 'knob', style: `--a:${knobAngle(id, 'b')}deg` }),
      h('i', { class: 'led' })),
    h('span', { class: 'pd-art', html: ART[id] || '' }),
    h('span', { class: 'pd-text' },
      o.eyebrow ? h('small', { class: 'pd-eyebrow', text: o.eyebrow }) : null,
      h('b', { class: 'pd-name', text: o.title || m.title }),
      h('span', { class: 'pd-sub', text: o.sub || PEDAL_SUB[id] || '' }),
      h('span', { class: 'pd-stat', html: today ? `Vandaag gespeeld${stat ? ', ' + stat : ''}` : stat || 'Nog niet gespeeld' })),
    h('span', { class: 'pd-switch', 'aria-hidden': 'true', html: ICONS.play }));
}
function renderPractice(view) {
  const wrap = h('section', { class: 'hub' });
  wrap.append(h('p', { class: 'hub-intro', text: 'Trap een pedaal in om te beginnen. Brandt het lampje, dan heb je die oefening vandaag al gespeeld.' }));
  const nb = Bin.count();
  wrap.append(nb
    ? h('div', { class: 'bin-card' },
      h('div', { class: 'bc-fret', html: Mascot.svg('ehbo') }),
      h('div', { class: 'bc-text' },
        h('h2', {}, 'Je foutenbak ', h('span', { class: 'bc-n bin-count', text: String(nb) })),
        h('p', { text: `${nb === 1 ? 'Eén vraag' : nb + ' vragen'} om te herstellen. Elke goede geeft bonus-XP, een lege bak 2 minuten extra voor je dagdoel.` }),
        h('button', { class: 'primary', type: 'button', html: `${ICONS.plaster}<span>Herstel je fouten</span>`, onclick: () => Bin.start() })))
    : h('div', { class: 'bin-card empty' },
      h('div', { class: 'bc-fret', html: Mascot.svg('blij', { crop: 'head' }) }),
      h('div', { class: 'bc-text' }, h('h2', { text: 'Je foutenbak is leeg' }), h('p', { text: 'Vragen die je in een les fout hebt, komen hier terecht. Herstel ze voor bonus-XP.' }))));
  const units = PathData.units(), cu = units[units.length - 1];
  if (cu) {
    const meta = unitMeta(cu), d = meta.drill;
    if (d && MODES[d.mode]) wrap.append(h('div', { class: 'hub-sec' }, h('h2', { class: 'hub-h', text: 'Past bij je les' }),
      pedal(d.mode, { wide: true, color: UNIT_COLORS[(units.length - 1) % UNIT_COLORS.length], eyebrow: `Les ${cu.lesson}: ${meta.title}`, sub: drillSub(d), before: () => { if (d.set) TempSettings.apply(d.mode, d.set); } })));
  }
  for (const sec of HUB) {
    const ids = sec.ids.filter(id => MODES[id]);
    if (!ids.length) continue;
    wrap.append(h('div', { class: 'hub-sec' }, h('h2', { class: 'hub-h', text: sec.title }),
      h('div', { class: 'pedals' + (sec.tools ? ' tools' : '') }, ids.map(id => pedal(id)))));
  }
  wrap.append(h('p', { class: 'foot', text: 'De app hoort welke toon klinkt, niet op welke snaar je hem speelt. Speel dus echt waar het gevraagd wordt, en leg je telefoon dicht bij je gitaar.' }));
  view.append(wrap);
}
