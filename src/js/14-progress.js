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
  // extra minuten als beloning (bijvoorbeeld een lege foutenbak)
  addBonus(secs) {
    const d = this.day(), before = d.secs;
    d.secs += secs; d.bonus = (d.bonus || 0) + secs;
    Store.saveStats(); this.renderTop();
    if (before < this.goalSecs() && d.secs >= this.goalSecs()) this.goalReached();
  },
  tick() {
    const v = document.body.dataset.view;
    const practicing = document.visibilityState === 'visible' && Activity.active() && (v === 'lesson' || (v === 'mode' && (Engine.mic || (current && current.noMic))));
    if (!practicing) return;
    const d = this.day(), before = d.secs;
    d.secs++;
    if (v === 'mode' && ++this.drillSecs >= 30) { this.drillSecs = 0; this.addXP(1); }
    if (v === 'mode' && current && current.id) { const md = Store.stats.modeDays || (Store.stats.modeDays = {}); md[current.id] = todayKey(); }
    if (before < this.goalSecs() && d.secs >= this.goalSecs()) this.goalReached();
    if (d.secs % 5 === 0) { Store.saveStats(); Quests.check(); }
    this.renderTop();
  },
  // reeks: aaneengesloten dagen met je dagdoel; een bevroren dag houdt de reeks vast maar telt niet mee
  streak() {
    const fr = Store.stats.frozen || {}, d = new Date(), today = this.met(dayKeyOf(d));
    d.setHours(12, 0, 0, 0);
    if (!today) d.setDate(d.getDate() - 1);
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      const k = dayKeyOf(d);
      if (this.met(k)) n++; else if (!fr[k]) break;
      d.setDate(d.getDate() - 1);
    }
    return { n, today };
  },
  bestStreak() {
    const fr = Store.stats.frozen || {};
    const keys = Array.from(new Set(Object.keys(Store.stats.days).filter(k => this.met(k)).concat(Object.keys(fr)))).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const d = new Date(k + 'T12:00:00');
      if (!(prev && Math.round((d - prev) / 86400000) === 1)) run = 0;
      if (this.met(k)) run++;
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
    UI.flash(Mascot.svg('juich', { crop: 'head' }), 'Dagdoel gehaald!', sk.n === 1 ? 'Je reeks is begonnen.' : `${sk.n} dagen op rij.`, 'goal');
    // de mijlpaal voor je eerste dagdoel zegt hetzelfde als deze melding
    Badges.check({ skip: ['goal'] });
    Confetti.burst({ n: 110, y: innerHeight * 0.3 });
    Sfx.play('goal');
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

// ---------- Mijlpalen: plectrums ----------
const BADGES = [
  { id: 'first', icon: 'note', pick: '#F5A31A', title: 'Eerste noot', desc: 'Je eerste les in het leerpad', test: s => Object.values(s.path.nodes).some(n => n.done) },
  { id: 'goal', icon: 'flame', pick: 'tortoise', title: 'Soundcheck', desc: 'Een keer je dagdoel gehaald', test: () => Progress.daysMet() >= 1 },
  { id: 'streak3', icon: 'flame', pick: '#2D6BD4', title: 'Trio', desc: '3 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 3 },
  { id: 'streak7', icon: 'flame', pick: '#7146D4', title: 'Septiem', desc: '7 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 7 },
  { id: 'streak30', icon: 'flame', pick: '#C4336F', title: 'Op tournee', desc: '30 dagen op rij je dagdoel', test: () => Progress.bestStreak() >= 30 },
  { id: 'perfect', icon: 'check', pick: 'pearl', title: 'Zuiver', desc: 'Een les zonder fouten', test: s => Object.values(s.path.nodes).some(n => n.perfect) },
  { id: 'unit', icon: 'trophy', pick: '#2B1A14', title: 'Eerste plaat', desc: 'Een unittoets gehaald', test: s => Object.values(s.path.nodes).some(n => n.test && n.done) },
  { id: 'bin', icon: 'plaster', pick: 'pearl', title: 'Pleister erop', desc: 'Je foutenbak helemaal leeggemaakt', test: s => (s.binCleared || 0) >= 1 },
  { id: 'srs10', icon: 'retry', pick: '#1F6FA8', title: 'Uit het hoofd', desc: '10 fouten onder de knie gekregen', test: s => (s.srsDone || 0) >= 10 },
  { id: 'xp100', icon: 'bolt', pick: '#0B7D72', title: 'Demo', desc: '100 XP verdiend', test: s => (s.xp || 0) >= 100 },
  { id: 'xp500', icon: 'bolt', pick: '#B4520E', title: 'Single', desc: '500 XP verdiend', test: s => (s.xp || 0) >= 500 },
  { id: 'xp1000', icon: 'bolt', pick: 'gold', title: 'Album', desc: '1000 XP verdiend', test: s => (s.xp || 0) >= 1000 },
  { id: 'notes100', icon: 'note', pick: 'tortoise', title: 'Notenjager', desc: '100 noten gevonden bij Noten zoeken', test: s => s.notes.found >= 100 },
  { id: 'speed25', icon: 'bolt', pick: '#C4336F', title: 'Shredder', desc: '25 noten in 60 seconden', test: s => s.challenge.best >= 25 },
  { id: 'hours5', icon: 'clock', pick: '#566170', title: 'Repetitieruimte', desc: '5 uur geoefend in totaal', test: () => Progress.totalSecs() >= 18000 },
];
// plectrum als SVG; speciale kleuren: schildpad, parelmoer en goud
let pickSeq = 0;
function pickBadge(b, got) {
  const id = 'pk' + (++pickSeq);
  const shape = 'M32 3c17 0 29 6 29 17 0 16-16 33-29 41C19 53 3 36 3 20 3 9 15 3 32 3z';
  let fill = b.pick, ink = '#FFFFFF', defs = '';
  if (!got) { fill = 'var(--led-off)'; ink = 'var(--muted)'; }
  else if (b.pick === 'tortoise') {
    defs = `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#8A4B22"/><path d="M2 3c5-2 8 2 6 6s-6 3-7 0zM13 11c4-1 7 3 5 6s-6 2-6-1zM14 1c2 0 3 2 2 3s-3 0-2-3z" fill="#3B1D0E" opacity=".8"/><path d="M8 14c3 0 4 3 2 5s-5 0-4-2z" fill="#D0893E" opacity=".7"/></pattern>`;
    fill = `url(#${id})`;
  } else if (b.pick === 'pearl') {
    defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#EDE6F2"/><stop offset=".7" stop-color="#E2F0EC"/><stop offset="1" stop-color="#F6EBDD"/></linearGradient>`;
    fill = `url(#${id})`; ink = '#0B7D72';
  } else if (b.pick === 'gold') {
    defs = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".55" stop-color="#E2A92B"/><stop offset="1" stop-color="#B57A12"/></linearGradient>`;
    fill = `url(#${id})`; ink = '#5A3500';
  } else if (b.pick === '#F5A31A') ink = '#2B1A14';
  if (got && b.id === 'unit') ink = '#F5A31A';
  const icon = (ICONS[b.icon] || '').replace('class="ico"', `class="pk-ico" x="20" y="14" width="24" height="24" color="${ink}"`);
  return `<svg viewBox="0 0 64 64" class="pickb${got ? ' got' : ''}" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}<path d="${shape}" fill="${fill}" ${got ? 'stroke="rgba(0,0,0,.18)" stroke-width="1.5"' : 'stroke="var(--line)" stroke-width="2" stroke-dasharray="4 4"'}/>${got ? '<path d="M17 12c6-4 18-5 26-1" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".45"/>' : ''}${icon}</svg>`;
}
const Badges = {
  // geeft de nieuw behaalde mijlpalen terug; quiet: geen melding (het eindscherm toont ze zelf)
  check(o = {}) {
    const s = Store.stats; s.badges = s.badges || {};
    const fresh = [];
    for (const b of BADGES) if (!s.badges[b.id] && b.test(s)) { s.badges[b.id] = todayKey(); fresh.push(b); }
    if (fresh.length) Store.saveStats();
    if (!o.quiet) for (const b of fresh) if (!(o.skip || []).includes(b.id)) UI.flash(pickBadge(b, true), `Nieuwe mijlpaal: ${b.title}`, b.desc, 'badge');
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
      const label = `${day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}: ${Math.round(secs / 60)} min${(Store.stats.frozen || {})[k] ? ', bevroren' : ''}`;
      g += `<rect class="cal-c l${lv}${k === todayKey() ? ' today' : ''}${(Store.stats.frozen || {})[k] ? ' frozen' : ''}" x="${L + w * (cell + gap)}" y="${T + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" tabindex="0" data-label="${label}" aria-label="${label}"></rect>`;
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
// mijlpalen als plectrums (ook in de lege staat: als doelen)
function badgesCard() {
  const got = Store.stats.badges || {}, n = Object.keys(got).length;
  return h('div', { class: 'card' }, h('h2', { class: 'card-h', text: 'Mijlpalen' }), h('p', { class: 'help', text: n ? `${n} van de ${BADGES.length} plectrums verzameld.` : `Nog geen plectrums. Je eerste verdien je met je eerste les; er zijn er ${BADGES.length} te verzamelen.` }),
    h('div', { class: 'badges' }, BADGES.map(b => h('div', { class: 'badge' + (got[b.id] ? ' got' : '') }, h('span', { class: 'b-pick', html: pickBadge(b, !!got[b.id]) }), h('b', { text: b.title }), h('small', { text: got[b.id] ? `${b.desc}. ${niceDate(got[b.id])}` : b.desc })))));
}
// nog nooit geoefend: één grote uitnodiging, en wat je hier straks ziet
function renderProgressEmpty(view) {
  view.append(emptyHero('progress'));
  const li = (icon, b, t) => h('li', {}, h('span', { class: 'pv-ico', html: icon }), h('span', {}, h('b', { text: b }), h('small', { text: t })));
  view.append(h('div', { class: 'card preview' }, h('h2', { class: 'card-h', text: 'Wat je hier straks ziet' }),
    h('ul', { class: 'pv-list' },
      li(ICONS.flame, 'Je reeks', `elke dag dat je ${Math.round(Progress.goalSecs() / 60)} minuten oefent`),
      li(ICONS.chart, 'Je oefenkalender', 'hoe vaak en hoe lang je speelt'),
      li(ICONS.retry, 'Herhalen', 'fouten komen terug na 1, 3 en 7 dagen'),
      li(ICONS.book, 'Voor je les', 'je zwakke plekken, klaar om te kopiëren'))));
  view.append(badgesCard());
  view.append(h('div', { class: 'row links' }, h('a', { class: 'link', href: '#instellingen', text: 'Instellingen' })));
}
function renderProgress(view) {
  Badges.check();
  if (isFresh()) return renderProgressEmpty(view);
  const st = Store.stats, sk = Progress.streak(), goalMin = Math.round(Progress.goalSecs() / 60);
  const left = Math.max(0, Math.ceil((Progress.goalSecs() - Progress.day().secs) / 60)), idle = Progress.day().secs <= 0;
  const fz = Store.stats.freezes || 0, yest = new Date(); yest.setDate(yest.getDate() - 1);
  const mood = (Store.stats.frozen || {})[dayKeyOf(yest)] ? 'ijs' : sk.today ? 'juich' : idle ? 'slaap' : sk.n ? 'blij' : 'slaap';
  const msg = sk.today ? `Vandaag gehaald. Morgen weer ${goalMin} minuten om je reeks te houden.`
    : idle ? `Je hebt vandaag nog geen oefensessies gedaan. ${sk.n ? `Met ${goalMin} minuten houd je je reeks vast.` : `Met ${goalMin} minuten begin je een nieuwe reeks.`}`
    : sk.n ? `Nog ${left} ${left === 1 ? 'minuut' : 'minuten'} vandaag, anders begint je reeks morgen opnieuw.` : `Nog ${left} ${left === 1 ? 'minuut' : 'minuten'} vandaag om een reeks te beginnen.`;
  view.append(h('section', { class: 'streak-card' + (idle ? ' idle' : '') },
    h('div', { class: 'sc-fret', html: Mascot.svg(mood) }),
    h('div', { class: 'sc-text' },
      h('p', { class: 'sc-n' }, h('span', { html: ICONS.flame }), h('b', { text: String(sk.n) }), h('span', { text: sk.n === 1 ? 'dag op rij' : 'dagen op rij' })),
      h('p', { class: 'help', text: msg }),
      idle ? h('button', { class: 'sc-go', type: 'button', onclick: () => Daily.showPlan() }, h('span', { html: ICONS.play }), h('span', { text: 'Oefen vandaag' })) : null,
      h('p', { class: 'sc-freeze' }, h('span', { html: ICONS.ice }), fz ? `${fz} ${fz === 1 ? 'reeksbevriezer' : 'reeksbevriezers'} op voorraad` : 'Nog geen reeksbevriezer. Doe de drie opdrachten van een dag.'))));
  const tile = (label, value, sub, icon, onclick) => h(onclick ? 'button' : 'div', { class: 'tile' + (onclick ? ' tap' : ''), type: onclick ? 'button' : null, onclick },
    h('span', { class: 'tile-l' }, icon ? h('span', { class: 'tile-ico', html: icon }) : null, label), h('b', { class: 'tile-v', text: value }), sub ? h('small', { text: sub }) : null);
  const wk = Math.round(Progress.weekSecs() / 60), todo = Srs.todoCount(), known = st.srsDone || 0, nxt = Srs.next();
  view.append(h('section', { class: 'kpis' },
    tile('XP', String(st.xp || 0), 'totaal', ICONS.bolt),
    tile('Deze week', `${wk}`, 'minuten', ICONS.clock),
    tile('Beste reeks', String(Progress.bestStreak()), Progress.bestStreak() === 1 ? 'dag' : 'dagen', ICONS.flame),
    tile('Herhalen', String(todo), todo ? 'tik om te herhalen' : nxt ? `${Srs.when(nxt.date)} ${nxt.n} terug` : known ? `${known} onder de knie` : 'niets vandaag', ICONS.retry, todo ? () => Srs.start() : null)));
  const sumOut = h('pre', { class: 'cc-out', hidden: true });
  view.append(h('div', { class: 'card course-card' },
    h('div', { class: 'cc-fret', html: Mascot.svg('boek') }),
    h('div', { class: 'cc-text' },
      h('h2', { class: 'card-h', text: 'Voor je muziektheorieles' }),
      h('p', { class: 'help', text: 'Kopieer je voortgang en plak hem als reactie op je volgende les. Dan stem ik de lessen af op wat je nog lastig vindt.' }),
      h('button', { class: 'primary', type: 'button', id: 'copyProgress', html: `${ICONS.copy}<span>Kopieer voortgang</span>`, onclick: () => copyCourseSummary(sumOut) })),
    sumOut));
  const calInfo = h('p', { class: 'chart-info', text: 'Tik op een dag voor de minuten' });
  view.append(h('div', { class: 'card' }, h('h2', { class: 'card-h', text: 'Oefenkalender' }), h('p', { class: 'help', text: 'De laatste 16 weken. Hoe donkerder, hoe langer je oefende. De donkerste kleur is je dagdoel gehaald.' }), renderCalendar(calInfo),
    h('div', { class: 'cal-legend', html: `<span>minder</span>${[0, 1, 2, 3, 4].map(l => `<i class="l${l}"></i>`).join('')}<span>dagdoel</span>` }), calInfo));
  const wkInfo = h('p', { class: 'chart-info', text: wk ? 'Tik op een dag voor de minuten' : '' });
  const wkChart = renderWeekChart(wkInfo);
  if (!wk) wkChart.append(h('p', { class: 'chart-empty', text: 'Nog geen minuten deze week. Je eerste balkje verschijnt zodra je gaat spelen.' }));
  view.append(h('div', { class: 'card' }, h('h2', { class: 'card-h', text: 'Deze week' }), h('p', { class: 'help', text: `Minuten per dag. De lijn is je dagdoel van ${goalMin} minuten.` }), wkChart, wkInfo));
  const units = PathData.units();
  view.append(h('div', { class: 'card' }, h('h2', { class: 'card-h', text: 'Leerpad' }),
    units.length ? h('div', { class: 'unit-list' }, units.map((u, i) => {
      const nodes = unitNodes(u), done = nodes.filter((n, k) => nodeDone(u, k)).length, test = nodeDone(u, nodes.length - 1);
      return h('div', { class: `ul-row c-${UNIT_COLORS[i % UNIT_COLORS.length]}` }, h('div', { class: 'ul-t' }, h('b', { text: `Unit ${i + 1}: ${unitMeta(u).title}` }), h('span', { class: 'help', text: test ? 'unittoets gehaald' : `${done} van ${nodes.length} stappen` })), h('div', { class: 'progress' }, h('span', { style: `width:${(100 * done / nodes.length).toFixed(0)}%` })));
    })) : h('p', { class: 'help', text: 'Na les 1 verschijnt hier je eerste unit.' })));
  view.append(badgesCard());
  const r = st.bends.recent, bendAvg = r.length ? Math.round(r.reduce((a, b) => a + Math.abs(b), 0) / r.length) : null;
  const earOk = Object.values(st.ear.ok).reduce((a, b) => a + b, 0);
  const rows = [
    ['Noten zoeken', st.notes.found ? `gemiddeld ${fmt1(st.notes.totalTime / st.notes.found)} s, snelste ${st.notes.best != null ? fmt1(st.notes.best) + ' s' : '–'}` : 'nog niet geoefend'],
    ['60 seconden', st.challenge.best ? `record ${st.challenge.best} noten` : 'nog niet gespeeld'],
    ['Toonladders', Object.keys(st.scales.best).length ? `${Object.keys(st.scales.best).length} boxen met een record` : 'nog geen record'],
    ['Bends', bendAvg != null ? `gemiddeld ${bendAvg} cent ernaast` : 'nog niet geoefend'],
    ['Op gehoor', earOk ? `${earOk} keer goed nagespeeld` : 'nog niet geoefend'],
    ['Totaal geoefend', `${Math.round(Progress.totalSecs() / 60)} minuten`],
  ];
  view.append(h('div', { class: 'card hard' }, h('h2', { class: 'card-h', text: 'Records' }), h('ol', {}, rows.map(([a, b]) => h('li', {}, h('span', { text: a }), h('span', { text: b })))),
    h('div', { class: 'row links' }, h('a', { class: 'link', href: '#m-heatmap', text: 'Hittekaart van de hals' }), h('a', { class: 'link', href: '#instellingen', text: 'Instellingen' }))));
}
