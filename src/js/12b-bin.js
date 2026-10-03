// ---------- Foutenbak: vragen die je fout had, tot je ze goed beantwoordt ----------
const Bin = {
  MAX: 40,
  list() { const s = Store.stats; if (!Array.isArray(s.bin)) s.bin = []; return s.bin; },
  count() { return this.list().length; },
  key(it) {
    if (it.type === 'mc') return `mc|${it.prompt}|${it.sub || ''}|${it.options[it.answer]}`;
    if (it.type === 'multi') return `multi|${it.prompt}|${it.correct.slice().sort().join(',')}`;
    if (it.type === 'tap') return `tap|${it.prompt}|${(it.marks || []).map(m => m.s + '-' + m.f).join(',')}`;
    return `play|${it.prompt}|${it.big || ''}|${(it.steps || []).map(s => s.k + ':' + (s.pc != null ? s.pc : s.semis != null ? s.semis : (s.pcs || []).join('.'))).join(',')}`;
  },
  clean(it) {
    const o = {};
    for (const k of Object.keys(it)) if (k[0] !== '_') o[k] = it[k];
    return JSON.parse(JSON.stringify(o));
  },
  add(it, from) {
    const k = it._bin || this.key(it), list = this.list(), ex = list.find(x => x.k === k);
    const first = !this.list().length && !(Store.stats.binSeen);
    if (ex) { ex.n++; ex.t = Date.now(); }
    else {
      list.push({ k, it: this.clean(it), n: 1, t: Date.now(), from: from || '' });
      while (list.length > this.MAX) list.shift();
    }
    if (first) Store.stats.binSeen = true;
    Store.saveStats();
    this.changed();
    return k;
  },
  has(k) { return this.list().some(x => x.k === k); },
  remove(k) {
    const list = this.list(), i = list.findIndex(x => x.k === k);
    if (i < 0) return false;
    list.splice(i, 1);
    Store.saveStats();
    this.changed();
    return true;
  },
  canPlay() { return !((Store.settings.cantPlayUntil || 0) > Date.now()); },
  // verse kopieën om opnieuw te stellen; meerkeuze-opties opnieuw geschud
  items(keys, max) {
    let src = this.list().slice();
    if (keys) src = src.filter(x => keys.includes(x.k));
    else src.sort((a, b) => b.n - a.n || a.t - b.t);
    if (!this.canPlay()) src = src.filter(x => x.it.type !== 'play');
    return src.slice(0, max || 10).map(x => {
      const it = JSON.parse(JSON.stringify(x.it));
      if (it.type === 'mc') { const right = it.options[it.answer]; it.options = shuffle(it.options); it.answer = it.options.indexOf(right); }
      it._bin = x.k;
      return it;
    });
  },
  bonusXP(n) { return 2 * n + 5; },
  // start een herstelronde. o.keys: alleen deze vragen (bijvoorbeeld uit de les die je net deed).
  // o.after: na afloop, o.exit: bij tussentijds stoppen. Standaard terug naar waar je vandaan kwam.
  start(o = {}) {
    const from = location.hash === '#les' ? '' : location.hash;
    const back = () => { if (location.hash === from) Router.render(); else location.hash = from; };
    const items = this.items(o.keys, 10);
    if (!items.length) {
      UI.flash(ICONS.plaster, this.count() ? 'Alleen speelvragen over' : 'Je foutenbak is leeg', this.count() ? 'Zet speelopdrachten weer aan om ze te herstellen.' : 'Fouten uit je lessen komen hier terecht.', 'badge');
      (o.after || back)();
      return;
    }
    const needMic = items.some(x => x.type === 'play') && !Engine.mic;
    Loader.run({ title: 'Herstel je fouten', sub: `${items.length} ${items.length === 1 ? 'vraag' : 'vragen'} uit je foutenbak`, mood: 'ehbo', wait: needMic ? Engine.startMic() : null }, () =>
      Lesson.open({ mode: 'bin', title: 'Herstel je fouten', items, onDone: o.after || back, onExit: o.exit || o.after || back }));
  },
  // beloning als de bak leeg is: 2 minuten erbij voor het dagdoel (de 10 XP telt de les zelf)
  reward() {
    Store.stats.binCleared = (Store.stats.binCleared || 0) + 1;
    Store.saveStats();
    Progress.addBonus(120);
  },
  changed() {
    const n = this.count();
    $$('.bin-count').forEach(el => { el.textContent = String(n); });
    $$('.bin-btn').forEach(el => { el.hidden = !n; });
  },
};
