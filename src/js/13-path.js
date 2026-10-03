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
  Store.saveStats();
}
function nodeKindIcon(node) {
  if (node.test) return ICONS.trophy;
  const items = node.gen(), play = items.some(x => x.type === 'play'), theory = items.some(x => x.type !== 'play');
  return play && theory ? ICONS.note : play ? ICONS.pick : ICONS.book;
}
function nodeInfo(node) {
  const items = node.gen(), play = items.filter(x => x.type === 'play').length;
  const guitar = play === items.length ? 'allemaal met gitaar' : play ? `${play} met gitaar` : 'zonder gitaar';
  return `${items.length} oefeningen, ${guitar}. Ongeveer ${Math.max(2, Math.round(items.length * 0.5))} minuten.`;
}
function startNode(unit, i, nodes, after) {
  const node = nodes[i], items = node.gen();
  const cantPlay = (Store.settings.cantPlayUntil || 0) > Date.now();
  const needMic = !cantPlay && items.some(x => x.type === 'play') && !Engine.mic;
  Loader.run({ title: node.test ? 'Unittoets' : node.title, sub: needMic ? 'Microfoon aanzetten…' : null, wait: needMic ? Engine.startMic() : null }, () => Lesson.open({
    title: `Les ${unit.lesson}: ${node.title}`, items, test: !!node.test, xp: node.test ? 20 : 10,
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
const SIDE_MOODS = ['luister', 'zwaai', 'denk', 'blij'];
function renderPath(view) {
  const units = PathData.units();
  const intro = PathFx.intro && !reducedMotion(); PathFx.intro = false;
  const just = PathFx.justDone; PathFx.justDone = null;
  const wrap = h('section', { class: 'path' + (intro ? ' intro' : '') });
  if ((Store.settings.cantPlayUntil || 0) > Date.now()) {
    const until = new Date(Store.settings.cantPlayUntil).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    wrap.append(h('div', { class: 'note-bar' }, h('span', { text: `Speelopdrachten staan uit tot ${until}.` }), h('button', { type: 'button', text: 'Weer aanzetten', onclick: () => { Store.settings.cantPlayUntil = 0; Store.saveSettings(); Router.render(); } })));
  }
  if (!units.length) wrap.append(h('div', { class: 'card empty' }, h('div', { class: 'empty-fret', html: Mascot.svg('slaap') }), h('h2', { text: 'Je leerpad begint na les 1' }), h('p', { class: 'help', text: 'Zodra je eerste muziektheorieles binnen is, verschijnt hier de eerste unit met oefeningen.' })));
  const nx = nextNode();
  let delay = 0;
  units.forEach((u, ui) => {
    const meta = unitMeta(u), nodes = unitNodes(u), color = UNIT_COLORS[ui % UNIT_COLORS.length];
    const doneCount = nodes.filter((n, i) => nodeDone(u, i)).length, complete = doneCount === nodes.length;
    const head = h('div', { class: 'unit-head' + (complete ? ' complete' : '') },
      h('div', { class: 'uh-text' },
        h('p', { class: 'uh-eyebrow', text: `Unit ${ui + 1}` }),
        h('h2', { text: meta.title }),
        meta.subtitle ? h('p', { class: 'uh-sub', text: meta.subtitle }) : null,
        h('div', { class: 'uh-prog', role: 'img', 'aria-label': `${doneCount} van ${nodes.length} stappen gedaan` }, h('span', { style: `width:${(100 * doneCount / nodes.length).toFixed(1)}%` }))),
      h('div', { class: 'uh-side' },
        complete ? h('span', { class: 'uh-done', html: ICONS.check, title: 'Unit gehaald' }) : h('span', { class: 'uh-count', text: `${doneCount}/${nodes.length}` }),
        h('a', { class: 'uh-link', href: u.doc || COURSE_DOC, target: '_blank', rel: 'noopener', text: `Lees les ${u.lesson}` })));
    const track = h('div', { class: 'track' });
    nodes.forEach((n, i) => {
      const state = nodeState(u, nodes, i), k = nodeKey(u, i);
      const isNext = nx && nx.unit.lesson === u.lesson && nx.index === i;
      const cls = `node ${state}${isNext ? ' next' : ''}${n.test ? ' test' : ''}${k === just ? ' just-done' : ''}${isNext && just ? ' just-next' : ''}`;
      const btn = h('button', { type: 'button', class: cls, style: intro ? `--d:${delay++ * 45}ms` : null, 'aria-label': `${n.title}: ${state === 'done' ? 'gedaan' : state === 'open' ? 'beschikbaar' : 'op slot'}`, html: state === 'locked' ? ICONS.lock : state === 'done' && !n.test ? ICONS.check : nodeKindIcon(n), onclick: () => nodeSheet(u, i, nodes, ui + 1) });
      const row = h('div', { class: 'node-row', style: `--x:${OFFSETS[i % OFFSETS.length]}` }, btn, isNext ? h('span', { class: 'bubble', text: i === 0 && !doneCount ? `Begin: ${n.title}` : n.title }) : null);
      track.append(row);
    });
    // de fret zit naast het pad, aan de kant waar plek is
    const mood = complete ? 'juich' : nx && nx.unit.lesson === u.lesson ? 'zwaai' : SIDE_MOODS[ui % SIDE_MOODS.length];
    if (nodes.length >= 3) track.append(h('div', { class: 'side-fret', html: Mascot.svg(mood) }));
    wrap.append(h('div', { class: `unit c-${color}`, id: `unit-${u.lesson}` }, head, track));
  });
  for (const up of PathData.upcoming()) {
    const tp = TOPICS[up.topic];
    wrap.append(h('div', { class: 'unit locked' }, h('div', { class: 'unit-head' },
      h('div', { class: 'uh-text' }, h('p', { class: 'uh-eyebrow', text: `Les ${up.lesson}, opent ${niceDate(up.date)}` }), h('h2', { text: tp ? tp.title : 'Volgende les' }), tp ? h('p', { class: 'uh-sub', text: tp.subtitle }) : null),
      h('div', { class: 'uh-side' }, h('span', { class: 'uh-lock', html: ICONS.lock })))));
  }
  wrap.append(h('div', { class: 'path-end', text: 'Na elke les van maandag en donderdag komt hier een nieuwe unit bij.' }));
  view.append(wrap);
  const remaining = Math.max(0, Progress.goalSecs() - Progress.day().secs), nb = Bin.count();
  const cta = h('div', { class: 'cta-bar' },
    h('button', { class: 'bin-btn', type: 'button', hidden: !nb, 'aria-label': `Herstel je fouten (${nb})`, title: 'Herstel je fouten', onclick: () => Bin.start() },
      h('span', { html: ICONS.plaster }), h('b', { class: 'bin-count', text: String(nb) }), h('small', { text: 'fouten' })),
    h('button', { class: 'primary big', type: 'button', id: 'todayBtn', onclick: () => Daily.showPlan() },
      h('span', { text: Daily.active ? 'Ga verder met vandaag' : remaining ? 'Oefen vandaag' : 'Extra oefenen' }),
      h('small', { text: remaining ? `nog ${Math.ceil(remaining / 60)} min voor je dagdoel` : 'dagdoel gehaald' })));
  view.append(cta);
  const target = nx ? document.getElementById(`unit-${nx.unit.lesson}`) : null;
  if (target && nx.index > 0) setTimeout(() => { const b = $('.node.next', target); if (b) b.scrollIntoView({ block: 'center', behavior: just && !reducedMotion() ? 'smooth' : 'auto' }); }, just ? 700 : 30);
  if (just) setTimeout(() => Sfx.play('fixed'), 250);
}
function nodeSheet(u, i, nodes, unitNo) {
  const n = nodes[i], state = nodeState(u, nodes, i);
  const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
    h('div', { class: `sheet c-${UNIT_COLORS[(unitNo - 1) % UNIT_COLORS.length]}` },
      h('p', { class: 'sheet-eyebrow', text: `Unit ${unitNo}, stap ${i + 1} van ${nodes.length}` }),
      h('h3', { text: n.title }),
      h('p', { class: 'help', text: state === 'locked' ? `Rond eerst “${nodes[i - 1].title}” af.` : n.test ? 'Tien vragen uit de hele unit. Met 80% goed heb je de unit gehaald.' : nodeInfo(n) }),
      state === 'locked' ? h('button', { class: 'big', type: 'button', text: 'Sluiten', onclick: () => sheet.remove() })
        : h('button', { class: 'primary big', type: 'button', text: state === 'done' ? 'Nog een keer (+10 XP)' : `Start (+${n.test ? 20 : 10} XP)`, onclick: () => { sheet.remove(); startNode(u, i, nodes); } })));
  document.body.append(sheet);
}

// ---------- Herhalen: vragen uit afgeronde lessen, zwakke eerst ----------
const Review = {
  candidates() {
    const out = [];
    for (const u of PathData.units()) unitNodes(u).forEach((node, i) => {
      if (node.test) return;
      const st = nodeStat(u, i);
      if (!st || !st.done) return;
      const days = (Date.now() - (st.last || 0)) / 86400000;
      out.push({ node, w: 1 + Math.min(3, st.mistakes / Math.max(1, st.runs)) + Math.min(3, days / 2) });
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
      items.push(...shuffle(c.node.gen()).slice(0, 2));
    }
    return items.slice(0, n || 8);
  },
};
