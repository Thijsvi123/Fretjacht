// ---------- Lesspeler (één oefening tegelijk, zoals Duolingo) ----------
const PRAISE = ['Goed!', 'Precies!', 'Klopt!', 'Netjes!', 'Top!'];
const FIXED = ['Hersteld!', 'Nu wel!', 'Opgelost!', 'Die zit!'];
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const KIND = { play: ['pick', 'Speel op je gitaar'], tap: ['note', 'Tik op de hals'], theory: ['book', 'Theorie'] };
const Lesson = {
  spec: null,
  open(spec) { this.spec = spec; if (location.hash === '#les') Router.render(); else location.hash = '#les'; },
  mount(view) {
    const sp = this.spec;
    if (!sp) { setTimeout(() => { location.hash = ''; }, 0); return; }
    this.bin = sp.mode === 'bin';
    this.cantPlay = (Store.settings.cantPlayUntil || 0) > Date.now();
    let items = sp.items.map((it, i) => Object.assign({ _id: i }, it));
    if (this.cantPlay && items.some(i => i.type !== 'play')) items = items.filter(i => i.type !== 'play');
    this.queue = items;
    this.total = items.length; this.doneIds = new Set(); this.mistakes = 0; this.skipped = 0; this.hints = 0;
    this.combo = 0; this.fixed = 0; this.wrongKeys = new Set();
    this.t0 = performance.now(); this.finished = false; this.cur = null;
    this.barFill = h('span');
    this.sndBtn = h('button', { class: 'ls-snd', type: 'button', onclick: () => { Store.settings.sound = !Sfx.on(); Store.saveSettings(); this.renderSnd(); } });
    this.el = h('section', { class: 'lesson' + (this.bin ? ' bin-mode' : '') },
      h('div', { class: 'ls-top' },
        h('button', { class: 'ls-close', type: 'button', 'aria-label': 'Les stoppen', html: ICONS.close, onclick: () => this.askQuit() }),
        h('div', { class: 'ls-bar', role: 'progressbar', 'aria-label': 'Voortgang in deze les' }, this.barFill),
        this.bin ? h('span', { class: 'ls-bin', title: 'Vragen in je foutenbak', html: `${ICONS.plaster}<b class="bin-count">${Bin.count()}</b>` }) : null,
        this.counter = h('span', { class: 'ls-count' }),
        this.sndBtn),
      this.comboEl = h('div', { class: 'combo', 'aria-live': 'polite' }),
      this.body = h('div', { class: 'ls-body' }),
      this.foot = h('div', { class: 'ls-foot' }));
    view.append(this.el);
    this.renderSnd();
    this.keys = { enter: () => this.enter() };
    this.updateBar();
    this.next();
  },
  unmount() { clearTimeout(this.autoT); clearTimeout(this.comboT); this.cur = null; },
  renderSnd() {
    const on = Sfx.on();
    this.sndBtn.innerHTML = on ? ICONS.sound : ICONS.mute;
    this.sndBtn.setAttribute('aria-label', on ? 'Geluidjes uitzetten' : 'Geluidjes aanzetten');
    this.sndBtn.setAttribute('aria-pressed', String(on));
  },
  updateBar() {
    const pct = this.total ? (100 * this.doneIds.size / this.total) : 0;
    this.barFill.style.width = pct + '%';
    this.counter.textContent = `${this.doneIds.size}/${this.total}`;
  },
  askQuit() {
    if (this.finished) return this.leave();
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet center' },
        h('div', { class: 'sheet-mascot', html: Mascot.svg('oeps') }),
        h('h3', { text: 'Wil je stoppen?' }),
        h('p', { class: 'help', text: this.bin ? 'Wat je al hebt hersteld, is uit je foutenbak. De rest blijft erin staan.' : 'Je voortgang in deze les gaat verloren. Wat je tot nu toe hebt geoefend, telt wel mee voor je dagdoel.' }),
        h('button', { class: 'primary big', type: 'button', text: 'Doorgaan met oefenen', onclick: () => sheet.remove() }),
        h('button', { class: 'big ghost', type: 'button', text: 'Stoppen', onclick: () => { sheet.remove(); this.leave(); } })));
    document.body.append(sheet);
  },
  leave() {
    const sp = this.spec; this.spec = null;
    if (sp && sp.onExit) sp.onExit(); else location.hash = '';
  },
  enter() {
    const b = $('.ls-foot button.primary', this.el);
    if (b && !b.disabled) b.click();
  },
  next() {
    clearTimeout(this.autoT);
    this.answered = false;
    if (!this.queue.length) return this.finish();
    const it = this.queue.shift();
    if (it.type === 'play' && this.cantPlay) { this.doneIds.add(it._id); this.updateBar(); return this.next(); }
    this.cur = it;
    this.body.innerHTML = '';
    this.body.classList.remove('enter'); void this.body.offsetWidth; this.body.classList.add('enter');
    this.foot.className = 'ls-foot';
    this.foot.innerHTML = '';
    const [ico, label] = KIND[it.type === 'play' ? 'play' : it.type === 'tap' ? 'tap' : 'theory'];
    this.body.append(h('p', { class: 'ls-kind' }, h('span', { html: ICONS[ico] }), it._again ? 'Nog een keer' : this.bin ? `${label}, uit je foutenbak` : label));
    this.body.append(h('h2', { class: 'ls-prompt', text: it.prompt }));
    if (it.sub && it.type !== 'play') this.body.append(h('p', { class: 'ls-sub', text: it.sub }));
    if (it.type === 'mc') this.renderMC(it);
    else if (it.type === 'multi') this.renderMulti(it);
    else if (it.type === 'tap') this.renderTap(it);
    else this.renderPlay(it);
    Activity.ping();
  },
  checkFoot() {
    this.checkBtn = h('button', { class: 'primary big', type: 'button', text: 'Controleer', disabled: true, onclick: () => this.check() });
    this.foot.append(this.checkBtn);
  },
  renderMC(it) {
    this.sel = null;
    const opts = h('div', { class: 'ls-opts' + (it.options.every(o => o.length <= 6) ? ' grid' : '') });
    it.options.forEach((o, i) => opts.append(h('button', { type: 'button', class: 'opt', text: o, onclick: e => {
      if (this.answered) return;
      this.sel = i;
      $$('.opt', opts).forEach(b => b.classList.toggle('sel', b === e.currentTarget));
      this.checkBtn.disabled = false;
    } })));
    this.optsEl = opts;
    this.body.append(opts);
    this.checkFoot();
  },
  renderMulti(it) {
    this.selSet = new Set();
    const chipsEl = h('div', { class: 'ls-chips' });
    it.choices.forEach(c => chipsEl.append(h('button', { type: 'button', class: 'chip-btn', text: c, 'aria-pressed': 'false', onclick: e => {
      if (this.answered) return;
      const b = e.currentTarget;
      if (this.selSet.has(c)) this.selSet.delete(c); else this.selSet.add(c);
      b.setAttribute('aria-pressed', String(this.selSet.has(c)));
      this.checkBtn.disabled = this.selSet.size === 0;
    } })));
    this.chipsEl = chipsEl;
    this.body.append(h('p', { class: 'ls-sub', text: 'Kies alle goede antwoorden.' }), chipsEl);
    this.checkFoot();
  },
  renderTap(it) {
    this.tapSel = null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Gitaarhals: tik op een plek');
    const fig = h('figure', { class: 'card neck tapneck' }, svg);
    this.body.append(fig);
    this.tapSvg = svg; this.tapFig = fig;
    const draw = extra => drawNeck(svg, { from: it.from, to: it.to, marks: it.marks.concat(extra || []), tap: !this.answered });
    this.drawTap = draw;
    draw();
    svg.addEventListener('click', e => {
      if (this.answered) return;
      const c = e.target.closest && e.target.closest('.cell');
      if (!c) return;
      this.tapSel = { s: Number(c.dataset.s), f: Number(c.dataset.f) };
      draw([{ s: this.tapSel.s, f: this.tapSel.f, kind: 'sel', label: '' }]);
      this.checkBtn.disabled = false;
    });
    this.checkFoot();
  },
  shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
  check() {
    const it = this.cur;
    if (!it || this.answered) return;
    let ok = false, answer = '', wrongEl = null;
    if (it.type === 'mc') {
      ok = this.sel === it.answer; answer = it.options[it.answer];
      $$('.opt', this.optsEl).forEach((b, i) => {
        b.classList.toggle('right', i === it.answer); b.classList.toggle('wrong', i === this.sel && !ok); b.disabled = true;
        if (i === it.answer && ok) b.classList.add('pop');
        if (i === this.sel && !ok) wrongEl = b;
      });
    } else if (it.type === 'multi') {
      const sel = Array.from(this.selSet);
      ok = sameSet(sel, it.correct); answer = it.correct.join(' ');
      $$('.chip-btn', this.chipsEl).forEach(b => { const c = b.textContent; b.classList.toggle('right', it.correct.includes(c)); b.classList.toggle('wrong', this.selSet.has(c) && !it.correct.includes(c)); b.disabled = true; });
      wrongEl = ok ? null : this.chipsEl;
      if (ok) this.chipsEl.classList.add('pop');
    } else if (it.type === 'tap') {
      ok = it.valid.some(p => p.s === this.tapSel.s && p.f === this.tapSel.f);
      answer = it.valid.map(p => `${STR_LETTER[p.s]}-snaar fret ${p.f}`).join(' of ');
      this.answered = true;
      this.drawTap(it.valid.map(p => ({ s: p.s, f: p.f, kind: 'found', label: '' })).concat(ok ? [] : [{ s: this.tapSel.s, f: this.tapSel.f, kind: 'wrong', label: '' }]));
      wrongEl = ok ? null : this.tapFig;
    }
    if (ok) {
      this.doneIds.add(it._id);
      this.right(it);
    } else {
      this.mistakes++;
      this.shake(wrongEl);
      if (!it._again) this.queue.push(Object.assign({}, it, { _again: true }));
      else this.doneIds.add(it._id);
      this.wrong(it, 'Niet helemaal', `Het goede antwoord: ${answer}. ${it.explain || ''}`);
    }
    this.updateBar();
  },
  // goed beantwoord: in de herstelronde gaat de vraag uit de foutenbak
  right(it, title, auto) {
    let fixedNow = false;
    if (this.bin && it._bin && Bin.remove(it._bin)) {
      fixedNow = true; this.fixed++;
      const b = $('.ls-bin', this.el);
      if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    }
    this.combo++;
    if ([3, 5, 8, 12].includes(this.combo)) this.showCombo(this.combo);
    Track.answer(it, true, this.spec && this.spec.topic);
    Quests.max('combo', this.combo);
    if (fixedNow) Quests.bump('fixed');
    Sfx.play(fixedNow ? 'fixed' : 'right');
    this.feedback(true, title || (fixedNow ? pick(FIXED) : pick(PRAISE)), it.explain || '', auto, fixedNow ? 'Uit je foutenbak.' : '');
  },
  wrong(it, title, text) {
    this.combo = 0;
    Track.answer(it, false, this.spec && this.spec.topic);
    let note = '';
    if (this.bin) { Bin.add(it); note = 'Hij blijft in je foutenbak.'; }
    else { this.wrongKeys.add(Bin.add(it, this.spec && this.spec.title, (this.spec && this.spec.topic) || it._topic)); note = 'In je foutenbak gezet. Herstel hem later voor bonus-XP.'; }
    Sfx.play('wrong');
    this.feedback(false, title, text, 0, note);
  },
  showCombo(n) {
    clearTimeout(this.comboT);
    this.comboEl.innerHTML = `${ICONS.flame}<b>${n} op rij!</b>`;
    this.comboEl.classList.remove('show'); void this.comboEl.offsetWidth; this.comboEl.classList.add('show');
    this.comboT = setTimeout(() => this.comboEl.classList.remove('show'), 1600);
  },
  feedback(ok, title, text, auto, note) {
    this.answered = true;
    clearTimeout(this.autoT);
    this.foot.innerHTML = '';
    this.foot.className = 'ls-foot ' + (ok ? 'ok' : 'bad');
    this.foot.append(
      h('div', { class: 'fb' },
        h('span', { class: 'fb-fret', html: Mascot.svg(ok ? 'blij' : 'oeps', { crop: 'head' }) }),
        h('div', {}, h('b', { text: title }), text ? h('p', { text: text.trim() }) : null,
          note ? h('p', { class: 'fb-note' }, h('span', { html: ICONS.plaster }), note) : null)),
      h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: () => this.next() }));
    if (auto) this.autoT = setTimeout(() => { if (this.answered) this.next(); }, auto);
    Activity.ping();
  },

  // --- speelopdrachten ---
  renderPlay(it) {
    this.ps = { idx: 0, last: null, found: new Set() };
    const big = h('div', { class: 'note ls-big', html: /^[A-G][♯♭]?$/.test(it.big || '') ? bigNoteHTML(it.big) : `<span class="deg">${it.big || ''}</span>` });
    this.body.append(big);
    if (it.sub) this.body.append(h('p', { class: 'ls-sub', text: it.sub }));
    this.stepsEl = h('div', { class: 'slots' });
    this.body.append(this.stepsEl);
    if (it.neck || it.highlight) {
      this.playSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.playSvg.setAttribute('role', 'img'); this.playSvg.setAttribute('aria-label', 'Gitaarhals');
      this.body.append(h('figure', { class: 'card neck' }, this.playSvg));
    } else this.playSvg = null;
    this.hintEl = h('div', { class: 'ls-hint' });
    this.body.append(this.hintEl, h('div', { class: 'toast pr-toast ls-toast' }), h('div', { class: 'heard-line' }));
    this.renderSteps();
    this.playFoot();
    UI.lastHeard = ''; UI.updateHeard(null);
  },
  playFoot() {
    this.foot.innerHTML = '';
    this.foot.className = 'ls-foot';
    const row = h('div', { class: 'ls-row' });
    if (!Engine.mic) row.append(h('button', { class: 'primary big', type: 'button', text: Engine.starting ? 'Toegang vragen…' : 'Start microfoon', onclick: async () => { await Engine.startMic(); if (this.cur && this.cur.type === 'play' && !this.answered) this.playFoot(); } }));
    row.append(h('button', { class: 'big', type: 'button', text: 'Hint', onclick: () => this.hint() }), h('button', { class: 'big', type: 'button', text: 'Overslaan', onclick: () => this.skip() }));
    this.foot.append(row, h('button', { class: 'linkish', type: 'button', text: 'Ik kan nu niet spelen', onclick: () => this.cantPlayNow() }));
  },
  onMic() { if (this.cur && this.cur.type === 'play' && !this.answered) this.playFoot(); },
  renderSteps() {
    const it = this.cur, ps = this.ps;
    if (it.steps.length === 1 && it.steps[0].k === 'set') {
      const st = it.steps[0];
      this.stepsEl.innerHTML = st.pcs.map((pc, i) => `<span class="slot${ps.found.has(pc) ? ' on' : ''}"><small>${st.labels ? st.labels[i] : ''}</small><b>${ps.found.has(pc) ? st.names[i] : '?'}</b></span>`).join('');
    } else if (it.steps.length > 1) {
      this.stepsEl.innerHTML = it.steps.map((st, i) => `<span class="slot${i < ps.idx ? ' on' : ''}${i === ps.idx && !this.answered ? ' now' : ''}"><small>${i + 1}</small><b>${i < ps.idx ? st.name : '?'}</b></span>`).join('');
    } else this.stepsEl.innerHTML = '';
    if (this.playSvg) {
      if (it.neck) {
        const cur = it.steps[ps.idx];
        const marks = it.neck.marks.map((m, i) => {
          const st = it.steps[i];
          if (i < ps.idx) return Object.assign({}, m, { kind: 'found' + (m.kind.includes('root') ? ' root' : '') });
          if (cur && st && st.pos && i === ps.idx) return Object.assign({}, m, { kind: 'next' });
          return m;
        });
        drawNeck(this.playSvg, { from: it.neck.from, to: it.neck.to, marks, highlight: cur && cur.pos ? [cur.pos.s] : [] });
      } else drawNeck(this.playSvg, { from: 0, to: Math.max(12, Store.settings.maxFret), highlight: it.highlight, marks: this.playMarks || [] });
    }
  },
  hint() {
    const it = this.cur;
    if (!it || this.answered) return;
    this.hints++;
    this.hintEl.textContent = it.hint || '';
    if (it.hintNeck) {
      if (!this.hintSvg || !this.hintSvg.isConnected) {
        this.hintSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.hintSvg.setAttribute('role', 'img'); this.hintSvg.setAttribute('aria-label', 'Hint op de hals');
        this.hintEl.after(h('figure', { class: 'card neck' }, this.hintSvg));
      }
      drawNeck(this.hintSvg, it.hintNeck);
    }
    if (it.highlight && it.steps[0].frets) { this.playMarks = it.steps[0].frets.map(f => ({ s: it.steps[0].string, f, kind: 'hint', label: it.steps[0].name })); this.renderSteps(); }
  },
  skip() {
    const it = this.cur;
    if (!it || this.answered) return;
    this.mistakes++; this.skipped++;
    this.doneIds.add(it._id); this.updateBar();
    const ans = it.steps.map(st => st.k === 'set' ? st.names.join(' ') : st.name).join(' → ');
    this.wrong(it, 'Overgeslagen', `${ans ? `Het antwoord: ${ans}. ` : ''}${it.hint || ''}`);
  },
  cantPlayNow() {
    Store.settings.cantPlayUntil = Date.now() + 15 * 60 * 1000; Store.saveSettings();
    this.cantPlay = true;
    for (const q of this.queue) if (q.type === 'play') this.doneIds.add(q._id);
    this.queue = this.queue.filter(q => q.type !== 'play');
    if (this.cur && this.cur.type === 'play') this.doneIds.add(this.cur._id);
    this.updateBar();
    this.next();
  },
  onNote(n) {
    const it = this.cur;
    if (!it || it.type !== 'play' || this.answered) return;
    const ps = this.ps, st = it.steps[ps.idx], toast = $('.ls-toast', this.body);
    const heard = pcName(n.midi, Store.settings.names === 'flats' ? 'flats' : 'sharps');
    Activity.ping();
    if (st.k === 'set') {
      const pc = mod12(n.midi);
      if (st.pcs.includes(pc)) {
        if (!ps.found.has(pc)) { ps.found.add(pc); toast.textContent = ''; this.renderSteps(); if (ps.found.size === st.pcs.length) this.playDone(); }
      } else toast.textContent = `${heard} hoort er niet bij`;
      return;
    }
    let ok;
    if (st.k === 'rel') {
      if (ps.last == null) return;
      const want = ps.last + st.semis;
      ok = Store.settings.strict || Math.abs(st.semis) === 12 ? n.midi === want : mod12(n.midi) === mod12(want);
    } else ok = mod12(n.midi) === st.pc;
    if (ok) {
      ps.last = n.midi; ps.idx++;
      toast.textContent = ps.idx < it.steps.length ? 'Goed, verder' : '';
      this.renderSteps();
      if (ps.idx >= it.steps.length) this.playDone();
      return;
    }
    if (ps.last != null && mod12(n.midi) === mod12(ps.last)) return;   // vorige noot klinkt nog
    toast.textContent = `Je speelde ${heard}`;
  },
  playDone() {
    const it = this.cur;
    this.doneIds.add(it._id); this.updateBar();
    this.right(it, 'Goed gespeeld!', 1500);
  },

  finish() {
    if (this.finished) return;
    this.finished = true; this.cur = null;
    clearTimeout(this.comboT); this.comboEl.classList.remove('show');
    const sp = this.spec, secs = (performance.now() - this.t0) / 1000;
    const accuracy = this.total ? Math.max(0, (this.total - this.mistakes) / this.total) : 1;
    const perfect = this.mistakes === 0 && this.skipped === 0;
    const passed = !sp.test || accuracy >= 0.8;
    let xp, title, sub, mood, party = false, extra = null;
    if (this.bin) {
      xp = 2 * this.fixed + (this.fixed && this.fixed === this.total ? 5 : 0);
      const left = Bin.count();
      if (this.fixed && !left) {
        Bin.reward(); xp += 10; party = true;
        title = 'Foutenbak leeg!'; mood = 'juich';
        sub = 'Alles hersteld. Je krijgt 10 XP extra en 2 minuten voor je dagdoel.';
      } else {
        title = this.fixed ? `${this.fixed} van ${this.total} hersteld` : 'Nog niet hersteld';
        mood = this.fixed ? 'ehbo' : 'oeps';
        sub = left ? `Er ${left === 1 ? 'staat' : 'staan'} nog ${left} ${left === 1 ? 'vraag' : 'vragen'} in je foutenbak.` : '';
      }
      if (xp) Progress.addXP(xp);
    } else {
      xp = passed ? (sp.xp || 10) + (perfect ? 5 : 0) : 5;
      Progress.addXP(xp);
      if (sp.onFinish) sp.onFinish({ passed, accuracy, perfect, secs, xp });
      title = sp.test ? (passed ? 'Unittoets gehaald!' : 'Nog niet gehaald') : perfect ? 'Foutloos!' : 'Les voltooid!';
      mood = !passed ? 'oeps' : perfect || sp.test ? 'juich' : 'blij';
      party = passed && (perfect || sp.test);
      sub = sp.test && !passed ? 'Je hebt 80% goed nodig. Herhaal de lessen van deze unit en probeer het nog eens.' : sp.title || '';
    }
    const fresh = Badges.check({ quiet: true });
    this.body.innerHTML = '';
    this.body.classList.remove('enter');
    this.foot.className = 'ls-foot';
    this.foot.innerHTML = '';
    const mm = `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
    const xpEl = h('b', { text: `+${xp}` }), pctEl = h('b', { text: `${Math.round(accuracy * 100)}%` });
    this.body.append(h('div', { class: 'ls-end' },
      h('div', { class: 'end-fret' + (party ? ' party' : ''), html: Mascot.svg(mood) }),
      h('h2', { class: 'end-title', text: title }),
      sub ? h('p', { class: 'help', text: sub }) : null,
      h('div', { class: 'end-stats' },
        h('div', {}, h('small', { text: 'XP' }), xpEl),
        this.bin ? h('div', {}, h('small', { text: 'Hersteld' }), h('b', { text: `${this.fixed}/${this.total}` })) : h('div', {}, h('small', { text: 'Goed' }), pctEl),
        h('div', {}, h('small', { text: 'Tijd' }), h('b', { text: mm }))),
      fresh.length ? h('div', { class: 'end-badges' }, fresh.map(b => h('div', { class: 'end-badge' },
        h('span', { class: 'b-pick', html: pickBadge(b, true) }),
        h('div', {}, h('small', { text: 'Nieuwe mijlpaal' }), h('b', { text: b.title }), h('span', { text: b.desc }))))) : null,
      Progress.goalLine()));
    countUp(xpEl, xp, { prefix: '+', delay: 250 });
    if (!this.bin) countUp(pctEl, Math.round(accuracy * 100), { suffix: '%', delay: 350 });
    this.counter.textContent = '';
    this.barFill.style.width = '100%';
    const done = () => { const s = this.spec; this.spec = null; if (s && s.onDone) s.onDone({ passed }); else location.hash = ''; };
    // fouten uit deze les: direct herstellen voor bonus-XP
    const fixable = this.bin ? [] : [...this.wrongKeys].filter(k => Bin.has(k));
    if (fixable.length && Bin.items(fixable).length) {
      this.foot.append(h('button', { class: 'primary big fix-btn', type: 'button', html: `${ICONS.plaster}<span>Herstel je fouten (+${Bin.bonusXP(fixable.length)} XP)</span>`, onclick: () => { const s = this.spec; this.spec = null; Bin.start({ keys: fixable, after: () => { if (s && s.onDone) s.onDone({ passed }); else location.hash = ''; } }); } }),
        h('button', { class: 'big', type: 'button', text: 'Verder', onclick: done }));
    } else if (this.bin && Bin.count() && Bin.items().length) {
      this.foot.append(h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: done }),
        h('button', { class: 'big', type: 'button', text: 'Nog een ronde', onclick: () => { const s = this.spec; this.spec = null; Bin.start({ after: s && s.onDone ? () => s.onDone({ passed: true }) : null }); } }));
    } else this.foot.append(h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: done }));
    Sfx.play('done');
    if (party) setTimeout(() => Confetti.burst({ n: this.bin ? 70 : 90 }), 200);
  },
};
