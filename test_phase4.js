const assert = require('assert'), M = require('../js/maps.js'), P = require('../js/physics.js');
const mem = {}; M.setStorage({ getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } });

/* map rules */
const g = new Map();
assert.strictEqual(M.place(g, 0, 0, 0, 1), 'ok'); assert.strictEqual(M.place(g, 0, 0, 0, 1), 'same');
assert.strictEqual(M.place(g, 40, 0, 0, 1), 'out'); assert.strictEqual(M.place(g, 0, -1, 0, 1), 'out'); assert.strictEqual(M.place(g, 0, 32, 0, 1), 'out');
assert.strictEqual(M.place(g, 1, 0, 0, 99), 'color'); assert.strictEqual(M.place(g, 1.5, 0, 0, 1), 'out');
assert.strictEqual(M.move(g, [0, 0, 0], [2, 0, 0]), 'ok'); assert(g.has('2,0,0') && !g.has('0,0,0'));
M.place(g, 5, 0, 0, 2); assert.strictEqual(M.move(g, [2, 0, 0], [5, 0, 0]), 'occupied'); assert.strictEqual(M.move(g, [9, 9, 9], [1, 0, 0]), 'none');
assert.strictEqual(M.move(g, [2, 0, 0], [0, 99, 0]), 'out');
assert.strictEqual(M.erase(g, 5, 0, 0), 'ok'); assert.strictEqual(M.erase(g, 5, 0, 0), 'none');
const full = new Map(); for (let i = 0; i < 2000; i++) full.set(i + ',0,0', 1); assert.strictEqual(M.place(full, 0, 1, 0, 1), 'limit'); assert.strictEqual(M.place(full, 0, 0, 0, 2), 'ok');

/* sanitize */
const s = M.sanitizeMap({ id: 'bad', name: '<b>Hi</b>', sky: 9, spawn: [99, 0, 0], blocks: [[0, 0, 0, 1], [0, 0, 0, 2], [1, 1, 1, 50], 'x', [70, 0, 0, 1], [1, 0, 1, 3]], published: 'yes' });
assert.strictEqual(s.id, ''); assert.strictEqual(s.name, 'bHi/b'); assert.strictEqual(s.sky, 0); assert.deepStrictEqual(s.spawn, [0, 0, 0]);
assert.strictEqual(s.blocks.length, 2); assert.strictEqual(s.published, false); assert.strictEqual(M.sanitizeMap(null).name, 'Untitled');
assert.strictEqual(M.sanitizeMap({ blocks: Array.from({ length: 3000 }, (_, i) => [i % 60 - 30, Math.floor(i / 60) % 30, 0, 1]) }).blocks.length <= 2000, true);

/* storage, ownership, publishing */
const five = [[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1], [3, 0, 0, 1], [4, 0, 0, 1]];
const a = M.save({ name: 'Mine', blocks: five }, 'Nora'); assert(/^m_[0-9a-f]{10}$/.test(a.id)); assert.strictEqual(a.published, false);
assert.strictEqual(M.get(a.id, 'nora').name, 'Mine'); assert.strictEqual(M.get(a.id, 'other'), null); assert.strictEqual(M.get(a.id), null);
assert.throws(() => M.save({ id: a.id, name: 'Steal', blocks: five }, 'Mallory'), /another player/);
assert.throws(() => M.setPublished(a.id, 'Mallory', true), /Save the map/); assert.strictEqual(M.remove(a.id, 'Mallory'), false);
const tiny = M.save({ name: 'Tiny', blocks: [[0, 0, 0, 1]] }, 'Nora'); assert.throws(() => M.setPublished(tiny.id, 'Nora', true), /at least 5/);
M.setPublished(a.id, 'nora', true); assert.strictEqual(M.get(a.id, 'other').name, 'Mine'); assert.deepStrictEqual(M.listPublished().map(m => m.id), [a.id]);
const a2 = M.save({ id: a.id, name: 'Mine v2', blocks: five }, 'Nora'); assert.strictEqual(a2.published, true);
M.setPublished(a.id, 'Nora', false); assert.strictEqual(M.listPublished().length, 0); assert.strictEqual(M.listMine('NORA').length, 2);
for (let i = 0; i < 18; i++) M.save({ name: 'x' + i }, 'Nora'); assert.throws(() => M.save({ name: 'one too many' }, 'Nora'), /up to 20/);
assert.strictEqual(M.remove(a.id, 'Nora'), true); assert.strictEqual(M.get(a.id, 'Nora'), null);

/* physics */
const solidOf = blocks => P.makeSolid(M.toGrid(blocks));
const mk = (x, y, z) => ({ x, y, z, vx: 0, vy: 0, vz: 0, ground: false });
const run = (p, inp, secs, solid, dt) => { for (let t = 0; t < secs; t += dt) P.step(p, typeof inp === 'function' ? inp(t) : inp, dt, solid); };
const still = { mx: 0, mz: 0, jump: false };
let p = mk(.5, 5, .5); run(p, still, 2, solidOf([]), 1 / 60); assert.strictEqual(p.y, 0); assert(p.ground);
p = mk(.5, 0, .5); let peak = 0; run(p, t => { peak = Math.max(peak, p.y); return { mx: 0, mz: 0, jump: t < .02 }; }, 1.5, solidOf([]), 1 / 60);
assert(peak > 1.5 && peak < 1.9, 'jump peak ' + peak); assert.strictEqual(p.y, 0);
const wall = []; for (let y = 0; y < 3; y++) for (let z = -3; z <= 3; z++) wall.push([3, y, z, 1]);
p = mk(.5, 0, .5); run(p, { mx: 1, mz: 0, jump: false }, 2, solidOf(wall), 1 / 60); assert(p.x <= 3 - P.R + 1e-6 && p.x > 2.5, 'stopped by wall at ' + p.x);
p = mk(.5, 0, .5); run(p, { mx: 1, mz: 0, jump: false }, 2, solidOf(wall), 1 / 15); assert(p.x <= 3 - P.R + 1e-6, 'no tunnelling at low fps');
const step1 = []; for (let x = 2; x <= 8; x++) for (let z = -3; z <= 3; z++) step1.push([x, 0, z, 1]); // 1 high, wide
p = mk(0.5, 0, .5); run(p, () => ({ mx: 1, mz: 0, jump: p.x < 1.6 }), .7, solidOf(step1), 1 / 60); assert(p.x > 2, 'jumped up a 1-block step, x=' + p.x); assert(Math.abs(p.y - 1) < 1e-6, 'standing on step y=' + p.y);
const step2 = step1.map(b => [b[0], 1, b[2], 1]).concat(step1);
p = mk(0.5, 0, .5); run(p, () => ({ mx: 1, mz: 0, jump: true }), 1.5, solidOf(step2), 1 / 60); assert(p.x < 2.8, 'cannot jump a 2-block wall, x=' + p.x);
const roof = []; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) roof.push([x, 2, z, 1]);
p = mk(.5, 0, .5); let hmax = 0; run(p, () => { hmax = Math.max(hmax, p.y + P.H); return { mx: 0, mz: 0, jump: true }; }, 1, solidOf(roof), 1 / 60); assert(hmax <= 2 + 1e-6 && hmax > 1.9, 'head stops at the roof: ' + hmax);
p = mk(.5, 0, .5); run(p, { mx: 1, mz: 1, jump: false }, 1, solidOf([]), 1 / 60); assert(Math.abs(Math.hypot(p.x - .5, p.z - .5) - P.SPEED) < .05, 'diagonal speed not faster');
p = mk(.5, 0, .5); run(p, { mx: 1, mz: 0, jump: false }, 8, solidOf([]), 1 / 60); assert(p.x > 32 && p.y < -20, 'walks off the edge into the void');
p = mk(.5, 0, .5); P.step(p, still, .01, solidOf([[0, 0, 0, 1], [0, 1, 0, 1]])); assert(p.y >= 2, 'pushed out of a block');

/* built-in worlds: valid, and the goals are reachable by conservative hops (gap <= 3 cells, rise <= 1) */
function reach(map) {
  const grid = M.toGrid(map.blocks), has = (x, y, z) => grid.has(x + ',' + y + ',' + z);
  const stand = (x, y, z) => M.validCell(x, y, z) && !has(x, y, z) && !has(x, y + 1, z) && (y === 0 || has(x, y - 1, z));
  const seen = new Set(), q = [map.spawn], k = c => c.join(); seen.add(k(map.spawn)); let top = 0;
  while (q.length) {
    const [x, y, z] = q.pop(); top = Math.max(top, y);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (dx * dx + dz * dz > 9) continue;
      for (let ny = Math.min(31, y + 1); ny >= 0; ny--) { const n = [x + dx, ny, z + dz]; if (stand(...n) && !seen.has(k(n))) { seen.add(k(n)); q.push(n); } } }
  }
  return { seen, top, stand };
}
const goals = { 'sky-hop': 7, 'lava-climb': 20, 'tower-tag': 5 };
['sky-hop', 'block-rally', 'lava-climb', 'pixel-farm', 'maze-run', 'tower-tag'].forEach(id => {
  const m = M.builtinMap(id); assert(m && m.blocks.length > 20 && m.blocks.length <= 2000, id + ' size ' + m.blocks.length);
  assert.strictEqual(M.sanitizeMap(m).blocks.length, m.blocks.length, id + ' survives sanitize');
  const g = M.toGrid(m.blocks), sp = m.spawn; assert(!g.has(M.key(sp[0], sp[1], sp[2])) && !g.has(M.key(sp[0], sp[1] + 1, sp[2])), id + ' spawn is clear');
  const r = reach(m); if (goals[id]) assert(r.top >= goals[id], id + ' reachable height ' + r.top + ' < ' + goals[id]);
  if (id === 'maze-run') assert(r.seen.has('13,0,13') || r.seen.has('13,0,14') || r.seen.has('14,0,13'), 'maze exit reachable');
  console.log('  ', id, m.blocks.length, 'blocks, reachable height', r.top);
});
assert.strictEqual(M.builtinMap('nope'), null);
console.log('Phase 4-6 tests passed (maps, storage, publishing, physics, built-in worlds)');
