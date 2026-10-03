// ---------- Oefen vandaag: een sessie die zichzelf samenstelt ----------
const Daily = {
  active: false, steps: [], idx: 0, left: 0, timer: 0, startXP: 0, startSecs: 0,
  plan() {
    const remainMin = Math.max(5, Math.ceil((Progress.goalSecs() - Progress.day().secs) / 60));
    const steps = [];
    let est = 0;
    const add = s => { steps.push(s); est += s.minutes; };
    // met gitaar alles met de microfoon, zonder gitaar alles op je telefoon
    const g = Guitar.on();
    if (g) add({ kind: 'drill', mode: 'notes', minutes: 2, title: 'Opwarmen', sub: 'Noten zoeken' });
    const nx = nextNode();
    if (nx) add({ kind: 'node', ref: nx, minutes: 4, title: 'Leerpad', sub: `Unit ${nx.unitNo}: ${nx.node.title}` });
    // de volgende stap in de Halsjacht: zonder gitaar, dus altijd mogelijk
    const hx = nextHals();
    if (hx) add({ kind: 'node', ref: hx, minutes: 3, title: 'Halsjacht', sub: `Niveau ${hx.unitNo}, ${hx.unit.title}: ${hx.node.title.toLowerCase()}` });
    // herhalen: nieuwe fouten en wat vandaag terugkomt; staat er niets klaar, dan vragen uit eerdere lessen
    const rv = Srs.items(), due = rv.filter(x => x._box).length, nb = rv.length - due;
    if (rv.length) add({ kind: 'bin', minutes: 3, title: 'Herhalen', sub: Srs.what(nb, due).replace(/^./, c => c.toUpperCase()) });
    else if (Review.available()) add({ kind: 'review', minutes: 3, title: 'Herhalen', sub: 'Vragen uit eerdere lessen, je zwakke punten eerst' });
    const cu = nx ? nx.unit : PathData.units().slice(-1)[0];
    if (cu) {
      const d = unitMeta(cu).drill;
      if (d && MODES[d.mode] && d.mode !== 'notes' && g === !NO_MIC.includes(d.mode)) add({ kind: 'drill', mode: d.mode, set: d.set, minutes: 3, title: 'Toepassen', sub: `${MODES[d.mode].title}, past bij les ${cu.lesson}` });
    }
    const extras = g ? shuffle([{ mode: 'challenge', minutes: 2, sub: '60 seconden' }, { mode: 'scales', minutes: 3, sub: 'Toonladders' }, { mode: 'positions', minutes: 2, sub: 'Alle posities' }, { mode: 'ear', minutes: 3, sub: 'Op gehoor naspelen' }, { mode: 'targets', minutes: 3, sub: 'Doeltonen over akkoordwissels' }])
      : [{ mode: 'noteq', minutes: 3, sub: 'Welke noot?' }, { mode: 'earq', minutes: 4, sub: 'Gehoortraining' }, { mode: 'noteq', minutes: 3, sub: 'Welke noot?, zoek de noot', set: { kind: 'find' } }];
    for (const x of extras) { if (est >= remainMin) break; add({ kind: 'drill', mode: x.mode, set: x.set, minutes: x.minutes, title: 'Extra', sub: x.sub }); }
    return steps;
  },
  showPlan() {
    if (this.active) return this.run();
    const steps = this.plan(), total = steps.reduce((a, s) => a + s.minutes, 0);
    const met = Progress.met(todayKey());
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet' },
        h('div', { class: 'plan-head' }, h('div', { class: 'plan-fret', html: Mascot.svg(met ? 'juich' : 'zwaai') }),
          h('div', {}, h('h3', { text: met ? 'Extra oefenen' : 'Oefen vandaag' }), h('p', { class: 'help', text: `${total} minuten in ${steps.length} stappen, ${Guitar.on() ? 'met' : 'zonder'} gitaar${met ? '. Je dagdoel is al gehaald.' : '.'}` }))),
        h('ol', { class: 'plan' }, steps.map((s, i) => h('li', {}, h('span', { class: 'pl-n', text: String(i + 1) }), h('div', {}, h('b', { text: s.title }), h('small', { text: s.sub })), h('span', { class: 'pl-m', text: `${s.minutes} min` })))),
        h('p', { class: 'help', text: 'De oefentijd telt alleen als je echt bezig bent. Tussen de stappen ga je vanzelf door.' }),
        h('button', { class: 'primary big', type: 'button', text: 'Start', onclick: () => { sheet.remove(); this.start(steps); } })));
    document.body.append(sheet);
  },
  start(steps) {
    this.steps = steps; this.idx = 0; this.active = true;
    this.startXP = Store.stats.xp || 0; this.startSecs = Progress.day().secs;
    // alles wat je in deze sessie verdient, komt aan het eind in één overzicht
    Moments.session = [];
    const needMic = !Engine.mic && Guitar.on();
    Loader.run({ title: 'Oefen vandaag', sub: needMic ? 'Microfoon aanzetten…' : `${steps.length} stappen`, mood: 'luister', wait: needMic ? Engine.startMic() : null }, () => this.run());
  },
  run() {
    const st = this.steps[this.idx];
    if (!st) return this.finish();
    clearInterval(this.timer);
    if (st.kind === 'node') {
      const hals = st.ref.unit.track === 'hals', units = PathData.units(), u = units.find(x => x.lesson === st.ref.unit.lesson) || st.ref.unit;
      const nodes = unitNodes(u);
      if (nodeState(u, nodes, st.ref.index) === 'done') { const nx = hals ? nextHals() : nextNode(); if (nx) { st.ref = nx; st.sub = hals ? `Niveau ${nx.unitNo}, ${nx.unit.title}: ${nx.node.title.toLowerCase()}` : `Unit ${nx.unitNo}: ${nx.node.title}`; } }
      const nodes2 = unitNodes(st.ref.unit);
      startNode(st.ref.unit, st.ref.index, nodes2, () => this.advance());
    } else if (st.kind === 'bin') {
      if (!Srs.items().length) return this.advance();
      Srs.start({ after: () => this.advance(), exit: () => { location.hash = ''; } });
    } else if (st.kind === 'review') {
      if (!Review.start({ after: () => this.advance(), exit: () => { location.hash = ''; } })) return this.advance();
    } else {
      // instellingen die bij de les horen gelden alleen tijdens deze stap
      if (st.set) TempSettings.apply(st.mode, st.set);
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
    if ((Engine.mic || current.noMic) && onIt && document.visibilityState === 'visible') {
      this.left--;
      if (this.left <= 0) { if (Engine.ctx && Sfx.on()) Engine.chime(); return this.advance(); }
    }
    this.renderBar();
  },
  restore() { TempSettings.restore(); },
  advance() { clearInterval(this.timer); this.restore(); this.idx++; if (this.idx >= this.steps.length) return this.finish(); this.run(); },
  stop() {
    this.active = false; clearInterval(this.timer); this.restore(); this.renderBar();
    Moments.session = null;
    if (location.hash.startsWith('#m-')) location.hash = ''; else Moments.later(300);
  },
  finish() {
    this.active = false; clearInterval(this.timer); this.restore(); this.renderBar();
    const min = Math.max(0, Math.round((Progress.day().secs - this.startSecs) / 60)), xp = Math.max(0, (Store.stats.xp || 0) - this.startXP);
    // alles uit deze sessie, ook wat al op het eindscherm van een les stond
    const got = Moments.session || [];
    Moments.session = null; Moments.take();
    if (location.hash === '' || location.hash === '#') Router.render(); else location.hash = '';
    setTimeout(() => this.celebrate(min, xp, got), 60);
  },
  celebrate(min, xp, got = []) {
    const sk = Progress.streak();
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet center' },
        h('div', { class: 'sheet-mascot party', html: Mascot.svg(sk.today ? 'juich' : 'blij') }),
        h('h3', { text: 'Sessie klaar!' }),
        h('p', { class: 'help', text: `${min} ${min === 1 ? 'minuut' : 'minuten'} geoefend en ${xp} XP verdiend.${sk.today ? ` Je reeks staat op ${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'}.` : ''}` }),
        got.length ? Moments.list(got, 'Dit heb je verdiend') : null,
        Progress.goalLine(),
        h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: () => sheet.remove() })));
    document.body.append(sheet);
    Moments.cheer(got.filter(m => m.big), innerHeight * 0.25, 250);
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
    bar.innerHTML = `<span class="sb-dots">${dots}</span><span class="sb-txt"><b>${onIt ? st.sub : 'Oefen vandaag'}</b>${onIt ? (Engine.mic || current.noMic ? '' : ', druk op Start') : `, stap ${this.idx + 1} van ${this.steps.length}`}</span>${onIt ? `<span class="sb-time">${mm}</span>` : ''}`;
    bar.append(onIt ? h('button', { type: 'button', text: 'Volgende', onclick: () => this.advance() }) : h('button', { type: 'button', class: 'primary', text: 'Ga verder', onclick: () => this.run() }), h('button', { type: 'button', text: 'Stop', onclick: () => this.stop() }));
  },
};
