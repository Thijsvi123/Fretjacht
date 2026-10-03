// ---------- Welke noot? De hals oefenen zonder gitaar ----------
// Twee soorten: Welke noot? (een stip op de hals, kies de noot) en Zoek de noot (tik alle plekken aan).
// Plekken die je vaak fout hebt of traag weet, komen vaker. De halskaart laat zien hoe goed je elke plek kent.
registerMode({
  id: 'noteq', group: 'hals', title: 'Welke noot?', desc: 'Noten op de hals herkennen en zoeken, zonder gitaar', noMic: true,
  homeStat: st => (st.fb && st.fb.n ? `${Math.round(100 * st.fb.ok / st.fb.n)}% goed · ${st.fb.found} gevonden` : ''),
  mount(view) {
    const s = Store.settings.noteq;
    this.card = h('div', { class: 'card prompt nq-card' });
    this.statsEl = h('div', { class: 'card nq-stats' });
    const L = exLayout(view, {
      prompt: this.card, neck: false, mic: false,
      actions: [{ id: 'nqSkip', label: 'Overslaan', key: 's', onClick: () => { DrillFx.reset(this.streakBox); this.next(); } }],
      options: [
        field('Snaren', chips([5, 4, 3, 2, 1, 0].map(i => ({ value: i, label: `${STR_LETTER[i]}<small>${i + 1}</small>` })), s.strings.map(String), v => { s.strings = v.map(Number).sort((a, b) => b - a); Store.saveSettings(); this.next(); }, 1)),
        field('Noten', seg([{ value: 'nat', label: 'Alleen stamtonen' }, { value: 'all', label: 'Alle twaalf' }], s.nat ? 'nat' : 'all', v => { s.nat = v === 'nat'; Store.saveSettings(); this.next(); })),
        field('Tot fret', seg([5, 7, 12].map(n => ({ value: n, label: String(n) })), s.to, v => { s.to = Number(v); Store.saveSettings(); this.next(); }), 'Begin met de eerste frets en schuif op als het lukt.'),
      ],
      optSummary: `${s.strings.length === 6 ? 'alle snaren' : s.strings.map(i => STR_LETTER[i]).join(' ')} · ${s.nat ? 'stamtonen' : 'alle noten'} · tot fret ${s.to}`,
      stats: this.statsEl,
    });
    this.keys = L.keys;
    this.renderShell();
    this.next();
    this.renderStats();
  },
  unmount() { clearTimeout(this.timer); },
  renderShell() {
    const s = Store.settings.noteq;
    this.card.innerHTML = '';
    this.svg = svgEl('Gitaarhals');
    this.qEl = h('p', { class: 'nq-q' });
    this.whereEl = h('p', { class: 'nq-where' });
    this.fbEl = h('div', { class: 'eq-fb', 'aria-live': 'polite' });
    this.padBox = h('div', { class: 'nq-pad' });
    this.card.append(
      seg([{ value: 'name', label: 'Welke noot?' }, { value: 'find', label: 'Zoek de noot' }], s.kind, v => { s.kind = v; Store.saveSettings(); this.next(); }, 'eq-kind'),
      h('div', { class: 'nq-stage' }, h('div', { class: 'nq-fret', html: Mascot.svg('hals') }), h('div', {}, this.qEl, this.whereEl), this.streakBox = h('div', { class: 'nq-streak' })),
      h('figure', { class: 'neck nq-neck' }, this.svg),
      this.padBox, this.fbEl);
    this.svg.addEventListener('click', e => this.tap(e));
  },
  next() {
    clearTimeout(this.timer);
    const s = Store.settings.noteq, prev = this.q;
    this.answered = false; this.ok = false;
    this.fbEl.innerHTML = ''; this.fbEl.className = 'eq-fb';
    this.padBox.innerHTML = '';
    if (s.kind === 'find') {
      // een noot die op de gekozen snaren voorkomt, niet twee keer dezelfde achter elkaar
      let pc = 0;
      for (let i = 0; i < 30; i++) { pc = s.nat ? pick(LETTER_PC) : Math.floor(Math.random() * 12); if (pc !== (prev && prev.pc) && FretQuiz.spots(pc, s.strings, 0, s.to).length) break; }
      const valid = FretQuiz.spots(pc, s.strings, 0, s.to), name = SHARP_NAMES[pc];
      this.q = { kind: 'find', pc, valid, name, found: [], miss: 0 };
      this.qEl.textContent = valid.length > 1 ? `Tik alle ${name}'s` : `Tik de ${name}`;
      this.whereEl.textContent = `op ${stringsPhrase(s.strings)}, tot fret ${s.to}${valid.length > 1 ? `: ${valid.length} plekken` : ''}`;
    } else {
      const sp = FretQuiz.pickSpot(s.strings, 0, s.to, s.nat ? 'nat' : false, prev && prev.kind === 'name' ? prev : null);
      this.q = { kind: 'name', s: sp.s, f: sp.f, pc: FretQuiz.pcAt(sp.s, sp.f) };
      this.qEl.textContent = 'Welke noot is dit?';
      this.whereEl.textContent = FretQuiz.label(sp.s, sp.f);
      this.pad = FretQuiz.keypad(!s.nat, (pc, btn) => this.answer(pc, btn));
      this.padBox.append(this.pad);
    }
    this.t1 = performance.now();
    this.draw();
  },
  draw() {
    const s = Store.settings.noteq, q = this.q, to = Math.max(s.to, 5);
    if (q.kind === 'name') {
      drawNeck(this.svg, { from: 0, to, big: true, highlight: [q.s], marks: [{ s: q.s, f: q.f, kind: this.answered ? (this.ok ? 'found' : 'reveal') : 'next', label: this.answered ? FretQuiz.nameAt(q.s, q.f) : '?' }] });
      return;
    }
    const marks = q.found.map(p => ({ s: p.s, f: p.f, kind: 'found', label: q.name }));
    if (q.flash) marks.push({ s: q.flash.s, f: q.flash.f, kind: 'wrong', label: FretQuiz.nameAt(q.flash.s, q.flash.f) });
    if (this.answered) for (const p of q.valid) if (!q.found.some(x => x.s === p.s && x.f === p.f)) marks.push({ s: p.s, f: p.f, kind: 'reveal', label: q.name });
    drawNeck(this.svg, { from: 0, to, big: true, highlight: s.strings.length < 6 ? s.strings : [], tap: !this.answered, marks });
  },
  expected() { return []; },
  // Welke noot?: een toets gekozen
  answer(pc, btn) {
    if (this.answered || !this.q || this.q.kind !== 'name') return;
    const q = this.q, ok = pc === q.pc, secs = (performance.now() - this.t1) / 1000;
    this.answered = true; this.ok = ok;
    FretQuiz.record(q.s, q.f, ok, secs);
    Score.answer(ok);
    FretQuiz.markKeys(this.pad, q.pc, btn);
    this.draw();
    this.result(ok, btn, ok ? `${FretQuiz.both(q.pc)} op ${FretQuiz.where(q.s, q.f)}, in ${fmt1(secs)} s.` : `Dit is een ${FretQuiz.both(q.pc)}. In de buurt: ${FretQuiz.near(q.s, q.f)}.`);
  },
  // Zoek de noot: tikken op de hals
  tap(e) {
    const q = this.q;
    if (this.answered || !q || q.kind !== 'find') return;
    const c = e.target.closest && e.target.closest('.cell');
    if (!c) return;
    const s = Number(c.dataset.s), f = Number(c.dataset.f);
    if (q.found.some(p => p.s === s && p.f === f)) return;
    if (q.valid.some(p => p.s === s && p.f === f)) {
      q.found.push({ s, f }); q.flash = null; this.draw();
      Fx.pop($$('.mk.found circle', this.svg).pop()); Haptics.play('tap');
      this.whereEl.textContent = `${q.found.length} van ${q.valid.length} gevonden`;
      if (q.found.length < q.valid.length) return;
      const ok = q.miss / q.valid.length < 0.34;
      this.answered = true; this.ok = ok;
      Score.answer(ok);
      if (ok) { FretQuiz.stats().found += q.valid.length; Quests.bump('noteq', q.valid.length); Store.saveStats(); }
      this.draw();
      this.result(ok, $('.nq-neck', this.card), `${q.name}: ${q.valid.map(p => `${STR_LETTER[p.s]}-snaar ${p.f === 0 ? 'los' : 'fret ' + p.f}`).join(', ')}${q.miss ? `. ${q.miss} ${q.miss === 1 ? 'misser' : 'missers'}.` : '.'}`);
    } else {
      // fout getikt: even laten zien welke noot daar wel ligt
      q.miss++; q.flash = { s, f }; this.draw();
      Fx.shake($('.nq-neck', this.card)); Fx.edge('bad'); Haptics.play('wrong');
      clearTimeout(q.ft); q.ft = setTimeout(() => { if (q.flash && q.flash.s === s && q.flash.f === f) { q.flash = null; this.draw(); } }, 900);
    }
  },
  result(ok, el, text) {
    const fb = FretQuiz.stats();
    DrillFx.sync();
    DrillFx.n = ok ? DrillFx.n + 1 : 0;
    DrillFx.badge(this.streakBox, true);
    Score.combo(DrillFx.n);
    if (DrillFx.n > (fb.best || 0)) { fb.best = DrillFx.n; Store.saveStats(); }
    const line = ok && DrillFx.n >= 3 ? Feedback.streak(DrillFx.n) : '', oops = Feedback.word('wrong');
    if (ok) Feedback.right({ el, via: 'tap', big: !!line }); else Feedback.wrong({ el, via: 'tap' });
    this.fbEl.className = 'eq-fb ' + (ok ? 'ok' : 'bad');
    this.fbEl.innerHTML = '';
    this.fbEl.append(h('p', {}, h('b', { text: ok ? line || Feedback.word('right') : `${oops}${/[!.?]$/.test(oops) ? '' : '.'}` }), ' ', text));
    if (ok) this.timer = setTimeout(() => this.next(), 1100);
    else this.fbEl.append(h('button', { type: 'button', class: 'primary', text: 'Volgende', onclick: () => this.next() }));
    this.renderStats();
    if (fb.n % 10 === 0) Badges.check();
    Activity.ping();
  },
  // de halskaart: elke plek die je oefende, gekleurd van groen (snel en goed) naar rood (lastig)
  renderStats() {
    const fb = FretQuiz.stats(), items = Object.entries(fb.items).map(([k, v]) => { const [s, f] = k.split('-').map(Number); return Object.assign({ s, f }, v); });
    const hard = items.filter(x => x.n >= 2).map(x => Object.assign({ w: FretQuiz.weight(x.s, x.f) }, x)).sort((a, b) => b.w - a.w).slice(0, 3);
    const totalT = items.reduce((a, x) => a + (x.t || 0), 0);
    const svg = svgEl('Halskaart: hoe goed je elke plek kent');
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('h2', { class: 'card-h', text: 'Je halskaart' }),
      h('p', { class: 'help', text: items.length ? 'Groen ken je snel en goed, rood is nog lastig. Plekken zonder stip heb je nog niet gehad.' : 'Hier kleurt de hals zodra je noten herkent: groen als je ze snel en goed weet, rood als ze nog lastig zijn.' }),
      h('figure', { class: 'neck heatneck' }, svg),
      statFigs([
        { label: 'Goed', value: fb.n ? `${Math.round(100 * fb.ok / fb.n)}<small>%</small>` : '–' },
        { label: 'Per noot', value: fb.ok && totalT ? sec(totalT / fb.ok) : '–' },
        { label: 'Beste reeks', value: String(fb.best || 0) },
      ]),
      hard.length ? h('p', { class: 'help nq-hard', text: `Lastigst: ${hard.map(x => `${FretQuiz.nameAt(x.s, x.f)} op ${FretQuiz.where(x.s, x.f)}`).join(', ')}.` }) : null);
    const marks = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) { const lv = FretQuiz.heat(s, f); if (lv) marks.push({ s, f, kind: `heat h${lv}`, label: FretQuiz.nameAt(s, f) }); }
    drawNeck(svg, { from: 0, to: 12, marks });
  },
});
