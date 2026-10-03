// ---------- Oefenen: het pedalboard ----------
const HUB = [
  { title: 'De hals', ids: ['noteq', 'notes', 'positions', 'intervals', 'degrees'] },
  { title: 'Solo’s', ids: ['scales', 'chords', 'targets', 'bends'] },
  { title: 'Gehoor', ids: ['earq', 'ear'] },
  { title: 'Uitdaging', ids: ['challenge', 'heatmap'] },
  { title: 'Gereedschap', ids: ['explorer', 'metro', 'tuner'], tools: true },
];
const PEDAL_SUB = {
  notes: 'Vind de noot op de snaar', positions: 'Eén noot, elke snaar', intervals: 'Van toon naar toon', degrees: 'Trap 1 tot 7 in een toonsoort',
  scales: 'Boxen en patronen', chords: 'Alle tonen van een akkoord', bends: 'Zuiver omhoog buigen', ear: 'Luister en speel na',
  challenge: 'Zoveel noten in één minuut', heatmap: 'Waar zit je zwakke plek?', metro: 'Strak op de tel', tuner: 'Stem je gitaar',
  targets: 'De terts op elk akkoord', earq: 'Zonder gitaar, alleen luisteren', explorer: 'Toonladders en akkoorden op de hals',
  noteq: 'Zonder gitaar: herkennen en zoeken',
};
const PEDAL_TIP = {
  notes: 'Speel de noot op de snaar die oplicht.', positions: 'Speel dezelfde noot op elke snaar, van laag naar hoog.',
  intervals: 'Eerst de grondtoon, dan het interval.', degrees: 'Trap 1 is de grondtoon van de toonsoort.',
  scales: 'Speel de box van laag naar hoog.', chords: 'Speel alle tonen van het akkoord, in elke volgorde.',
  bends: 'Bend tot de lijn het doel raakt, en houd hem even vast.', ear: 'Luister goed en zoek de noot op de hals.',
  challenge: 'Eén minuut, zoveel mogelijk noten.', tuner: 'Speel één snaar tegelijk en laat hem uitklinken.',
  targets: 'Het akkoord klinkt eerst. Speel dan de doeltoon.',
};
const NO_MIC = ['metro', 'heatmap', 'explorer', 'earq', 'noteq'];
// vaste knopstand per pedaal, zodat het bord er elke keer hetzelfde uitziet
const knobAngle = (id, k) => { let x = 7; for (const c of id + k) x = (x * 31 + c.charCodeAt(0)) % 997; return -130 + (x % 260); };
// pedaal intrappen: lampje aan, klik, microfoon aan en dan naar de oefening
function stomp(e, id, before) {
  e.preventDefault();
  const el = e.currentTarget, href = '#m-' + id, m = MODES[id];
  if (el.classList.contains('stomp')) return;
  el.classList.add('stomp');
  Sfx.play('tap');
  Engine.ensureCtx();
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
// ---------- Lege staten: nog nooit geoefend, of vandaag nog niet ----------
function isFresh() {
  const st = Store.stats;
  return !(st.xp > 0) && !Object.values(st.days).some(d => d.secs > 0) && !Object.keys(st.path.nodes).length && !Bin.all().length;
}
function startFirst() {
  const nx = nextNode();
  if (nx) startNode(nx.unit, nx.index, unitNodes(nx.unit));
  else location.hash = '#m-notes';
}
// grote kaart met de fret en één duidelijke knop; null als je vandaag al geoefend hebt
function emptyHero(where) {
  const fresh = isFresh(), goal = Math.round(Progress.goalSecs() / 60);
  if (!fresh && Progress.day().secs > 0) return null;
  if (fresh) {
    const nx = nextNode();
    return h('section', { class: 'hero-empty fresh' },
      h('div', { class: 'he-fret', html: Mascot.svg(where === 'progress' ? 'zwaai' : 'gitaar') }),
      h('div', { class: 'he-text' },
        h('h2', { text: where === 'progress' ? 'Hier groeit je voortgang' : 'Nog geen oefensessies' }),
        h('p', { text: where === 'progress' ? 'Je hebt nog geen oefensessies gedaan. Start je eerste les en zie hier je reeks, je XP en je plectrums groeien.' : 'Je hebt nog niet geoefend. Start je eerste les: een paar minuten, en je merkt meteen hoe de app meeluistert.' })),
      h('button', { class: 'primary big he-go', type: 'button', onclick: startFirst }, h('span', { text: nx ? 'Start je eerste les' : 'Begin met Noten zoeken' }), h('small', { text: nx ? `Unit ${nx.unitNo}: ${nx.node.title}` : 'Speel de noot die je ziet' })),
      where === 'progress' ? h('a', { class: 'he-alt', href: '#oefenen', text: 'Of kies zelf een oefening' }) : null);
  }
  const sk = Progress.streak();
  return h('section', { class: 'hero-empty today' },
    h('div', { class: 'he-fret', html: Mascot.svg('slaap') }),
    h('div', { class: 'he-text' },
      h('h2', { text: 'De fret slaapt nog' }),
      h('p', { text: `Je hebt vandaag nog geen oefensessies gedaan. ${sk.n ? `Je reeks staat op ${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'}: met ${goal} minuten houd je hem vast.` : `Met ${goal} minuten begin je een nieuwe reeks.`}` })),
    h('button', { class: 'primary big he-go', type: 'button', onclick: () => Daily.showPlan() }, h('span', { text: 'Oefen vandaag' }), h('small', { text: `${goal} minuten, alles staat voor je klaar` })));
}

function renderPractice(view) {
  const wrap = h('section', { class: 'hub' });
  const hero = emptyHero('practice');
  if (hero) wrap.append(hero);
  wrap.append(Srs.card());
  wrap.append(h('p', { class: 'hub-intro', text: hero ? 'Of trap zelf een pedaal in. Brandt het lampje, dan heb je die oefening vandaag al gespeeld.' : 'Trap een pedaal in om te beginnen. Brandt het lampje, dan heb je die oefening vandaag al gespeeld.' }));
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
