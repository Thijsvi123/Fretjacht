// ---------- Oefen vandaag: een sessie die zichzelf samenstelt ----------
const Daily = {
  active: false, steps: [], idx: 0, left: 0, timer: 0, startXP: 0, startSecs: 0,
  plan() {
    const remainMin = Math.max(5, Math.ceil((Progress.goalSecs() - Progress.day().secs) / 60));
    const steps = [];
    let est = 0;
    const add = s => { steps.push(s); est += s.minutes; };
    add({ kind: 'drill', mode: 'notes', minutes: 2, title: 'Opwarmen', sub: 'Noten zoeken' });
    const nx = nextNode();
    if (nx) add({ kind: 'node', ref: nx, minutes: 4, title: 'Leerpad', sub: `Unit ${nx.unitNo}: ${nx.node.title}` });
    if (Review.available()) add({ kind: 'review', minutes: 3, title: 'Herhalen', sub: 'Vragen uit eerdere lessen, je zwakke punten eerst' });
    const cu = nx ? nx.unit : PathData.units().slice(-1)[0];
    if (cu) {
      const d = unitMeta(cu).drill;
      if (d && MODES[d.mode] && d.mode !== 'notes') add({ kind: 'drill', mode: d.mode, set: d.set, minutes: 3, title: 'Toepassen', sub: `${MODES[d.mode].title} · past bij les ${cu.lesson}` });
    }
    const extras = shuffle([{ mode: 'challenge', minutes: 2, sub: '60 seconden' }, { mode: 'scales', minutes: 3, sub: 'Toonladders' }, { mode: 'positions', minutes: 2, sub: 'Alle posities' }, { mode: 'ear', minutes: 3, sub: 'Op gehoor naspelen' }]);
    for (const x of extras) { if (est >= remainMin) break; add({ kind: 'drill', mode: x.mode, minutes: x.minutes, title: 'Extra', sub: x.sub }); }
    return steps;
  },
  showPlan() {
    if (this.active) return this.run();
    const steps = this.plan(), total = steps.reduce((a, s) => a + s.minutes, 0);
    const met = Progress.met(todayKey());
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet' },
        h('p', { class: 'eyebrow', text: met ? 'Dagdoel al gehaald' : 'Oefen vandaag' }),
        h('h3', { text: `${total} minuten` }),
        h('ol', { class: 'plan' }, steps.map((s, i) => h('li', {}, h('span', { class: 'pl-n', text: String(i + 1) }), h('div', {}, h('b', { text: s.title }), h('small', { text: s.sub })), h('span', { class: 'pl-m', text: `${s.minutes} min` })))),
        h('p', { class: 'help', text: 'De oefentijd telt alleen als je echt bezig bent. Tussen de stappen ga je vanzelf door.' }),
        h('button', { class: 'primary big', type: 'button', text: 'Start', onclick: () => { sheet.remove(); this.start(steps); } })));
    document.body.append(sheet);
  },
  start(steps) {
    this.steps = steps; this.idx = 0; this.active = true;
    this.startXP = Store.stats.xp || 0; this.startSecs = Progress.day().secs;
    if (!Engine.mic && !((Store.settings.cantPlayUntil || 0) > Date.now())) Engine.startMic();
    this.run();
  },
  run() {
    const st = this.steps[this.idx];
    if (!st) return this.finish();
    clearInterval(this.timer);
    if (st.kind === 'node') {
      const units = PathData.units(), u = units.find(x => x.lesson === st.ref.unit.lesson) || st.ref.unit;
      const nodes = unitNodes(u);
      if (nodeState(u, nodes, st.ref.index) === 'done') { const nx = nextNode(); if (nx) { st.ref = nx; st.sub = `Unit ${nx.unitNo}: ${nx.node.title}`; } }
      const nodes2 = unitNodes(st.ref.unit);
      startNode(st.ref.unit, st.ref.index, nodes2, () => this.advance());
    } else if (st.kind === 'review') {
      const items = Review.build(8);
      if (!items.length) return this.advance();
      Lesson.open({ title: 'Herhalen', items, xp: 10, onDone: () => this.advance(), onExit: () => { location.hash = ''; } });
    } else {
      if (st.set && st.mode === 'scales') { Object.assign(Store.settings.scales, st.set); Store.saveSettings(); }
      this.left = st.minutes * 60;
      if (location.hash === '#m-' + st.mode) Router.render(); else location.hash = '#m-' + st.mode;
      this.timer = setInterval(() => this.tick(), 1000);
    }
    this.renderBar();
  },
  tick() {
    const st = this.steps[this.idx];
    if (!this.active || !st || st.kind !== 'drill') return;
    const onIt = current && current.id === st.mode;
    if (Engine.mic && onIt && document.visibilityState === 'visible') {
      this.left--;
      if (this.left <= 0) { if (Engine.ctx) Engine.chime(); return this.advance(); }
    }
    this.renderBar();
  },
  advance() { clearInterval(this.timer); this.idx++; if (this.idx >= this.steps.length) return this.finish(); this.run(); },
  stop() { this.active = false; clearInterval(this.timer); this.renderBar(); if (location.hash.startsWith('#m-')) location.hash = ''; },
  finish() {
    this.active = false; clearInterval(this.timer); this.renderBar();
    const min = Math.max(0, Math.round((Progress.day().secs - this.startSecs) / 60)), xp = Math.max(0, (Store.stats.xp || 0) - this.startXP);
    if (location.hash === '' || location.hash === '#') Router.render(); else location.hash = '';
    setTimeout(() => this.celebrate(min, xp), 60);
  },
  celebrate(min, xp) {
    const sk = Progress.streak();
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet center' },
        h('div', { class: 'end-ico', html: ICONS.trophy }),
        h('h3', { text: 'Sessie klaar!' }),
        h('p', { class: 'help', text: `${min} ${min === 1 ? 'minuut' : 'minuten'} geoefend · +${xp} XP${sk.today ? ` · reeks ${sk.n}` : ''}` }),
        Progress.goalLine(),
        h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: () => sheet.remove() })));
    document.body.append(sheet);
  },
  renderBar() {
    const bar = $('#sessionBar');
    if (!bar) return;
    if (!this.active) { bar.hidden = true; bar._k = ''; return; }
    const st = this.steps[this.idx];
    if (!st) { bar.hidden = true; return; }
    const onIt = st.kind === 'drill' && current && current.id === st.mode;
    const mm = `${Math.floor(this.left / 60)}:${String(this.left % 60).padStart(2, '0')}`;
    const dots = this.steps.map((s, i) => `<i class="${i < this.idx ? 'done' : i === this.idx ? 'now' : ''}"></i>`).join('');
    const k = [this.idx, onIt, onIt ? mm : '', Engine.mic].join('|');
    bar.hidden = false;
    if (bar._k === k) return;
    bar._k = k;
    bar.innerHTML = `<span class="sb-dots">${dots}</span><span class="sb-txt"><b>${onIt ? st.sub : 'Oefen vandaag'}</b>${onIt ? (Engine.mic ? '' : ' · druk op Start') : ` · stap ${this.idx + 1} van ${this.steps.length}`}</span>${onIt ? `<span class="sb-time">${mm}</span>` : ''}`;
    bar.append(onIt ? h('button', { type: 'button', text: 'Volgende', onclick: () => this.advance() }) : h('button', { type: 'button', class: 'primary', text: 'Ga verder', onclick: () => this.run() }), h('button', { type: 'button', text: 'Stop', onclick: () => this.stop() }));
  },
};
