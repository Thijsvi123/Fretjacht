// ---------- Hals tekenen ----------
// o = { from, to, highlight: [snaren], marks: [{s, f, kind, label}], range: {min, max} | null,
//       tap: tikvakjes aan, big: grote stippen (uitleg en vragen waar de naam ertoe doet),
//       touch: een hals om op te tikken. Op de telefoon liggen de snaren dan verder uit elkaar en staat een
//              lange hals in twee rijen (fret 0–6 en 7–12), zodat elk vakje groot genoeg is voor je vinger,
//       zoom: {from, to}: op de telefoon alleen dit stuk van de hals,
//       active: [snaren]: alleen deze snaren zijn aan te tikken; hun vakjes lopen door tot halverwege de buursnaar }
function drawNeck(svg, o) {
  const narrow = (svg.getBoundingClientRect().width || 1000) < 560, touch = narrow && !!o.touch;
  let from = Math.max(0, o.from || 0), to = Math.max(from + 3, o.to == null ? 12 : o.to);
  if (narrow && o.zoom) { from = Math.max(0, o.zoom.from); to = Math.max(from + 3, o.zoom.to); }
  const W = narrow ? (o.tap || o.big || touch ? 470 : 640) : 1000, TOP = 16, GAP = touch ? 36 : 30, BOARD_H = 28 + 5 * GAP, X0 = 86;
  const ROW_H = TOP + BOARD_H + (touch ? 44 : 50);
  // twee rijen: de tweede rij gaat verder waar de eerste ophoudt, met dezelfde fretbreedtes
  const mid = touch && to - from >= 9 ? from + Math.ceil((to - from) / 2) : null;
  const rows = mid == null ? [[from, to]] : [[from, mid], [mid + 1, to]];
  const d = n => 1 - Math.pow(2, -n / 12);
  const hl = new Set(o.highlight || []);
  const act = o.active && o.active.length && o.active.length < 6 ? o.active.slice().sort((a, b) => a - b) : null;
  let h = '<defs><linearGradient id="fjwood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w1"/><stop offset=".5" class="w2"/><stop offset="1" class="w1"/></linearGradient></defs>';
  rows.forEach(([a, b], ri) => {
    const oy = ri * ROW_H, top = oy + TOP;
    const leftN = a === 0 ? 0 : a - 1;
    const S = (W - 12 - X0) / (d(b + 0.45) - d(leftN));
    const xOf = n => X0 + S * (d(n) - d(leftN));
    const cellW = f => (f === 0 ? 40 : xOf(f) - xOf(f - 1));
    const midOf = f => (f === 0 ? X0 - 32 : (xOf(f - 1) + xOf(f)) / 2);
    const yOf = s => top + 14 + s * GAP;
    const yB = top + BOARD_H;
    const strStart = a === 0 ? X0 - 52 : X0 - 18;
    h += `<rect x="${X0}" y="${top}" width="${W - X0}" height="${BOARD_H}" fill="url(#fjwood)"/>`;
    for (let i = 0; i < 9; i++) {
      const y = top + 10 + i * (BOARD_H - 20) / 8, amp = 3 + (i * 7) % 5, ph = i * 1.7 + ri;
      let p = `M${X0} ${y.toFixed(1)}`;
      for (let x = X0 + 60; x <= W; x += 60) p += ` L${x} ${(y + amp * Math.sin(x / 140 + ph)).toFixed(1)}`;
      h += `<path class="grain" d="${p}"/>`;
    }
    if (o.range) {
      for (let f = Math.max(1, a); f <= b; f++) {
        if (f < o.range.min || f > o.range.max) h += `<rect class="shade" x="${xOf(f - 1).toFixed(1)}" y="${top}" width="${cellW(f).toFixed(1)}" height="${BOARD_H}"/>`;
      }
      if (b >= o.range.max) h += `<rect class="shade" x="${xOf(b).toFixed(1)}" y="${top}" width="${(W - xOf(b)).toFixed(1)}" height="${BOARD_H}"/>`;
    }
    const midY = (yOf(2) + yOf(3)) / 2;
    for (let f = Math.max(1, a); f <= b; f++) {
      if ([3, 5, 7, 9, 15, 17, 19].includes(f)) h += `<circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${midY}" r="8"/>`;
      if (f === 12) h += `<circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${(yOf(1) + yOf(2)) / 2}" r="8"/><circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${(yOf(3) + yOf(4)) / 2}" r="8"/>`;
    }
    for (let f = Math.max(1, a); f <= b; f++) {
      const x = xOf(f).toFixed(1);
      h += `<line class="fretw" x1="${x}" y1="${top}" x2="${x}" y2="${yB}"/><line class="freth" x1="${x - 1}" y1="${top}" x2="${x - 1}" y2="${yB}"/>`;
    }
    if (a === 0) h += `<rect class="nut" x="${X0 - 9}" y="${top - 3}" width="10" height="${BOARD_H + 6}" rx="2"/>`;
    else h += `<line class="fretw" x1="${X0}" y1="${top}" x2="${X0}" y2="${yB}"/>`;
    for (let s = 0; s < 6; s++) {
      const y = yOf(s), w = 1 + GAUGE[s] / 12, wound = s >= 3, isT = hl.has(s);
      if (isT) h += `<line class="glow" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${(w + 10).toFixed(1)}"/>`;
      h += `<line class="str${wound ? ' wound' : ''}${isT ? ' target' : ''}" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${w.toFixed(1)}"/>`;
      if (wound) h += `<line class="wind" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${(w * 0.55).toFixed(1)}"/>`;
      h += `<text class="slbl${isT ? ' target' : ''}" x="16" y="${y + 7}" text-anchor="middle">${STR_LETTER[s]}</text>`;
    }
    const few = b - a <= 8;
    for (let f = Math.max(1, a); f <= b; f++) {
      if (few || [3, 5, 7, 9, 12, 15, 17, 19].includes(f)) h += `<text class="fnum" x="${midOf(f).toFixed(1)}" y="${yB + (touch ? 28 : 30)}" text-anchor="middle">${f}</text>`;
    }
    for (const m of o.marks || []) {
      if (m.f < a || m.f > b) continue;
      const x = midOf(m.f).toFixed(1), y = yOf(m.s);
      // big: grotere stippen en letters, voor uitleg en vragen waar de naam ertoe doet
      const r = o.big ? Math.max(12, Math.min(touch ? 17 : 15, cellW(m.f) * 0.5)) : Math.max(9, Math.min(16, cellW(m.f) * 0.44));
      const fs = o.big ? Math.min(touch ? 19 : 17, r * 1.08) : Math.max(10, Math.min(15, r * 0.95));
      const lbl = m.label == null ? '' : String(m.label);
      h += `<g class="mk ${m.kind || ''}"><circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>${lbl ? `<text x="${x}" y="${(y + fs * 0.34).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}">${lbl}</text>` : ''}</g>`;
    }
    if (o.tap) {
      // tikvakjes; met active alleen op die snaren, en dan zo hoog dat je er niet naast tikt
      const strs = act || [0, 1, 2, 3, 4, 5];
      strs.forEach((s, k) => {
        const y0 = act ? (k === 0 ? top - 8 : (yOf(strs[k - 1]) + yOf(s)) / 2) : yOf(s) - GAP / 2;
        const y1 = act ? (k === strs.length - 1 ? yB + 8 : (yOf(s) + yOf(strs[k + 1])) / 2) : yOf(s) + GAP / 2;
        for (let f = a; f <= b; f++) {
          const x0 = f === 0 ? X0 - 50 : xOf(f - 1), x1 = f === 0 ? X0 - 6 : xOf(f);
          h += `<rect class="cell" data-s="${s}" data-f="${f}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}"/>`;
        }
      });
    }
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${ROW_H * rows.length}`);
  svg.classList.toggle('two-rows', rows.length > 1);
  svg.innerHTML = h;
}
