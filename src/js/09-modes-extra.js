// ---------- 60 seconden ----------
registerMode({
  id: 'challenge', group: 'uitdaging', title: '60 seconden', desc: 'Zoveel mogelijk noten vinden in één minuut',
  homeStat: st => (st.challenge.best ? `record ${st.challenge.best} noten` : ''),
  mount(view) {
    this.card = promptCard('Uitdaging');
    this.timerEl = h('div', { class: 'timer', text: '60' });
    this.card.prepend(this.timerEl);
    this.statsEl = h('div', { class: 'card' });
    const L = exLayout(view, {
      prompt: this.card, caption: h('span', { text: rangeCaption() }),
      actions: [{ id: 'goBtn', label: 'Begin', key: 'b', onClick: () => this.begin() }],
      stats: this.statsEl,
    });
    this.svg = L.svg; this.keys = L.keys;
    this.goBtn = $('#goBtn', L.ctrl);
    this.ready();
    this.renderStats();
  },
  unmount() { clearInterval(this.iv); clearTimeout(this.cd); this.state = 'off'; },
  ready() {
    this.state = 'ready';
    this.timerEl.textContent = '60';
    $('.pr-note', this.card).innerHTML = '<span class="deg">60 s</span>';
    $('.pr-where', this.card).innerHTML = `Zoveel mogelijk noten op de juiste snaar${Store.stats.challenge.best ? `<small>record ${Store.stats.challenge.best}</small>` : ''}`;
    $('.pr-toast', this.card).textContent = Engine.mic ? 'Druk op Begin' : 'Druk op Start en daarna op Begin';
    $('.pr-leds', this.card).hidden = false;
    setLeds(this.card, 0);
    this.card.classList.remove('hit');
    drawNeck(this.svg, { from: 0, to: Math.max(12, Store.settings.maxFret), range: { min: Store.settings.minFret, max: Store.settings.maxFret } });
  },
  async begin() {
    if (this.state === 'run' || this.state === 'count') return;
    if (!Engine.mic && !(await Engine.startMic())) return;
    this.state = 'count';
    let n = 3;
    const step = () => {
      if (this.state !== 'count') return;
      if (n === 0) return this.run();
      $('.pr-note', this.card).innerHTML = `<span class="deg">${n}</span>`;
      $('.pr-where', this.card).textContent = 'Maak je klaar…';
      n--; this.cd = setTimeout(step, 800);
    };
    step();
  },
  run() {
    this.state = 'run'; this.score = 0; this.times = []; this.endsAt = performance.now() + 60000;
    this.target = null; this.nextTarget();
    clearInterval(this.iv);
    this.iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.endsAt - performance.now()) / 1000));
      this.timerEl.textContent = String(left);
      this.timerEl.classList.toggle('low', left <= 10);
      if (left <= 0) this.end();
    }, 200);
  },
  nextTarget() {
    this.target = NoteGame.pick(this.target);
    this.hold = { hold: 0 }; this.elapsed = 0;
    const t = this.target;
    $('.pr-note', this.card).innerHTML = bigNoteHTML(t.name);
    $('.pr-where', this.card).innerHTML = `op de <b>${STR_NAME[t.s]}</b><small>${this.score} gevonden</small>`;
    $('.pr-toast', this.card).textContent = '';
    setLeds(this.card, 0);
    drawNeck(this.svg, { from: 0, to: Math.max(12, Store.settings.maxFret), highlight: [t.s], range: { min: Store.settings.minFret, max: Store.settings.maxFret } });
  },
  expected() { return this.state === 'run' ? this.target.midis : []; },
  onFrame(f, dt) {
    if (this.state !== 'run') return;
    this.elapsed += dt;
    const ok = NoteGame.hold(this.hold, f, dt, m => NoteGame.matches(this.target, m));
    setLeds(this.card, this.hold.hold);
    if (ok) {
      this.score++; this.times.push(this.elapsed);
      NoteGame.record(this.target, this.elapsed, false);
      Engine.blip();
      this.nextTarget();
      // de nieuwe noot springt erin, de vorige spat uiteen in noten
      const note = $('.pr-note', this.card);
      Fx.notes(note.firstElementChild || note, { n: 5, dist: 40 }); Fx.pop(note); Fx.edge('ok');
      if ([10, 20, 30, 40].includes(this.score)) { Fx.pop(this.timerEl); $('.pr-toast', this.card).textContent = `${this.score} al! ${Feedback.word('play')}`; }
    }
  },
  end() {
    clearInterval(this.iv);
    this.state = 'end';
    const st = Store.stats.challenge, rec = this.score > st.best;
    st.runs++; st.last = this.score;
    if (rec) st.best = this.score;
    Store.saveStats();
    Quests.max('challenge', this.score);
    this.timerEl.textContent = '0';
    this.card.classList.add('hit');
    $('.pr-note', this.card).innerHTML = `<span class="deg">${this.score}</span>`;
    const avg = this.times.length ? this.times.reduce((a, b) => a + b, 0) / this.times.length : 0;
    $('.pr-where', this.card).innerHTML = `${this.score === 1 ? 'noot' : 'noten'} gevonden${this.times.length ? `<small>gemiddeld ${fmt1(avg)} s</small>` : ''}`;
    $('.pr-toast', this.card).textContent = rec && this.score ? 'Nieuw record!' : `Record: ${st.best}. Druk op Begin voor een nieuwe ronde.`;
    setLeds(this.card, 0);
    Engine.chime();
    Fx.pop($('.pr-note', this.card));
    if (rec && this.score) setTimeout(() => Confetti.burst({ n: 80 }), 150);
    this.renderStats();
  },
  renderStats() {
    const st = Store.stats.challenge;
    this.statsEl.innerHTML = '';
    this.statsEl.append(h('p', { class: 'eyebrow', text: 'Scores' }), statFigs([{ label: 'Record', value: String(st.best) }, { label: 'Vorige ronde', value: String(st.last) }, { label: 'Rondes', value: String(st.runs) }]));
  },
});

// ---------- Hittekaart ----------
const heatLevel = avg => (avg < 2 ? 1 : avg < 3.5 ? 2 : avg < 5 ? 3 : avg < 8 ? 4 : 5);
registerMode({
  id: 'heatmap', group: 'uitdaging', title: 'Hittekaart', desc: 'Zie in één oogopslag welke plekken je nog lastig vindt',
  homeStat: st => { const n = Object.keys(st.notes.items).length; return n ? `${n} van 72 plekken geoefend` : ''; },
  mount(view) {
    const items = Store.stats.notes.items, S = Store.settings, to = Math.max(12, S.maxFret);
    const intro = h('div', { class: 'card' },
      h('p', { class: 'eyebrow', text: 'Hoe snel vind je elke noot?' }),
      h('p', { class: 'lead', text: 'Elke stip is een plek op de hals. Groen vind je snel, rood duurt lang, grijs heb je nog niet geoefend. Gebaseerd op Noten zoeken en de 60-secondenuitdaging.' }),
      h('div', { class: 'legend', html: '<span><i class="hz h1"></i>&lt; 2 s</span><span><i class="hz h2"></i>2–3,5 s</span><span><i class="hz h3"></i>3,5–5 s</span><span><i class="hz h4"></i>5–8 s</span><span><i class="hz h5"></i>&gt; 8 s</span><span><i class="hz h0"></i>nog niet</span>' }));
    const rows = Object.entries(items).filter(([, v]) => v.n > 0).map(([k, v]) => { const [s, pc] = k.split('-').map(Number); return { k, s, pc, avg: v.total / v.n, n: v.n }; }).sort((a, b) => b.avg - a.avg);
    this.weak = rows.slice(0, 8).map(r => r.k);
    const list = h('div', { class: 'card hard' }, h('p', { class: 'eyebrow', text: 'Zwakste plekken' }),
      rows.length ? h('ol', {}, rows.slice(0, 5).map(r => h('li', {}, h('span', { text: `${pcLabel(r.pc, S.names)} op de ${STR_NAME[r.s]}` }), h('span', { text: `${fmt1(r.avg)} s · ${r.n}×` })))) : h('p', { class: 'help', text: 'Nog geen gegevens. Speel eerst een paar rondes Noten zoeken.' }));
    const L = exLayout(view, {
      prompt: intro, mic: false,
      caption: h('span', { text: 'Op geoefende plekken staat de notenaam' }),
      actions: rows.length ? [{ id: 'focusBtn', label: 'Oefen je zwakste plekken', cls: 'primary', onClick: () => { MODES.notes.focus = this.weak; location.hash = '#m-notes'; } }] : [{ id: 'goNotes', label: 'Naar Noten zoeken', cls: 'primary', onClick: () => { location.hash = '#m-notes'; } }],
      stats: list,
    });
    const marks = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= to; f++) {
      const pc = mod12(OPEN[s] + f), it = items[s + '-' + pc];
      const seen = it && it.n;
      marks.push({ s, f, kind: 'heat h' + (seen ? heatLevel(it.total / it.n) : 0), label: seen ? pcName(pc, S.names === 'flats' ? 'flats' : 'sharps') : '' });
    }
    drawNeck(L.svg, { from: 0, to, marks });
    this.keys = L.keys;
  },
});

// ---------- Stemapparaat ----------
registerMode({
  id: 'tuner', group: 'handig', title: 'Stemapparaat', desc: 'Stem je gitaar, met referentietonen per snaar',
  mount(view) {
    this.card = h('div', { class: 'card prompt tuner-card' },
      h('p', { class: 'eyebrow', text: 'Stemmen' }),
      this.noteEl = h('div', { class: 'note tn-note', html: '<span>–</span>' }),
      this.infoEl = h('div', { class: 'where', text: Engine.mic ? 'Speel een open snaar' : 'Druk op Start' }),
      h('div', { class: 'meter big', 'aria-hidden': 'true' }, h('div', { class: 'zone' }), h('div', { class: 'track' }), h('div', { class: 'tick', style: 'left:50%' }), this.needle = h('div', { class: 'needle', hidden: true }), h('div', { class: 'scale', html: '<span>−50</span><span>0 cent</span><span>+50</span>' })));
    this.strBtns = h('div', { class: 'str-btns' }, [5, 4, 3, 2, 1, 0].map(s => h('button', { type: 'button', 'data-s': String(s), html: `${STR_LETTER[s]}<small>${pcName(OPEN[s], 'sharps')}${octaveOf(OPEN[s])}</small>`, onclick: () => { Engine.pluck(OPEN[s], Engine.ensureCtx().currentTime + 0.02, 1.4, 0.8); Engine.block(1500); } })));
    const L = exLayout(view, { prompt: this.card, neck: false, middle: h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Tik voor een referentietoon' }), this.strBtns) });
    this.keys = L.keys;
    UI.tuner = (hh, n, c, nm) => this.update(hh, n, c, nm);
  },
  unmount() { UI.tuner = null; },
  onMic(on) { this.infoEl.textContent = on ? 'Speel een open snaar' : 'Druk op Start'; },
  update(hh, n, c, nm) {
    if (!hh) { this.needle.hidden = true; $$('button', this.strBtns).forEach(b => b.classList.remove('near', 'ok')); return; }
    this.noteEl.innerHTML = bigNoteHTML(nm) + `<span class="sym">${octaveOf(n)}</span>`;
    let best = null;
    for (let s = 0; s < 6; s++) { const d = hh.midi - OPEN[s]; if (Math.abs(d) <= 2.5 && (!best || Math.abs(d) < Math.abs(best.d))) best = { s, d }; }
    let cents = c;
    if (best) {
      cents = Math.round(best.d * 100);
      const ok = Math.abs(cents) <= 5;
      this.infoEl.textContent = `${STR_NAME[best.s]} · ${ok ? 'gestemd' : `${Math.abs(cents)} cent ${cents < 0 ? 'te laag, draai hoger' : 'te hoog, draai lager'}`}`;
      $$('button', this.strBtns).forEach(b => { const on = Number(b.dataset.s) === best.s; b.classList.toggle('near', on && !ok); b.classList.toggle('ok', on && ok); });
    } else this.infoEl.textContent = `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)} cent`;
    this.needle.hidden = false;
    this.needle.style.left = `${clamp(50 + cents, 1, 99)}%`;
    this.needle.classList.toggle('ok', Math.abs(cents) <= 5);
  },
});

