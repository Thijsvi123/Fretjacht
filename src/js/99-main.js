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
  lesson: () => (current === Lesson && Lesson.cur ? { type: Lesson.cur.type, answer: Lesson.cur.answer, options: Lesson.cur.options, correct: Lesson.cur.correct, valid: Lesson.cur.valid, answered: Lesson.answered, done: Lesson.doneIds.size, total: Lesson.total, finished: Lesson.finished, bin: Lesson.bin, review: Lesson.review, box: Lesson.cur._box || 0 } : (current === Lesson ? { finished: Lesson.finished, bin: Lesson.bin, review: Lesson.review } : null)),
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
