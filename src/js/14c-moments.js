// ---------- Momenten: niveau omhoog, dagdoel, opdrachten, bevriezer, plectrums ----------
// Tijdens een les of Oefen vandaag verschijnt er geen melding over je vraag heen. Alles wat je verdient,
// komt samen in één overzicht aan het eind: op het eindscherm van de les of na de sessie.
// Daarbuiten (bijvoorbeeld tijdens een oefening) worden momenten die vlak na elkaar komen één melding.
// m = { key, prio, icon, title, text, big }: big = met confetti; prio bepaalt de volgorde (hoogste eerst)
const Moments = {
  pending: [], session: null, timer: 0,
  quiet() { return document.body.dataset.view === 'lesson' || Daily.active; },
  add(m) {
    if (m.key && this.pending.some(x => x.key === m.key)) return;
    this.pending.push(m);
    if (this.session && !(m.key && this.session.some(x => x.key === m.key))) this.session.push(m);
    this.later(400);
  },
  // de momenten die nog niet getoond zijn, belangrijkste eerst; daarna is de lijst leeg
  take() { const out = this.sort(this.pending); this.pending = []; return out; },
  // belangrijkste eerst; meer opdrachten tegelijk worden één regel
  sort(list) {
    const qs = list.filter(m => m.quest), rest = list.filter(m => !m.quest);
    if (qs.length > 1) {
      const texts = qs.map((m, i) => (i ? m.quest[0].toLowerCase() + m.quest.slice(1) : m.quest));
      rest.push({ key: 'quests', prio: 3, icon: qs[0].icon, title: `${qs.length} opdrachten gedaan!`, text: `${texts.slice(0, -1).join(', ')} en ${texts[texts.length - 1]}. +${10 * qs.length} XP` });
    } else rest.push(...qs);
    return rest.sort((a, b) => (b.prio || 0) - (a.prio || 0));
  },
  later(ms) { clearTimeout(this.timer); if (this.pending.length && !this.quiet()) this.timer = setTimeout(() => this.flush(), ms); },
  // één melding: het belangrijkste moment bovenaan, de rest als regels eronder
  flush() {
    if (this.quiet()) return;
    const list = this.take();
    if (!list.length) return;
    const [top, ...rest] = list;
    UI.flash(top.icon, top.title, top.text, 'goal', rest);
    this.cheer(list);
  },
  cheer(list, y, delay = 0) {
    if (list.some(m => m.big)) { Sfx.play('goal'); setTimeout(() => Confetti.burst({ n: 90, y: y != null ? y : innerHeight * 0.3 }), delay); }
    else if (list.length) Sfx.play('fixed');
  },
  // lijstje voor een eindscherm
  list(list, title) {
    return h('section', { class: 'moments', 'aria-label': title || 'Verdiend' },
      title ? h('p', { class: 'mo-h', text: title }) : null,
      h('ul', {}, this.sort(list).map(m => h('li', { class: m.big ? 'big' : '' },
        h('span', { class: 'mo-ico', html: m.icon || ICONS.star }),
        h('span', { class: 'mo-txt' }, h('b', { text: m.title }), m.text ? h('small', { text: m.text }) : null)))));
  },
};
