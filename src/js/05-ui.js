// ---------- DOM-hulpjes ----------
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const ACC_SVG = {
  '♯': '<svg viewBox="0 0 50 100" aria-hidden="true"><path d="M14 10h6v88h-6zM30 2h6v88h-6zM4 38L46 26v14L4 52zM4 68L46 56v14L4 82z"/></svg>',
  '♭': '<svg viewBox="0 0 44 100" aria-hidden="true"><path fill-rule="evenodd" d="M6 0h7v55c7-8 17-11 23-7 8 5 6 18-4 28L6 98zM13 64v24c9-7 17-15 18-22 1-7-7-10-18-2z"/></svg>'
};
const bigNoteHTML = name => `<span>${name[0]}</span>${name[1] && ACC_SVG[name[1]] ? ACC_SVG[name[1]] : ''}`;
const spoken = n => n[0] + (n[1] === '♯' ? ' kruis' : n[1] === '♭' ? ' mol' : '');
const MODES = {};
const MODE_ORDER = [];
function registerMode(m) { MODES[m.id] = m; MODE_ORDER.push(m.id); }

// ---------- Bouwstenen ----------
function seg(options, value, onChange, cls) {
  const el = h('div', { class: 'seg' + (cls ? ' ' + cls : ''), role: 'group' });
  const render = v => $$('button', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  for (const o of options) el.append(h('button', { type: 'button', 'data-v': String(o.value), html: o.label, onclick: () => { render(o.value); onChange(o.value); } }));
  render(value);
  return el;
}
function chips(options, selected, onChange, min) {
  const el = h('div', { class: 'seg', role: 'group' });
  let sel = new Set(selected);
  const render = () => $$('button', el).forEach(b => b.setAttribute('aria-pressed', String(sel.has(b.dataset.v))));
  for (const o of options) el.append(h('button', { type: 'button', 'data-v': String(o.value), html: o.label, onclick: () => {
    const v = String(o.value);
    if (sel.has(v)) { if (sel.size <= (min || 1)) return; sel.delete(v); } else sel.add(v);
    render(); onChange(Array.from(sel));
  } }));
  sel = new Set(selected.map(String));
  render();
  return el;
}
function selectEl(id, options, value, onChange) {
  const el = h('select', { id, onchange: e => onChange(e.target.value) });
  for (const o of options) el.append(h('option', { value: String(o.value), text: o.label }));
  el.value = String(value);
  return el;
}
function checkEl(id, label, value, onChange, help) {
  const inp = h('input', { type: 'checkbox', id, onchange: e => onChange(e.target.checked) });
  inp.checked = !!value;
  return h('label', { class: 'check', for: id }, inp, h('span', {}, label, help ? h('span', { class: 'help block', text: help }) : null));
}
function field(label, control, help, forId) {
  return h('div', { class: 'field' }, forId ? h('label', { class: 'lbl', for: forId, text: label }) : h('span', { class: 'lbl', text: label }), control, help ? h('span', { class: 'help', text: help }) : null);
}

// ---------- UI ----------
const UI = {
  msgTimer: 0,
  showMsg(t) { const m = $('#msg'); m.textContent = t; m.hidden = false; },
  hideMsg() { $('#msg').hidden = true; },
  micState() {
    const pill = $('#micPill'), txt = $('#micText');
    const st = Engine.mic ? 'on' : Engine.starting ? 'busy' : 'off';
    pill.dataset.state = st;
    txt.textContent = st === 'on' ? 'Luistert' : st === 'busy' ? 'Toegang vragen…' : 'Microfoon uit';
    $$('.mic-btn').forEach(b => {
      b.textContent = st === 'on' ? 'Stop' : 'Start';
      b.classList.toggle('stop', st === 'on');
      b.disabled = st === 'busy';
    });
  },
  updateLevel(db) {
    const pct = v => clamp((v + 70) / 60 * 100, 0, 100);
    $$('.lvl-fill').forEach(el => { el.style.width = pct(db) + '%'; el.classList.toggle('loud', db >= Store.settings.gateDb); });
    $$('.lvl-gate').forEach(el => { el.style.left = pct(Store.settings.gateDb) + '%'; });
    $$('.lvl-text').forEach(el => { el.textContent = db > -100 ? `${Math.round(db)} dB` : '– dB'; });
  },
  lastHeard: '',
  updateHeard(hh) {
    let key, html;
    if (!hh) {
      key = Engine.mic ? 'stil' : 'uit';
      html = `Ik hoor <b>–</b><span>${Engine.mic ? '' : 'microfoon uit'}</span>`;
    } else {
      const n = Math.round(hh.midi), c = Math.round((hh.midi - n) * 100);
      const nm = pcName(n, Store.settings.names === 'flats' ? 'flats' : 'sharps');
      key = nm + n + c;
      html = `Ik hoor <b>${nm}${octaveOf(n)}</b><span>${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)} cent</span>`;
      if (UI.tuner) UI.tuner(hh, n, c, nm);
    }
    if (!hh && UI.tuner) UI.tuner(null);
    if (key === this.lastHeard) return;
    this.lastHeard = key;
    $$('.heard-line').forEach(el => { el.innerHTML = html; });
  },
  tuner: null,
};

// Standaard oefenscherm: opdrachtkaart, hals, knoppen, opties, scores
function exLayout(view, o) {
  const wrap = h('section', { class: 'ex' });
  wrap.append(o.prompt);
  let svg = null;
  if (o.neck !== false) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Gitaarhals');
    wrap.append(h('figure', { class: 'card neck' }, svg, o.caption ? h('figcaption', { class: 'neck-cap' }, o.caption) : null));
  }
  if (o.middle) wrap.append(o.middle);
  const ctrl = h('div', { class: 'controls' + (o.actions && o.actions.length >= 3 ? ' four' : '') });
  if (o.mic !== false) ctrl.append(h('button', { class: 'primary mic-btn', type: 'button', text: 'Start', onclick: () => (Engine.mic ? Engine.stopMic() : Engine.startMic()) }));
  for (const a of o.actions || []) ctrl.append(h('button', { type: 'button', id: a.id, class: a.cls || '', html: a.label + (a.key ? `<kbd>${a.key.toUpperCase()}</kbd>` : ''), onclick: a.onClick }));
  wrap.append(ctrl);
  if (o.options) wrap.append(h('details', { class: 'card opts' }, h('summary', {}, h('b', { text: 'Opties' }), h('span', { class: 'opt-sum', text: o.optSummary || '' })), h('div', { class: 'set-grid' }, o.options)));
  if (o.stats) wrap.append(o.stats);
  view.append(wrap);
  UI.micState();
  const keys = {};
  for (const a of o.actions || []) if (a.key) keys[a.key] = a.onClick;
  return { wrap, svg, ctrl, keys };
}
function promptCard(eyebrow) {
  const el = h('div', { class: 'card prompt', 'aria-live': 'polite' });
  el.innerHTML = `<p class="eyebrow pr-eyebrow">${eyebrow || 'Speel'}</p><div class="note pr-note"></div><div class="where pr-where"></div><div class="pr-extra"></div><div class="leds pr-leds" aria-hidden="true">${'<span></span>'.repeat(12)}</div><div class="toast pr-toast"></div><div class="heard-line"></div>`;
  return el;
}
function setLeds(card, v, n) {
  const leds = $$('.pr-leds span', card);
  const k = Math.round(v * leds.length);
  if (card._leds === k) return;
  card._leds = k;
  leds.forEach((el, i) => el.classList.toggle('on', i < k));
}
function statFigs(items) {
  return h('dl', { class: 'figures' }, items.map(it => h('div', { class: 'fig' }, h('dt', { text: it.label }), h('dd', { html: it.value }))));
}
const sec = s => (s == null ? '–' : `${fmt1(s)}<small>s</small>`);

// ---------- Router ----------
let current = null;
const Router = {
  render() {
    const hash = location.hash.replace('#', '');
    if (current && current.unmount) current.unmount();
    Engine.sink = null; current = null; UI.tuner = null;
    const view = $('#view');
    view.innerHTML = '';
    UI.lastHeard = '';
    const back = $('#backBtn');
    if (hash.startsWith('m-') && MODES[hash.slice(2)]) {
      const m = MODES[hash.slice(2)];
      back.hidden = false;
      $('#title').textContent = m.title;
      document.body.dataset.view = 'mode';
      current = m;
      Engine.sink = m;
      m.mount(view);
      Routine.decorate(m.id);
    } else if (hash === 'instellingen') {
      back.hidden = false;
      $('#title').textContent = 'Instellingen';
      document.body.dataset.view = 'settings';
      renderSettings(view);
    } else {
      back.hidden = true;
      $('#title').textContent = 'Fretjacht';
      document.body.dataset.view = 'home';
      renderHome(view);
      Routine.decorate(null);
    }
    UI.micState();
    UI.updateHeard(null);
    UI.updateLevel(-120);
    window.scrollTo(0, 0);
  }
};

// ---------- Startscherm ----------
const GROUPS = [
  { id: 'hals', title: 'De hals leren kennen' },
  { id: 'solo', title: "Solo's" },
  { id: 'gehoor', title: 'Gehoor' },
  { id: 'uitdaging', title: 'Uitdaging en inzicht' },
  { id: 'handig', title: 'Handig' },
];
function renderHome(view) {
  const st = Store.stats, R = Store.settings.routine;
  const sk = Routine.streak();
  if (Routine.justDone) {
    view.append(h('div', { class: 'okmsg', text: `Routine klaar! Je hebt ${Routine.justDone.minutes} minuten geoefend${sk.n > 1 ? `, ${sk.n} dagen op rij` : ''}.` }));
    Routine.justDone = null;
  }
  const blocksSum = () => `${R.blocks.length} × ${R.minutes} min: ${R.blocks.map(b => ROUTINE_BLOCKS[b].title).join(', ')}`;
  const sumEl = h('p', { class: 'help', text: blocksSum() });
  const titleEl = h('h2', { text: `${R.blocks.length * R.minutes} minuten oefenen` });
  const upd = () => { Store.saveSettings(); sumEl.textContent = blocksSum(); titleEl.textContent = `${R.blocks.length * R.minutes} minuten oefenen`; };
  const rc = h('div', { class: 'card routine-card' },
    h('div', { class: 'rc-head' },
      h('div', { class: 'rc-text' },
        h('p', { class: 'eyebrow', text: 'Dagelijkse routine' }), titleEl, sumEl,
        sk.n ? h('p', { class: 'streak', text: sk.today && sk.n === 1 ? 'Vandaag gedaan' : `${sk.n} ${sk.n === 1 ? 'dag' : 'dagen'} op rij${sk.today ? '' : '. Doe vandaag mee om de reeks vast te houden.'}` }) : null),
      h('button', { class: 'primary', type: 'button', text: 'Start routine', onclick: () => Routine.start() })),
    h('details', { class: 'rc-opts' }, h('summary', { text: 'Routine aanpassen' }),
      h('div', { class: 'set-grid' },
        field('Onderdelen', chips(Object.keys(ROUTINE_BLOCKS).map(k => ({ value: k, label: ROUTINE_BLOCKS[k].title })), R.blocks, v => { R.blocks = Object.keys(ROUTINE_BLOCKS).filter(k => v.includes(k)); upd(); }, 1)),
        field('Minuten per onderdeel', seg([1, 2, 3, 5].map(n => ({ value: n, label: String(n) })), R.minutes, v => { R.minutes = Number(v); upd(); }, 'tight')))));
  view.append(rc);
  for (const g of GROUPS) {
    const ids = MODE_ORDER.filter(id => MODES[id].group === g.id);
    if (!ids.length) continue;
    view.append(h('h2', { class: 'eyebrow group-title', text: g.title }));
    view.append(h('div', { class: 'mode-list' }, ids.map(id => {
      const m = MODES[id];
      const stat = m.homeStat ? m.homeStat(st) : '';
      return h('a', { class: 'mode-item', href: '#m-' + id },
        h('span', { class: 'mi-name', text: m.title }),
        h('span', { class: 'mi-desc', text: m.desc }),
        stat ? h('span', { class: 'mi-stat', html: stat }) : null);
    })));
  }
  view.append(h('a', { class: 'mode-item settings-link', href: '#instellingen' }, h('span', { class: 'mi-name', text: 'Instellingen' }), h('span', { class: 'mi-desc', text: 'Microfoon, oefenbereik, notenamen en scores' })));
  view.append(h('p', { class: 'foot', text: 'De app hoort welke toon klinkt, niet op welke snaar je hem speelt. Speel dus echt waar het gevraagd wordt. Leg je telefoon dicht bij je gitaar.' }));
}

// ---------- Instellingen ----------
function renderSettings(view) {
  const s = Store.settings;
  const save = () => Store.saveSettings();
  const lvl = h('div', { class: 'lvl' },
    h('div', { class: 'lvl-head' }, h('span', { text: 'Invoerniveau' }), h('span', { class: 'lvl-text', text: '– dB' })),
    h('div', { class: 'level', 'aria-hidden': 'true' }, h('div', { class: 'lvl-fill' }), h('div', { class: 'lvl-gate' })));
  const gateText = h('span', { class: 'help', text: `(${s.gateDb} dB)` });
  const gate = h('input', { type: 'range', id: 'gate', min: '-70', max: '-20', step: '1', value: String(s.gateDb), oninput: e => { s.gateDb = Number(e.target.value); gateText.textContent = `(${s.gateDb} dB)`; Engine.syncGate(); UI.updateLevel(-120); save(); } });
  const micCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Microfoon' }),
    h('div', { class: 'set-grid' },
      h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'gate' }, 'Drempel ', gateText), gate, lvl,
        h('span', { class: 'help', text: 'Links reageert de app op zachte tonen, rechts negeert hij meer achtergrondgeluid. De zwarte streep is de drempel.' })),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Test' }), h('div', { class: 'heard-line big' }), h('button', { class: 'primary mic-btn', type: 'button', text: 'Start', onclick: () => (Engine.mic ? Engine.stopMic() : Engine.startMic()) }))));
  const strSeg = chips([0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: `${STR_LETTER[i]}<small>${i + 1}</small>` })), s.strings.map(String), v => { s.strings = v.map(Number).sort(); save(); }, 1);
  const minSel = selectEl('minFret', Array.from({ length: MAX_FRET }, (_, i) => ({ value: i, label: String(i) })), s.minFret, v => { s.minFret = Number(v); if (s.maxFret <= s.minFret) { s.maxFret = s.minFret + 1; maxSel.value = String(s.maxFret); } save(); });
  const maxSel = selectEl('maxFret', Array.from({ length: MAX_FRET }, (_, i) => ({ value: i + 1, label: String(i + 1) })), s.maxFret, v => { s.maxFret = Number(v); if (s.minFret >= s.maxFret) { s.minFret = s.maxFret - 1; minSel.value = String(s.minFret); } save(); });
  const rangeCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Oefenbereik' }),
    h('div', { class: 'set-grid' },
      field('Snaren', strSeg, 'Voor Noten zoeken, Alle posities, de uitdaging en de hittekaart.'),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Fretbereik' }), h('div', { class: 'row' }, h('label', { for: 'minFret', text: 'van' }), minSel, h('label', { for: 'maxFret', text: 'tot en met' }), maxSel)),
      field('Noten', checkEl('naturalsOnly', 'Alleen stamtonen (C D E F G A B)', s.naturalsOnly, v => { s.naturalsOnly = v; save(); }))));
  const ctlCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Controle en weergave' }),
    h('div', { class: 'set-grid' },
      h('div', { class: 'field' },
        checkEl('strict', 'Octaaf moet kloppen', s.strict, v => { s.strict = v; save(); }, 'Alleen de precieze toonhoogte telt. Werkt het best met een goede microfoon of via een versterker; een telefoon hoort lage noten soms een octaaf te hoog.'),
        checkEl('sound', 'Geluidje bij een goede noot', s.sound, v => { s.sound = v; save(); })),
      field('Notenamen', seg([{ value: 'sharps', label: 'met ♯' }, { value: 'flats', label: 'met ♭' }, { value: 'both', label: '♯ en ♭' }], s.names, v => { s.names = v; save(); }), 'Met ♯ en ♭ wisselt het af, zodat je leert dat F♯ en G♭ dezelfde toets zijn.'),
      field('Automatische hint bij Noten zoeken', selectEl('autoHint', [{ value: 0, label: 'Uit' }, { value: 5, label: 'Na 5 seconden' }, { value: 10, label: 'Na 10 seconden' }, { value: 20, label: 'Na 20 seconden' }], s.autoHint, v => { s.autoHint = Number(v); save(); }))));
  let armed = 0;
  const reset = h('button', { type: 'button', text: 'Alle scores wissen', onclick: e => {
    const b = e.currentTarget;
    if (!armed) { b.textContent = 'Zeker weten? Tik nog een keer'; b.classList.add('danger'); armed = setTimeout(() => { armed = 0; b.textContent = 'Alle scores wissen'; b.classList.remove('danger'); }, 3500); return; }
    clearTimeout(armed); armed = 0;
    Store.stats = DEFAULT_STATS(); Store.saveStats();
    b.textContent = 'Scores gewist'; b.classList.remove('danger');
  } });
  const scoreCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Scores' }), h('div', { class: 'row' }, reset));
  view.append(h('section', { class: 'settings-view' }, micCard, rangeCard, ctlCard, scoreCard));
  UI.updateLevel(-120);
}

// gedeelde toetsen
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select, textarea'))) return;
  if (current && current.keys) {
    const fn = current.keys[e.key.toLowerCase()] || (e.key === 'ArrowRight' ? current.keys.s : null);
    if (fn) { e.preventDefault(); fn(); }
  }
});
