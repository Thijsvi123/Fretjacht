// ---------- Leerpad: units uit path.json (of het cursusschema) ----------
const COURSE_DOC = 'https://claude.ai/code/artifact/a8cea592-791b-4211-9b66-8fdbddcd8c09';
const PathData = {
  remote: null,
  async load() {
    try {
      const r = await fetch('path.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.units)) { this.remote = j; Store.put('path', j); }
      }
    } catch (e) {}
    if (document.body.dataset.view === 'path' || document.body.dataset.view === 'progress') Router.render();
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
function recordNode(unit, i, node, res) {
  const k = nodeKey(unit, i), st = Store.stats.path.nodes[k] || (Store.stats.path.nodes[k] = { runs: 0, mistakes: 0 });
  st.runs++; st.last = Date.now(); st.mistakes += Math.round((1 - res.accuracy) * 10);
  st.best = Math.max(st.best || 0, res.accuracy);
  if (res.perfect) st.perfect = true;
  if (node.test) st.test = true;
  if (res.passed) st.done = true;
  Store.saveStats();
}
function nodeKindIcon(node) {
  if (node.test) return ICONS.trophy;
  const items = node.gen(), play = items.some(x => x.type === 'play'), theory = items.some(x => x.type !== 'play');
  return play && theory ? ICONS.note : play ? ICONS.pick : ICONS.book;
}
function nodeInfo(node) {
  const items = node.gen(), play = items.filter(x => x.type === 'play').length;
  const parts = [`${items.length} oefeningen`];
  parts.push(play === items.length ? 'met gitaar' : play ? `${play} met gitaar` : 'zonder gitaar');
  parts.push(`ongeveer ${Math.max(2, Math.round(items.length * 0.5))} min`);
  return parts.join(' · ');
}
function startNode(unit, i, nodes, after) {
  const node = nodes[i], items = node.gen();
  const cantPlay = (Store.settings.cantPlayUntil || 0) > Date.now();
  if (!cantPlay && items.some(x => x.type === 'play') && !Engine.mic) Engine.startMic();
  Lesson.open({
    title: `Les ${unit.lesson} · ${node.title}`, items, test: !!node.test, xp: node.test ? 20 : 10,
    onFinish: res => recordNode(unit, i, node, res),
    onDone: after || (() => { location.hash = ''; }),
    onExit: () => { location.hash = ''; },
  });
}
const OFFSETS = [0, 1, 1.6, 1, 0, -1, -1.6, -1];
function niceDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}
function renderPath(view) {
  const units = PathData.units();
  const wrap = h('section', { class: 'path' });
  if ((Store.settings.cantPlayUntil || 0) > Date.now()) {
    const until = new Date(Store.settings.cantPlayUntil).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    wrap.append(h('div', { class: 'note-bar' }, h('span', { text: `Speelopdrachten staan uit tot ${until}.` }), h('button', { type: 'button', text: 'Weer aanzetten', onclick: () => { Store.settings.cantPlayUntil = 0; Store.saveSettings(); Router.render(); } })));
  }
  if (!units.length) wrap.append(h('div', { class: 'card empty' }, h('h2', { text: 'Je leerpad begint na les 1' }), h('p', { class: 'help', text: 'Zodra je eerste muziektheorieles binnen is, verschijnt hier de eerste unit met oefeningen.' })));
  const nx = nextNode();
  units.forEach((u, ui) => {
    const meta = unitMeta(u), nodes = unitNodes(u);
    const doneCount = nodes.filter((n, i) => nodeDone(u, i)).length;
    const head = h('div', { class: 'unit-head' + (doneCount === nodes.length ? ' complete' : '') },
      h('div', { class: 'uh-text' },
        h('p', { class: 'eyebrow', text: `Unit ${ui + 1} · bij les ${u.lesson}` }),
        h('h2', { text: meta.title }),
        meta.subtitle ? h('p', { class: 'uh-sub', text: meta.subtitle }) : null),
      h('div', { class: 'uh-side' },
        h('span', { class: 'uh-count', text: `${doneCount}/${nodes.length}` }),
        h('a', { class: 'uh-link', href: u.doc || COURSE_DOC, target: '_blank', rel: 'noopener', text: 'Lees de les' })));
    const track = h('div', { class: 'track' });
    nodes.forEach((n, i) => {
      const state = nodeState(u, nodes, i);
      const isNext = nx && nx.unit.lesson === u.lesson && nx.index === i;
      const btn = h('button', { type: 'button', class: `node ${state}${isNext ? ' next' : ''}${n.test ? ' test' : ''}`, 'aria-label': `${n.title}: ${state === 'done' ? 'gedaan' : state === 'open' ? 'beschikbaar' : 'op slot'}`, html: state === 'locked' ? ICONS.lock : state === 'done' && !n.test ? ICONS.check : nodeKindIcon(n), onclick: () => nodeSheet(u, i, nodes, ui + 1) });
      const row = h('div', { class: 'node-row', style: `--x:${OFFSETS[i % OFFSETS.length]}` }, btn, isNext ? h('span', { class: 'bubble', text: n.title }) : null);
      track.append(row);
    });
    wrap.append(h('div', { class: 'unit', id: `unit-${u.lesson}` }, head, track));
  });
  for (const up of PathData.upcoming()) {
    const tp = TOPICS[up.topic];
    wrap.append(h('div', { class: 'unit locked' }, h('div', { class: 'unit-head' },
      h('div', { class: 'uh-text' }, h('p', { class: 'eyebrow', text: `Les ${up.lesson} · opent ${niceDate(up.date)}` }), h('h2', { text: tp ? tp.title : 'Volgende les' }), tp ? h('p', { class: 'uh-sub', text: tp.subtitle }) : null),
      h('div', { class: 'uh-side' }, h('span', { class: 'uh-lock', html: ICONS.lock })))));
  }
  wrap.append(h('div', { class: 'path-end', text: 'Na elke les van maandag en donderdag komt hier een nieuwe unit bij.' }));
  view.append(wrap);
  const remaining = Math.max(0, Progress.goalSecs() - Progress.day().secs);
  const cta = h('div', { class: 'cta-bar' }, h('button', { class: 'primary big', type: 'button', id: 'todayBtn', onclick: () => Daily.showPlan() },
    h('span', { text: Daily.active ? 'Ga verder met vandaag' : remaining ? 'Oefen vandaag' : 'Extra oefenen' }),
    h('small', { text: remaining ? `nog ${Math.ceil(remaining / 60)} min voor je dagdoel` : 'dagdoel gehaald' })));
  view.append(cta);
  const target = nx ? document.getElementById(`unit-${nx.unit.lesson}`) : null;
  if (target && nx.index > 0) setTimeout(() => { const b = $('.node.next', target); if (b) b.scrollIntoView({ block: 'center' }); }, 30);
}
function nodeSheet(u, i, nodes, unitNo) {
  const n = nodes[i], state = nodeState(u, nodes, i);
  const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
    h('div', { class: 'sheet' },
      h('p', { class: 'eyebrow', text: `Unit ${unitNo} · stap ${i + 1} van ${nodes.length}` }),
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
