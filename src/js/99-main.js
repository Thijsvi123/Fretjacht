// ---------- Opstarten ----------
Store.load();
$('#backBtn').addEventListener('click', () => Router.back());
$('#micPill').addEventListener('click', () => (Engine.mic ? Engine.stopMic() : Engine.startMic()));
window.addEventListener('hashchange', () => Router.render());
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
  lesson: () => (current === Lesson && Lesson.cur ? { type: Lesson.cur.type, answer: Lesson.cur.answer, options: Lesson.cur.options, correct: Lesson.cur.correct, valid: Lesson.cur.valid, answered: Lesson.answered, done: Lesson.doneIds.size, total: Lesson.total, finished: Lesson.finished, bin: Lesson.bin } : (current === Lesson ? { finished: Lesson.finished, bin: Lesson.bin } : null)),
  loading: () => !!document.querySelector('.loader'),
  onsets: () => Engine.onsetLog.slice(),
  latency: () => Engine.latency(),
  metro: () => ({ on: Metronome.on, beats: Metronome.recent.map(b => b.t), now: Engine.ctx ? Engine.ctx.currentTime : 0, bpm: Metronome.bpm }),
  daily: () => ({ active: Daily.active, idx: Daily.idx, steps: Daily.steps.map(s => s.kind + ':' + (s.mode || '')) }),
  progress: () => ({ secs: Progress.day().secs, xp: Store.stats.xp, streak: Progress.streak(), nodes: Store.stats.path.nodes, badges: Store.stats.badges, bin: Bin.count(), binCleared: Store.stats.binCleared || 0 }),
  bin: () => Bin.list().map(x => ({ k: x.k, n: x.n, type: x.it.type })),
  settings: () => JSON.parse(JSON.stringify(Store.settings)),
  addSecs: n => { Progress.day().secs += n; Store.saveStats(); Progress.renderTop(); },
};
$('#streakChip .chip-ico').innerHTML = ICONS.flame;
$('#goalChip .chip-ico').innerHTML = ICONS.ring;
$('#micPill .chip-ico').innerHTML = ICONS.mic;
$('#logo').innerHTML = Mascot.svg('blij', { crop: 'head' });
const TAB_ICONS = { path: ICONS.path, practice: ICONS.pedal, progress: ICONS.chart };
$$('.tabbar a').forEach(a => { $('.tb-ico', a).innerHTML = TAB_ICONS[a.dataset.tab]; });
Router.render();
PathData.load();
setTimeout(() => Badges.check(), 1500);
