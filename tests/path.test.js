// Test: welke units het leerpad toont (path.json, vangnet uit het cursusschema)
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const files = ['01-theory.js', '01b-theory2.js', '11-content.js', '13-path.js'].map(f => fs.readFileSync('src/js/' + f, 'utf8')).join('\n');
function world(now, stored) {
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
  const store = { path: stored };
  const ctx = vm.createContext({ Date: FakeDate, Math, JSON, console, Store: { get: (k, d) => (k in store ? store[k] : d), put: (k, v) => { store[k] = v; }, stats: { path: { nodes: {} } } } });
  vm.runInContext(files + '\nthis.P = PathData;', ctx);
  return ctx.P;
}
const lessons = P => Array.from(P.units(), u => u.lesson);
const one = { updated: '2026-10-03', units: [{ lesson: 1, date: '2026-10-02', topic: 'twelve-tones', title: 'Waarom 12 tonen' }] };
// zonder path.json: les 2 (ma 5 okt) opent pas vanaf 20:15
assert.deepStrictEqual(lessons(world('2026-10-05T19:00:00', null)), [1]);
assert.deepStrictEqual(lessons(world('2026-10-05T20:30:00', null)), [1, 2]);
// met path.json: de unit van les 2 staat er nog niet in, vangnet pas de dag erna
assert.deepStrictEqual(lessons(world('2026-10-05T21:00:00', one)), [1]);
assert.deepStrictEqual(lessons(world('2026-10-06T09:00:00', one)), [1, 2]);
// path.json gaat voor: les 2 met een ander onderwerp blijft zoals de cursus hem gaf
const two = { units: one.units.concat([{ lesson: 2, date: '2026-10-05', topic: 'scale-boxes', params: { scale: 'minpent', root: 'A', boxes: [1, 2] }, title: 'Pentatonisch' }]) };
const P2 = world('2026-10-09T09:00:00', two);
assert.deepStrictEqual(lessons(P2), [1, 2, 3]);
assert.strictEqual(P2.units()[1].topic, 'scale-boxes');
// onbekend onderwerp zonder vragen valt weg, met vragen blijft hij staan
const odd = { units: [{ lesson: 1, topic: 'iets-nieuws' }, { lesson: 2, topic: 'iets-nieuws', quiz: [{ q: 'x', options: ['a', 'b'], answer: 0 }] }] };
assert.deepStrictEqual(lessons(world('2026-10-03T09:00:00', odd)), [2]);
// vooruitblik: de volgende twee lessen uit het schema
assert.deepStrictEqual(Array.from(world("2026-10-03T09:00:00", one).upcoming(), u => u.lesson), [2, 3]);
console.log('alle leerpadtests geslaagd');
