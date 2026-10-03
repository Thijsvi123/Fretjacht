// ---------- Lesspeler (één oefening tegelijk, zoals Duolingo) ----------
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
// tikvraag met een gemarkeerde noot: welk stuk van de hals de telefoon laat zien (7 frets rond die noot,
// genoeg voor de vormen van intervallen, met minstens één goede plek erin). Op een groot scherm blijft
// de hele hals staan.
function tapZoom(it) {
  const root = (it.marks || [])[0];
  if (!root) return null;
  let a = Math.max(0, root.f - 2), b = a + 6;
  if (b > 12) { b = 12; a = 6; }
  if (!(it.valid || []).some(p => p.f >= a && p.f <= b) && (it.valid || []).length) {
    const near = it.valid.slice().sort((p, q) => Math.abs(p.f - root.f) - Math.abs(q.f - root.f))[0];
    a = Math.min(a, near.f); b = Math.max(b, near.f);
  }
  return { from: a, to: b };
}
const KIND = { play: ['pick', 'Speel op je gitaar'], tap: ['note', 'Tik op de hals'], theory: ['book', 'Theorie'], learn: ['book', 'Leren'], name: ['eye', 'Herkennen'], tapall: ['target', 'Toepassen'] };
const Lesson = {
  spec: null,
  open(spec) { this.spec = spec; if (location.hash === '#les') Router.render(); else location.hash = '#les'; },
  mount(view) {
    const sp = this.spec;
    if (!sp) { setTimeout(() => { location.hash = ''; }, 0); return; }
    // bin: een herhaalronde (nieuwe fouten en vragen die vandaag terugkomen)
    this.bin = sp.mode === 'bin'; this.review = this.bin;
    this.cantPlay = (Store.settings.cantPlayUntil || 0) > Date.now();
    let items = sp.items.map((it, i) => Object.assign({ _id: i }, it));
    if (this.cantPlay && items.some(i => i.type !== 'play')) items = items.filter(i => i.type !== 'play');
    this.queue = items;
    this.total = items.length; this.doneIds = new Set(); this.mistakes = 0; this.skipped = 0; this.hints = 0;
    this.combo = 0; this.fixed = 0; this.recalled = 0; this.mastered = 0; this.wrongKeys = new Set(); this.times = [];
    this.srsBefore = this.bin ? Srs.snapshot() : null;
    this.t0 = performance.now(); this.finished = false; this.cur = null;
    this.barFill = h('span');
    this.sndBtn = h('button', { class: 'ls-snd', type: 'button', onclick: () => { Store.settings.sound = !Sfx.on(); Store.saveSettings(); this.renderSnd(); } });
    this.el = h('section', { class: 'lesson' + (this.bin ? ' bin-mode' : '') },
      h('div', { class: 'ls-top' },
        h('button', { class: 'ls-close', type: 'button', 'aria-label': 'Les stoppen', html: ICONS.close, onclick: () => this.askQuit() }),
        h('div', { class: 'ls-bar', role: 'progressbar', 'aria-label': 'Voortgang in deze les' }, this.barFill),
        this.bin ? h('span', { class: 'ls-bin', title: 'Nog te herhalen', html: `${ICONS.retry}<b class="todo-count">${Srs.todoCount()}</b>` }) : null,
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
        h('p', { class: 'help', text: this.bin ? 'Wat je al goed had, schuift een vakje door. De rest komt de volgende keer terug.' : 'Je voortgang in deze les gaat verloren. Wat je tot nu toe hebt geoefend, telt wel mee voor je dagdoel.' }),
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
    const [ico, label] = KIND[KIND[it.type] ? it.type : 'theory'];
    const from = it._box ? `herhaling na ${SRS_DAYS[it._box]} ${SRS_DAYS[it._box] === 1 ? 'dag' : 'dagen'}` : 'eerder fout';
    this.body.append(h('p', { class: 'ls-kind' }, h('span', { html: ICONS[ico] }), it._again ? 'Nog een keer' : this.bin ? `${label}, ${from}` : label));
    this.body.append(h('h2', { class: 'ls-prompt', text: it.prompt }));
    if (it.sub && it.type !== 'play') this.body.append(h('p', { class: 'ls-sub', text: it.sub }));
    if (it.type === 'mc') this.renderMC(it);
    else if (it.type === 'multi') this.renderMulti(it);
    else if (it.type === 'tap') this.renderTap(it);
    else if (it.type === 'learn') this.renderLearn(it);
    else if (it.type === 'name') this.renderName(it);
    else if (it.type === 'tapall') this.renderTapAll(it);
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
    // op de telefoon ingezoomd op het stuk rond de gemarkeerde noot: grotere vakjes
    const zoom = tapZoom(it);
    const draw = extra => drawNeck(svg, { from: it.from, to: it.to, zoom, touch: true, marks: it.marks.concat(extra || []), tap: !this.answered });
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
  check() {
    const it = this.cur;
    if (!it || this.answered) return;
    let ok = false, answer = '', fx = null;
    const mark = (b, good) => b.append(h('span', { class: 'opt-mark' + (good ? '' : ' bad'), html: good ? ICONS.check : ICONS.close }));
    if (it.type === 'mc') {
      ok = this.sel === it.answer; answer = it.options[it.answer];
      $$('.opt', this.optsEl).forEach((b, i) => {
        b.disabled = true;
        if (i === it.answer) { b.classList.add('right'); mark(b, true); if (ok) fx = b; else b.classList.add('reveal'); }
        if (i === this.sel && !ok) { b.classList.add('wrong'); mark(b, false); fx = b; }
      });
    } else if (it.type === 'multi') {
      const sel = Array.from(this.selSet);
      ok = sameSet(sel, it.correct); answer = it.correct.join(' ');
      $$('.chip-btn', this.chipsEl).forEach(b => { const c = b.textContent; b.classList.toggle('right', it.correct.includes(c)); b.classList.toggle('wrong', this.selSet.has(c) && !it.correct.includes(c)); b.disabled = true; });
      fx = this.chipsEl;
    } else if (it.type === 'tap') {
      ok = it.valid.some(p => p.s === this.tapSel.s && p.f === this.tapSel.f);
      answer = it.valid.map(p => `${STR_LETTER[p.s]}-snaar fret ${p.f}`).join(' of ');
      this.answered = true;
      this.drawTap(it.valid.map(p => ({ s: p.s, f: p.f, kind: 'found', label: '' })).concat(ok ? [] : [{ s: this.tapSel.s, f: this.tapSel.f, kind: 'wrong', label: '' }]));
      fx = ok ? $('.mk.found circle', this.tapSvg) || this.tapFig : this.tapFig;
    }
    this.fxEl = fx; this.via = 'tap';
    if (ok) {
      this.doneIds.add(it._id);
      this.right(it);
    } else {
      this.mistakes++;
      if (!it._again) this.queue.push(Object.assign({}, it, { _again: true }));
      else this.doneIds.add(it._id);
      this.wrong(it, null, it.explain || '', answer);
    }
    this.updateBar();
  },
  // fout antwoord: één keer opnieuw aan het eind van de les
  requeue(it) {
    this.mistakes++;
    if (!it._again) this.queue.push(Object.assign({}, it, { _again: true }));
    else this.doneIds.add(it._id);
  },

  // --- Halsjacht: uitleg, welke noot is dit, tik alle plekken ---
  renderLearn(it) {
    if (it.big) this.body.append(h('div', { class: 'note ls-big learn-big', html: bigNoteHTML(it.big) }));
    if (it.neck) {
      const svg = svgEl('Gitaarhals met uitleg');
      this.body.append(h('figure', { class: 'card neck learnneck' }, svg));
      drawNeck(svg, Object.assign({ big: true }, it.neck));
    }
    this.body.append(h('div', { class: 'learn-text' }, it.text.map(t => h('p', { text: t }))));
    const last = !this.queue.some(q => q.type === 'learn');
    this.foot.append(h('button', { class: 'primary big', type: 'button', text: last ? 'Begrepen' : 'Volgende', onclick: () => {
      this.doneIds.add(it._id); this.updateBar(); Sfx.play('tap'); this.next();
    } }));
  },
  renderName(it) {
    const svg = svgEl('Gitaarhals met één gemarkeerde plek');
    this.quizSvg = svg;
    this.body.append(h('figure', { class: 'card neck quizneck' }, svg));
    this.drawName = (kind, label) => drawNeck(svg, { from: 0, to: 12, big: true, highlight: [it.s], marks: [{ s: it.s, f: it.f, kind: kind || 'next', label: label || '?' }] });
    this.drawName();
    this.pad = FretQuiz.keypad(it.all, (pc, btn) => this.answerName(it, pc, btn));
    this.body.append(this.pad);
    this.foot.append(h('p', { class: 'ls-tip', text: 'Tik op de noot die op de gemarkeerde plek ligt.' }));
    this.t1 = performance.now();
  },
  answerName(it, pc, btn) {
    if (this.answered || this.cur !== it) return;
    const ok = pc === it.pc, secs = (performance.now() - this.t1) / 1000;
    FretQuiz.record(it.s, it.f, ok, secs);
    FretQuiz.markKeys(this.pad, it.pc, btn);
    this.drawName(ok ? 'found' : 'reveal', FretQuiz.nameAt(it.s, it.f));
    this.fxEl = btn; this.via = 'tap';
    if (ok) { this.times.push(secs); this.doneIds.add(it._id); this.right(it, null, 1100, `${FretQuiz.both(it.pc)} op ${FretQuiz.where(it.s, it.f)}, in ${fmt1(secs)} s`); }
    else { this.requeue(it); this.wrong(it, null, it.explain || '', `${FretQuiz.both(it.pc)} op ${FretQuiz.where(it.s, it.f)}`); }
    this.updateBar();
  },
  renderTapAll(it) {
    const svg = svgEl('Gitaarhals: tik alle plekken aan');
    const fig = h('figure', { class: 'card neck tapneck' }, svg);
    this.body.append(fig);
    const ta = this.ta = { found: [], miss: 0, flash: null };
    const draw = () => drawNeck(svg, { from: 0, to: 12, big: true, touch: true, active: it.strings, highlight: it.strings.length < 6 ? it.strings : [], tap: !this.answered,
      marks: ta.found.map(p => ({ s: p.s, f: p.f, kind: 'found', label: it.name })).concat(ta.flash ? [{ s: ta.flash.s, f: ta.flash.f, kind: 'wrong', label: FretQuiz.nameAt(ta.flash.s, ta.flash.f) }] : []).concat(this.answered && ta.shown ? ta.shown : []) });
    this.drawTapAll = draw;
    draw();
    this.taCount = h('b', { text: `0 van ${it.valid.length}` });
    this.foot.append(h('div', { class: 'ta-row' }, h('span', { class: 'ta-count' }, this.taCount, ' gevonden'), h('button', { class: 'ghost ta-give', type: 'button', text: 'Laat zien', onclick: () => this.giveUpTapAll(it) })));
    svg.addEventListener('click', e => {
      if (this.answered || this.cur !== it) return;
      const c = e.target.closest && e.target.closest('.cell');
      if (!c) return;
      const s = Number(c.dataset.s), f = Number(c.dataset.f);
      if (ta.found.some(p => p.s === s && p.f === f)) return;
      if (it.valid.some(p => p.s === s && p.f === f)) {
        ta.found.push({ s, f }); ta.flash = null; draw();
        this.taCount.textContent = `${ta.found.length} van ${it.valid.length}`;
        Fx.pop($$('.mk.found circle', svg).pop());
        Haptics.play('tap'); Sfx.play('tap');
        if (ta.found.length === it.valid.length) this.doneTapAll(it, fig);
      } else {
        // fout getikt: laat zien welke noot daar wel ligt
        ta.miss++; ta.flash = { s, f }; draw();
        Fx.shake(fig); Fx.edge('bad'); Haptics.play('wrong');
        clearTimeout(ta.t); ta.t = setTimeout(() => { if (ta.flash && ta.flash.s === s && ta.flash.f === f) { ta.flash = null; draw(); } }, 900);
      }
    });
  },
  // klaar met tikken. Een misser telt naar verhouding: één misser op zes plekken is nog goed.
  doneTapAll(it, fig, gaveUp) {
    const ta = this.ta, frac = gaveUp ? 1 : Math.min(1, ta.miss / it.valid.length);
    const where = `${it.name}: ${it.valid.map(p => `${STR_LETTER[p.s]}-snaar ${p.f === 0 ? 'los' : 'fret ' + p.f}`).join(', ')}`;
    this.fxEl = fig; this.via = 'tap';
    this.mistakes += frac;
    if (frac < 0.34) { this.doneIds.add(it._id); this.right(it, ta.miss ? `Gevonden, op ${ta.miss === 1 ? 'één misser' : ta.miss + ' missers'} na` : null, null, where); }
    else {
      if (!it._again) this.queue.push(Object.assign({}, it, { _again: true })); else this.doneIds.add(it._id);
      this.wrong(it, gaveUp ? 'Hier liggen ze' : `Gevonden, met ${ta.miss} ${ta.miss === 1 ? 'misser' : 'missers'}`, '', where);
    }
    this.drawTapAll();
    this.updateBar();
  },
  giveUpTapAll(it) {
    if (this.answered || this.cur !== it) return;
    const ta = this.ta;
    ta.shown = it.valid.filter(p => !ta.found.some(q => q.s === p.s && q.f === p.f)).map(p => ({ s: p.s, f: p.f, kind: 'reveal', label: it.name }));
    this.doneTapAll(it, $('.tapneck', this.body), true);
  },
  // goed beantwoord. In een herhaalronde schuift de vraag een vakje door:
  // van nu naar morgen, daarna over 3 en over 7 dagen, en dan heb je hem onder de knie.
  right(it, title, auto, answer) {
    let note = '', icon = ICONS.retry, pool = it.type === 'play' ? 'play' : 'right', sound = 'right';
    if (this.bin && it._bin) {
      const r = Srs.correct(it._bin);
      if (r && r.from === 0) {
        this.fixed++; pool = 'fixed'; sound = 'fixed';
        note = 'Morgen komt hij nog één keer terug, om te kijken of hij blijft hangen.';
        Quests.bump('fixed');
      } else if (r) {
        this.recalled++; pool = 'recall'; sound = 'fixed';
        if (r.mastered) { this.mastered++; icon = ICONS.star; note = 'Onder de knie! Deze vraag komt niet meer terug.'; }
        else note = `Een vakje verder: je ziet hem over ${r.days} dagen terug.`;
      }
      // oude opdracht "herhaal vragen die vandaag terugkomen", ook als het pas de tweede keer lukt
      if (r && it._box) Quests.bump('srs');
      if (r) { Quests.bump('herhaal'); Fx.pop($('.ls-bin', this.el)); }
    }
    if (it._again && (pool === 'right' || pool === 'play')) pool = 'again';
    this.combo++;
    const milestone = [3, 5, 8, 12].includes(this.combo) || (this.combo > 12 && this.combo % 5 === 0);
    if (milestone) this.showCombo(this.combo);
    Track.answer(it, true, this.spec && this.spec.topic);
    Quests.max('combo', this.combo);
    Score.combo(this.combo);
    Fx.restart(this.barFill.parentElement, 'glow');
    Feedback.right({ el: this.fxEl, via: this.via, sound, big: milestone });
    this.feedback(true, title || (milestone && Feedback.streak(this.combo)) || Feedback.word(pool), it.type === 'name' || it.type === 'tapall' ? '' : it.explain || '', auto, note, '', icon, answer || '');
  },
  // fout: de vraag komt terug bij Herhalen (weer vanaf het begin) en in deze les nog een keer
  wrong(it, title, text, answer) {
    const lost = this.combo;
    this.combo = 0;
    Track.answer(it, false, this.spec && this.spec.topic);
    const again = !it._again && this.queue.some(q => q._id === it._id);
    let note;
    if (this.bin) {
      const prev = it._bin ? Srs.entry(it._bin) : null, back = prev && prev.box > 0;
      Bin.add(it);
      note = `${back ? 'Terug naar het begin. ' : ''}${again ? 'Je krijgt hem zo nog een keer.' : 'Hij komt de volgende keer terug.'}`;
    } else {
      this.wrongKeys.add(Bin.add(it, this.spec && this.spec.title, (this.spec && this.spec.topic) || it._topic));
      note = again ? 'Je krijgt hem straks nog een keer, en hij komt terug bij Herhalen.' : 'Hij komt terug bij Herhalen.';
    }
    Feedback.wrong({ el: this.fxEl, via: this.via });
    const lift = lost >= 3 ? `Jammer van je ${lost} op rij. Je pakt de draad zo weer op.` : this.mistakes <= 1 || Math.random() < 0.35 ? Feedback.word('lift') : '';
    this.feedback(false, title || Feedback.word(it._again ? 'wrongAgain' : 'wrong'), text, 0, note, lift, ICONS.retry, answer);
  },
  showCombo(n) {
    clearTimeout(this.comboT);
    this.comboEl.innerHTML = `${ICONS.flame}<b>${n} op rij!</b>`;
    Fx.restart(this.comboEl, 'show');
    this.comboT = setTimeout(() => this.comboEl.classList.remove('show'), 1600);
  },
  // feedbackpaneel: vinkje of kruisje bij de fret, het goede antwoord met een pijl, en hoeveel vragen er nog komen
  feedback(ok, title, text, auto, note, lift, icon, answer) {
    this.answered = true;
    clearTimeout(this.autoT);
    this.foot.innerHTML = '';
    this.foot.className = 'ls-foot ' + (ok ? 'ok' : 'bad');
    const left = this.queue.filter(q => q.type !== 'learn').length;
    this.foot.append(
      h('div', { class: 'fb', role: 'status' },
        h('span', { class: 'fb-fret' }, h('span', { html: Mascot.svg(ok ? (this.combo >= 5 ? 'juich' : 'blij') : 'oeps', { crop: 'head' }) }), h('span', { class: 'fb-mark ' + (ok ? 'ok' : 'bad'), html: ok ? ICONS.check : ICONS.close })),
        h('div', { class: 'fb-body' },
          h('div', { class: 'fb-head' }, h('b', { class: 'fb-title', text: title }), h('small', { class: 'fb-left', text: left ? `nog ${left} ${left === 1 ? 'vraag' : 'vragen'}` : 'klaar!' })),
          answer ? h('p', { class: 'fb-answer' }, h('span', { class: 'fb-arrow', text: '→' }), h('span', { text: answer })) : null,
          text ? h('p', { text: text.trim() }) : null,
          note ? h('p', { class: 'fb-note' }, h('span', { html: icon || ICONS.retry }), note) : null,
          lift ? h('p', { class: 'fb-lift', text: lift }) : null)),
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
    this.fxEl = $('.ls-big', this.body); this.via = 'tap';
    this.wrong(it, 'Overgeslagen', it.hint || '', ans);
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
    const miss = text => { toast.textContent = text; Fx.shake($('.ls-big', this.body)); Fx.edge('bad'); };
    if (st.k === 'set') {
      const pc = mod12(n.midi);
      if (st.pcs.includes(pc)) {
        if (!ps.found.has(pc)) { ps.found.add(pc); toast.textContent = ''; this.renderSteps(); Fx.pop($$('.slots .slot.on', this.body).pop()); if (ps.found.size === st.pcs.length) this.playDone(); }
      } else miss(`${heard} hoort er niet bij`);
      return;
    }
    let ok, wantPc = st.pc;
    if (st.k === 'rel') {
      if (ps.last == null) return;
      const want = ps.last + st.semis;
      wantPc = mod12(want);
      ok = Store.settings.strict || Math.abs(st.semis) === 12 ? n.midi === want : mod12(n.midi) === mod12(want);
    } else ok = mod12(n.midi) === st.pc;
    if (ok) {
      ps.last = n.midi; ps.idx++;
      toast.textContent = ps.idx < it.steps.length ? 'Goed, verder' : '';
      this.renderSteps();
      if (ps.idx < it.steps.length) Fx.pop($$('.slots .slot.on', this.body).pop());
      if (ps.idx >= it.steps.length) this.playDone();
      return;
    }
    if (ps.last != null && mod12(n.midi) === mod12(ps.last)) return;   // vorige noot klinkt nog
    miss(`Je speelde ${heard}.${mod12(n.midi) === wantPc ? ' Goede noot, ander octaaf.' : DrillFx.near(n.midi, wantPc)}`);
  },
  playDone() {
    const it = this.cur;
    this.doneIds.add(it._id); this.updateBar();
    this.fxEl = $('.ls-big', this.body); this.via = 'mic';
    this.right(it, null, 1500);
  },

  finish() {
    if (this.finished) return;
    this.finished = true; this.cur = null;
    clearTimeout(this.comboT); this.comboEl.classList.remove('show');
    const sp = this.spec, secs = (performance.now() - this.t0) / 1000;
    const accuracy = this.total ? Math.max(0, (this.total - this.mistakes) / this.total) : 1;
    const perfect = this.mistakes === 0 && this.skipped === 0;
    const need = sp.pass || (sp.test ? 0.8 : 0), passed = accuracy >= need;
    const speed = this.times.length ? this.times.reduce((a, b) => a + b, 0) / this.times.length : null;
    let xp, title, sub, mood, party = false, how = '';
    if (this.bin) {
      const good = this.fixed + this.recalled, todo = Srs.todoCount();
      xp = 2 * good + (good && !this.mistakes ? 5 : 0) + 5 * this.mastered;
      if (good && !todo) {
        // alles herhaald wat er klaarstond: 10 XP extra
        Bin.reward(); xp += 10;
        title = this.mastered ? 'Onder de knie!' : 'Alles herhaald!'; mood = 'juich'; party = !this.mistakes || this.mastered > 0;
        sub = this.mastered ? `${this.mastered === 1 ? 'Eén vraag komt' : `${this.mastered} vragen komen`} niet meer terug. Voor vandaag is alles herhaald: 10 XP extra.` : 'Voor vandaag is alles herhaald. Je krijgt 10 XP extra.';
      } else {
        title = good ? `${good} van ${this.total} goed` : 'Nog niet onthouden';
        mood = good ? 'ehbo' : 'oeps';
        sub = todo ? `Nog ${todo} ${todo === 1 ? 'vraag' : 'vragen'} te herhalen.` : '';
      }
      // zo werkt herhalen: uitleg op het moment dat het gebeurt
      how = this.fixed ? 'Wat je nu goed had, komt morgen terug. Weet je het dan nog, dan zie je het na 3 en daarna na 7 dagen nog één keer.' : '';
      if (xp) Progress.addXP(xp);
    } else {
      xp = passed ? (sp.xp || 10) + (perfect ? 5 : 0) : 5;
      Progress.addXP(xp);
      if (sp.onFinish) sp.onFinish({ passed, accuracy, perfect, secs, xp });
      title = !passed ? 'Nog niet gehaald' : sp.test ? 'Unittoets gehaald!' : sp.label ? (perfect ? `${sp.label}: foutloos!` : `${sp.label} ${sp.pass ? 'gehaald' : 'klaar'}!`) : perfect ? 'Foutloos!' : 'Les voltooid!';
      mood = !passed ? 'oeps' : perfect || sp.test || sp.pass ? 'juich' : 'blij';
      party = passed && (perfect || sp.test || !!sp.pass);
      sub = !passed ? (sp.test ? 'Je hebt 80% goed nodig. Herhaal de lessen van deze unit en probeer het nog eens.' : `Je hebt ${Math.round(need * 100)}% goed nodig. De vragen zijn elke keer anders: probeer het nog eens.`) : sp.sub || sp.title || '';
    }
    // alles wat je in deze les verdiende (niveau, dagdoel, opdrachten, plectrums): hier in één overzicht
    Badges.check();
    const got = Moments.take();
    if (got.some(m => m.big)) party = true;
    this.body.innerHTML = '';
    this.body.classList.remove('enter');
    this.foot.className = 'ls-foot';
    this.foot.innerHTML = '';
    const mm = `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
    const xpEl = h('b', { text: `+${xp}` }), pctEl = h('b', { text: `${Math.round(accuracy * 100)}%` });
    this.body.append(h('div', { class: 'ls-end' + (got.length ? ' has-moments' : '') },
      h('div', { class: 'end-fret' + (party ? ' party' : ''), html: Mascot.svg(mood) }),
      h('h2', { class: 'end-title', text: title }),
      sub ? h('p', { class: 'help', text: sub }) : null,
      h('div', { class: 'end-stats' },
        h('div', {}, h('small', { text: 'XP' }), xpEl),
        this.bin ? h('div', {}, h('small', { text: 'Goed' }), h('b', { text: `${this.fixed + this.recalled}/${this.total}` })) : h('div', {}, h('small', { text: 'Goed' }), pctEl),
        speed != null ? h('div', {}, h('small', { text: 'Per noot' }), h('b', { text: `${fmt1(speed)} s` })) : h('div', {}, h('small', { text: 'Tijd' }), h('b', { text: mm }))),
      this.bin ? h('div', { class: 'end-srs' }, Srs.row({ delta: Srs.delta(this.srsBefore) }), how ? h('p', { class: 'help', text: how }) : null) : null,
      got.length ? Moments.list(got, 'Verdiend') : null,
      Progress.goalLine()));
    countUp(xpEl, xp, { prefix: '+', delay: 250 });
    if (!this.bin) countUp(pctEl, Math.round(accuracy * 100), { suffix: '%', delay: 350 });
    this.counter.textContent = '';
    this.barFill.style.width = '100%';
    const done = () => { const s = this.spec; this.spec = null; if (s && s.onDone) s.onDone({ passed }); else location.hash = ''; };
    // fouten uit deze les: meteen herhalen voor bonus-XP
    const fixable = this.bin ? [] : [...this.wrongKeys].filter(k => Bin.has(k));
    if (fixable.length && Bin.items(fixable).length) {
      this.foot.append(h('button', { class: 'primary big fix-btn', type: 'button', html: `${ICONS.retry}<span>Herhaal je ${fixable.length === 1 ? 'fout' : `${fixable.length} fouten`} (+${Bin.bonusXP(fixable.length)} XP)</span>`, onclick: () => { const s = this.spec; this.spec = null; Bin.start({ keys: fixable, after: () => { if (s && s.onDone) s.onDone({ passed }); else location.hash = ''; } }); } }),
        h('button', { class: 'big', type: 'button', text: 'Verder', onclick: done }));
    } else if (this.bin && Srs.items().length) {
      this.foot.append(h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: done }),
        h('button', { class: 'big', type: 'button', text: 'Nog een ronde', onclick: () => { const s = this.spec; this.spec = null; Srs.start({ after: s && s.onDone ? () => s.onDone({ passed: true }) : null }); } }));
    } else this.foot.append(h('button', { class: 'primary big', type: 'button', text: 'Verder', onclick: done }));
    // één geluid en één keer confetti voor alles samen
    Sfx.play(got.some(m => m.big) ? 'goal' : 'done');
    if (party) setTimeout(() => Confetti.burst({ n: this.bin ? 70 : 90 }), 200);
  },
};
