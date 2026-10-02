// ---------- Opstarten ----------
Store.load();
$('#backBtn').addEventListener('click', () => { location.hash = ''; });
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
  mode: () => (current ? current.id : null),
  expected: () => (current && current.expected ? current.expected() : []),
  routine: () => ({ active: Routine.active, idx: Routine.idx, left: Routine.left }),
  onsets: () => Engine.onsetLog.slice(),
  latency: () => Engine.latency(),
  metro: () => ({ on: Metronome.on, beats: Metronome.recent.map(b => b.t), now: Engine.ctx ? Engine.ctx.currentTime : 0, bpm: Metronome.bpm }),
};
Router.render();
