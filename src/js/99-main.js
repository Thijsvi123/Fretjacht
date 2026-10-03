// ---------- Opstarten ----------
Store.load();
Freeze.check();
$('#backBtn').addEventListener('click', () => Router.back());
$('#micPill').addEventListener('click', () => (Engine.mic ? Engine.stopMic() : Engine.startMic()));
window.addEventListener('hashchange', () => Router.render());
// terug in de app op een nieuwe dag: bevriezer toepassen en nieuwe opdrachten tonen
let lastDay = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || todayKey() === lastDay) return;
  lastDay = todayKey();
  Freeze.check();
  if (['path', 'progress', 'practice'].includes(document.body.dataset.view)) Router.render();
});
let lastNarrow = null, resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const narrow = innerWidth < 600;
    if (narrow !== lastNarrow) { lastNarrow = narrow; if (current && current.draw) current.draw(); }
  }, 150);
});
// testhaak: welke tonen verwacht de huidige oefening
window.__fj = {
  mode: () => (current ? current.id || document.body.dataset.view : document.body.dataset.view),
  expected: () => {
    if (current === Lesson) {
      const it = Lesson.cur;
      if (!it || Lesson.answered || it.type !== 'play') return [];
      const st = it.steps[Lesson.ps.idx];
      if (!st) return [];
      if (st.k === 'set') return st.pcs.filter(pc => !Lesson.ps.found.has(pc)).map(pc => 48 + pc);
      if (st.k === 'rel') return [Lesson.ps.last + st.semis];
      return [48 + st.pc];
    }
    return current && current.expected ? current.expected() : [];
  },
  lesson: () => (current === Lesson && Lesson.cur ? { type: Lesson.cur.type, answer: Lesson.cur.answer, options: Lesson.cur.options, correct: Lesson.cur.correct, valid: Lesson.cur.valid, pc: Lesson.cur.pc, s: Lesson.cur.s, f: Lesson.cur.f, answered: Lesson.answered, done: Lesson.doneIds.size, total: Lesson.total, finished: Lesson.finished, bin: Lesson.bin, review: Lesson.review, box: Lesson.cur._box || 0 } : (current === Lesson ? { finished: Lesson.finished, bin: Lesson.bin, review: Lesson.review } : null)),
  level: () => Object.assign(Level.of(Store.stats.xp || 0), { notes: Score.notes(), acc: Score.accuracy(), combo: Store.stats.bestCombo || 0 }),
  hals: () => ({ done: halsDoneCount(), next: nextHals() && { level: nextHals().unitNo, step: nextHals().node.title }, levels: HALS_LEVELS.map((L, i) => halsLevelDone(i)) }),
  noteq: () => (current && current.id === 'noteq' && current.q ? { kind: current.q.kind, s: current.q.s, f: current.q.f, pc: current.q.pc, valid: current.q.valid, answered: current.answered } : null),
  addXP: n => Progress.addXP(n),
  // een les met zelfgekozen vragen, en de momenten die nog wachten op een overzicht
  lessonWith: (items, o) => Lesson.open(Object.assign({ title: 'Test', items: items.map(x => Object.assign({}, x)), onDone: () => { location.hash = ''; }, onExit: () => { location.hash = ''; } }, o || {})),
  moments: () => Moments.pending.map(m => m.title),
  tapVisible: () => ((Lesson.cur && Lesson.cur.valid) || []).find(v => document.querySelector(`.tapneck .cell[data-s="${v.s}"][data-f="${v.f}"]`)) || null,
  halsGen: (i, k) => halsNodes(HalsData.units()[i])[k].gen(),
  halsLevels: () => HALS_LEVELS,
  loading: () => !!document.querySelector('.loader'),
  onsets: () => Engine.onsetLog.slice(),
  latency: () => Engine.latency(),
  metro: () => ({ on: Metronome.on, beats: Metronome.recent.map(b => b.t), now: Engine.ctx ? Engine.ctx.currentTime : 0, bpm: Metronome.bpm }),
  daily: () => ({ active: Daily.active, idx: Daily.idx, steps: Daily.steps.map(s => s.kind + ':' + (s.mode || '')) }),
  progress: () => ({ secs: Progress.day().secs, xp: Store.stats.xp, streak: Progress.streak(), nodes: Store.stats.path.nodes, badges: Store.stats.badges, bin: Bin.count(), binCleared: Store.stats.binCleared || 0 }),
  bin: () => Bin.list().map(x => ({ k: x.k, n: x.n, type: x.it.type })),
  // herhalen: alle vragen met hun vak en dag; srsShift(n) doet alsof er n dagen voorbij zijn
  srs: () => ({ items: Bin.all().map(x => ({ k: x.k, box: x.box || 0, due: x.due || '', type: x.it.type })), counts: Srs.snapshot(), due: Srs.dueCount(), todo: Srs.todoCount(), done: Store.stats.srsDone || 0 }),
  srsShift: n => { for (const x of Bin.all()) if (x.due) x.due = addDays(x.due, -n); Store.saveStats(); Bin.changed(); },
  settings: () => JSON.parse(JSON.stringify(Store.settings)),
  quests: () => Quests.today().map(q => ({ id: q.id, target: q.target, v: Quests.progress(q), done: !!(Progress.day().qd || {})[q.id] })),
  questBump: (k, n) => (k === 'combo' || k === 'challenge' ? Quests.max(k, n) : Quests.bump(k, n)),
  markPlayed: ids => { const md = Store.stats.modeDays || (Store.stats.modeDays = {}); ids.forEach(i => { md[i] = todayKey(); }); Quests.check(); },
  freezes: () => ({ n: Store.stats.freezes || 0, frozen: Store.stats.frozen || {} }),
  targets: () => (current && current.id === 'targets' ? { want: current.want, chord: current.chord && current.chord.name, hit: current.hit, idx: current.idx } : null),
  summary: () => courseSummary(),
  earq: () => (current && current.id === 'earq' && current.q ? current.q.key : null),
  addSecs: n => { Progress.day().secs += n; Store.saveStats(); Progress.renderTop(); },
};
$('#streakChip .chip-ico').innerHTML = ICONS.flame;
$('#goalChip .chip-ico').innerHTML = ICONS.ring;
$('#micPill .chip-ico').innerHTML = ICONS.mic;
$('#logo').innerHTML = Mascot.svg('blij', { crop: 'head' });
const TAB_ICONS = { path: ICONS.path, practice: ICONS.pedal, progress: ICONS.chart };
$$('.tabbar a').forEach(a => { $('.tb-ico', a).innerHTML = TAB_ICONS[a.dataset.tab]; });
// teller op Oefenen: wat er vandaag te herhalen is
$('.tabbar a[data-tab="practice"] .tb-ico').append(h('b', { class: 'tb-badge', hidden: true }));
Router.render();
PathData.load();
setTimeout(() => Badges.check(), 1500);
