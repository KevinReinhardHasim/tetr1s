// Engine and rules checks that run in Node without a browser: node tests/run.js
'use strict';
const path = require('path');
['util.js', 'engine.js', 'rules.js'].forEach(f => require(path.join(__dirname, '..', 'js', f)));
const TR = global.TR;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }

function game(seed) {
  const events = [];
  const g = new TR.Game({seed: seed || 1, onEvent: (t, d) => events.push([t, d])});
  g.events = events;
  return g;
}
const G = {t: 'G', back: false, rune: null};
function fillRow(g, y, holes) { for (let x = 0; x < 10; x++) g.grid[y][x] = holes.indexOf(x) >= 0 ? null : Object.assign({}, G); }
const last = (g, type) => { for (let i = g.events.length - 1; i >= 0; i--) if (g.events[i][0] === type) return g.events[i][1]; return null; };

test('7-bag: each group of 7 holds every piece once', () => {
  const g = game(42), seen = [];
  for (let i = 0; i < 14; i++) { seen.push(g.queue.shift()); g.fill(); }
  eq(seen.slice(0, 7).sort(), TR.TYPES.slice().sort());
  eq(seen.slice(7).sort(), TR.TYPES.slice().sort());
});

test('same seed gives the same piece order', () => {
  eq(game(7).queue, game(7).queue);
});

test('T rotates clockwise to point right', () => {
  const g = game(); g.spawn('T');
  g.rotate(1);
  const cells = g.cells(g.piece).map(c => c[0] + ',' + c[1]).sort();
  eq(cells, ['4,1', '4,2', '4,3', '5,2'].sort());
});

test('I kicks off the left wall', () => {
  const g = game(); g.spawn('I');
  g.rotate(1);                               // vertical in column 5
  while (g.move(-1)) {}                     // pressed against the wall
  eq(g.piece.x, -2, 'vertical I against the wall');
  eq(g.rotate(1), true, 'rotation must kick');
  eq(Math.min.apply(null, g.cells(g.piece).map(c => c[0])), 0);
});

test('hard drop clears a full row', () => {
  const g = game(); fillRow(g, 21, [3, 4, 5, 6]);
  g.spawn('I'); g.hardDrop();
  eq(last(g, 'clear').lines, 1);
  g.update(.3);
  eq(g.grid[21].every(v => !v), true, 'bottom row empty after the clear delay');
});

test('T-spin double is detected', () => {
  const g = game();
  fillRow(g, 21, [4]); fillRow(g, 20, [3, 4, 5]);
  g.grid[19][3] = Object.assign({}, G);       // overhang
  g.spawn('T');
  Object.assign(g.piece, {rot: 1, x: 3, y: 19});
  eq(g.rotate(1), true);
  g.lockPiece();
  const c = last(g, 'clear');
  eq([c.lines, c.tspin], [2, 2]);
});

test('lines clear in a row count as a combo, and quads chain back-to-back', () => {
  const g = game();
  fillRow(g, 21, [0]); fillRow(g, 20, [0]); fillRow(g, 19, [0]); fillRow(g, 18, [0]);
  g.spawn('I'); g.rotate(1); while (g.move(-1)) {} g.hardDrop();
  eq(last(g, 'clear').lines, 4); eq(last(g, 'clear').b2b, false);
  g.update(.3);
  fillRow(g, 21, [0]); fillRow(g, 20, [0]); fillRow(g, 19, [0]); fillRow(g, 18, [0]);
  g.piece = null; g.spawn('I'); g.rotate(1); while (g.move(-1)) {} g.hardDrop();
  eq(last(g, 'clear').b2b, true); eq(last(g, 'clear').combo, 1);
});

test('flip keeps each column count and settles on the floor', () => {
  const g = game();
  g.grid[21][0] = Object.assign({}, G); g.grid[19][0] = Object.assign({}, G);  // a hole in column 0
  g.grid[21][1] = Object.assign({}, G);
  g.flipGrid();
  eq(!!g.grid[21][0] && !!g.grid[20][0] && !g.grid[19][0], true, 'column 0 compacts to the floor');
  eq(!!g.grid[21][1] && !g.grid[20][1], true);
  eq(g.grid[21][0].back, true, 'cells show their back face');
});

test('flip turns columns of equal count into full rows', () => {
  const g = game();
  for (let x = 0; x < 10; x++) g.grid[x % 2 ? 21 : 15][x] = Object.assign({}, G);  // scattered, one per column
  g.flipGrid();
  eq(g.fullRows(), [21]);
});

test('garbage rises and a full board tops out', () => {
  const g = game(); g.spawn('O');
  eq(g.addGarbage(3, 2), true);
  eq(!g.grid[21][2] && !!g.grid[21][0], true);
  eq(g.removeGarbageRow(), true);
  const h = game(); h.grid[0][0] = Object.assign({}, G);
  eq(h.addGarbage(1, 0), false); eq(h.over, true);
});

test('hold swaps once per piece', () => {
  const g = game(3); g.spawn();
  const first = g.piece.type;
  eq(g.holdPiece(), true); eq(g.hold.type, first);
  eq(g.holdPiece(), false, 'second hold in the same turn is refused');
});

test('flip requested mid-piece brings the same piece back', () => {
  const g = game(5); g.spawn('L');
  eq(g.requestFlipNow(), true);
  for (let i = 0; i < 200 && g.phase !== 'play'; i++) g.update(.02);
  eq(g.piece.type, 'L');
});

test('rules: score, attack, damage', () => {
  const R = TR.Rules;
  eq(R.score(R.info({lines: 4}), 1), 800);
  eq(R.score(R.info({lines: 4, b2b: true}), 2), 2400);
  eq(R.score(R.info({lines: 2, tspin: 2}), 1), 1200);
  eq(R.attack(R.info({lines: 2})), 1);
  eq(R.attack(R.info({lines: 2, tspin: 2})), 4);
  eq(R.attack(R.info({lines: 4, b2b: true, combo: 2})), 6);
  eq(R.attack(R.info({lines: 3, runes: ['fire']}, true)), 4);
  eq(R.damage(R.info({lines: 4}), []), 72);
  eq(R.damage(R.info({lines: 4}), ['keris']), 108);
  eq(R.damage(R.info({lines: 1, runes: ['fire', 'thunder']}), []), 37);
  eq(R.MONSTERS.length, 10);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
