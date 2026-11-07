/* KAVIX maps: format, editing rules, storage, built-in worlds. Pure logic is Node-testable. */
(function (root) {
  const PALETTE = ['#F3F1FF','#FFC93C','#B23DFF','#2FD3E6','#FF5C8A','#7CE38B','#FF9F43','#3D6BFF','#5E6A8A','#33334A','#8A5230','#E8C15A'];
  const SKIES = ['#8EC9FF','#FFB88A','#1B1D4D','#A8F0D0'];
  const L = { MIN: -32, MAX: 32, H: 32, BLOCKS: 2000, PER_USER: 20, PUBLISH_MIN: 5 };
  const key = (x, y, z) => x + ',' + y + ',' + z, isInt = Number.isInteger;
  const validCell = (x, y, z) => isInt(x) && isInt(y) && isInt(z) && x >= L.MIN && x < L.MAX && z >= L.MIN && z < L.MAX && y >= 0 && y < L.H;
  const toGrid = blocks => { const g = new Map(); blocks.forEach(b => g.set(key(b[0], b[1], b[2]), b[3])); return g; };
  const fromGrid = g => { const o = []; g.forEach((c, k) => { const p = k.split(',').map(Number); o.push([p[0], p[1], p[2], c]); }); return o; };

  /* editing rules: each returns 'ok' or a reason */
  function place(g, x, y, z, c) {
    if (!validCell(x, y, z)) return 'out'; if (!isInt(c) || c < 0 || c >= PALETTE.length) return 'color';
    const k = key(x, y, z); if (!g.has(k) && g.size >= L.BLOCKS) return 'limit'; if (g.get(k) === c) return 'same';
    g.set(k, c); return 'ok';
  }
  const erase = (g, x, y, z) => g.delete(key(x, y, z)) ? 'ok' : 'none';
  function move(g, from, to) {
    const fk = key(from[0], from[1], from[2]), tk = key(to[0], to[1], to[2]);
    if (!g.has(fk)) return 'none'; if (!validCell(to[0], to[1], to[2])) return 'out'; if (g.has(tk)) return 'occupied';
    const c = g.get(fk); g.delete(fk); g.set(tk, c); return 'ok';
  }
  function sanitizeMap(m) {
    m = m && typeof m === 'object' ? m : {};
    const g = new Map();
    (Array.isArray(m.blocks) ? m.blocks : []).forEach(b => { if (Array.isArray(b) && g.size < L.BLOCKS && validCell(b[0], b[1], b[2]) && isInt(b[3]) && b[3] >= 0 && b[3] < PALETTE.length) g.set(key(b[0], b[1], b[2]), b[3]); });
    const sp = Array.isArray(m.spawn) && validCell(m.spawn[0], m.spawn[1], m.spawn[2]) ? m.spawn.slice(0, 3) : [0, 0, 0];
    return { v: 1, id: /^m_[0-9a-f]{10}$/.test(m.id) ? m.id : '', name: String(m.name == null ? '' : m.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 32) || 'Untitled',
      sky: isInt(m.sky) && m.sky >= 0 && m.sky < SKIES.length ? m.sky : 0, spawn: sp, blocks: fromGrid(g), published: m.published === true };
  }

  /* storage (local to this browser for now) */
  let store = typeof localStorage !== 'undefined' ? localStorage : null;
  const K = 'kavix.maps', setStorage = s => { store = s; };
  const all = () => { try { return JSON.parse(store.getItem(K)) || {}; } catch (e) { return {}; } };
  const newId = () => 'm_' + Array.from((root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(5)), x => x.toString(16).padStart(2, '0')).join('');
  function save(map, user) {
    const a = all(), m = sanitizeMap(map), u = String(user).toLowerCase();
    if (!m.id) m.id = newId();
    const old = a[m.id];
    if (old && old.owner !== u) throw new Error('This map belongs to another player.');
    if (!old && Object.values(a).filter(x => x.owner === u).length >= L.PER_USER) throw new Error('You can keep up to ' + L.PER_USER + ' maps. Delete one first.');
    if (old && old.published) m.published = true;
    Object.assign(m, { owner: u, author: user, updated: Date.now() });
    if (m.published && m.blocks.length < L.PUBLISH_MIN) m.published = false;
    a[m.id] = m; store.setItem(K, JSON.stringify(a)); return m;
  }
  function setPublished(id, user, on) {
    const a = all(), m = a[id];
    if (!m || m.owner !== String(user).toLowerCase()) throw new Error('Save the map first.');
    if (on && m.blocks.length < L.PUBLISH_MIN) throw new Error('Add at least ' + L.PUBLISH_MIN + ' blocks before publishing.');
    m.published = !!on; store.setItem(K, JSON.stringify(a)); return m;
  }
  function remove(id, user) { const a = all(); if (a[id] && a[id].owner === String(user).toLowerCase()) { delete a[id]; store.setItem(K, JSON.stringify(a)); return true; } return false; }
  const listMine = user => Object.values(all()).filter(m => m.owner === String(user).toLowerCase()).sort((p, q) => q.updated - p.updated);
  const listPublished = () => Object.values(all()).filter(m => m.published).sort((p, q) => q.updated - p.updated);

  /* built-in worlds for the sample games */
  const META = { 'sky-hop': ['Sky Hop', 'Nora', 0], 'block-rally': ['Block Rally', 'Tariq', 1], 'lava-climb': ['Lava Climb', 'Mika', 1],
    'pixel-farm': ['Pixel Farm', 'Sam', 3], 'maze-run': ['Maze Run', 'Layla', 2], 'tower-tag': ['Tower Tag', 'Omar', 0] };
  const isBuiltin = id => Object.prototype.hasOwnProperty.call(META, id);
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function builtinMap(id) {
    if (!isBuiltin(id)) return null;
    const g = new Map(), put = (x, y, z, c) => { if (validCell(x, y, z)) g.set(key(x, y, z), c); };
    const box = (x0, y0, z0, x1, y1, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, c); };
    let spawn = [0, 0, 0];
    if (id === 'sky-hop') {
      for (let i = 0; i < 14; i++) { const x0 = -26 + 4 * i, cz = Math.round(Math.sin(i * .7) * 5); box(x0, Math.floor(i / 2), cz - 1, x0 + 2, Math.floor(i / 2), cz + 1, i === 13 ? 1 : [3, 4, 2, 5][i % 4]); }
      spawn = [-28, 0, 0];
    } else if (id === 'lava-climb') {
      let cx = 0, cz = 0, cy = 0;
      for (let i = 0; i < 60; i++) { const a = i * .5; cx = Math.round(Math.cos(a) * 6); cz = Math.round(Math.sin(a) * 6); cy = Math.floor(i / 3); box(cx, cy, cz, cx + 1, cy, cz + 1, i % 2 ? 4 : 6); }
      box(cx - 1, cy + 1, cz - 1, cx + 3, cy + 1, cz + 3, 1); spawn = [9, 0, 0];
    } else if (id === 'block-rally') {
      for (let x = -20; x <= 20; x++) for (let z = -12; z <= 12; z++) { const edge = Math.max(Math.abs(x) - 17, Math.abs(z) - 9); if (edge >= 0 && edge < 3 && (Math.abs(x) >= 17 || Math.abs(z) >= 9)) put(x, 0, z, (x + z) & 1 ? 8 : 9); }
      for (let x = -20; x <= 20; x++) { put(x, 1, -12, x & 1 ? 4 : 0); put(x, 1, 12, x & 1 ? 4 : 0); }
      for (let z = -12; z <= 12; z++) { put(-20, 1, z, z & 1 ? 4 : 0); put(20, 1, z, z & 1 ? 4 : 0); }
      spawn = [0, 1, -11];
    } else if (id === 'pixel-farm') {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = -14 + i * 8, z = -14 + j * 8; box(x, 0, z, x + 4, 0, z + 4, 10); box(x + 1, 1, z + 1, x + 3, 1, z + 3, [5, 1, 6, 4][(i + j) % 4]); }
      spawn = [0, 0, 0];
    } else if (id === 'maze-run') {
      const n = 17, w = Array.from({ length: n }, () => Array(n).fill(1)), r = rng(7), st = [[1, 1]]; w[1][1] = 0;
      while (st.length) {
        const [x, y] = st[st.length - 1], d = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => r() - .5).filter(q => { const a = x + q[0], b = y + q[1]; return a > 0 && b > 0 && a < n && b < n && w[a][b]; });
        if (!d.length) { st.pop(); continue; } const q = d[0]; w[x + q[0] / 2][y + q[1] / 2] = 0; w[x + q[0]][y + q[1]] = 0; st.push([x + q[0], y + q[1]]);
      }
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (w[a][b]) box(-17 + a * 2, 0, -17 + b * 2, -16 + a * 2, 1, -16 + b * 2, (a + b) % 5 ? 7 : 2);
      box(14, 0, 14, 14, 1, 14, 1); spawn = [-15, 0, -15];
    } else if (id === 'tower-tag') {
      [[-14, -14, 3, 4], [14, -14, 4, 3], [14, 14, 5, 2], [-14, 14, 4, 6]].forEach(t => { for (let l = 0; l < t[2]; l++) { const h = t[2] - l; box(t[0] - h, l, t[1] - h, t[0] + h, l, t[1] + h, l % 2 ? t[3] : 0); } });
    }
    const meta = META[id];
    return { v: 1, id, name: meta[0], author: meta[1], sky: meta[2], spawn, blocks: fromGrid(g), published: true, builtin: true };
  }
  function get(id, user) {
    if (isBuiltin(id)) return builtinMap(id);
    const m = all()[id]; return m && (m.published || (user && m.owner === String(user).toLowerCase())) ? m : null;
  }

  /* one InstancedMesh for all blocks (used by studio and world) */
  function blockMesh(THREE, blocks) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.98, .98, .98), new THREE.MeshStandardMaterial({ roughness: .8 }), Math.max(1, blocks.length));
    const m = new THREE.Matrix4(), c = new THREE.Color();
    blocks.forEach((b, i) => { m.setPosition(b[0] + .5, b[1] + .5, b[2] + .5); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(PALETTE[b[3]])); });
    mesh.count = blocks.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.blocks = blocks; return mesh;
  }
  const api = { PALETTE, SKIES, LIMITS: L, key, validCell, toGrid, fromGrid, place, erase, move, sanitizeMap, setStorage, save, setPublished, remove, listMine, listPublished, get, builtinMap, isBuiltin, blockMesh };
  if (typeof module !== 'undefined') module.exports = api; else root.KAVIX_MAPS = api;
})(this);
