const assert = require('assert'), AV = require('../js/avatar.js'), A = require('../js/api.js');
/* minimal THREE stub: records structure, no rendering */
class V { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
class Obj { constructor() { this.children = []; this.position = new V(); this.rotation = new V(); this.userData = {}; this.name = ''; } add(c) { this.children.push(c); } traverse(f) { f(this); this.children.forEach(c => c.traverse(f)); } }
const THREE = { Group: class extends Obj {}, Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  BoxGeometry: class { constructor(w, h, d) { Object.assign(this, { w, h, d }); } dispose() {} }, MeshStandardMaterial: class { constructor(o) { this.color = o.color; } dispose() {} } };
const count = av => { let n = 0; av.traverse(o => { if (o.geometry) n++; }); return n; };
const bad = /[^#0-9a-fA-F]|NaN/;

assert.deepStrictEqual(AV.sanitize(null), AV.DEFAULT);
const s = AV.sanitize({ skin: '<script>', shirt: '#b23dff', hair: 'mohawk', face: 'wow', acc: 'crown', hairColor: 'red', evil: 1 });
assert.strictEqual(s.skin, AV.DEFAULT.skin); assert.strictEqual(s.shirt, '#B23DFF'); assert.strictEqual(s.hair, 'flat');
assert.strictEqual(s.face, 'wow'); assert.strictEqual(s.acc, 'crown'); assert(!('evil' in s));

const base = AV.build(THREE, AV.DEFAULT); const P = base.userData.parts;
['body', 'head', 'armL', 'armR', 'legL', 'legR'].forEach(n => assert(P[n], n));
let top = 0, bot = 1e9; const n0 = count(AV.build(THREE, Object.assign({}, AV.DEFAULT, { hair: 'none' })));
assert(count(AV.build(THREE, Object.assign({}, AV.DEFAULT, { hair: 'spiky' }))) > count(base));
assert(count(base) > n0);
assert(count(AV.build(THREE, Object.assign({}, AV.DEFAULT, { acc: 'crown' }))) > count(base));
assert(count(AV.build(THREE, Object.assign({}, AV.DEFAULT, { acc: 'backpack' }))) === count(base) + 1);

/* every option combination builds with valid colors and finite numbers */
let combos = 0;
for (const hair of AV.OPT.hair) for (const face of AV.OPT.face) for (const acc of AV.OPT.acc) {
  const av = AV.build(THREE, Object.assign({}, AV.DEFAULT, { hair, face, acc })); combos++;
  av.traverse(o => { if (o.material) assert(/^#[0-9a-f]{6}$/i.test(o.material.color), o.material.color);
    ['x', 'y', 'z'].forEach(k => assert(Number.isFinite(o.position[k]))); if (o.geometry) assert(o.geometry.w > 0 && o.geometry.h > 0 && o.geometry.d > 0); });
}
assert.strictEqual(combos, 64);

/* walk cycle: limbs swing in opposite pairs, idle is still */
AV.pose(base, .13, 1);
assert(Math.abs(P.armL.rotation.x + P.armR.rotation.x) < 1e-9 && Math.abs(P.legL.rotation.x + P.legR.rotation.x) < 1e-9);
assert(P.armL.rotation.x !== 0 && Math.abs(P.armL.rotation.x + P.legL.rotation.x) < 1e-9);
AV.pose(base, .13, 0); assert.strictEqual(P.armL.rotation.x, 0); assert.strictEqual(P.body.position.y, 0);

/* random is always valid */
for (let i = 0; i < 300; i++) { const r = AV.random(); assert.deepStrictEqual(AV.sanitize(r), r); }
let seed = 1; const seq = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
assert.deepStrictEqual(AV.random(seq), AV.random((() => { let s2 = 1; return () => (s2 = (s2 * 16807) % 2147483647) / 2147483647; })()));
AV.dispose(base);

/* storage round trip */
const mem = {}; A.setStorage({ getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } });
(async () => {
  assert.strictEqual(A.getAvatar(), null);
  assert.throws(() => A.setAvatar({ a: 1 }), /Sign in/);
  await A.signup('Builder1', 'longenough');
  assert.strictEqual(A.getAvatar(), null);
  A.setAvatar(AV.sanitize({ shirt: '#FFC93C', acc: 'shades' }));
  assert.deepStrictEqual(AV.sanitize(A.getAvatar()), AV.sanitize({ shirt: '#FFC93C', acc: 'shades' }));
  assert.throws(() => A.setAvatar('x'), /Invalid/); assert.throws(() => A.setAvatar({ big: 'x'.repeat(700) }), /Invalid/);
  A.logout(); await A.login('builder1', 'longenough'); assert.strictEqual(A.getAvatar().acc, 'shades');
  console.log('Phase 3 avatar tests passed:', combos, 'combinations');
})().catch(e => { console.error(e); process.exit(1); });
