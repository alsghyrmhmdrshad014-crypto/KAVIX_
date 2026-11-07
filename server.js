'use strict';
/* KAVIX server: serves the site and relays multiplayer rooms over WebSocket. No dependencies. Run: node server/server.js */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const OK_PATH = /^\/(?:[\w-]+\.html|(?:css|js|assets)\/[\w.-]+)$/, MAX_ROOM = 20, MAX_PAYLOAD = 4096, RATE = 40;
const num = (v, lim) => (typeof v === 'number' && isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

function frame(op, payload) {
  const n = payload.length;
  return Buffer.concat([n < 126 ? Buffer.from([0x80 | op, n]) : Buffer.from([0x80 | op, 126, n >> 8, n & 255]), payload]);
}
function parseFrame(buf) {
  if (buf.length < 2) return null;
  const fin = !!(buf[0] & 0x80), op = buf[0] & 15, masked = !!(buf[1] & 0x80); let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) return { err: 1009 };
  if (!masked) return { err: 1002 }; if (len > MAX_PAYLOAD) return { err: 1009 };
  if (buf.length < off + 4 + len) return null;
  const payload = Buffer.alloc(len); for (let i = 0; i < len; i++) payload[i] = buf[off + 4 + i] ^ buf[off + (i & 3)];
  return { fin, op, payload, used: off + 4 + len };
}

function createServer(opts) {
  opts = opts || {};
  const origins = String(opts.origins || process.env.KAVIX_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), rooms = new Map();
  const server = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!OK_PATH.test(p) || p.includes('..') || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('Not found'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }); res.end(data);
    });
  });
  server.on('upgrade', (req, socket) => {
    const k = req.headers['sec-websocket-key'];
    if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || !k) return socket.destroy();
    if (origins.length && !origins.includes(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(k + GUID).digest('base64') + '\r\n\r\n');
    attach(socket);
  });

  function attach(socket) {
    const c = { id: crypto.randomBytes(4).toString('hex'), room: null, name: 'Guest', avatar: null, st: { x: 0, y: 0, z: 0, ry: 0, a: 0 }, tokens: RATE, last: Date.now(), dead: false };
    let buf = Buffer.alloc(0);
    c.send = o => { if (!c.dead) socket.write(frame(1, Buffer.from(JSON.stringify(o)))); };
    const pub = o => Object.assign({ id: o.id, name: o.name, avatar: o.avatar }, o.st);
    const cleanup = () => {
      if (c.dead) return; c.dead = true;
      const r = c.room && rooms.get(c.room); if (!r) return;
      r.delete(c.id); r.forEach(o => o.send({ t: 'leave', id: c.id })); if (!r.size) rooms.delete(c.room);
    };
    const close = code => { if (c.dead) return; const b = Buffer.alloc(2); b.writeUInt16BE(code); try { socket.write(frame(8, b)); } catch (e) { /* gone */ } cleanup(); socket.end(); };
    function onMessage(text) {
      const now = Date.now(); c.tokens = Math.min(RATE, c.tokens + (now - c.last) / 1000 * RATE); c.last = now;
      if (c.tokens < 1) return; c.tokens--;
      let m; try { m = JSON.parse(text); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'join' && !c.room) {
        if (typeof m.room !== 'string' || !/^[\w-]{1,40}$/.test(m.room)) return close(1008);
        let r = rooms.get(m.room); if (!r) rooms.set(m.room, r = new Map());
        if (r.size >= MAX_ROOM) { c.send({ t: 'full' }); return close(1008); }
        c.name = String(m.name || '').replace(/\W/g, '').slice(0, 16) || 'Guest';
        c.avatar = m.avatar && typeof m.avatar === 'object' && JSON.stringify(m.avatar).length <= 600 ? m.avatar : null;
        c.room = m.room;
        c.send({ t: 'welcome', id: c.id, players: [...r.values()].map(pub) });
        r.forEach(o => o.send({ t: 'join', p: pub(c) })); r.set(c.id, c);
      } else if (m.t === 'state' && c.room) {
        c.st = { x: num(m.x, 1000), y: num(m.y, 1000), z: num(m.z, 1000), ry: num(m.ry, 10), a: m.a ? 1 : 0 };
        const out = Object.assign({ t: 'state', id: c.id }, c.st);
        rooms.get(c.room).forEach(o => { if (o !== c) o.send(out); });
      }
    }
    socket.setNoDelay(true); socket.setTimeout(60000, () => close(1001));
    socket.on('close', cleanup); socket.on('error', cleanup);
    socket.on('data', d => {
      buf = Buffer.concat([buf, d]); if (buf.length > 16384) return close(1009);
      for (;;) {
        const f = parseFrame(buf); if (!f) break; if (f.err) return close(f.err);
        buf = buf.subarray(f.used);
        if (!f.fin || f.op === 0 || f.op > 10 || (f.op > 2 && f.op < 8)) return close(1003);
        if (f.op === 1) onMessage(f.payload.toString('utf8')); else if (f.op === 8) return close(1000);
        else if (f.op === 9 && f.payload.length < 126) socket.write(frame(10, f.payload));
        else if (f.op === 2) return close(1003);
      }
    });
  }
  server.rooms = rooms; return server;
}
if (require.main === module) {
  const port = +process.env.PORT || 8080, host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => console.log('KAVIX is running at http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port));
}
module.exports = { createServer };
