// ---------- Oefentijd, XP, reeks ----------
const Activity = {
  last: -1e9,
  ping() { this.last = performance.now(); },
  active() { return performance.now() - this.last < 60000; },
};
document.addEventListener('pointerdown', () => Activity.ping(), { passive: true });
document.addEventListener('keydown', () => Activity.ping());

const dayKeyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const Progress = {
  drillSecs: 0,
  goalSecs() { return (Store.settings.goal || 15) * 60; },
  day(k) { const d = Store.stats.days; k = k || todayKey(); if (!d[k]) d[k] = { secs: 0, xp: 0 }; return d[k]; },
  peek(k) { return Store.stats.days[k] || { secs: 0, xp: 0 }; },
  addXP(n) { Store.stats.xp = (Store.stats.xp || 0) + n; this.day().xp += n; Store.saveStats(); this.renderTop(); },
  met(k) { return this.peek(k).secs >= this.goalSecs(); },
  tick() {
    const v = document.body.dataset.view;
    const practicing = document.visibilityState === 'visible' && Activity.active() && (v === 'lesson' || (v === 'mode' && Engine.mic));
    if (!practicing) return;
    const d = this.day(), before = d.secs;
    d.secs++;
    if (v === 'mode' && ++this.drillSecs >= 30) { this.drillSecs = 0; this.addXP(1); }
    if (before < this.goalSecs() && d.secs >= this.goalSecs()) this.goalReached();
    if (d.secs % 5 === 0) Store.saveStats();
    this.renderTop();
  },
  streak() {
    const d = new Date(), today = this.met(dayKeyOf(d));
    if (!today) d.setDate(d.getDate() - 1);
    let n = 0;
    while (this.met(dayKeyOf(d))) { n++; d.setDate(d.getDate() - 1); }
    return { n, today };
  },
  bestStreak() {
    const keys = Object.keys(Store.stats.days).filter(k => this.met(k)).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const d = new Date(k + 'T12:00:00');
      run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    }
    return best;
  },
  daysMet() { return Object.keys(Store.stats.days).filter(k => this.met(k)).length; },
  totalSecs() { return Object.values(Store.stats.days).reduce((a, d) => a + (d.secs || 0), 0); },
  weekSecs() {
    const d = new Date(); let s = 0;
    const dow = (d.getDay() + 6) % 7;
    for (let i = 0; i <= dow; i++) { const x = new Date(d); x.setDate(d.getDate() - i); s += this.peek(dayKeyOf(x)).secs; }
    return s;
  },
  goalReached() {
    Store.saveStats();
    const sk = this.streak();
    UI.flash(ICONS.flame, 'Dagdoel gehaald!', sk.n === 1 ? 'Je reeks is begonnen.' : `${sk.n} dagen op rij.`, 'goal');
    // de mijlpaal 'Dagdoel gehaald' zegt hetzelfde als deze melding
    Badges.check({ skip: ['goal'] });
    if (Engine.ctx) Engine.chime();
  },
  renderTop() {
    const sk = this.streak(), secs = this.day().secs, goal = this.goalSecs();
    const s = $('#streakChip');
    if (s) { $('b', s).textContent = String(sk.n); s.classList.toggle('lit', sk.today); s.setAttribute('aria-label', `Reeks: ${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'}${sk.today ? ', vandaag gehaald' : ''}`); }
    const g = $('#goalChip');
    if (g) {
      const pct = clamp(secs / goal, 0, 1);
      $('b', g).textContent = `${Math.floor(secs / 60)}/${Math.round(goal / 60)}`;
      const c = $('.ring-fg', g);
      if (c) c.setAttribute('stroke-dasharray', `${(pct * 62.83).toFixed(2)} 62.83`);
      g.classList.toggle('lit', pct >= 1);
      g.setAttribute('aria-label', `Dagdoel: ${Math.floor(secs / 60)} van ${Math.round(goal / 60)} minuten`);
    }
  },
  goalLine() {
    const secs = this.day().secs, goal = this.goalSecs(), pct = clamp(secs / goal, 0, 1);
    return h('div', { class: 'goal-line' },
      h('div', { class: 'gl-text' }, h('span', { text: 'Dagdoel' }), h('b', { text: pct >= 1 ? 'gehaald' : `${Math.floor(secs / 60)} van ${Math.round(goal / 60)} min` })),
      h('div', { class: 'progress' }, h('span', { style: `width:${(pct * 100).toFixed(1)}%` })));
  },
};
setInterval(() => Progress.tick(), 1000);

// ---------- Mijlpalen ----------
const BADGES = [
  { id: 'first', icon: 'star', title: 'Eerste stap', desc: 'Je eerste les in het leerpad', test: s => Object.values(s.path.nodes).some(n => n.done) },
  { id: 'goal', icon: 'flame', title: 'Dagdoel gehaald', desc: 'Een dag je dagdoel gehaald', test: () => Progress.daysMet() >= 1 },
  { id: 'streak3', icon: 'flame', title: 'Drie op rij', desc: '3 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 3 },
  { id: 'streak7', icon: 'flame', title: 'Een week vol', desc: '7 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 7 },
  { id: 'streak30', icon: 'flame', title: 'Een maand vol', desc: '30 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 30 },
  { id: 'perfect', icon: 'check', title: 'Foutloos', desc: 'Een les zonder fouten', test: s => Object.values(s.path.nodes).some(n => n.perfect) },
  { id: 'unit', icon: 'trophy', title: 'Unit voltooid', desc: 'Een unittoets gehaald', test: s => Object.values(s.path.nodes).some(n => n.test && n.done) },
  { id: 'xp100', icon: 'bolt', title: '100 XP', desc: '100 XP verdiend', test: s => (s.xp || 0) >= 100 },
  { id: 'xp500', icon: 'bolt', title: '500 XP', desc: '500 XP verdiend', test: s => (s.xp || 0) >= 500 },
  { id: 'xp1000', icon: 'bolt', title: '1000 XP', desc: '1000 XP verdiend', test: s => (s.xp || 0) >= 1000 },
  { id: 'notes100', icon: 'note', title: '100 noten', desc: '100 noten gevonden bij Noten zoeken', test: s => s.notes.found >= 100 },
  { id: 'speed25', icon: 'bolt', title: 'Snelle vingers', desc: '25 noten in 60 seconden', test: s => s.challenge.best >= 25 },
  { id: 'hours5', icon: 'clock', title: 'Vijf uur', desc: '5 uur geoefend in totaal', test: () => Progress.totalSecs() >= 18000 },
];
const Badges = {
  // geeft de nieuw behaalde mijlpalen terug; quiet: geen melding (het eindscherm toont ze zelf)
  check(o = {}) {
    const s = Store.stats; s.badges = s.badges || {};
    const fresh = [];
    for (const b of BADGES) if (!s.badges[b.id] && b.test(s)) { s.badges[b.id] = todayKey(); fresh.push(b); }
    if (fresh.length) Store.saveStats();
    if (!o.quiet) for (const b of fresh) if (!(o.skip || []).includes(b.id)) UI.flash(ICONS[b.icon], `Nieuwe mijlpaal: ${b.title}`, b.desc, 'badge');
    return fresh;
  },
};

// ---------- Voortgang-scherm ----------
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const WD = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
function calLevel(secs) {
  const goal = Progress.goalSecs();
  if (secs <= 0) return 0;
  if (secs >= goal) return 4;
  if (secs >= goal * 0.66) return 3;
  if (secs >= goal * 0.33) return 2;
  return 1;
}
function renderCalendar(infoEl) {
  const weeks = 16, cell = 15, gap = 3, L = 22, T = 16;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today); start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const W = L + weeks * (cell + gap), H = T + 7 * (cell + gap);
  let g = '';
  const monthOf = w => { const x = new Date(start); x.setDate(start.getDate() + w * 7); return x.getMonth(); };
  for (let w = 0; w < weeks; w++) {
    const m = monthOf(w);
    const label = w === 0 ? monthOf(1) === m && monthOf(2) === m : m !== monthOf(w - 1);
    if (label) g += `<text class="cal-m" x="${L + w * (cell + gap)}" y="10">${MONTHS[m]}</text>`;
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day > today) continue;
      const k = dayKeyOf(day), secs = Progress.peek(k).secs, lv = calLevel(secs);
      const label = `${day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}: ${Math.round(secs / 60)} min`;
      g += `<rect class="cal-c l${lv}${k === todayKey() ? ' today' : ''}" x="${L + w * (cell + gap)}" y="${T + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" tabindex="0" data-label="${label}" aria-label="${label}"></rect>`;
    }
  }
  [0, 2, 4].forEach(d => { g += `<text class="cal-wd" x="0" y="${T + d * (cell + gap) + cell - 3}">${WD[d]}</text>`; });
  const svg = h('div', { class: 'cal-wrap', html: `<svg class="cal" viewBox="0 0 ${W} ${H}" role="img" aria-label="Oefenkalender van de laatste ${weeks} weken">${g}</svg>` });
  const show = e => { const c = e.target.closest && e.target.closest('.cal-c'); if (c) { infoEl.textContent = c.dataset.label; $$('.cal-c.sel', svg).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); } };
  svg.addEventListener('pointerover', show); svg.addEventListener('pointerdown', show); svg.addEventListener('focusin', show);
  return svg;
}
function renderWeekChart(infoEl) {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7, goalMin = Progress.goalSecs() / 60;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - dow + i); const k = dayKeyOf(d); return { d, k, min: d > today ? null : Progress.peek(k).secs / 60, isToday: i === dow }; });
  const maxV = Math.max(goalMin, ...days.map(x => x.min || 0));
  const step = maxV > 40 ? 20 : maxV > 20 ? 10 : 5;
  const top = Math.ceil((maxV * 1.1) / step) * step;
  const W = 340, H = 170, L = 30, R = 34, T = 14, B = 26;
  const Y = v => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - R) / 7, bw = Math.min(24, slot * 0.55);
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  days.forEach((x, i) => {
    const cx = L + slot * (i + 0.5);
    g += `<text class="tick${x.isToday ? ' now' : ''}" x="${cx}" y="${H - 8}" text-anchor="middle">${WD[i]}</text>`;
    if (x.min == null) return;
    const v = x.min, y = Y(v), base = Y(0), hgt = base - y, r = Math.min(4, hgt);
    const label = `${x.d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}: ${Math.round(v)} min`;
    if (hgt > 0.5) g += `<path class="bar${x.isToday ? ' now' : ''}" d="M${cx - bw / 2} ${base} V${y + r} Q${cx - bw / 2} ${y} ${cx - bw / 2 + r} ${y} H${cx + bw / 2 - r} Q${cx + bw / 2} ${y} ${cx + bw / 2} ${y + r} V${base} Z"/>`;
    g += `<rect class="hit" x="${cx - slot / 2}" y="${T}" width="${slot}" height="${H - T - B}" tabindex="0" data-label="${label}" aria-label="${label}"/>`;
    if (x.isToday && v > 0) g += `<text class="val" x="${cx}" y="${y - 6}" text-anchor="middle">${Math.round(v)}</text>`;
  });
  g += `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(goalMin)}" y2="${Y(goalMin)}"/><text class="goal-t" x="${W - R + 4}" y="${Y(goalMin) + 3}">doel</text>`;
  const el = h('div', { class: 'week-wrap', html: `<svg class="week" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minuten geoefend per dag deze week">${g}</svg>` });
  const show = e => { const c = e.target.closest && e.target.closest('.hit'); if (c) infoEl.textContent = c.dataset.label; };
  el.addEventListener('pointerover', show); el.addEventListener('pointerdown', show); el.addEventListener('focusin', show);
  return el;
}
function renderProgress(view) {
  Badges.check();
  const st = Store.stats, sk = Progress.streak();
  const tile = (label, value, sub, icon) => h('div', { class: 'tile' }, h('span', { class: 'tile-l' }, icon ? h('span', { class: 'tile-ico', html: icon }) : null, label), h('b', { class: 'tile-v', text: value }), sub ? h('small', { text: sub }) : null);
  const wk = Math.round(Progress.weekSecs() / 60);
  view.append(h('section', { class: 'kpis' },
    tile('Reeks', String(sk.n), sk.today ? 'vandaag gehaald' : sk.n ? 'oefen vandaag om hem te houden' : 'haal je dagdoel', ICONS.flame),
    tile('Beste reeks', String(Progress.bestStreak()), 'dagen'),
    tile('XP', String(st.xp || 0), 'totaal', ICONS.bolt),
    tile('Deze week', `${wk}`, 'minuten', ICONS.clock)));
  const calInfo = h('p', { class: 'chart-info', text: 'Tik op een dag voor de minuten' });
  view.append(h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Oefenkalender' }), h('p', { class: 'help', text: 'De laatste 16 weken. Hoe donkerder, hoe langer je oefende; de donkerste kleur is je dagdoel gehaald.' }), renderCalendar(calInfo),
    h('div', { class: 'cal-legend', html: `<span>minder</span>${[0, 1, 2, 3, 4].map(l => `<i class="l${l}"></i>`).join('')}<span>dagdoel</span>` }), calInfo));
  const wkInfo = h('p', { class: 'chart-info', text: 'Tik op een dag voor de minuten' });
  view.append(h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Deze week' }), h('p', { class: 'help', text: `Minuten per dag. De lijn is je dagdoel van ${Math.round(Progress.goalSecs() / 60)} minuten.` }), renderWeekChart(wkInfo), wkInfo));
  const units = PathData.units();
  view.append(h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Leerpad' }),
    units.length ? h('div', { class: 'unit-list' }, units.map((u, i) => {
      const nodes = unitNodes(u), done = nodes.filter((n, k) => nodeDone(u, k)).length, test = nodeDone(u, nodes.length - 1);
      return h('div', { class: 'ul-row' }, h('div', { class: 'ul-t' }, h('b', { text: `Unit ${i + 1} · ${unitMeta(u).title}` }), h('span', { class: 'help', text: test ? 'unittoets gehaald' : `${done} van ${nodes.length} stappen` })), h('div', { class: 'progress' }, h('span', { style: `width:${(100 * done / nodes.length).toFixed(0)}%` })));
    })) : h('p', { class: 'help', text: 'Na les 1 verschijnt hier je eerste unit.' })));
  const got = st.badges || {};
  view.append(h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: `Mijlpalen · ${Object.keys(got).length} van ${BADGES.length}` }),
    h('div', { class: 'badges' }, BADGES.map(b => h('div', { class: 'badge' + (got[b.id] ? ' got' : '') }, h('span', { class: 'b-ico', html: ICONS[b.icon] }), h('b', { text: b.title }), h('small', { text: got[b.id] ? `${niceDate(got[b.id])}` : b.desc }))))));
  const r = st.bends.recent, bendAvg = r.length ? Math.round(r.reduce((a, b) => a + Math.abs(b), 0) / r.length) : null;
  const earOk = Object.values(st.ear.ok).reduce((a, b) => a + b, 0);
  const rows = [
    ['Noten zoeken', st.notes.found ? `gemiddeld ${fmt1(st.notes.totalTime / st.notes.found)} s · snelste ${st.notes.best != null ? fmt1(st.notes.best) + ' s' : '–'}` : 'nog niet geoefend'],
    ['60 seconden', st.challenge.best ? `record ${st.challenge.best} noten` : 'nog niet gespeeld'],
    ['Toonladders', Object.keys(st.scales.best).length ? `${Object.keys(st.scales.best).length} boxen met een record` : 'nog geen record'],
    ['Bends', bendAvg != null ? `gemiddeld ${bendAvg} cent ernaast` : 'nog niet geoefend'],
    ['Op gehoor', earOk ? `${earOk} keer goed nagespeeld` : 'nog niet geoefend'],
    ['Totaal geoefend', `${Math.round(Progress.totalSecs() / 60)} minuten`],
  ];
  view.append(h('div', { class: 'card hard' }, h('p', { class: 'eyebrow', text: 'Records' }), h('ol', {}, rows.map(([a, b]) => h('li', {}, h('span', { text: a }), h('span', { text: b })))),
    h('div', { class: 'row links' }, h('a', { class: 'link', href: '#m-heatmap', text: 'Hittekaart van de hals ›' }), h('a', { class: 'link', href: '#instellingen', text: 'Instellingen ›' }))));
}
