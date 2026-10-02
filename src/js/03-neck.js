// ---------- Hals tekenen ----------
// o = { from, to, highlight: [snaren], marks: [{s, f, kind, label}], range: {min, max} | null }
function drawNeck(svg, o) {
  const narrow = (svg.getBoundingClientRect().width || 1000) < 560;
  const W = narrow ? (o.tap ? 470 : 640) : 1000, TOP = 16, GAP = 30, BOARD_H = 28 + 5 * GAP, X0 = 86;
  const from = Math.max(0, o.from || 0), to = Math.max(from + 3, o.to == null ? 12 : o.to);
  const d = n => 1 - Math.pow(2, -n / 12);
  const leftN = from === 0 ? 0 : from - 1;
  const S = (W - 12 - X0) / (d(to + 0.45) - d(leftN));
  const xOf = n => X0 + S * (d(n) - d(leftN));
  const cellW = f => (f === 0 ? 40 : xOf(f) - xOf(f - 1));
  const midOf = f => (f === 0 ? X0 - 32 : (xOf(f - 1) + xOf(f)) / 2);
  const yOf = s => TOP + 14 + s * GAP;
  const yB = TOP + BOARD_H;
  const hl = new Set(o.highlight || []);
  const strStart = from === 0 ? X0 - 52 : X0 - 18;
  svg.setAttribute('viewBox', `0 0 ${W} 244`);
  let h = '<defs><linearGradient id="fjwood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w1"/><stop offset=".5" class="w2"/><stop offset="1" class="w1"/></linearGradient></defs>';
  h += `<rect x="${X0}" y="${TOP}" width="${W - X0}" height="${BOARD_H}" fill="url(#fjwood)"/>`;
  for (let i = 0; i < 9; i++) {
    const y = TOP + 10 + i * (BOARD_H - 20) / 8, a = 3 + (i * 7) % 5, ph = i * 1.7;
    let p = `M${X0} ${y.toFixed(1)}`;
    for (let x = X0 + 60; x <= W; x += 60) p += ` L${x} ${(y + a * Math.sin(x / 140 + ph)).toFixed(1)}`;
    h += `<path class="grain" d="${p}"/>`;
  }
  if (o.range) {
    for (let f = Math.max(1, from); f <= to; f++) {
      if (f < o.range.min || f > o.range.max) h += `<rect class="shade" x="${xOf(f - 1).toFixed(1)}" y="${TOP}" width="${cellW(f).toFixed(1)}" height="${BOARD_H}"/>`;
    }
    if (to >= o.range.max) h += `<rect class="shade" x="${xOf(to).toFixed(1)}" y="${TOP}" width="${(W - xOf(to)).toFixed(1)}" height="${BOARD_H}"/>`;
  }
  const midY = (yOf(2) + yOf(3)) / 2;
  for (let f = Math.max(1, from); f <= to; f++) {
    if ([3, 5, 7, 9, 15, 17, 19].includes(f)) h += `<circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${midY}" r="8"/>`;
    if (f === 12) h += `<circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${(yOf(1) + yOf(2)) / 2}" r="8"/><circle class="inlay" cx="${midOf(f).toFixed(1)}" cy="${(yOf(3) + yOf(4)) / 2}" r="8"/>`;
  }
  for (let f = Math.max(1, from); f <= to; f++) {
    const x = xOf(f).toFixed(1);
    h += `<line class="fretw" x1="${x}" y1="${TOP}" x2="${x}" y2="${yB}"/><line class="freth" x1="${x - 1}" y1="${TOP}" x2="${x - 1}" y2="${yB}"/>`;
  }
  if (from === 0) h += `<rect class="nut" x="${X0 - 9}" y="${TOP - 3}" width="10" height="${BOARD_H + 6}" rx="2"/>`;
  else h += `<line class="fretw" x1="${X0}" y1="${TOP}" x2="${X0}" y2="${yB}"/>`;
  for (let s = 0; s < 6; s++) {
    const y = yOf(s), w = 1 + GAUGE[s] / 12, wound = s >= 3, isT = hl.has(s);
    if (isT) h += `<line class="glow" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${(w + 10).toFixed(1)}"/>`;
    h += `<line class="str${wound ? ' wound' : ''}${isT ? ' target' : ''}" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${w.toFixed(1)}"/>`;
    if (wound) h += `<line class="wind" x1="${strStart}" y1="${y}" x2="${W}" y2="${y}" stroke-width="${(w * 0.55).toFixed(1)}"/>`;
    h += `<text class="slbl${isT ? ' target' : ''}" x="16" y="${y + 7}" text-anchor="middle">${STR_LETTER[s]}</text>`;
  }
  const few = to - from <= 8;
  for (let f = Math.max(1, from); f <= to; f++) {
    if (few || [3, 5, 7, 9, 12, 15, 17, 19].includes(f)) h += `<text class="fnum" x="${midOf(f).toFixed(1)}" y="${yB + 30}" text-anchor="middle">${f}</text>`;
  }
  for (const m of o.marks || []) {
    if (m.f < from || m.f > to) continue;
    const x = midOf(m.f).toFixed(1), y = yOf(m.s);
    const r = Math.max(9, Math.min(16, cellW(m.f) * 0.44));
    const fs = Math.max(10, Math.min(15, r * 0.95));
    const lbl = m.label == null ? '' : String(m.label);
    h += `<g class="mk ${m.kind || ''}"><circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>${lbl ? `<text x="${x}" y="${(y + fs * 0.34).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}">${lbl}</text>` : ''}</g>`;
  }
  if (o.tap) {
    for (let s = 0; s < 6; s++) for (let f = Math.max(0, from); f <= to; f++) {
      const x0 = f === 0 ? X0 - 50 : xOf(f - 1), x1 = f === 0 ? X0 - 6 : xOf(f);
      h += `<rect class="cell" data-s="${s}" data-f="${f}" x="${x0.toFixed(1)}" y="${(yOf(s) - GAP / 2).toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${GAP}"/>`;
    }
  }
  svg.innerHTML = h;
}
