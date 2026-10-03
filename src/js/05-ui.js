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

// ---------- Iconen (24×24, currentColor) ----------
const svgI = (body, fill) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  flame: svgI('<path d="M12 2.5c.6 2.9 3.8 4.9 4.6 8.3.8 3.6-1.4 7.7-4.6 7.7s-5.6-2.5-5.2-5.9c.3-2.3 1.7-3.3 2.6-4.6.3 1.6.9 2.6 2 3 .5-2.9-.5-5.3.6-8.5z"/>', true),
  mic: svgI('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
  close: svgI('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svgI('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  star: svgI('<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/>', true),
  trophy: svgI('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9.5 18h5"/>'),
  retry: svgI('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>'),
  book: svgI('<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5zM12 6v13.5"/>'),
  pick: svgI('<path d="M12 3c4.4 0 7.5 1.6 7.5 4.6 0 4.1-4.2 9.6-7.5 13.4C8.7 17.2 4.5 11.7 4.5 7.6 4.5 4.6 7.6 3 12 3z"/>', true),
  note: svgI('<path d="M9 17.5V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15" r="2.5" fill="currentColor"/>'),
  lock: svgI('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  path: svgI('<circle cx="7" cy="5" r="2.2"/><circle cx="16" cy="11" r="2.2"/><circle cx="8" cy="19" r="2.2"/><path d="M9 6.2l5 3.6M14.2 12.6l-4.4 5"/>'),
  grid: svgI('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  chart: svgI('<path d="M5 20V11M12 20V5M19 20v-6M3 20.5h18"/>'),
  clock: svgI('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  bolt: svgI('<path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z"/>', true),
  ring: '<svg viewBox="0 0 24 24" aria-hidden="true" class="ico ring"><circle cx="12" cy="12" r="10" class="ring-bg"/><circle cx="12" cy="12" r="10" class="ring-fg" stroke-dasharray="0 62.83" transform="rotate(-90 12 12)"/></svg>',
};

// ---------- UI ----------
const UI = {
  msgTimer: 0,
  showMsg(t) { const m = $('#msg'); m.textContent = t; m.hidden = false; },
  hideMsg() { $('#msg').hidden = true; },
  micState() {
    const pill = $('#micPill');
    const st = Engine.mic ? 'on' : Engine.starting ? 'busy' : 'off';
    pill.dataset.state = st;
    const label = st === 'on' ? 'Microfoon aan: tik om te stoppen' : st === 'busy' ? 'Toegang vragen' : 'Microfoon uit: tik om te starten';
    pill.setAttribute('aria-label', label); pill.title = label;
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
  // korte melding bovenin; more: extra regels in dezelfde melding (zie Moments). Tik om weg te halen.
  // now: antwoord op iets wat je net deed (bijvoorbeeld een reservekopie); die wacht niet op andere meldingen
  flashQ: [], flashing: false, closeFlash: null,
  flash(icon, title, text, kind, more, now) {
    const f = { icon, title, text, kind, more: more || [] };
    if (now) this.flashQ.unshift(f); else this.flashQ.push(f);
    if (!this.flashing) this.nextFlash();
    else if (now && this.closeFlash) this.closeFlash();
  },
  nextFlash() {
    const f = this.flashQ.shift();
    if (!f) { this.flashing = false; this.closeFlash = null; return; }
    this.flashing = true;
    const el = h('div', { class: 'flash' + (f.kind ? ' flash-' + f.kind : '') + (f.more.length ? ' multi' : ''), role: 'status' },
      h('span', { class: 'fl-ico', html: f.icon || '' }),
      h('span', { class: 'fl-txt' }, h('b', { text: f.title }), f.text ? h('small', { text: f.text }) : null,
        f.more.length ? h('ul', { class: 'fl-more' }, f.more.slice(0, 4).map(m => h('li', {}, h('b', { text: m.title }), m.text ? h('small', { text: m.text }) : null))) : null));
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => { el.remove(); this.nextFlash(); }, 400); };
    this.closeFlash = close;
    el.addEventListener('click', close);
    document.body.append(el);
    setTimeout(close, 2800 + 1200 * Math.min(3, f.more.length));
  },
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
const TABS = { '': 'path', 'leerpad': 'path', 'oefenen': 'practice', 'voortgang': 'progress' };
const Router = {
  render() {
    const hash = location.hash.replace('#', '');
    if (TempSettings.saved && hash !== 'm-' + TempSettings.saved.mode && !Daily.active) TempSettings.restore();
    if (current && current.unmount) current.unmount();
    Engine.sink = null; current = null; UI.tuner = null;
    $$('.sheet-wrap').forEach(x => x.remove());
    const view = $('#view');
    view.innerHTML = '';
    UI.lastHeard = '';
    const back = $('#backBtn');
    let tab = null, title = '';
    if (hash.startsWith('m-') && MODES[hash.slice(2)]) {
      const m = MODES[hash.slice(2)];
      title = m.title; document.body.dataset.view = 'mode';
      current = m; Engine.sink = m;
      m.mount(view);
    } else if (hash === 'les') {
      document.body.dataset.view = 'lesson';
      current = Lesson; Engine.sink = Lesson;
      Lesson.mount(view);
    } else if (hash === 'instellingen') {
      title = 'Instellingen'; document.body.dataset.view = 'settings';
      renderSettings(view);
    } else {
      tab = TABS[hash] || 'path';
      document.body.dataset.view = tab;
      title = { path: 'Leerpad', practice: 'Oefenen', progress: 'Voortgang' }[tab];
      if (tab === 'path') renderPath(view);
      else if (tab === 'practice') renderPractice(view);
      else renderProgress(view);
    }
    back.hidden = !!tab || document.body.dataset.view === 'lesson';
    $('#logo').hidden = !tab;
    $('#title').textContent = title;
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    $$('.tabbar a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
    UI.micState();
    UI.updateHeard(null);
    UI.updateLevel(-120);
    Progress.renderTop();
    Daily.renderBar();
    Srs.badge();
    // wat je verdiende terwijl je op het eindscherm van een les stond, krijg je nu alsnog te zien
    Moments.later(700);
    window.scrollTo(0, 0);
  },
  back() {
    const v = document.body.dataset.view;
    location.hash = v === 'settings' ? '#voortgang' : v === 'mode' ? '#oefenen' : '';
  },
};

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
        checkEl('sound', 'Geluidjes', s.sound, v => { s.sound = v; save(); }, 'Bij goede antwoorden en noten, als je een fout goed herhaalt en als je je dagdoel haalt. In een les zet je ze ook aan of uit met het luidsprekertje.'),
        checkEl('haptics', 'Trillen bij goed en fout', s.haptics, v => { s.haptics = v; save(); if (v) Haptics.play('right'); }, 'Eén tikje bij een goed antwoord, twee bij een fout. Werkt op Android en op een iPhone met iOS 18 of nieuwer. Terwijl je speelt trilt de app niet, anders hoort de microfoon je telefoon.')),
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
  const bk = Backup.status();
  const scoreCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Je voortgang' }),
    h('p', { class: 'help', text: 'Je voortgang staat alleen in deze browser. Met een reservekopie zet je hem terug, ook op een ander toestel.' }),
    h('p', { class: 'bk-status' + (bk.old ? ' old' : ''), text: bk.text }),
    backupButtons(),
    h('div', { class: 'row' }, reset));
  const goalCard = h('div', { class: 'card' }, h('p', { class: 'eyebrow', text: 'Dagdoel en lessen' }),
    h('div', { class: 'set-grid' },
      field('Dagdoel', seg([10, 15, 20, 30].map(n => ({ value: n, label: `${n} min` })), s.goal, v => { s.goal = Number(v); save(); Progress.renderTop(); }), 'Je reeks telt de dagen waarop je dit aantal minuten echt geoefend hebt.'),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Muziektheoriecursus' }), h('a', { class: 'link', href: COURSE_DOC, target: '_blank', rel: 'noopener', text: 'Open het cursusboek ›' }), h('span', { class: 'help', text: 'Na elke les van maandag en donderdag komt er een unit bij in je leerpad.' }))));
  view.append(h('section', { class: 'settings-view' }, goalCard, micCard, rangeCard, ctlCard, scoreCard));
  UI.updateLevel(-120);
}

// gedeelde toetsen
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select, textarea'))) return;
  if (e.key === 'Enter' && e.target.closest && e.target.closest('button, a')) return;
  if (current && current.keys) {
    const fn = current.keys[e.key.toLowerCase()] || (e.key === 'ArrowRight' ? current.keys.s : null);
    if (fn) { e.preventDefault(); fn(); }
  }
});
