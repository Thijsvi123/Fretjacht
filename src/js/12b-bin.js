// ---------- Herhalen: wat je fout had, komt terug tot je het weet ----------
// Eén begrip voor de gebruiker: Herhalen. Een vraag die je fout hebt, komt terug: meteen (vak 0), en als je
// hem dan goed hebt na 1 dag, na 3 dagen en na 7 dagen (vak 1 t/m 3, Leitner). Weet je hem na 7 dagen nog,
// dan heb je hem onder de knie. Een fout zet hem altijd terug in vak 0.
// Bin beheert de lijst (vak 0 heette vroeger de foutenbak), Srs de vakken en de herhaalrondes.
const Bin = {
  MAX: 40, MAX_ALL: 150,
  all() { const s = Store.stats; if (!Array.isArray(s.bin)) s.bin = []; return s.bin; },
  list() { return this.all().filter(x => !x.box); },
  count() { return this.list().length; },
  key(it) {
    if (it.type === 'mc') return `mc|${it.prompt}|${it.sub || ''}|${it.options[it.answer]}`;
    if (it.type === 'multi') return `multi|${it.prompt}|${it.correct.slice().sort().join(',')}`;
    if (it.type === 'tap') return `tap|${it.prompt}|${(it.marks || []).map(m => m.s + '-' + m.f).join(',')}`;
    if (it.type === 'name') return `name|${it.s}-${it.f}|${it.all ? 12 : 7}`;
    if (it.type === 'tapall') return `tapall|${it.name}|${it.strings.join('')}`;
    return `play|${it.prompt}|${it.big || ''}|${(it.steps || []).map(s => s.k + ':' + (s.pc != null ? s.pc : s.semis != null ? s.semis : (s.pcs || []).join('.'))).join(',')}`;
  },
  clean(it) {
    const o = {};
    for (const k of Object.keys(it)) if (k[0] !== '_') o[k] = it[k];
    return JSON.parse(JSON.stringify(o));
  },
  add(it, from, topic) {
    // een vraag die voor de gitaarstand is omgezet, gaat als origineel in de lijst
    const src = it._orig || it;
    const k = it._bin || this.key(src), all = this.all(), ex = all.find(x => x.k === k);
    if (ex) { ex.n++; ex.t = Date.now(); ex.box = 0; ex.due = ''; }
    else {
      all.push({ k, it: this.clean(src), n: 1, t: Date.now(), from: from || '', topic: topic || it._topic || '', box: 0 });
      // maximaal 40 nieuwe fouten en 150 in totaal: de oudste gaan eruit
      const b0 = all.filter(x => !x.box);
      for (let i = 0; i < b0.length - this.MAX; i++) all.splice(all.indexOf(b0[i]), 1);
      while (all.length > this.MAX_ALL) { const i = all.findIndex(x => x.box); all.splice(i >= 0 ? i : 0, 1); }
    }
    Store.saveStats();
    this.changed();
    return k;
  },
  has(k) { return this.list().some(x => x.k === k); },
  // kan deze vraag in de huidige stand (met of zonder gitaar)? Speelopdrachten worden zonder gitaar een vraag.
  // (naspelen op gehoor kan altijd: zonder gitaar op de toetsen in de app)
  playable(x) { return Guitar.on() || x.it.type !== 'play' || !!x.it.pad || !!askFromPlay(x.it); },
  // verse kopie om opnieuw te stellen; meerkeuze-opties opnieuw geschud
  copy(x) {
    const it = JSON.parse(JSON.stringify(x.it));
    if (it.type === 'mc') { const right = it.options[it.answer]; it.options = shuffle(it.options); it.answer = it.options.indexOf(right); }
    it._bin = x.k; it._topic = x.topic || ''; if (x.box) it._box = x.box;
    return it;
  },
  items(keys, max) {
    let src = this.list().slice();
    if (keys) src = src.filter(x => keys.includes(x.k));
    else src.sort((a, b) => b.n - a.n || a.t - b.t);
    return src.filter(x => this.playable(x)).slice(0, max || 10).map(x => this.copy(x));
  },
  bonusXP(n) { return 2 * n + 5; },
  // herhaal alleen deze vragen (de fouten uit de les die je net deed).
  // o.after: na afloop, o.exit: bij tussentijds stoppen. Standaard terug naar waar je vandaan kwam.
  start(o = {}) {
    if (!o.keys) return Srs.start(o);
    try { Engine.ensureCtx(); } catch (e) {}   // geluid aan binnen de tik (luistervragen), ook op een iPhone
    const from = location.hash === '#les' ? '' : location.hash;
    const back = () => { if (location.hash === from) Router.render(); else location.hash = from; };
    const items = this.items(o.keys, 10);
    if (!items.length) { (o.after || back)(); return; }
    const needMic = needsMic(items) && !Engine.mic;
    Loader.run({ title: items.length === 1 ? 'Herhaal je fout' : 'Herhaal je fouten', sub: `${items.length} ${items.length === 1 ? 'vraag' : 'vragen'} uit deze les`, mood: 'ehbo', wait: needMic ? Engine.startMic() : null }, () =>
      Lesson.open({ mode: 'bin', title: 'Herhalen', items, onDone: o.after || back, onExit: o.exit || o.after || back }));
  },
  // alles herhaald wat er klaarstond: telt voor de mijlpaal (de 10 XP extra telt de les zelf)
  reward() {
    Store.stats.binCleared = (Store.stats.binCleared || 0) + 1;
    Store.saveStats();
  },
  changed() {
    const todo = Srs.todoCount();
    $$('.todo-count').forEach(el => { el.textContent = String(todo); });
    $$('.bin-btn').forEach(el => { el.hidden = !todo; });
    Srs.badge();
  },
};

const SRS_DAYS = [0, 1, 3, 7];
const SRS_LABELS = ['Nu', '1 dag', '3 dagen', '7 dagen', 'Onder de knie'];
const addDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const Srs = {
  entry(k) { return Bin.all().find(x => x.k === k) || null; },
  isDue(x, t) { return x.box > 0 && (x.due || '') <= (t || todayKey()); },
  dueList() { const t = todayKey(); return Bin.all().filter(x => this.isDue(x, t)); },
  dueCount() { return this.dueList().length; },
  // alles wat nu te herhalen is: nieuwe fouten plus wat vandaag terugkomt
  todoCount() { return Bin.count() + this.dueCount(); },
  // "2 nieuwe fouten en 1 vraag die vandaag terugkomt"
  what(nb, due) {
    return [nb ? `${nb} ${nb === 1 ? 'nieuwe fout' : 'nieuwe fouten'}` : '', due ? `${due} ${due === 1 ? 'vraag die vandaag terugkomt' : 'vragen die vandaag terugkomen'}` : ''].filter(Boolean).join(' en ');
  },
  // aantallen per vak, plus wat je onder de knie hebt
  snapshot() {
    const c = [0, 0, 0, 0, Store.stats.srsDone || 0];
    for (const x of Bin.all()) c[Math.min(3, x.box || 0)]++;
    return c;
  },
  delta(before) { const now = this.snapshot(); return now.map((v, i) => v - (before ? before[i] : v)); },
  dueBy() { const c = [0, 0, 0, 0], t = todayKey(); for (const x of Bin.all()) if (this.isDue(x, t)) c[x.box]++; return c; },
  // de eerstvolgende dag waarop er iets terugkomt
  next() {
    const t = todayKey(), fut = Bin.all().filter(x => x.box > 0 && x.due > t).map(x => x.due).sort();
    return fut.length ? { date: fut[0], n: fut.filter(d => d === fut[0]).length } : null;
  },
  when(date) {
    const t = todayKey();
    if (date === addDays(t, 1)) return 'morgen';
    if (date === addDays(t, 2)) return 'overmorgen';
    return 'op ' + new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' });
  },
  comes(nx) { const w = this.when(nx.date); return `${w[0].toUpperCase() + w.slice(1)} ${nx.n === 1 ? 'komt er een vraag' : `komen er ${nx.n} vragen`} terug.`; },
  // goed beantwoord in een herhaalronde: een vak verder
  correct(k) {
    const x = this.entry(k);
    if (!x) return null;
    const t = todayKey(), from = x.box || 0;
    if (from > 0 && !this.isDue(x, t)) return null;
    let res;
    if (from >= 3) {
      Bin.all().splice(Bin.all().indexOf(x), 1);
      Store.stats.srsDone = (Store.stats.srsDone || 0) + 1;
      res = { from, to: 4, mastered: true };
    } else {
      x.box = from + 1; x.due = addDays(t, SRS_DAYS[x.box]); x.seen = t;
      res = { from, to: x.box, mastered: false, days: SRS_DAYS[x.box] };
    }
    Store.saveStats();
    Bin.changed();
    return res;
  },
  // wat vandaag terugkomt (oudste eerst), daarna de nieuwe fouten
  items(max) {
    const due = this.dueList().filter(x => Bin.playable(x)).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
    const bin = Bin.list().filter(x => Bin.playable(x)).sort((a, b) => b.n - a.n || a.t - b.t);
    return due.concat(bin).slice(0, max || 10).map(x => Bin.copy(x));
  },
  // herhalen: eerst wat klaarstaat; staat er niets klaar, dan vragen uit eerdere lessen (zwakke eerst)
  start(o = {}) {
    try { Engine.ensureCtx(); } catch (e) {}
    const from = location.hash === '#les' ? '' : location.hash;
    const back = () => { if (location.hash === from) Router.render(); else location.hash = from; };
    const items = this.items(10);
    if (!items.length) {
      const todo = this.todoCount();
      if (!todo && Review.start(o)) return;
      const nx = this.next();
      UI.flash(ICONS.retry, todo ? 'Alleen speelvragen over' : 'Niets te herhalen', todo ? 'Zet het schuifje op Met gitaar om ze te herhalen.' : nx ? this.comes(nx) : 'Wat je fout hebt in een les, komt hier terug.', 'badge', null, true);
      (o.after || back)();
      return;
    }
    const due = items.filter(x => x._box).length;
    const needMic = needsMic(items) && !Engine.mic;
    Loader.run({ title: 'Herhalen', sub: this.what(items.length - due, due), mood: due ? 'denk' : 'ehbo', wait: needMic ? Engine.startMic() : null }, () =>
      Lesson.open({ mode: 'bin', title: 'Herhalen', items, onDone: o.after || back, onExit: o.exit || o.after || back }));
  },
  // teller op het tabblad Oefenen
  badge() {
    const b = $('.tabbar a[data-tab="practice"] .tb-badge');
    if (!b) return;
    const n = this.todoCount();
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    b.closest('a').setAttribute('aria-label', n ? `Oefenen, ${n} te herhalen` : 'Oefenen');
  },
  // de vakjes naast elkaar; o.delta laat zien wat er in deze ronde verschoof
  row(o = {}) {
    const c = this.snapshot(), due = this.dueBy(), d = o.delta || [];
    return h('div', { class: 'lb-row', role: 'list', 'aria-label': 'Herhaalvakjes' }, SRS_LABELS.map((label, k) => {
      const n = c[k], cards = Math.min(3, n);
      return h('div', { class: `lb b${k}${n ? ' has' : ''}${due[k] ? ' due' : ''}`, role: 'listitem', 'aria-label': `${k === 0 ? 'Nu te herhalen' : k === 4 ? label : `Na ${label}`}: ${n}${due[k] ? `, ${due[k]} vandaag aan de beurt` : ''}` },
        h('span', { class: 'lb-cards', 'aria-hidden': 'true' }, Array.from({ length: cards }, () => h('i'))),
        h('b', { class: 'lb-n', text: String(n) }),
        h('small', { class: 'lb-l', text: label }),
        due[k] ? h('em', { class: 'lb-due', text: `${due[k]} nu` }) : null,
        d[k] ? h('span', { class: 'lb-d ' + (d[k] > 0 ? 'up' : 'down'), text: (d[k] > 0 ? '+' : '−') + Math.abs(d[k]) }) : null);
    }));
  },
  // kaart bovenaan Oefenen
  card() {
    const c = this.snapshot(), nb = c[0], due = this.dueCount(), todo = nb + due, total = c.reduce((a, b) => a + b, 0), nx = this.next();
    const old = !todo && Review.available();
    let title, text, mood;
    if (!total) {
      title = 'Nog niets te herhalen'; mood = 'boek';
      text = 'Wat je fout hebt in een les, komt hier terug: meteen, en daarna na 1, 3 en 7 dagen. Zo blijft het hangen.';
    } else if (todo) {
      title = `${todo} ${todo === 1 ? 'vraag' : 'vragen'} om te herhalen`; mood = due ? 'denk' : 'ehbo';
      text = `${this.what(nb, due)[0].toUpperCase()}${this.what(nb, due).slice(1)}. Goed is een vakje verder, fout is terug naar het begin.`;
    } else {
      title = 'Vandaag niets te herhalen'; mood = 'slaap';
      text = nx ? this.comes(nx) : `Je hebt ${c[4]} ${c[4] === 1 ? 'vraag' : 'vragen'} onder de knie.`;
    }
    return h('section', { class: 'srs-card' + (todo ? ' todo' : '') + (!total ? ' none' : ''), id: 'srsCard' },
      h('div', { class: 'srs-head' },
        h('div', { class: 'srs-fret', html: Mascot.svg(mood) }),
        h('div', { class: 'srs-text' }, h('p', { class: 'srs-eyebrow', text: 'Herhalen' }), h('h2', { text: title }), h('p', { class: 'srs-sub', text: text }))),
      this.row(),
      todo ? h('button', { class: 'primary big srs-go', type: 'button', onclick: () => this.start() }, h('span', { html: ICONS.retry }), h('span', { text: 'Herhaal nu' }), h('b', { class: 'todo-count', text: String(todo) }))
        : old ? h('button', { class: 'big srs-old', type: 'button', onclick: () => Review.start() }, h('span', { html: ICONS.retry }), h('span', { text: 'Herhaal eerdere lessen' })) : null);
  },
};
