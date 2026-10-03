// ---------- Feedback bij goed en fout: trillen, animatie, geluid en een motiverend bericht ----------
// Trillen: Android via navigator.vibrate. Op een iPhone (iOS 18 en nieuwer) geeft een klik op een
// <input type="checkbox" switch> een tikje; dat gebruiken we als er geen vibrate is.
// Tijdens het spelen (microfoon) trilt de app niet, anders hoort hij de telefoon zelf.
const Haptics = {
  el: null,
  ios: /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  on() { return Store.settings.haptics !== false; },
  tap() {
    if (!this.el || !this.el.isConnected) {
      this.el = h('label', { class: 'hx', 'aria-hidden': 'true' }, h('input', { type: 'checkbox', switch: true, tabindex: '-1' }));
      document.body.append(this.el);
    }
    this.el.click();
    const inp = this.el.firstChild;
    if (document.activeElement === inp) inp.blur();
  },
  // right: één tikje, wrong: twee, big: drie (een reeks of mijlpaal)
  play(kind) {
    if (!this.on()) return;
    const P = { tap: [10], right: [18], wrong: [40, 70, 40], big: [22, 60, 22, 60, 45] }[kind] || [15];
    try {
      if (typeof navigator.vibrate === 'function' && !this.ios) { navigator.vibrate(P); return; }
      if (!this.ios) return;
      const n = Math.ceil(P.length / 2);
      this.tap();
      for (let i = 1; i < n; i++) setTimeout(() => this.tap(), i * 120);
    } catch (e) {}
  },
};

// ---------- Kleine animaties ----------
const NOTE_GLYPHS = [
  '<svg viewBox="0 0 24 24"><ellipse cx="8.5" cy="18" rx="4.8" ry="3.5" transform="rotate(-20 8.5 18)" fill="currentColor"/><path d="M12.8 17V3.5c1 3.4 5.6 4.2 4.6 8.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 24 24"><ellipse cx="6" cy="19" rx="4" ry="3" transform="rotate(-20 6 19)" fill="currentColor"/><ellipse cx="17.5" cy="16.5" rx="4" ry="3" transform="rotate(-20 17.5 16.5)" fill="currentColor"/><path d="M9.6 18.2V6.2M21.1 15.7V3.7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.6 6.2l11.5-2.5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 3c4.4 0 7.5 1.6 7.5 4.6 0 4.1-4.2 9.6-7.5 13.4C8.7 17.2 4.5 11.7 4.5 7.6 4.5 4.6 7.6 3 12 3z" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3L2.5 12l7.3-2.2z" fill="currentColor"/></svg>',
];
const Fx = {
  restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); },
  pop(el) { if (!reducedMotion()) this.restart(el, 'fx-pop'); },
  shake(el) { this.restart(el, 'shake'); },
  // gloed langs de rand van het scherm: ook uit je ooghoek te zien als je naar je gitaar kijkt
  edge(kind) {
    if (reducedMotion()) return;
    let el = document.getElementById('fxEdge');
    if (!el) { el = h('div', { id: 'fxEdge', class: 'fx-edge', 'aria-hidden': 'true' }); document.body.append(el); }
    el.className = 'fx-edge'; void el.offsetWidth; el.className = 'fx-edge ' + kind;
  },
  // een handvol noten en plectrums springt uit een knop of noot
  notes(el, o = {}) {
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    const n = o.n || 7, box = h('div', { class: 'fx-notes', 'aria-hidden': 'true', style: `left:${(r.left + r.width / 2).toFixed(0)}px;top:${(r.top + r.height / 2).toFixed(0)}px` });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.25 + (Math.random() - 0.5) * 0.35, d = (o.dist || 54) + Math.random() * 34;
      box.append(h('i', { style: `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--r:${((Math.random() - 0.5) * 80).toFixed(0)}deg;--c:${CONFETTI_COLORS[(i + 1) % CONFETTI_COLORS.length]};--t:${i * 16}ms`, html: NOTE_GLYPHS[i % NOTE_GLYPHS.length] }));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 1000);
  },
};

// ---------- Motiverende berichten ----------
const CHEER = {
  right: ['Goed zo!', 'Precies!', 'Klopt!', 'Netjes!', 'Top!', 'Lekker bezig!', 'Helemaal goed!', 'Knap!', 'Mooi zo!', 'Zo doe je dat!'],
  play: ['Raak!', 'Zuiver!', 'Mooi gespeeld!', 'Dat klinkt!', 'Strak!', 'Netjes gespeeld!'],
  again: ['Nu wel!', 'Tweede keer goed!', 'Zie je wel!', 'Die zit erin!'],
  fixed: ['Hersteld!', 'Opgelost!', 'Die zit!', 'Gerepareerd!'],
  recall: ['Goed onthouden!', 'Nog steeds goed!', 'Blijft hangen!', 'Paraat!'],
  wrong: ['Net niet', 'Bijna!', 'Niet helemaal', 'Nog niet', 'Oei, net mis'],
  wrongAgain: ['Nog lastig', 'Deze is taai', 'Nog niet helemaal'],
  lift: ['Van fouten leer je het meest.', 'Zo onthoud je hem straks beter.', 'Even goed kijken, dan lukt hij de volgende keer.', 'Elke fout is een stapje vooruit.', 'Ook de beste gitaristen spelen weleens een valse noot.'],
};
const STREAK_LINES = { 3: 'Drie op rij!', 5: 'Vijf op rij, lekker bezig!', 8: 'Acht op rij! Niet te stoppen.', 10: 'Tien op rij! Applaus.', 15: 'Vijftien op rij. Encore!', 20: 'Twintig op rij. Legendarisch!' };
const Feedback = {
  last: {},
  // een woord uit de lijst, niet twee keer hetzelfde achter elkaar
  word(pool) {
    const arr = CHEER[pool] || CHEER.right;
    let w = arr[0];
    for (let i = 0; i < 5; i++) { w = pick(arr); if (w !== this.last[pool]) break; }
    this.last[pool] = w;
    return w;
  },
  streak(n) { return STREAK_LINES[n] || (n > 20 && n % 10 === 0 ? `${n} op rij!` : ''); },
  // goed antwoord. o.el licht op, o.via: 'tap' (scherm) of 'mic' (gespeeld), o.sound: soort geluidje, o.big: een reeks of mijlpaal
  right(o = {}) {
    if (o.via !== 'mic') Haptics.play(o.big ? 'big' : 'right');
    if (o.sound !== false) Sfx.play(o.sound || 'right');
    // bij een grote noot springen de noten uit de letter zelf, niet uit het midden van de regel
    if (o.el) { Fx.pop(o.el); Fx.notes(o.el.classList.contains('note') ? o.el.firstElementChild || o.el : o.el, { n: o.big ? 11 : 7 }); }
    Fx.edge('ok');
  },
  wrong(o = {}) {
    if (o.via !== 'mic') { Haptics.play('wrong'); if (o.sound !== false) Sfx.play('wrong'); }
    if (o.el) Fx.shake(o.el);
    Fx.edge('bad');
  },
};

// ---------- Oefeningen met de microfoon: het kaartje licht op en telt je reeks ----------
// Hier geen trillen of foutgeluid: dat zou de microfoon horen.
const DrillFx = {
  n: 0, id: null,
  sync() { const id = current && current.id; if (id !== this.id) { this.id = id; this.n = 0; } },
  // info: wat er goed ging (fret, tijd); er komt een aanmoediging voor
  hit(card, info, o = {}) {
    this.sync(); this.n++;
    const note = $('.pr-note', card), toast = $('.pr-toast', card), line = this.n >= 3 ? Feedback.streak(this.n) : '';
    card.classList.remove('nope'); card.classList.add('hit');
    if (toast && info != null) toast.textContent = `${line || Feedback.word(o.pool || 'play')} ${info}`.trim();
    Fx.pop(note); Fx.notes(note && (note.firstElementChild || note), { n: line ? 10 : 6 }); Fx.edge('ok');
    this.badge(card);
    if (o.via === 'tap') Haptics.play(line ? 'big' : 'right');
    if (o.sound === 'ding' || o.sound == null) Engine.ding(Math.min(this.n - 1, 7));
    else if (o.sound) Sfx.play(o.sound);
  },
  // foute noot: kaartje schudt even rood, de reeks begint opnieuw
  miss(card, text, o = {}) {
    this.sync();
    this.n = 0; this.badge(card);
    const toast = $('.pr-toast', card);
    if (toast && text) toast.textContent = text;
    card.classList.add('nope');
    clearTimeout(card._nope); card._nope = setTimeout(() => card.classList.remove('nope'), 650);
    Fx.shake($('.pr-note', card)); Fx.edge('bad');
    if (o.via === 'tap') { Haptics.play('wrong'); if (o.sound !== false) Sfx.play('wrong'); }
  },
  reset(card) { this.n = 0; if (card) this.badge(card); },
  badge(card) {
    let b = $('.pr-streak', card);
    if (this.n < 3) { if (b) b.classList.remove('show'); return; }
    if (!b) { b = h('span', { class: 'pr-streak', 'aria-live': 'polite' }); card.append(b); }
    b.innerHTML = `${ICONS.flame}<b>${this.n} op rij</b>`;
    Fx.restart(b, 'show');
  },
  // hulp bij een foute noot: hoeveel frets je ernaast zat (zelfde snaar)
  near(midi, pc) {
    const d = ((mod12(midi) - pc) % 12 + 18) % 12 - 6;
    if (!d || Math.abs(d) > 2) return '';
    return ` Net ernaast: ${Math.abs(d) === 1 ? 'één fret' : 'twee frets'} te ${d < 0 ? 'laag' : 'hoog'}.`;
  },
};
