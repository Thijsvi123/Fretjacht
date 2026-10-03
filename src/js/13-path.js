// ---------- Leerpad: units uit path.json (of het cursusschema) ----------
const COURSE_DOC = 'https://claude.ai/code/artifact/a8cea592-791b-4211-9b66-8fdbddcd8c09';
const PathData = {
  remote: null,
  async load() {
    const before = JSON.stringify(this.units());
    try {
      const r = await fetch('path.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.units)) { this.remote = j; Store.put('path', j); }
      }
    } catch (e) {}
    // alleen opnieuw tekenen als er echt iets veranderd is (anders breekt de intro-animatie af)
    const v = document.body.dataset.view;
    if (JSON.stringify(this.units()) !== before && (v === 'path' || v === 'progress' || v === 'practice')) Router.render();
  },
  units() {
    const src = this.remote || Store.get('path', null), today = todayKey();
    let list;
    if (src) {
      list = src.units.slice();
      // vangnet: staat een gegeven les een dag later nog niet in path.json, dan opent de unit uit het cursusschema
      const max = list.reduce((m, u) => Math.max(m, (u && u.lesson) || 0), 0);
      for (const u of FASE1) if (u.lesson > max && u.date < today) list.push(u);
    } else {
      // zonder path.json: een les telt als gegeven vanaf 20:15 op de lesdag
      const late = new Date().getHours() * 60 + new Date().getMinutes() >= 20 * 60 + 15;
      list = FASE1.filter(u => u.date < today || (u.date === today && late));
    }
    list = list.filter(u => u && u.lesson && (TOPICS[u.topic] || (u.quiz && u.quiz.length))).slice().sort((a, b) => a.lesson - b.lesson);
    return list;
  },
  upcoming() {
    const have = this.units(), last = have.length ? have[have.length - 1].lesson : 0;
    return FASE1.filter(u => u.lesson > last).slice(0, 2);
  },
};
const nodeKey = (unit, i) => `L${unit.lesson}-${i}`;
const nodeStat = (unit, i) => Store.stats.path.nodes[nodeKey(unit, i)];
const nodeDone = (unit, i) => !!(nodeStat(unit, i) && nodeStat(unit, i).done);
function nodeState(unit, nodes, i) {
  if (nodeDone(unit, i)) return 'done';
  if (i === 0 || nodeDone(unit, i - 1)) return 'open';
  return 'locked';
}
function nextNode() {
  const units = PathData.units();
  for (let u = units.length - 1; u >= 0; u--) {
    const nodes = unitNodes(units[u]);
    for (let i = 0; i < nodes.length; i++) if (nodeState(units[u], nodes, i) === 'open') return { unit: units[u], index: i, node: nodes[i], unitNo: u + 1 };
  }
  return null;
}
const PathFx = { intro: true, justDone: null };
function recordNode(unit, i, node, res) {
  const k = nodeKey(unit, i), st = Store.stats.path.nodes[k] || (Store.stats.path.nodes[k] = { runs: 0, mistakes: 0 });
  const wasDone = !!st.done;
  st.runs++; st.last = Date.now(); st.mistakes += Math.round((1 - res.accuracy) * 10);
  st.best = Math.max(st.best || 0, res.accuracy);
  if (res.perfect) st.perfect = true;
  if (node.test) st.test = true;
  if (res.passed) st.done = true;
  if (res.passed && !wasDone) PathFx.justDone = k;
  if (res.passed) Quests.bump('nodes');
  Store.saveStats();
}
function nodeKindIcon(node) {
  if (node.icon) return node.icon;
  if (node.test) return ICONS.trophy;
  const items = node.gen(), play = items.some(x => x.type === 'play'), theory = items.some(x => x.type !== 'play');
  return play && theory ? ICONS.note : play ? ICONS.pick : ICONS.book;
}
function nodeInfo(node) {
  if (node.info) return node.info;
  const items = node.gen(), play = items.filter(x => x.type === 'play').length;
  const guitar = play === items.length ? 'allemaal met gitaar' : play ? `${play} met gitaar` : 'zonder gitaar';
  return `${items.length} oefeningen, ${guitar}. Ongeveer ${Math.max(2, Math.round(items.length * 0.5))} minuten.`;
}
function startNode(unit, i, nodes, after) {
  const node = nodes[i], items = node.gen(), hals = unit.track === 'hals';
  const cantPlay = (Store.settings.cantPlayUntil || 0) > Date.now();
  const needMic = !cantPlay && items.some(x => x.type === 'play') && !Engine.mic;
  Loader.run({ title: node.test ? 'Unittoets' : hals ? `${unit.title}: ${node.title.toLowerCase()}` : node.title, sub: needMic ? 'Microfoon aanzetten…' : hals ? 'Halsjacht, zonder gitaar' : null, wait: needMic ? Engine.startMic() : null }, () => Lesson.open({
    title: hals ? `Halsjacht niveau ${unit.idx + 1}: ${unit.title}` : `Les ${unit.lesson}: ${node.title}`, topic: unit.topic, items,
    test: !!node.test, pass: node.pass || 0, label: hals ? node.title : null, xp: node.test ? 20 : node.pass ? 15 : 10,
    onFinish: res => recordNode(unit, i, node, res),
    onDone: after || (() => { location.hash = ''; }),
    onExit: () => { location.hash = ''; },
  }));
}
const OFFSETS = [0, 1, 1.6, 1, 0, -1, -1.6, -1];
function niceDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}
// de fret naast het pad wisselt van houding: per unit en per dag
const SIDE_MOODS = ['gitaar', 'noot', 'hals', 'luister', 'boek'];
const dayNo = () => Math.floor(new Date(todayKey() + 'T12:00:00') / 86400000);

// ---------- Startscherm: de Vandaag-kaart, een klein podium met je niveau ----------
function homeLine(sk, secs, goal, lv) {
  const hr = new Date().getHours(), d = dayNo();
  const hi = hr < 6 ? 'Nog wakker?' : hr < 12 ? 'Goedemorgen!' : hr < 18 ? 'Goedemiddag!' : 'Goedenavond!';
  const todo = Srs.todoCount(), left = Math.max(1, Math.ceil((goal - secs) / 60));
  if (secs >= goal) return ['Dagdoel gehaald. Rock on!', 'Lekker gespeeld vandaag!', 'Dagdoel binnen. Alles wat je nu doet is extra.'][d % 3];
  if (todo) return `${hi} Er ${todo === 1 ? 'komt een vraag' : `komen ${todo} vragen`} terug om te herhalen.`;
  if (!secs) return sk.n ? `${hi} Je reeks staat op ${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'}. Houd hem vast!` : `${hi} ${Math.round(goal / 60)} minuten oefenen en je reeks begint.`;
  if (lv.left <= 25) return `Nog ${lv.left} XP en je bent ${lv.next}!`;
  return `Nog ${left} ${left === 1 ? 'minuut' : 'minuten'} voor je dagdoel. Je kunt het!`;
}
function homeHero() {
  const st = Store.stats, xp = st.xp || 0, lv = Level.of(xp), sk = Progress.streak(), secs = Progress.day().secs, goal = Progress.goalSecs();
  const met = secs >= goal, acc = Score.accuracy(), notes = Score.notes(), gmin = Math.round(goal / 60), done = Math.min(gmin, Math.floor(secs / 60));
  const stat = (icon, v, l, cls) => h('div', { class: 'hh-stat' + (cls ? ' ' + cls : '') }, h('span', { class: 'hh-ico', html: icon }), h('b', { text: v }), h('small', { text: l }));
  return h('section', { class: 'home-hero' + (met ? ' met' : ''), id: 'homeHero' },
    h('div', { class: 'hh-top' },
      h('div', { class: 'hh-level' },
        h('p', { class: 'hh-eyebrow', text: `Fretjacht niveau ${lv.n}` }),
        h('h2', { class: 'hh-title', text: lv.title }),
        Level.meter(lv),
        h('p', { class: 'hh-xp' }, h('b', { text: `${xp} XP` }), h('span', { text: ` · nog ${lv.left} tot niveau ${lv.n + 1}` }))),
      h('div', { class: 'hh-fret', html: Mascot.svg(met ? 'juich' : secs ? 'gitaar' : 'zwaai') })),
    h('p', { class: 'hh-say', text: homeLine(sk, secs, goal, lv) }),
    h('div', { class: 'hh-stats' },
      stat(ICONS.flame, String(sk.n), sk.n === 1 ? 'dag op rij' : 'dagen op rij', sk.today ? 'lit' : ''),
      stat(ICONS.note, String(notes), notes === 1 ? 'noot gevonden' : 'noten gevonden'),
      stat(ICONS.star, acc == null ? '–' : `${acc}%`, 'goed beantwoord')),
    h('div', { class: 'hh-goal' },
      h('div', { class: 'hh-goal-t' }, h('span', { text: 'Dagdoel' }), h('b', { text: met ? 'gehaald!' : `${done} van ${gmin} minuten` })),
      h('div', { class: 'hh-bar', role: 'img', 'aria-label': `Dagdoel: ${done} van ${gmin} minuten` }, h('span', { style: `width:${(100 * clamp(secs / goal, 0, 1)).toFixed(1)}%` }))));
}

// ---------- Twee paden: Muziektheorie (de cursus) en de Halsjacht ----------
const trackDots = states => h('span', { class: 'tdots', 'aria-hidden': 'true' }, states.map(c => h('i', { class: c })));
function trackHead(track) {
  if (track === 'hals') {
    const n = halsDoneCount(), nx = nextHals();
    const states = HALS_LEVELS.map((L, i) => halsLevelDone(i) ? 'done' : nx && nx.unit.idx === i ? 'now' : '');
    return h('div', { class: 'track-head' }, h('p', {}, h('b', { text: n ? `${n} van ${HALS_LEVELS.length} niveaus beheerst` : `${HALS_LEVELS.length} niveaus, zonder gitaar` }), h('span', { text: 'Per niveau: leren, herkennen en toepassen.' })), trackDots(states));
  }
  const units = PathData.units(), total = Math.max(FASE1.length, units.reduce((m, u) => Math.max(m, u.lesson), 0));
  const cur = units.length ? units[units.length - 1].lesson : 0;
  const states = Array.from({ length: total }, (_, k) => {
    const u = units.find(x => x.lesson === k + 1);
    if (!u) return '';
    return nodeDone(u, unitNodes(u).length - 1) ? 'done' : 'now';
  });
  return h('div', { class: 'track-head' }, h('p', {}, h('b', { text: cur ? `Cursus: les ${cur} van ${total}` : `Cursus: ${total} lessen` }), h('span', { text: 'Na elke les op maandag en donderdag komt er een unit bij.' })), trackDots(states));
}
function trackSwitch(track, onPick) {
  const btn = (v, icon, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(track === v), class: track === v ? 'on' : '', 'data-track': v, onclick: () => onPick(v) }, h('span', { html: icon }), h('span', { text: label }));
  return h('div', { class: 'track-switch', role: 'tablist', 'aria-label': 'Kies je leerpad' }, btn('theory', ICONS.book, 'Muziektheorie'), btn('hals', ICONS.neck, 'Halsjacht'));
}
// oefen een Halsjacht-niveau vrij, met de instellingen van dat niveau
function practiceLevel(u) {
  const L = HALS_LEVELS[u.idx];
  TempSettings.apply('noteq', { kind: 'name', strings: L.strings.slice(), nat: L.nat });
  location.hash = '#m-noteq';
}
function renderUnits(wrap, units, o) {
  const nx = o.next, just = o.just, hals = o.hals;
  let delay = 0;
  units.forEach((u, ui) => {
    const meta = unitMeta(u), nodes = unitNodes(u), color = UNIT_COLORS[(ui + (hals ? 1 : 0)) % UNIT_COLORS.length];
    const doneCount = nodes.filter((n, i) => nodeDone(u, i)).length, complete = doneCount === nodes.length;
    const head = h('div', { class: 'unit-head' + (complete ? ' complete' : '') },
      h('div', { class: 'uh-text' },
        h('p', { class: 'uh-eyebrow', text: hals ? `Niveau ${ui + 1}` : `Unit ${ui + 1}` }),
        h('h2', { text: meta.title }),
        meta.subtitle ? h('p', { class: 'uh-sub', text: meta.subtitle }) : null,
        h('div', { class: 'uh-prog', role: 'img', 'aria-label': `${doneCount} van ${nodes.length} stappen gedaan` }, h('span', { style: `width:${(100 * doneCount / nodes.length).toFixed(1)}%` }))),
      h('div', { class: 'uh-side' },
        complete ? h('span', { class: 'uh-done', html: ICONS.check, title: hals ? 'Niveau beheerst' : 'Unit gehaald' }) : h('span', { class: 'uh-count', text: `${doneCount} van ${nodes.length}` }),
        hals ? h('button', { class: 'uh-link', type: 'button', text: 'Vrij oefenen', onclick: () => practiceLevel(u) }) : h('a', { class: 'uh-link', href: u.doc || COURSE_DOC, target: '_blank', rel: 'noopener', text: `Lees les ${u.lesson}` })));
    const track = h('div', { class: 'track' });
    nodes.forEach((n, i) => {
      const state = nodeState(u, nodes, i), k = nodeKey(u, i);
      const isNext = nx && nx.unit.lesson === u.lesson && nx.index === i;
      const cls = `node ${state}${isNext ? ' next' : ''}${n.test ? ' test' : ''}${k === just ? ' just-done' : ''}${isNext && just ? ' just-next' : ''}`;
      const btn = h('button', { type: 'button', class: cls, style: o.intro ? `--d:${delay++ * 45}ms` : null, 'aria-label': `${n.title}: ${state === 'done' ? 'gedaan' : state === 'open' ? 'beschikbaar' : 'op slot'}`, html: state === 'locked' ? ICONS.lock : state === 'done' && !n.test ? ICONS.check : nodeKindIcon(n), onclick: () => nodeSheet(u, i, nodes, ui + 1) });
      const row = h('div', { class: 'node-row', style: `--x:${OFFSETS[i % OFFSETS.length]}` }, btn, isNext ? h('span', { class: 'bubble', text: i === 0 && !doneCount ? `Begin: ${n.title}` : n.title }) : null, hals ? h('span', { class: 'node-lbl', text: n.title }) : null);
      track.append(row);
    });
    // de fret zit naast het pad, aan de kant waar plek is
    const current = nx && nx.unit.lesson === u.lesson;
    const mood = complete ? 'juich' : hals ? (current ? 'hals' : ['noot', 'gitaar', 'luister'][(ui + dayNo()) % 3]) : current ? ['zwaai', 'gitaar', 'noot', 'hals'][dayNo() % 4] : SIDE_MOODS[(ui + dayNo()) % SIDE_MOODS.length];
    if (nodes.length >= 3) track.append(h('div', { class: 'side-fret', html: Mascot.svg(mood) }));
    // uitlegkaartje: de kern van de les, open bij de unit waar je nu bent
    const sum = unitSummary(u);
    const card = sum.length ? h('details', { class: 'unit-sum', open: current && !doneCount ? true : null },
      h('summary', {}, h('span', { class: 'us-ico', html: hals ? ICONS.neck : ICONS.book }), h('span', { text: hals ? 'Zo onthoud je het' : 'De les in het kort' })),
      h('div', { class: 'us-body' }, h('div', { class: 'us-fret', html: Mascot.svg('boek') }), h('ul', {}, sum.map(t => h('li', { text: t }))))) : null;
    wrap.append(h('div', { class: `unit c-${color}${hals ? ' hals' : ''}`, id: `unit-${u.lesson}` }, head, card, track));
  });
}
function renderTrack(box, track, o) {
  box.innerHTML = '';
  box.append(trackHead(track));
  if (track === 'hals') {
    renderUnits(box, HalsData.units(), Object.assign({ hals: true, next: nextHals() }, o));
    box.append(h('div', { class: 'path-end', text: 'Beheers je alle acht niveaus, dan ken je de hele hals. Zonder gitaar, waar je ook bent.' }));
    return nextHals();
  }
  const units = PathData.units();
  if (!units.length) box.append(h('div', { class: 'card empty' }, h('div', { class: 'empty-fret', html: Mascot.svg('slaap') }), h('h2', { text: 'Je leerpad begint na les 1' }), h('p', { class: 'help', text: 'Zodra je eerste muziektheorieles binnen is, verschijnt hier de eerste unit met oefeningen. Begin intussen met de Halsjacht.' })));
  renderUnits(box, units, Object.assign({ next: nextNode() }, o));
  for (const up of PathData.upcoming()) {
    const tp = TOPICS[up.topic];
    box.append(h('div', { class: 'unit locked' }, h('div', { class: 'unit-head' },
      h('div', { class: 'uh-text' }, h('p', { class: 'uh-eyebrow', text: `Les ${up.lesson}, opent ${niceDate(up.date)}` }), h('h2', { text: tp ? tp.title : 'Volgende les' }), tp ? h('p', { class: 'uh-sub', text: tp.subtitle }) : null),
      h('div', { class: 'uh-side' }, h('span', { class: 'uh-lock', html: ICONS.lock })))));
  }
  box.append(h('div', { class: 'path-end', text: 'Na elke les van maandag en donderdag komt hier een nieuwe unit bij.' }));
  return nextNode();
}
function scrollToNext(box, nx, just) {
  const target = nx ? document.getElementById(`unit-${nx.unit.lesson}`) : null;
  if (target && (nx.index > 0 || nx.unitNo > 1)) setTimeout(() => { const b = $('.node.next', target); if (b) b.scrollIntoView({ block: 'center', behavior: just && !reducedMotion() ? 'smooth' : 'auto' }); }, just ? 700 : 30);
}
function renderPath(view) {
  const units = PathData.units();
  const intro = PathFx.intro && !reducedMotion(); PathFx.intro = false;
  const just = PathFx.justDone; PathFx.justDone = null;
  const wrap = h('section', { class: 'path' + (intro ? ' intro' : '') });
  if ((Store.settings.cantPlayUntil || 0) > Date.now()) {
    const until = new Date(Store.settings.cantPlayUntil).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    wrap.append(h('div', { class: 'note-bar' }, h('span', { text: `Speelopdrachten staan uit tot ${until}.` }), h('button', { type: 'button', text: 'Weer aanzetten', onclick: () => { Store.settings.cantPlayUntil = 0; Store.saveSettings(); Router.render(); } })));
  }
  wrap.append(homeHero());
  if (units.length) wrap.append(Quests.card());
  // laatst gekozen pad; zonder cursusunits begin je in de Halsjacht
  let track = Store.settings.track === 'hals' || (!units.length && Store.settings.track !== 'theory') ? 'hals' : 'theory';
  const box = h('div', { class: 'track-box' });
  const sw = trackSwitch(track, v => {
    if (v === track) return;
    track = v; Store.settings.track = v; Store.saveSettings();
    $$('button', sw).forEach(b => { const on = b.dataset.track === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    renderTrack(box, v, {});
    Sfx.play('tap');
  });
  wrap.append(sw, box);
  view.append(wrap);
  const nx = renderTrack(box, track, { intro, just });
  const remaining = Math.max(0, Progress.goalSecs() - Progress.day().secs), todo = Srs.todoCount();
  const cta = h('div', { class: 'cta-bar' },
    h('button', { class: 'bin-btn', type: 'button', hidden: !todo, 'aria-label': `Herhalen: ${todo} ${todo === 1 ? 'vraag' : 'vragen'}`, title: 'Herhalen', onclick: () => Srs.start() },
      h('span', { html: ICONS.retry }), h('b', { class: 'todo-count', text: String(todo) }), h('small', { text: 'herhaal' })),
    h('button', { class: 'primary big', type: 'button', id: 'todayBtn', onclick: () => Daily.showPlan() },
      h('span', { text: Daily.active ? 'Ga verder met vandaag' : remaining ? 'Oefen vandaag' : 'Extra oefenen' }),
      h('small', { text: remaining ? `nog ${Math.ceil(remaining / 60)} min voor je dagdoel` : 'dagdoel gehaald' })));
  view.append(cta);
  if (just) scrollToNext(box, nx, just);
  if (just) setTimeout(() => Sfx.play('fixed'), 250);
}
function nodeSheet(u, i, nodes, unitNo) {
  const n = nodes[i], state = nodeState(u, nodes, i), hals = u.track === 'hals';
  const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
    h('div', { class: `sheet c-${UNIT_COLORS[(unitNo - 1 + (hals ? 1 : 0)) % UNIT_COLORS.length]}` },
      h('p', { class: 'sheet-eyebrow', text: hals ? `Halsjacht niveau ${unitNo}: ${u.title}` : `Unit ${unitNo}, stap ${i + 1} van ${nodes.length}` }),
      h('h3', { text: n.title }),
      h('p', { class: 'help', text: state === 'locked' ? `Rond eerst “${nodes[i - 1].title}” af.` : n.test ? 'Tien vragen uit de hele unit. Met 80% goed heb je de unit gehaald.' : nodeInfo(n) }),
      state === 'locked' ? h('button', { class: 'big', type: 'button', text: 'Sluiten', onclick: () => sheet.remove() })
        : h('button', { class: 'primary big', type: 'button', text: state === 'done' ? `Nog een keer (+${n.test ? 20 : n.pass ? 15 : 10} XP)` : `Start (+${n.test ? 20 : n.pass ? 15 : 10} XP)`, onclick: () => { sheet.remove(); startNode(u, i, nodes); } })));
  document.body.append(sheet);
}

// ---------- Herhalen zonder fouten: vragen uit afgeronde lessen, zwakke eerst ----------
// Staat er bij Herhalen niets klaar, dan haalt dit vragen uit lessen die je al deed. Wat je dan fout hebt,
// komt gewoon terug bij Herhalen.
const Review = {
  // start een ronde; geeft false als er nog geen afgeronde lessen zijn
  start(o = {}) {
    const items = this.build(8);
    if (!items.length) return false;
    const from = location.hash === '#les' ? '' : location.hash;
    const back = () => { if (location.hash === from) Router.render(); else location.hash = from; };
    const needMic = items.some(x => x.type === 'play') && !Engine.mic && Bin.canPlay();
    Loader.run({ title: 'Herhalen', sub: 'Vragen uit eerdere lessen, je zwakke punten eerst', mood: 'boek', wait: needMic ? Engine.startMic() : null }, () =>
      Lesson.open({ title: 'Herhalen', label: 'Herhalen', sub: 'Vragen uit eerdere lessen. Wat je fout had, komt terug bij Herhalen.', items, xp: 10, onDone: o.after || back, onExit: o.exit || o.after || back }));
    return true;
  },
  candidates() {
    const out = [];
    for (const u of PathData.units()) unitNodes(u).forEach((node, i) => {
      if (node.test) return;
      const st = nodeStat(u, i);
      if (!st || !st.done) return;
      const days = (Date.now() - (st.last || 0)) / 86400000;
      out.push({ node, topic: u.topic, w: 1 + Math.min(3, st.mistakes / Math.max(1, st.runs)) + Math.min(3, days / 2) });
    });
    return out;
  },
  available() { return this.candidates().length > 0; },
  build(n) {
    const cands = this.candidates(), items = [];
    if (!cands.length) return items;
    for (let k = 0; k < 40 && items.length < (n || 8); k++) {
      let r = Math.random() * cands.reduce((a, c) => a + c.w, 0), c = cands[0];
      for (const x of cands) { r -= x.w; if (r <= 0) { c = x; break; } }
      items.push(...shuffle(c.node.gen()).slice(0, 2).map(it => Object.assign(it, { _topic: c.topic })));
    }
    return items.slice(0, n || 8);
  },
};
