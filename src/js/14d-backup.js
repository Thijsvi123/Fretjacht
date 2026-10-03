// ---------- Reservekopie: je voortgang bewaren en terugzetten ----------
// Alles staat alleen in de opslag van deze browser. Een kopie als bestand beschermt je reeks en XP als de
// browser die opslag wist (Safari doet dat bij een website die je een week niet opent), en zo neem je je
// voortgang mee naar een andere telefoon of computer.
const daysAgo = ts => Math.round((new Date(todayKey() + 'T12:00:00') - new Date(dayKeyOf(new Date(ts)) + 'T12:00:00')) / 86400000);
const Backup = {
  data() { return { app: 'fretjacht', v: 1, saved: new Date().toISOString(), stats: Store.stats, settings: Store.settings }; },
  fileName() { return `fretjacht-${todayKey()}.json`; },
  // op de telefoon via het deelmenu (bewaar in Bestanden of iCloud Drive, of mail hem naar jezelf),
  // anders als download
  async save() {
    const prev = Store.stats.backupAt;
    Store.stats.backupAt = Date.now();
    const name = this.fileName(), text = JSON.stringify(this.data());
    let how = 'download';
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Fretjacht-reservekopie' });
        how = 'share';
      }
    } catch (e) {
      // deelmenu dichtgedaan: niets bewaard
      if (e && e.name === 'AbortError') { Store.stats.backupAt = prev; return false; }
    }
    if (how === 'download') this.download(text, name);
    Store.saveStats();
    this.persist();
    UI.flash(ICONS.check, 'Reservekopie gemaakt', how === 'share' ? 'Bewaar hem op een plek die blijft, zoals iCloud Drive of Google Drive.' : `${name} staat bij je downloads.`, 'goal', null, true);
    this.refresh();
    return true;
  },
  download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    a.style.display = 'none';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
  // vraag de browser de opslag niet zomaar te wissen (werkt niet overal, maar kan geen kwaad)
  persist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {} },
  pick() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.style.display = 'none';
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) this.read(f); });
    document.body.append(inp);
    inp.click();
  },
  async read(file) {
    let j = null;
    try { j = JSON.parse(await file.text()); } catch (e) {}
    if (!this.valid(j)) { UI.flash(ICONS.close, 'Dit is geen reservekopie', 'Kies een bestand van Fretjacht, zoals fretjacht-2026-10-03.json.', 'badge', null, true); return false; }
    this.confirm(j);
    return true;
  },
  valid(j) { return !!(j && j.app === 'fretjacht' && j.stats && typeof j.stats === 'object' && !Array.isArray(j.stats) && j.stats.days && typeof j.stats.days === 'object'); },
  facts(st) {
    const xp = Number(st.xp) || 0, lv = Level.of(xp);
    const days = Object.keys(st.days || {}).filter(k => st.days[k] && st.days[k].secs > 0).sort();
    return { level: `${lv.n}, ${lv.title}`, xp: `${xp}`, days: String(days.length), last: days.length ? niceDate(days[days.length - 1]) : '–', badges: String(Object.keys(st.badges || {}).length) };
  },
  // eerst laten zien wat er verandert
  confirm(j) {
    const now = this.facts(Store.stats), kop = this.facts(j.stats), saved = new Date(j.saved || Date.now());
    const row = (label, a, b) => h('tr', {}, h('th', { scope: 'row', text: label }), h('td', { text: a }), h('td', { class: a !== b ? 'diff' : '', text: b }));
    const less = (Number(j.stats.xp) || 0) < (Store.stats.xp || 0);
    const sheet = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'sheet backup-sheet' },
        h('p', { class: 'sheet-eyebrow', text: 'Reservekopie terugzetten' }),
        h('h3', { text: `Kopie van ${isNaN(saved) ? 'onbekende datum' : saved.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` }),
        h('table', { class: 'bk-table' },
          h('thead', {}, h('tr', {}, h('td'), h('th', { scope: 'col', text: 'Nu' }), h('th', { scope: 'col', text: 'In de kopie' }))),
          h('tbody', {}, row('Niveau', now.level, kop.level), row('XP', now.xp, kop.xp), row('Dagen geoefend', now.days, kop.days), row('Laatst geoefend', now.last, kop.last), row('Plectrums', now.badges, kop.badges))),
        h('p', { class: 'help' + (less ? ' bk-warn' : ''), text: `Je voortgang op dit toestel wordt vervangen door die uit de kopie.${less ? ' Let op: in de kopie heb je minder XP dan nu.' : ''}` }),
        h('button', { class: 'primary big', type: 'button', id: 'bkRestore', text: 'Terugzetten', onclick: () => { sheet.remove(); this.restore(j); } }),
        h('button', { class: 'big ghost', type: 'button', text: 'Annuleren', onclick: () => sheet.remove() })));
    document.body.append(sheet);
  },
  restore(j) {
    if (Daily.active) Daily.stop();
    // instellingen van de microfoon horen bij dit toestel en blijven staan
    const cur = Store.settings, set = Object.assign({}, j.settings && typeof j.settings === 'object' ? j.settings : {});
    set.gateDb = cur.gateDb; set.cantPlayUntil = 0;
    set.metro = Object.assign({}, set.metro || {}, { corr: cur.metro.corr });
    Store.put('stats', j.stats);
    Store.put('settings', set);
    Store.load();
    Moments.pending = [];
    Freeze.check();
    this.persist();
    const lv = Level.of(Store.stats.xp || 0);
    Bin.changed(); Progress.renderTop();
    Router.render();
    UI.flash(Mascot.svg('juich', { crop: 'head' }), 'Voortgang teruggezet', `Niveau ${lv.n}, ${Store.stats.xp || 0} XP. Welkom terug!`, 'goal', null, true);
  },
  status() {
    const at = Store.stats.backupAt;
    if (!at) return { text: 'Je hebt nog geen reservekopie gemaakt.', old: (Store.stats.xp || 0) >= 50 };
    const n = daysAgo(at), when = n <= 0 ? 'vandaag' : n === 1 ? 'gisteren' : `${n} dagen geleden`;
    return { text: `Laatste reservekopie: ${when}.`, old: n > 14 };
  },
  refresh() { $$('.bk-status').forEach(el => { const s = this.status(); el.textContent = s.text; el.classList.toggle('old', s.old); }); },
};
// knoppen, voor Voortgang en Instellingen
function backupButtons() {
  return h('div', { class: 'bk-btns' },
    h('button', { class: 'primary', type: 'button', id: 'bkSave', onclick: () => Backup.save() }, h('span', { html: ICONS.copy }), h('span', { text: 'Reservekopie maken' })),
    h('button', { type: 'button', id: 'bkPick', onclick: () => Backup.pick() }, h('span', { html: ICONS.retry }), h('span', { text: 'Terugzetten' })));
}
function backupCard() {
  const s = Backup.status();
  return h('div', { class: 'card backup-card', id: 'backupCard' },
    h('h2', { class: 'card-h', text: 'Reservekopie' }),
    h('p', { class: 'help', text: 'Je voortgang staat alleen in deze browser. Bewaar af en toe een kopie, bijvoorbeeld in iCloud Drive of Google Drive. Wist je browser hem, of krijg je een nieuwe telefoon, dan zet je hem daarmee terug.' }),
    h('p', { class: 'bk-status' + (s.old ? ' old' : ''), text: s.text }),
    backupButtons());
}
// in de lege staat: misschien heb je al een kopie
function restoreCard() {
  return h('div', { class: 'card backup-card restore' },
    h('h2', { class: 'card-h', text: 'Al eerder geoefend?' }),
    h('p', { class: 'help', text: 'Op een ander toestel, of voordat je browser alles wiste? Zet je reservekopie terug, dan ga je verder waar je was.' }),
    h('div', { class: 'bk-btns' }, h('button', { type: 'button', id: 'bkPick', onclick: () => Backup.pick() }, h('span', { html: ICONS.retry }), h('span', { text: 'Reservekopie terugzetten' }))));
}
