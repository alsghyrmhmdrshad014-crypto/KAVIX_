const assert = require('assert'), http = require('http'), { createServer } = require('../server/server.js');
const server = createServer(), sleep = ms => new Promise(r => setTimeout(r, ms));
function client(port) {
  return new Promise((res, rej) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port), q = [], w = []; ws.closed = false;
    ws.onmessage = e => { const m = JSON.parse(e.data), i = w.findIndex(x => x.f(m)); if (i >= 0) w.splice(i, 1)[0].r(m); else q.push(m); };
    ws.next = (f = () => true, ms = 1500) => new Promise((r, j) => { const i = q.findIndex(f); if (i >= 0) return r(q.splice(i, 1)[0]); const o = { f, r }; w.push(o); setTimeout(() => { const k = w.indexOf(o); if (k >= 0) { w.splice(k, 1); j(new Error('timeout')); } }, ms); });
    ws.q = q; ws.onclose = () => { ws.closed = true; }; ws.onopen = () => res(ws); ws.onerror = rej;
  });
}
const raw = (port, path) => new Promise(r => http.get({ host: '127.0.0.1', port, path }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r({ status: res.statusCode, type: res.headers['content-type'], body: d })); }));
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  try {
    /* static files */
    let r = await raw(port, '/'); assert.strictEqual(r.status, 200); assert(r.body.includes('KAVIX')); assert(/text\/html/.test(r.type));
    r = await raw(port, '/js/api.js'); assert.strictEqual(r.status, 200); assert(/javascript/.test(r.type));
    for (const bad of ['/server/server.js', '/package.json', '/tests/test_server.js', '/..%2fpackage.json', '/%2e%2e/%2e%2e/etc/passwd', '/js/%00x.js', '/nope.html']) assert.strictEqual((await raw(port, bad)).status, 404, bad);
    assert.strictEqual((await raw(port, '/%E0%A4%A')).status, 400);

    /* rooms */
    const A = await client(port), B = await client(port), C = await client(port);
    A.send(JSON.stringify({ t: 'join', room: 'r1', name: 'Alice!! <b>', avatar: { shirt: '#FFC93C' } }));
    const wa = await A.next(m => m.t === 'welcome'); assert.deepStrictEqual(wa.players, []); assert(wa.id);
    B.send(JSON.stringify({ t: 'join', room: 'r1', name: 'Bob', avatar: 'junk' }));
    const wb = await B.next(m => m.t === 'welcome'); assert.strictEqual(wb.players.length, 1);
    assert.strictEqual(wb.players[0].name, 'Aliceb', 'name sanitized'); assert.deepStrictEqual(wb.players[0].avatar, { shirt: '#FFC93C' });
    const ja = await A.next(m => m.t === 'join'); assert.strictEqual(ja.p.name, 'Bob'); assert.strictEqual(ja.p.avatar, null);
    C.send(JSON.stringify({ t: 'join', room: 'r2', name: 'Cy' })); await C.next(m => m.t === 'welcome');

    B.send(JSON.stringify({ t: 'state', x: 1.234, y: 2, z: -3, ry: 1, a: 1 }));
    const sa = await A.next(m => m.t === 'state'); assert.strictEqual(sa.id, wb.id); assert.strictEqual(sa.x, 1.234); assert.strictEqual(sa.a, 1);
    B.send(JSON.stringify({ t: 'state', x: 'evil', y: 1e99, z: NaN, ry: null, a: 0 }));
    const sb = await A.next(m => m.t === 'state'); assert.strictEqual(sb.x, 0); assert.strictEqual(sb.y, 1000); assert.strictEqual(sb.ry, 0);
    await sleep(150); assert.strictEqual(C.q.length, 0, 'rooms are isolated'); assert.strictEqual(B.q.filter(m => m.t === 'state').length, 0, 'no echo to sender');

    /* bad input */
    B.send('not json'); B.send('null'); B.send(JSON.stringify({ t: 'state', x: 5, y: 0, z: 0, ry: 0, a: 0 }));
    assert.strictEqual((await A.next(m => m.t === 'state')).x, 5, 'server survives junk');
    B.send(JSON.stringify({ t: 'join', room: 'other' })); await sleep(100); assert.strictEqual(server.rooms.has('other'), false, 'cannot join twice');
    const D = await client(port); D.send(JSON.stringify({ t: 'join', room: '../etc' })); await sleep(200); assert(D.closed, 'bad room name closes');
    const E = await client(port); E.send('x'.repeat(5000)); await sleep(200); assert(E.closed, 'oversize frame closes');
    const F = await client(port); F.send(JSON.stringify({ t: 'state', x: 1 })); await sleep(100); assert.strictEqual(A.q.length, 0, 'state before join is ignored');

    /* rate limit */
    A.q.length = 0; for (let i = 0; i < 300; i++) B.send(JSON.stringify({ t: 'state', x: i, y: 0, z: 0, ry: 0, a: 0 }));
    await sleep(500); const got = A.q.filter(m => m.t === 'state').length; assert(got > 0 && got < 120, 'rate limited, relayed ' + got + ' of 300');

    /* leave */
    B.close(); const lv = await A.next(m => m.t === 'leave'); assert.strictEqual(lv.id, wb.id);
    A.close(); C.close(); await sleep(150); assert.strictEqual(server.rooms.size, 0, 'empty rooms are removed');

    /* full room */
    const crowd = []; for (let i = 0; i < 20; i++) { const c = await client(port); c.send(JSON.stringify({ t: 'join', room: 'big', name: 'p' + i })); await c.next(m => m.t === 'welcome'); crowd.push(c); }
    const extra = await client(port); extra.send(JSON.stringify({ t: 'join', room: 'big' })); await extra.next(m => m.t === 'full'); await sleep(100); assert(extra.closed);
    crowd.forEach(c => c.close());
    console.log('Server tests passed (static safety, rooms, relay, validation, rate limit, leave, capacity)');
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
});
