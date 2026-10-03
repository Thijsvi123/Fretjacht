// lege svg voor een hals, met een beschrijving voor schermlezers
const svgEl = label => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); return s; };

// ---------- Halsquiz: noten op de hals, zonder gitaar ----------
// Gedeeld door de Halsjacht (leerpad) en de oefening Welke noot? (Oefenen).
const FretQuiz = {
  pcAt(s, f) { return mod12(OPEN[s] + f); },
  nameAt(s, f) { return SHARP_NAMES[this.pcAt(s, f)]; },
  // "lage E-snaar, 5e fret" of "A-snaar, los"
  label(s, f) { return `${STR_NAME[s]}, ${f === 0 ? 'los' : `${f}e fret`}`; },
  // "fret 5 van de lage E-snaar" of "de losse A-snaar"
  where(s, f) { return f === 0 ? `de losse ${STR_NAME[s]}` : `fret ${f} van de ${STR_NAME[s]}`; },
  // naam met beide spellingen voor een noot tussen de stamtonen: "F♯ (G♭)"
  both(pc) { return NATURAL.has(pc) ? SHARP_NAMES[pc] : `${SHARP_NAMES[pc]} (${FLAT_NAMES[pc]})`; },
  // alle plekken van een toonklasse op deze snaren binnen het bereik
  spots(pc, strings, from, to) {
    const out = [];
    for (const s of strings) for (let f = from; f <= to; f++) if (mod12(OPEN[s] + f) === pc) out.push({ s, f });
    return out;
  },
  // stamtonen in de buurt als geheugensteun: "G op 3, A op 5, B op 7"
  near(s, f) {
    const out = [];
    for (let g = Math.max(0, f - 3); g <= Math.min(15, f + 3); g++) if (g !== f && NATURAL.has(this.pcAt(s, g))) out.push(g === 0 ? `${this.nameAt(s, g)} los` : `${this.nameAt(s, g)} op ${g}`);
    return out.slice(0, 3).join(', ');
  },
  // toetsenbord als een stukje piano: stamtonen onder, kruizen en mollen erboven, alleen waar ze bestaan
  keypad(all, onPick) {
    const el = h('div', { class: 'keypad' + (all ? ' k12' : ' k7'), role: 'group', 'aria-label': 'Kies de noot' });
    LETTERS.forEach((n, i) => el.append(h('button', { type: 'button', class: 'key nat', style: `--c:${2 * i + 1}`, 'data-pc': String(LETTER_PC[i]), 'aria-label': n, onclick: e => onPick(LETTER_PC[i], e.currentTarget) }, h('b', { text: n }))));
    if (all) [1, 3, 6, 8, 10].forEach(pc => {
      const col = { 1: 2, 3: 4, 6: 8, 8: 10, 10: 12 }[pc];
      el.append(h('button', { type: 'button', class: 'key acc', style: `--c:${col}`, 'data-pc': String(pc), 'aria-label': `${SHARP_NAMES[pc]} of ${FLAT_NAMES[pc]}`, onclick: e => onPick(pc, e.currentTarget) }, h('b', { text: SHARP_NAMES[pc] }), h('small', { text: FLAT_NAMES[pc] })));
    });
    return el;
  },
  // na het antwoord: goede toets groen, gekozen foute toets rood
  markKeys(pad, right, picked) {
    $$('.key', pad).forEach(k => {
      k.disabled = true;
      const pc = Number(k.dataset.pc);
      if (pc === right) k.classList.add('right');
      else if (k === picked) k.classList.add('wrong');
    });
  },
  stats() { const st = Store.stats; return st.fb || (st.fb = { items: {}, found: 0, n: 0, ok: 0, best: 0 }); },
  // per plek bijhouden hoe vaak en hoe snel je hem goed had
  record(s, f, ok, secs) {
    const fb = this.stats(), k = s + '-' + f, it = fb.items[k] || (fb.items[k] = { n: 0, ok: 0, t: 0 });
    it.n++; fb.n++;
    if (ok) { it.ok++; it.t += Math.min(secs, 20); fb.found++; fb.ok++; Quests.bump('noteq'); }
    Store.saveStats();
  },
  // zwakke plekken krijgen meer kans: vaak fout, traag of nog nooit gezien
  weight(s, f) {
    const it = this.stats().items[s + '-' + f];
    if (!it || !it.n) return 1.6;
    const miss = 1 - it.ok / it.n, slow = it.ok ? Math.min(2, it.t / it.ok / 3) : 1.5;
    return 0.6 + 2.5 * miss + slow;
  },
  // only: true of 'nat' = alleen stamtonen, 'acc' = alleen kruizen en mollen
  pickSpot(strings, from, to, only, prev) {
    const cands = [];
    for (const s of strings) for (let f = from; f <= to; f++) {
      const nat = NATURAL.has(this.pcAt(s, f));
      if ((only === true || only === 'nat') && !nat) continue;
      if (only === 'acc' && nat) continue;
      if (prev && prev.s === s && prev.f === f) continue;
      cands.push({ s, f, w: this.weight(s, f) });
    }
    if (!cands.length) return { s: strings[0], f: from };
    let r = Math.random() * cands.reduce((a, c) => a + c.w, 0);
    for (const c of cands) { r -= c.w; if (r <= 0) return c; }
    return cands[cands.length - 1];
  },
  // kleur per plek voor de halskaart: groen = snel en goed, rood = lastig
  heat(s, f) {
    const it = this.stats().items[s + '-' + f];
    if (!it || !it.n) return null;
    const acc = it.ok / it.n, avg = it.ok ? it.t / it.ok : 9;
    if (acc < 0.5) return 5;
    if (acc < 0.75 || avg > 6) return 4;
    if (acc < 0.9 || avg > 4) return 3;
    if (avg > 2.5) return 2;
    return 1;
  },
};

// ---------- Score: noten gevonden, nauwkeurigheid, beste reeks ----------
const Score = {
  answers() {
    const st = Store.stats;
    if (!st.answers) {
      // eerste keer: tellen wat er al was
      let r = 0, w = 0;
      for (const t of Object.values(st.topics || {})) { r += t.r || 0; w += t.w || 0; }
      const eq = st.earq || { ok: {}, n: {} };
      const eok = Object.values(eq.ok || {}).reduce((a, b) => a + b, 0), en = Object.values(eq.n || {}).reduce((a, b) => a + b, 0);
      st.answers = { r: r + eok, w: w + Math.max(0, en - eok) };
    }
    return st.answers;
  },
  answer(ok) { const a = this.answers(); if (ok) a.r++; else a.w++; },
  // nauwkeurigheid in procenten, pas vanaf 10 antwoorden
  accuracy() { const a = this.answers(), n = a.r + a.w; return n >= 10 ? Math.round(100 * a.r / n) : null; },
  notes() { const st = Store.stats; return (st.notes.found || 0) + ((st.fb && st.fb.found) || 0); },
  combo(n) {
    const st = Store.stats;
    if (n > (st.bestCombo || 0)) {
      st.bestCombo = n;
      if (n === 10) setTimeout(() => Badges.check(), 400);
    }
  },
};
