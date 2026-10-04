// Test: wanneer de lessen van de cursus opengaan. Les 1 op 2 oktober, daarna elke zondag
// een nieuwe les, maar pas als je de unittoets van de vorige hebt gehaald.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const files = ['01-theory.js', '01b-theory2.js', '05d-fretquiz.js', '11-content.js', '11b-hals.js', '11c-course.js', '11d-guitar.js', '11e-gehoor.js', '13-path.js'].map(f => fs.readFileSync('src/js/' + f, 'utf8')).join('\n');
function world(now, nodes) {
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
  const ctx = vm.createContext({ Date: FakeDate, Math, JSON, console, ICONS: new Proxy({}, { get: () => '' }),
    dayKeyOf: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    Store: { settings: { guitar: true }, stats: { path: { nodes: nodes || {} } } } });
  vm.runInContext(files + '\nthis.X = { PathData, courseDates, COURSE, unitNodes, nodeKey, nextNode, GehoorData, nextGehoor, gehoorLevelDone };', ctx);
  return ctx.X;
}
const X = world('2026-10-03T10:00:00');
const cd = (passed, today) => Array.from(X.courseDates(passed, today, 8));

// vóór de start: alleen de datum van les 1, verder niets
assert.deepStrictEqual(cd([], '2026-10-01'), ['2026-10-02']);
// les 1 is open, de toets nog niet gehaald: les 2 wacht (null)
assert.deepStrictEqual(cd([], '2026-10-03'), ['2026-10-02', null]);
// toets op zaterdag gehaald: les 2 opent zondag
assert.deepStrictEqual(cd(['2026-10-03'], '2026-10-03'), ['2026-10-02', '2026-10-04']);
assert.deepStrictEqual(cd(['2026-10-03'], '2026-10-04'), ['2026-10-02', '2026-10-04', null]);
// op zondag zelf gehaald: dezelfde dag open
assert.deepStrictEqual(cd(['2026-10-04'], '2026-10-04'), ['2026-10-02', '2026-10-04', null]);
// les 2 op de dag zelf af: les 3 pas de zondag erna, hooguit één les per week
assert.deepStrictEqual(cd(['2026-10-03', '2026-10-04'], '2026-10-06'), ['2026-10-02', '2026-10-04', '2026-10-11']);
// later gehaald: de eerste zondag daarna
assert.deepStrictEqual(cd(['2026-10-20'], '2026-10-21'), ['2026-10-02', '2026-10-25']);
assert.deepStrictEqual(cd(['2026-10-20'], '2026-10-25'), ['2026-10-02', '2026-10-25', null]);
// alles meteen gehaald: elke week één les, nooit een stapel tegelijk
const fast = Array(8).fill('2026-10-02');
assert.deepStrictEqual(cd(fast, '2027-01-01'), ['2026-10-02', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15']);

// het leerpad zelf: welke units er staan en wat de volgende is
const u1 = Object.assign({}, X.COURSE[0]), testKey = X.nodeKey(u1, X.unitNodes(u1).length - 1);
assert.strictEqual(testKey, 'L1-5');                       // de toets houdt zijn oude nummer
assert.strictEqual(X.nodeKey(u1, 0), 'L1-0');              // de eerste stap (met zijn uitleg) is de oude eerste oefening
assert.strictEqual(X.unitNodes(u1).length, 6);             // vijf stappen en de unittoets, geen aparte les meer
assert.deepStrictEqual(Array.from(X.unitNodes(u1), n => (n.cards || []).length), [3, 2, 1, 1, 1, 1]);
const lessons = P => Array.from(P.units(), u => u.lesson);
const up = P => Array.from(P.upcoming(), x => [x.unit.lesson, x.date]);
let W = world('2026-10-03T10:00:00');
assert.deepStrictEqual(lessons(W.PathData), [1]);
assert.deepStrictEqual(up(W.PathData), [[2, null]]);
W = world('2026-10-03T21:00:00', { [testKey]: { done: true, runs: 1, doneDay: '2026-10-03' } });
assert.deepStrictEqual(lessons(W.PathData), [1]);
assert.deepStrictEqual(up(W.PathData), [[2, '2026-10-04']]);
W = world('2026-10-04T08:00:00', { [testKey]: { done: true, runs: 1, doneDay: '2026-10-03' } });
assert.deepStrictEqual(lessons(W.PathData), [1, 2]);
assert.deepStrictEqual(up(W.PathData), [[3, null]]);
assert.strictEqual(W.PathData.units()[1].topic, 'intervals');
assert.strictEqual(W.PathData.units()[1].date, '2026-10-04');
// voortgang van vóór deze versie: geen doneDay, dan telt de dag van de laatste keer
W = world('2026-10-04T08:00:00', { [testKey]: { done: true, runs: 2, last: new Date('2026-10-03T15:00:00').getTime() } });
assert.deepStrictEqual(lessons(W.PathData), [1, 2]);
// voortgang van versie 9.1: de les gelezen (L1-les) en de eerste twee oefeningen gedaan. Dan is stap 3
// (Powerchords) de volgende, met zijn eigen uitleg; L1-les telt niet meer mee
W = world('2026-10-03T10:00:00', { 'L1-les': { done: true, runs: 1 }, 'L1-0': { done: true, runs: 1 }, 'L1-1': { done: true, runs: 1 } });
const nx = W.nextNode();
assert.strictEqual(nx.index, 2);
assert.strictEqual(nx.node.title, 'Powerchords');
assert.deepStrictEqual(Array.from(nx.node.cards, c => c.t), ['Powerchords']);
// alleen de les gelezen: dan begint het bij stap 1, met de uitleg over het octaaf
W = world('2026-10-03T10:00:00', { 'L1-les': { done: true, runs: 1 } });
assert.strictEqual(W.nextNode().index, 0);
// het pad Gehoor: eigen nummers (LG1-0), tien niveaus, het eerste staat open
W = world('2026-10-03T10:00:00');
const g1 = W.GehoorData.units()[0];
assert.strictEqual(W.nodeKey(g1, 2), 'LG1-2');
assert.strictEqual(W.GehoorData.units().length, 10);
assert.deepStrictEqual([W.nextGehoor().unitNo, W.nextGehoor().node.title], [1, 'Leren']);
W = world('2026-10-03T10:00:00', { 'LG1-0': { done: true }, 'LG1-1': { done: true }, 'LG1-2': { done: true } });
assert.ok(W.gehoorLevelDone(0));
assert.deepStrictEqual([W.nextGehoor().unitNo, W.nextGehoor().node.title], [2, 'Leren']);
console.log('alle leerpadtests geslaagd');
