// ---------- Dagelijkse opdrachten, reeksbevriezer en voortgang voor de cursus ----------
const qc = (d, k) => (d.c && d.c[k]) || 0;
const QUESTS = [
  { id: 'node', cat: 'a', icon: 'path', target: () => 1, text: () => 'Rond een stap in je leerpad af', value: d => qc(d, 'nodes'), ok: () => !!(nextNode() || nextHals() || nextGehoor()) },
  { id: 'herhaal', cat: 'a', icon: 'retry', target: () => Math.min(4, Srs.items(4).length), text: n => (n === 1 ? 'Herhaal een vraag' : `Herhaal ${n} vragen`), value: d => qc(d, 'herhaal'), ok: () => Srs.items(1).length > 0 },
  { id: 'combo', cat: 'a', icon: 'flame', target: () => 6, text: n => `Beantwoord ${n} vragen op rij goed`, value: d => qc(d, 'combo'), ok: () => PathData.units().length > 0 },
  // van vóór Herhalen; alleen nog voor een dag waarop ze al gekozen waren
  { id: 'fix', cat: 'old', icon: 'retry', target: () => 1, text: n => (n === 1 ? 'Herhaal een vraag die je fout had' : `Herhaal ${n} vragen die je fout had`), value: d => qc(d, 'fixed') },
  { id: 'srs', cat: 'old', icon: 'retry', target: () => 1, text: n => (n === 1 ? 'Herhaal de vraag die vandaag terugkomt' : `Herhaal ${n} vragen die vandaag terugkomen`), value: d => qc(d, 'srs') },
  { id: 'notes', cat: 'b', icon: 'note', target: () => 25, text: n => `Vind ${n} noten op de hals`, value: d => qc(d, 'notes') },
  { id: 'challenge', cat: 'b', icon: 'bolt', target: () => clamp(Math.round((Store.stats.challenge.best || 12) * 0.8), 8, 40), text: n => `Haal ${n} of meer bij 60 seconden`, value: d => qc(d, 'challenge') },
  { id: 'scales', cat: 'b', icon: 'pick', target: () => 2, text: n => `Speel ${n} toonladderboxen helemaal`, value: d => qc(d, 'scales') },
  { id: 'targets', cat: 'b', icon: 'target', target: () => 12, text: n => `Raak ${n} doeltonen`, value: d => qc(d, 'targets') },
  { id: 'earq', cat: 'c', icon: 'ear', target: () => 10, text: n => `Herken ${n} intervallen of akkoorden op gehoor`, value: d => qc(d, 'earq') },
  { id: 'noteq', cat: 'c', icon: 'eye', target: () => 20, text: n => `Vind ${n} noten op de hals zonder gitaar`, value: d => qc(d, 'noteq') },
  { id: 'pedals', cat: 'c', icon: 'pedal', target: () => 3, text: n => `Trap ${n} verschillende pedalen in`, value: () => Object.values(Store.stats.modeDays || {}).filter(k => k === todayKey()).length },
];
const Quests = {
  def(id) { return QUESTS.find(q => q.id === id); },
  // drie opdrachten per dag, één uit elke soort; vast voor die dag
  today() {
    const d = Progress.day();
    if (Array.isArray(d.quests) && d.quests.length) return d.quests;
    let seed = 7;
    for (const ch of todayKey()) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const picks = [];
    for (const cat of ['a', 'b', 'c']) {
      let pool = QUESTS.filter(q => q.cat === cat && (!q.ok || q.ok()));
      if (!pool.length) pool = QUESTS.filter(q => q.cat === 'b' && !picks.includes(q));
      const q = pool[Math.floor(rnd() * pool.length)];
      if (q && !picks.includes(q)) picks.push(q);
    }
    d.quests = picks.map(q => ({ id: q.id, target: Math.max(1, q.target()) }));
    Store.saveStats();
    return d.quests;
  },
  progress(q) { const def = this.def(q.id); return def ? Math.min(q.target, def.value(Progress.day())) : 0; },
  text(q) { const def = this.def(q.id); return def ? def.text(q.target) : ''; },
  bump(key, n = 1) { const d = Progress.day(); d.c = d.c || {}; d.c[key] = (d.c[key] || 0) + n; this.check(); },
  max(key, v) { const d = Progress.day(); d.c = d.c || {}; if (v > (d.c[key] || 0)) { d.c[key] = v; this.check(); } },
  check() {
    const d = Progress.day(), qs = this.today();
    d.qd = d.qd || {};
    let changed = false;
    for (const q of qs) if (!d.qd[q.id] && this.progress(q) >= q.target) {
      d.qd[q.id] = true; changed = true;
      Moments.add({ key: 'quest-' + q.id, prio: 3, quest: this.text(q), icon: Mascot.svg('juich', { crop: 'head' }), title: 'Opdracht gedaan!', text: `${this.text(q)}. +10 XP` });
      Progress.addXP(10);
    }
    if (changed && qs.every(q => d.qd[q.id]) && !d.qdAll) {
      d.qdAll = true;
      if ((Store.stats.freezes || 0) < 2) {
        Store.stats.freezes = (Store.stats.freezes || 0) + 1;
        Moments.add({ key: 'freeze', prio: 4, big: true, icon: Mascot.svg('ijs', { crop: 'head' }), title: 'Reeksbevriezer verdiend!', text: 'Je deed alle drie de opdrachten. Mis je een dag, dan houdt hij je reeks vast.' });
      } else {
        Moments.add({ key: 'quests-all', prio: 4, big: true, icon: Mascot.svg('juich', { crop: 'head' }), title: 'Alle opdrachten gedaan!', text: 'Je hebt al 2 bevriezers, dus je krijgt 20 XP extra.' });
        Progress.addXP(20);
      }
    }
    if (changed) { Store.saveStats(); this.render(); }
  },
  // één regel bovenaan het leerpad; tik erop voor de drie opdrachten
  open: false,
  card() {
    const qs = this.today(), d = Progress.day(), done = qs.filter(q => d.qd && d.qd[q.id]).length, all = done === qs.length, fz = Store.stats.freezes || 0;
    return h('details', { class: 'quests' + (all ? ' all' : ''), id: 'questCard', open: this.open ? true : null, ontoggle: e => { this.open = e.currentTarget.open; } },
      h('summary', {},
        h('span', { class: 'q-sico', html: all ? ICONS.check : ICONS.target }),
        h('span', { class: 'q-sum' }, h('b', { text: all ? 'Opdrachten gedaan' : 'Opdrachten' }), all ? null : h('span', { class: 'q-dots', 'aria-label': `${done} van ${qs.length} gedaan` }, qs.map(q => h('i', { class: d.qd && d.qd[q.id] ? 'on' : '' })))),
        h('span', { class: 'q-freeze' + (fz ? ' has' : ''), title: 'Reeksbevriezers', 'aria-label': `${fz} reeksbevriezers` }, h('span', { html: ICONS.ice }), h('b', { text: String(fz) }))),
      all ? null : h('ul', { class: 'q-list' }, qs.map(q => {
        const v = this.progress(q), ok = !!(d.qd && d.qd[q.id]), def = this.def(q.id);
        return h('li', { class: ok ? 'done' : '' },
          h('span', { class: 'q-ico', html: ok ? ICONS.check : ICONS[def ? def.icon : 'star'] }),
          h('span', { class: 'q-text' }, h('span', { text: this.text(q) }), h('span', { class: 'q-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${(100 * v / q.target).toFixed(0)}%` }))),
          h('small', { class: 'q-n', text: ok ? '' : `${v}/${q.target}` }));
      })),
      h('p', { class: 'q-foot', text: all ? (fz ? `Je hebt ${fz} ${fz === 1 ? 'reeksbevriezer' : 'reeksbevriezers'}. Mis je een dag, dan blijft je reeks staan.` : 'Morgen staan er nieuwe opdrachten klaar.') : `Doe ze alle drie en verdien een reeksbevriezer${fz ? ` (je hebt er ${fz}, maximaal 2)` : ''}.` }));
  },
  render() {
    const old = $('#questCard');
    if (old) old.replaceWith(this.card());
  },
};

// ---------- Reeksbevriezer: overbrugt gemiste dagen als je reeks liep ----------
const Freeze = {
  apply() {
    const st = Store.stats, fr = st.frozen || (st.frozen = {});
    if (!st.freezes) return [];
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1);
    const gap = [];
    for (let i = 0; i < 7; i++) {
      const k = dayKeyOf(d);
      if (Progress.met(k) || fr[k]) break;
      gap.push(k); d.setDate(d.getDate() - 1);
    }
    const before = dayKeyOf(d);
    if (!gap.length || !(Progress.met(before) || fr[before]) || gap.length > st.freezes) return [];
    for (const k of gap) fr[k] = true;
    st.freezes -= gap.length;
    Store.saveStats();
    return gap;
  },
  check() {
    const used = this.apply();
    if (used.length) Moments.add({ key: 'frozen', prio: 4, icon: Mascot.svg('ijs', { crop: 'head' }), title: 'Je reeks is gered!', text: used.length === 1 ? 'Je reeksbevriezer heeft je reeks vastgehouden voor de dag die je miste.' : `${used.length} bevriezers hebben je reeks vastgehouden.` });
    return used;
  },
};

// ---------- Antwoorden bijhouden per onderwerp (voor de cursus) ----------
const Track = {
  answer(it, ok, topic) {
    const st = Store.stats;
    topic = topic || it._topic || 'overig';
    const t = st.topics[topic] || (st.topics[topic] = { r: 0, w: 0 });
    if (ok) t.r++; else t.w++;
    const k = it.skill || it.type, sk = st.skills[k] || (st.skills[k] = { r: 0, w: 0, t: topic });
    if (ok) sk.r++; else { sk.w++; sk.p = it.type === 'name' ? 'Welke noot is dit? (noten herkennen op de hals)' : it.prompt; }
    Score.answer(ok);
  },
};
