// ---------- Dagelijkse opdrachten, reeksbevriezer en voortgang voor de cursus ----------
const qc = (d, k) => (d.c && d.c[k]) || 0;
const QUESTS = [
  { id: 'node', cat: 'a', icon: 'path', target: () => 1, text: () => 'Rond een stap in je leerpad af', value: d => qc(d, 'nodes'), ok: () => !!nextNode() },
  { id: 'fix', cat: 'a', icon: 'plaster', target: () => Math.min(3, Bin.count()), text: n => (n === 1 ? 'Herstel een fout uit je foutenbak' : `Herstel ${n} fouten uit je foutenbak`), value: d => qc(d, 'fixed'), ok: () => Bin.items().length > 0 },
  { id: 'combo', cat: 'a', icon: 'flame', target: () => 6, text: n => `Beantwoord ${n} vragen op rij goed`, value: d => qc(d, 'combo'), ok: () => PathData.units().length > 0 },
  { id: 'notes', cat: 'b', icon: 'note', target: () => 25, text: n => `Vind ${n} noten op de hals`, value: d => qc(d, 'notes') },
  { id: 'challenge', cat: 'b', icon: 'bolt', target: () => clamp(Math.round((Store.stats.challenge.best || 12) * 0.8), 8, 40), text: n => `Haal ${n} of meer bij 60 seconden`, value: d => qc(d, 'challenge') },
  { id: 'scales', cat: 'b', icon: 'pick', target: () => 2, text: n => `Speel ${n} toonladderboxen helemaal`, value: d => qc(d, 'scales') },
  { id: 'targets', cat: 'b', icon: 'target', target: () => 12, text: n => `Raak ${n} doeltonen`, value: d => qc(d, 'targets') },
  { id: 'earq', cat: 'c', icon: 'ear', target: () => 10, text: n => `Herken ${n} intervallen of akkoorden op gehoor`, value: d => qc(d, 'earq') },
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
      Progress.addXP(10);
      UI.flash(Mascot.svg('juich', { crop: 'head' }), 'Opdracht gedaan!', `${this.text(q)}. +10 XP`, 'goal');
      Sfx.play('fixed');
    }
    if (changed && qs.every(q => d.qd[q.id]) && !d.qdAll) {
      d.qdAll = true;
      if ((Store.stats.freezes || 0) < 2) {
        Store.stats.freezes = (Store.stats.freezes || 0) + 1;
        UI.flash(Mascot.svg('ijs', { crop: 'head' }), 'Reeksbevriezer verdiend!', 'Mis je een dag, dan houdt hij je reeks vast.', 'goal');
      } else {
        Progress.addXP(20);
        UI.flash(Mascot.svg('juich', { crop: 'head' }), 'Alle opdrachten gedaan!', 'Je hebt al 2 bevriezers, dus je krijgt 20 XP extra.', 'goal');
      }
      setTimeout(() => Confetti.burst({ n: 70 }), 300);
    }
    if (changed) { Store.saveStats(); this.render(); }
  },
  // kaart bovenaan het leerpad
  card() {
    const qs = this.today(), d = Progress.day(), done = qs.filter(q => d.qd && d.qd[q.id]).length, all = done === qs.length, fz = Store.stats.freezes || 0;
    return h('section', { class: 'quests' + (all ? ' all' : ''), id: 'questCard' },
      h('div', { class: 'q-head' },
        h('div', { class: 'q-title' },
          h('h2', { text: all ? 'Alle opdrachten gedaan' : 'Opdrachten van vandaag' }),
          h('span', { class: 'q-freeze' + (fz ? ' has' : ''), title: 'Reeksbevriezers', 'aria-label': `${fz} reeksbevriezers` }, h('span', { html: ICONS.ice }), h('b', { text: `${fz} ${fz === 1 ? 'bevriezer' : 'bevriezers'}` }))),
        h('div', { class: 'q-fret', html: Mascot.svg(all ? 'juich' : 'noot') })),
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
    if (used.length) setTimeout(() => UI.flash(Mascot.svg('ijs', { crop: 'head' }), 'Je reeks is gered!', used.length === 1 ? 'Je reeksbevriezer heeft je reeks vastgehouden voor de dag die je miste.' : `${used.length} bevriezers hebben je reeks vastgehouden.`, 'goal'), 900);
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
    if (ok) sk.r++; else { sk.w++; sk.p = it.prompt; }
  },
};
const topicName = k => (TOPICS[k] && k !== 'generic' ? TOPICS[k].title : k === 'generic' ? 'eigen vragen uit de les' : k === 'review' ? 'herhalen' : k);
const shorten = (t, n = 70) => (t.length > n ? t.slice(0, n - 1).trim() + '…' : t);
function courseSummary() {
  const st = Store.stats, sk = Progress.streak(), units = PathData.units(), L = [];
  L.push(`Fretjacht-voortgang, ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  L.push(`- Oefentijd: ${Math.round(Progress.weekSecs() / 60)} minuten deze week, reeks ${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'}, dagdoel ${Math.round(Progress.goalSecs() / 60)} minuten.`);
  if (units.length) L.push(`- Leerpad: ${units.slice(-3).map(u => { const nodes = unitNodes(u), done = nodes.filter((n, k) => nodeDone(u, k)).length; return `${unitMeta(u).title} ${done} van ${nodes.length} stappen${nodeDone(u, nodes.length - 1) ? ', toets gehaald' : ''}`; }).join('; ')}.`);
  const tp = Object.entries(st.topics || {}).filter(([k, v]) => k !== 'overig' && v.r + v.w >= 3).map(([k, v]) => ({ k, pct: Math.round(100 * v.r / (v.r + v.w)), n: v.r + v.w })).sort((a, b) => a.pct - b.pct);
  if (tp.length) L.push(`- Goed per onderwerp: ${tp.map(x => `${topicName(x.k)} ${x.pct}% (${x.n} vragen)`).join(', ')}.`);
  const weakSk = Object.values(st.skills || {}).filter(v => v.w >= 2 && v.p).sort((a, b) => b.w / (b.r + b.w) - a.w / (a.r + a.w)).slice(0, 3);
  if (weakSk.length) L.push(`- Vaak fout: ${weakSk.map(v => `“${shorten(v.p)}” (${v.w} van ${v.r + v.w} fout)`).join(', ')}.`);
  const bin = Bin.list();
  if (bin.length) L.push(`- Nog in de foutenbak (${bin.length}): ${bin.slice(-4).map(x => `“${shorten(x.it.prompt)}”`).join(', ')}.`);
  const rows = Object.entries(st.notes.items).filter(([, v]) => v.n > 0).map(([k, v]) => { const [s, pc] = k.split('-').map(Number); return { s, pc, avg: v.total / v.n }; }).sort((a, b) => b.avg - a.avg).slice(0, 3);
  if (rows.length) L.push(`- Traagst op de hals: ${rows.map(r => `${pcLabel(r.pc, 'sharps')} op de ${STR_NAME[r.s]} (${fmt1(r.avg)} s)`).join(', ')}.`);
  const eq = st.earq || { ok: {}, n: {} };
  const ear = Object.keys(eq.n).filter(k => eq.n[k] >= 3).map(k => ({ k, pct: Math.round(100 * (eq.ok[k] || 0) / eq.n[k]) })).sort((a, b) => a.pct - b.pct).slice(0, 3);
  if (ear.length) L.push(`- Op gehoor: ${ear.map(x => `${earName(x.k)} ${x.pct}%`).join(', ')}.`);
  const tg = st.targets;
  if (tg && tg.tries) {
    const by = Object.entries(tg.by || {}).filter(([, v]) => v.t >= 3).map(([k, v]) => ({ k, pct: Math.round(100 * v.h / v.t) })).sort((a, b) => a.pct - b.pct);
    L.push(`- Doeltonen: ${tg.hits} van ${tg.tries} geraakt${tg.hits ? `, gemiddeld ${fmt1(tg.time / tg.hits)} s` : ''}${by.length ? `; lastigst: de ${TARGET_NAME[by[0].k] || by[0].k} (${by[0].pct}%)` : ''}.`);
  }
  if (st.ear && Object.keys(st.ear.ok || {}).length) L.push(`- Op gehoor naspelen: ${Object.values(st.ear.ok).reduce((a, b) => a + b, 0)} keer goed.`);
  L.push('Stem de volgende lessen en oefeningen hier graag op af.');
  return L.join('\n');
}
async function copyCourseSummary(out) {
  const text = courseSummary();
  out.hidden = false;
  out.textContent = text;
  try {
    await navigator.clipboard.writeText(text);
    UI.flash(Mascot.svg('boek', { crop: 'head' }), 'Gekopieerd', 'Plak het als reactie op je volgende les.', 'goal');
  } catch (e) {
    const r = document.createRange(); r.selectNodeContents(out);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    UI.flash(ICONS.book, 'Kopieer de tekst hieronder', 'Hij staat al geselecteerd.', 'badge');
  }
}
