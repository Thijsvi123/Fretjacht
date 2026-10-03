// ---------- Huisstijl: de fret (mascotte), pedaalkleuren, illustraties ----------
// "Fretjacht" is letterlijk jagen met een fret. De mascotte is dus een fret, met een plectrum.
const FUR = {
  line: '#2B1A14', face: '#F4E3C9', cap: '#B98A63', mask: '#4A2F22', muzzle: '#FFF9F0', earIn: '#E4A498',
  body: '#6B4632', bib: '#F4E3C9', paw: '#4A2F22', tail: '#553524', nose: '#E8868C', noseLine: '#9C4B51',
  eye: '#1B110D', pick: '#F5A31A', pickLine: '#B5520F', plaster: '#F0C49A', plasterPad: '#E2A574', blush: '#F2A08F',
};
const Mascot = {
  // mood: blij, juich, oeps, luister, ehbo, slaap, denk. crop: 'head' toont alleen het hoofd.
  svg(mood = 'blij', o = {}) {
    const F = FUR, L = `stroke="${F.line}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
    const thin = `stroke="${F.line}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    const head = o.crop === 'head', raised = mood === 'juich' && !head, wave = mood === 'zwaai' && !head;
    const arm = (d) => `<path d="${d}" fill="none" stroke="${F.line}" stroke-width="22" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${F.paw}" stroke-width="14" stroke-linecap="round"/>`;
    let s = '';
    // staart en lijf (niet bij alleen het hoofd)
    if (!head) {
      s += `<path d="M146 198c26-4 44-24 40-50-3-16-16-24-26-18 10 9 12 29-1 44-6 8-14 13-22 16z" fill="${F.tail}" ${L}/>`;
      s += `<path d="M56 126c-18 18-23 46-19 74h126c4-28-1-56-19-74z" fill="${F.body}" ${L}/>`;
      s += `<path d="M78 130c-6 20-2 44 22 56 24-12 28-36 22-56z" fill="${F.bib}"/>`;
    }
    // armen
    if (raised) s += arm('M60 146C36 136 22 104 22 54') + arm('M140 146c24-10 38-42 38-92');
    if (wave) s += `<g class="m-wave">${arm('M140 146c22-8 34-34 36-70')}<ellipse cx="176" cy="72" rx="12" ry="10" fill="${F.paw}" ${L}/></g>`;
    // oren
    s += `<circle cx="46" cy="60" r="17" fill="${F.face}" ${L}/><circle cx="47" cy="61" r="8.5" fill="${F.earIn}"/>`;
    s += `<circle cx="154" cy="60" r="17" fill="${F.face}" ${L}/><circle cx="153" cy="61" r="8.5" fill="${F.earIn}"/>`;
    // hoofd met kap, masker en snuit
    s += `<path d="M100 30c40 0 66 22 66 54 0 26-18 42-40 48-10 3-18 8-26 8s-16-5-26-8c-22-6-40-22-40-48 0-32 26-54 66-54z" fill="${F.face}" ${L}/>`;
    s += `<path d="M100 33c27 0 48 12 59 30-14-6-32-7-44-1-6 3-11 7-15 12-4-5-9-9-15-12-12-6-30-5-44 1 11-18 32-30 59-30z" fill="${F.cap}"/>`;
    s += `<path d="M40 88c4-14 22-21 40-15 10 3 14 6 20 6s10-3 20-6c18-6 36 1 40 15 2 10-10 18-24 18-12 0-22-6-28-11-5-3-11-3-16 0-6 5-16 11-28 11-14 0-26-8-24-18z" fill="${F.mask}"/>`;
    s += `<ellipse cx="100" cy="114" rx="30" ry="21" fill="${F.muzzle}"/>`;
    // ogen
    if (mood === 'juich' || mood === 'luister') {
      s += `<path d="M58 92q11-14 22 0M120 92q11-14 22 0" stroke="${F.muzzle}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    } else if (mood === 'slaap') {
      s += `<path d="M58 88q11 9 22 0M120 88q11 9 22 0" stroke="${F.muzzle}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    } else {
      const up = mood === 'denk' ? -3 : 0, dx = mood === 'denk' ? 2 : 0;
      s += `<g class="m-eyes"><ellipse cx="${69 + dx}" cy="${88 + up}" rx="10" ry="11.5" fill="${F.eye}"/><ellipse cx="${131 + dx}" cy="${88 + up}" rx="10" ry="11.5" fill="${F.eye}"/>`;
      s += `<circle cx="${65.5 + dx}" cy="${83.5 + up}" r="4" fill="#fff"/><circle cx="${127.5 + dx}" cy="${83.5 + up}" r="4" fill="#fff"/><circle cx="${72.5 + dx}" cy="${92.5 + up}" r="1.8" fill="#fff"/><circle cx="${134.5 + dx}" cy="${92.5 + up}" r="1.8" fill="#fff"/></g>`;
    }
    if (mood === 'oeps') s += `<path d="M56 68q10-7 22-3M144 68q-10-7-22-3" ${thin}/>`;
    // wangetjes
    if (mood === 'juich' || mood === 'blij' || mood === 'ehbo' || mood === 'zwaai') s += `<ellipse cx="62" cy="110" rx="7" ry="4.5" fill="${F.blush}" opacity=".55"/><ellipse cx="138" cy="110" rx="7" ry="4.5" fill="${F.blush}" opacity=".55"/>`;
    // neus, snorharen, mond
    s += `<path d="M89 102c4-5 18-5 22 0-1 6-6 10-11 10s-10-4-11-10z" fill="${F.nose}" stroke="${F.noseLine}" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<path d="M74 112l-24-5M74 118l-24 2M126 112l24-5M126 118l24 2" stroke="${F.line}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`;
    if (mood === 'juich') s += `<path d="M86 117c4 13 24 13 28 0z" fill="${F.line}"/><path d="M92 124c4 4 12 4 16 0-4-3-12-3-16 0z" fill="${F.nose}"/>`;
    else if (mood === 'oeps') s += `<path d="M90 121c3-3 6-3 10 0s7 3 10 0" ${thin}/>`;
    else if (mood === 'slaap' || mood === 'denk') s += `<path d="M95 119h10" ${thin}/>`;
    else s += `<path d="M100 112v4M100 116c-3 6-11 6-13 1M100 116c3 6 11 6 13 1" ${thin}/>`;
    // extra's
    if (mood === 'oeps') s += `<path d="M163 44c5 7 7 11 7 14a7 7 0 0 1-14 0c0-3 2-7 7-14z" fill="#7FC3EF" stroke="${F.line}" stroke-width="2.5" stroke-linejoin="round"/>`;
    if (mood === 'ehbo') s += `<g transform="rotate(-28 136 56)"><rect x="116" y="48" width="40" height="16" rx="8" fill="${F.plaster}" ${L} stroke-width="3"/><rect x="130" y="48" width="12" height="16" fill="${F.plasterPad}"/><circle cx="123" cy="56" r="1.4" fill="${F.line}" opacity=".4"/><circle cx="149" cy="56" r="1.4" fill="${F.line}" opacity=".4"/></g>`;
    if (mood === 'luister') {
      s += `<path d="M38 66c-2-40 26-58 62-58s64 18 62 58" fill="none" stroke="${F.line}" stroke-width="12" stroke-linecap="round"/><path d="M38 66c-2-40 26-58 62-58s64 18 62 58" fill="none" stroke="${F.pick}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<rect x="24" y="54" width="24" height="36" rx="11" fill="${F.pick}" ${L}/><rect x="152" y="54" width="24" height="36" rx="11" fill="${F.pick}" ${L}/>`;
    }
    if (mood === 'slaap') s += `<path d="M150 22h12l-12 14h12M170 6h8l-8 10h8" stroke="${F.pick}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (mood === 'denk') s += `<g class="m-dots" fill="${F.pick}" stroke="${F.line}" stroke-width="2.5"><circle cx="152" cy="30" r="5"/><circle cx="168" cy="20" r="6.5"/><circle cx="186" cy="10" r="8"/></g>`;
    // plectrum in de pootjes
    const pick = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0-16c13 0 20 4 20 11C20 6 9 18 0 26-9 18-20 6-20-5c0-7 7-11 20-11z" fill="${F.pick}" stroke="${F.pickLine}" stroke-width="3" stroke-linejoin="round"/><path d="M-6-8c4-2 9-2 12 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/></g>`;
    if (head) { /* alleen het hoofd */ } else if (raised) {
      s += pick(180, 26, 14);
      s += `<ellipse cx="22" cy="50" rx="12" ry="10" fill="${F.paw}" ${L}/><ellipse cx="178" cy="50" rx="12" ry="10" fill="${F.paw}" ${L}/>`;
    } else if (wave) {
      s += pick(96, 168, -8);
      s += `<ellipse cx="80" cy="168" rx="12" ry="10" fill="${F.paw}" ${L}/><ellipse cx="114" cy="170" rx="11" ry="9" fill="${F.paw}" ${L}/>`;
    } else {
      s += pick(100, 168, 0);
      s += `<ellipse cx="80" cy="168" rx="12" ry="10" fill="${F.paw}" ${L}/><ellipse cx="120" cy="168" rx="12" ry="10" fill="${F.paw}" ${L}/>`;
      s += `<path d="M76 172v-4M84 172v-4M116 172v-4M124 172v-4" stroke="${F.face}" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>`;
    }
    if (mood === 'juich') s += `<path d="M44 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM182 120l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="${F.pick}"/>`;
    const vb = head ? '16 2 168 168' : '0 0 200 200';
    const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
    return `<svg class="mascot m-${mood}${o.cls ? ' ' + o.cls : ''}" viewBox="${vb}"${size} aria-hidden="true">${s}</svg>`;
  },
};

// ---------- Extra iconen ----------
Object.assign(ICONS, {
  plaster: svgI('<path d="M12 2.5v19" stroke-width="3" opacity=".35"/><g transform="rotate(-40 12 12)"><rect x="2.5" y="8" width="19" height="8" rx="4"/><path d="M9.5 8v8M14.5 8v8"/><circle cx="12" cy="10.6" r=".2"/><circle cx="12" cy="13.4" r=".2"/></g>'),
  pedal: svgI('<rect x="5" y="2.5" width="14" height="19" rx="3"/><circle cx="9" cy="6.8" r="1.2"/><circle cx="15" cy="6.8" r="1.2"/><circle cx="12" cy="15.5" r="3"/>'),
  sound: svgI('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: svgI('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  play: svgI('<path d="M8 5.5v13l10.5-6.5z"/>', true),
});

// ---------- Illustraties per oefening (48×48, lijnen in currentColor) ----------
const artSvg = body => `<svg viewBox="0 0 48 48" aria-hidden="true" class="art" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ART = {
  notes: artSvg('<path d="M4 13h40M4 24h40M4 35h40" opacity=".55"/><path d="M15 6v36M33 6v36" stroke-width="3.4"/><circle cx="24" cy="24" r="10.5"/><circle cx="24" cy="24" r="4.5" fill="currentColor"/>'),
  positions: artSvg('<path d="M4 9h40M4 19h40M4 29h40M4 39h40" opacity=".55"/><circle cx="11" cy="39" r="4" fill="currentColor"/><circle cx="20" cy="29" r="4" fill="currentColor"/><circle cx="29" cy="19" r="4" fill="currentColor"/><circle cx="38" cy="9" r="4" fill="currentColor"/>'),
  intervals: artSvg('<path d="M4 34h40" opacity=".55"/><circle cx="12" cy="34" r="5" fill="currentColor"/><circle cx="36" cy="34" r="5" fill="currentColor"/><path d="M12 25c3-14 21-14 24 0"/><path d="M31.5 21.5l4.5 3.5 2.5-5.2"/>'),
  degrees: artSvg('<path d="M5 42h9v-8h9v-8h9v-8h9v-8"/><circle cx="41" cy="5.5" r="3.5" fill="currentColor"/><path d="M9.5 38v-1M18.5 30v-1M27.5 22v-1" stroke-width="3"/>'),
  scales: artSvg('<path d="M6 8h36M6 16h36M6 24h36M6 32h36M6 40h36" opacity=".45"/><path d="M17 4v40M31 4v40" opacity=".8"/><circle cx="11" cy="8" r="3.4" fill="currentColor"/><circle cx="24" cy="16" r="3.4" fill="currentColor"/><circle cx="11" cy="24" r="3.4" fill="currentColor"/><circle cx="37" cy="24" r="3.4" fill="currentColor"/><circle cx="24" cy="32" r="3.4" fill="currentColor"/><circle cx="11" cy="40" r="3.4" fill="currentColor"/>'),
  chords: artSvg('<rect x="8" y="5" width="32" height="38" rx="3"/><path d="M8 15h32M8 25h32M8 34h32M18.7 5v38M29.3 5v38" opacity=".55"/><circle cx="18.7" cy="20" r="4" fill="currentColor"/><circle cx="29.3" cy="20" r="4" fill="currentColor"/><circle cx="24" cy="29.5" r="4" fill="currentColor"/>'),
  bends: artSvg('<path d="M4 36h12c8 0 10-4 13-12l3-9" /><path d="M27.5 16.5l4.5-4 3 5.4"/><path d="M4 36h40" opacity=".35"/><circle cx="16" cy="36" r="4" fill="currentColor"/>'),
  ear: artSvg('<path d="M14 20a11 11 0 0 1 22 0c0 7-6 9-8 14-1.6 4-4 7-8 7a6 6 0 0 1-6-6"/><path d="M20 21a5 5 0 0 1 10 0c0 3-3 4-4 6"/><path d="M38 6v12" /><circle cx="35" cy="18.5" r="3" fill="currentColor"/><path d="M38 6l5 2"/>'),
  challenge: artSvg('<circle cx="24" cy="27" r="16"/><path d="M24 11V6M19 4h10M37 13l3-3"/><path d="M24 27V18"/><path d="M24 27l7 5"/>'),
  heatmap: artSvg('<rect x="6" y="6" width="10" height="10" rx="2.5" fill="currentColor" opacity=".25"/><rect x="19" y="6" width="10" height="10" rx="2.5" fill="currentColor" opacity=".9"/><rect x="32" y="6" width="10" height="10" rx="2.5" fill="currentColor" opacity=".5"/><rect x="6" y="19" width="10" height="10" rx="2.5" fill="currentColor" opacity=".7"/><rect x="19" y="19" width="10" height="10" rx="2.5" fill="currentColor" opacity=".25"/><rect x="32" y="19" width="10" height="10" rx="2.5" fill="currentColor"/><rect x="6" y="32" width="10" height="10" rx="2.5" fill="currentColor" opacity=".5"/><rect x="19" y="32" width="10" height="10" rx="2.5" fill="currentColor" opacity=".7"/><rect x="32" y="32" width="10" height="10" rx="2.5" fill="currentColor" opacity=".25"/>'),
  metro: artSvg('<path d="M17 6h14l8 36H9z"/><path d="M13 32h22" opacity=".55"/><path d="M24 34L33 12"/><circle cx="31" cy="17" r="3" fill="currentColor"/>'),
  tuner: artSvg('<path d="M6 34a18 18 0 0 1 36 0"/><path d="M24 34l7-14"/><circle cx="24" cy="34" r="3.4" fill="currentColor"/><path d="M24 12v4M10.5 19l2.8 2.8M37.5 19l-2.8 2.8" opacity=".6"/>'),
};

// ---------- Kleuren voor units en pedalen ----------
const UNIT_COLORS = ['amber', 'blauw', 'framboos', 'violet', 'groen', 'tabak'];
const MODE_COLOR = { notes: 'blauw', positions: 'blauw', intervals: 'blauw', degrees: 'blauw', scales: 'framboos', chords: 'framboos', bends: 'framboos', ear: 'violet', challenge: 'groen', heatmap: 'groen', metro: 'leisteen', tuner: 'leisteen' };
const CONFETTI_COLORS = ['#F5A31A', '#2D6BD4', '#C4336F', '#7146D4', '#0B9C8E', '#FFD27A'];
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Confetti van muzieknoten en plectrums ----------
const Confetti = {
  burst(o = {}) {
    if (reducedMotion()) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const n = o.n || 80, x0 = o.x != null ? o.x : W / 2, y0 = o.y != null ? o.y : H * 0.38;
    const parts = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, v = 7 + Math.random() * 9;
      return { x: x0 + (Math.random() - 0.5) * 40, y: y0 + (Math.random() - 0.5) * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.24, s: 0.8 + Math.random() * 0.7,
        kind: i % 3 === 0 ? 'pick' : i % 3 === 1 ? 'note' : 'beam', c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], wob: Math.random() * 6.28 };
    });
    const t0 = performance.now(), DUR = o.dur || 2600;
    let last = t0;
    const draw = p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s, p.s);
      ctx.fillStyle = p.c; ctx.strokeStyle = p.c;
      if (p.kind === 'pick') {
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.bezierCurveTo(7, -8, 10, -6, 10, -2.5); ctx.bezierCurveTo(10, 3, 4.5, 9, 0, 13); ctx.bezierCurveTo(-4.5, 9, -10, 3, -10, -2.5); ctx.bezierCurveTo(-10, -6, -7, -8, 0, -8); ctx.fill();
      } else {
        ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        const head = (x, y) => { ctx.beginPath(); ctx.ellipse(x, y, 4.6, 3.4, -0.45, 0, 6.29); ctx.fill(); };
        if (p.kind === 'note') {
          head(-3, 8); ctx.beginPath(); ctx.moveTo(1, 7); ctx.lineTo(1, -10); ctx.quadraticCurveTo(7, -6, 7, 0); ctx.stroke();
        } else {
          head(-7, 9); head(7, 6); ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, -9); ctx.moveTo(11, 5); ctx.lineTo(11, -12); ctx.stroke();
          ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(11, -12); ctx.stroke();
        }
      }
      ctx.restore();
    };
    const step = now => {
      const dt = Math.min(2.2, (now - last) / 16.67), el = now - t0;
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = el > DUR - 700 ? Math.max(0, (DUR - el) / 700) : 1;
      for (const p of parts) {
        p.vy += 0.34 * dt; p.vx *= Math.pow(0.985, dt); p.vy *= Math.pow(0.99, dt);
        p.wob += 0.12 * dt;
        p.x += (p.vx + Math.sin(p.wob) * 0.6) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        draw(p);
      }
      if (el < DUR) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  },
};

// ---------- Geluidjes met gitaarklank (Karplus-Strong uit de engine) ----------
const Sfx = {
  last: 0, lastPri: 0,
  on() { return Store.settings.sound !== false; },
  play(kind) {
    if (!this.on()) return;
    const pri = { tap: 0, right: 1, wrong: 1, fixed: 2, done: 2, goal: 3 }[kind] || 0, now = performance.now();
    if (now - this.last < 900 && pri < this.lastPri) return;
    this.last = now; this.lastPri = pri;
    let ctx;
    try { ctx = Engine.ensureCtx(); } catch (e) { return; }
    const t = ctx.currentTime + 0.03;
    const seq = (notes, gap, dur, gain) => { notes.forEach((m, i) => Engine.pluck(m, t + i * gap, dur, gain)); Engine.block((notes.length * gap + dur) * 1000 + 250); };
    if (kind === 'right') seq([76, 80, 83], 0.06, 0.5, 0.32);
    else if (kind === 'wrong') { Engine.pluck(47, t, 0.11, 0.38); Engine.pluck(46, t + 0.1, 0.16, 0.32); Engine.block(500); }
    else if (kind === 'fixed') seq([72, 77, 84], 0.07, 0.55, 0.32);
    else if (kind === 'done') seq([57, 61, 64, 69, 73], 0.035, 0.9, 0.3);
    else if (kind === 'goal') seq([69, 72, 74, 76, 79, 81], 0.075, 0.7, 0.32);
    else if (kind === 'tap') { Engine.click(t, false); }
  },
};

// ---------- Laadanimatie: de fret springt over de frets ----------
const LOADER_LINES = [
  'Leg je telefoon dicht bij je gitaar.',
  'Een blije fret springt alle kanten op. In het Engels heet dat de weasel war dance.',
  'Fretten slapen 14 tot 18 uur per dag. Jouw dagdoel is een stuk korter.',
  'Geen gitaar bij de hand? Tik op “Ik kan nu niet spelen”.',
  'Foute antwoorden gaan naar je foutenbak. Herstel ze voor bonus-XP.',
];
const Loader = {
  // toont de laadanimatie minstens min ms (en tot o.wait klaar is) en voert dan go() uit
  run(o, go) {
    const el = h('div', { class: 'loader', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'ld-stage', 'aria-hidden': 'true' },
        h('div', { class: 'ld-board' }, [0, 1, 2, 3, 4].map(i => h('i', { style: `--i:${i}` }))),
        h('div', { class: 'ld-fret', html: Mascot.svg(o.mood || 'blij', { crop: 'head' }) })),
      h('b', { class: 'ld-title', text: o.title || '' }),
      h('span', { class: 'ld-sub', text: o.sub || pick(LOADER_LINES) }));
    document.body.append(el);
    const t0 = performance.now(), min = reducedMotion() ? 250 : (o.min || 900);
    const done = () => {
      setTimeout(() => {
        go();
        el.classList.add('out');
        setTimeout(() => el.remove(), 260);
      }, Math.max(0, min - (performance.now() - t0)));
    };
    Promise.resolve(o.wait).then(done, done);
  },
};

// ---------- Getal laten oplopen ----------
function countUp(el, to, o = {}) {
  const pre = o.prefix || '', suf = o.suffix || '', dur = o.dur || 700;
  if (reducedMotion() || !to) { el.textContent = pre + to + suf; return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + Math.round(to * e) + suf;
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = pre + '0' + suf;
  setTimeout(() => requestAnimationFrame(step), o.delay || 0);
}

// ---------- Tijdelijke instellingen voor een oefening (bij een les of sessie) ----------
const TempSettings = {
  saved: null,
  apply(mode, set) {
    if (!set || !Store.settings[mode]) return;
    if (!this.saved || this.saved.mode !== mode) { this.restore(); this.saved = { mode, prev: JSON.parse(JSON.stringify(Store.settings[mode])) }; }
    Object.assign(Store.settings[mode], set);
  },
  restore() {
    if (!this.saved) return;
    const cur = Store.settings[this.saved.mode], prev = this.saved.prev;
    for (const k of Object.keys(cur)) if (!(k in prev)) delete cur[k];
    Object.assign(cur, prev);
    this.saved = null;
    Store.saveSettings();
  },
};
