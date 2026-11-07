(function () {
  const M = KAVIX_MAPS, A = KAVIX_API, $ = id => document.getElementById(id), me = A.me();
  if (!me) { location.replace('auth.html?next=studio.html'); return; }
  const say = t => { $('status').textContent = t; }, cv = $('cv');
  let renderer; try { if (!window.THREE) throw 0; renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); }
  catch (e) { $('viewport').innerHTML = '<p class="nogl">The Studio needs 3D (WebGL). Check your connection and browser settings.</p>'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const MSG = { out: 'That spot is outside the map.', limit: 'You reached the ' + M.LIMITS.BLOCKS + ' block limit.', occupied: 'That spot is taken.' };
  let meta = { id: '', sky: 0, spawn: [0, 0, 0], published: false }, grid = new Map(), tool = 'place', color = 1, sel = null, undo = [], redo = [], dirty = false, mesh = null;

  /* scene */
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a60c0, .95)); const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(20, 40, 15); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ color: '#4A4F86', roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const lines = new THREE.GridHelper(64, 64, 0x8a90d0, 0x6a70b0); lines.position.y = .01; scene.add(lines);
  const outline = c => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)), new THREE.LineBasicMaterial({ color: c }));
  const cur = outline(0x7CE38B), selBox = outline(0xFFC93C), marker = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.7, .5), new THREE.MeshBasicMaterial({ color: '#FF5C8A', transparent: true, opacity: .65 }));
  cur.visible = selBox.visible = false; scene.add(cur, selBox, marker);
  const TOOLCOL = { place: 0x7CE38B, erase: 0xFF5C8A, move: 0xFFC93C, spawn: 0x2FD3E6 };

  function rebuild() {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    mesh = M.blockMesh(THREE, M.fromGrid(grid)); scene.add(mesh);
    marker.position.set(meta.spawn[0] + .5, meta.spawn[1] + .85, meta.spawn[2] + .5);
    scene.background = new THREE.Color(M.SKIES[meta.sky]);
    $('count').textContent = grid.size + ' / ' + M.LIMITS.BLOCKS + ' blocks' + (dirty ? ' · unsaved changes' : '');
    $('pub').textContent = meta.published ? 'Unpublish' : 'Publish';
    document.querySelectorAll('#skies .sw').forEach((b, i) => b.setAttribute('aria-checked', String(i === meta.sky)));
  }
  const snapshot = () => JSON.stringify({ b: M.fromGrid(grid), s: meta.spawn });
  function restore(str) { const o = JSON.parse(str); grid = M.toGrid(o.b); meta.spawn = o.s; sel = null; selBox.visible = false; dirty = true; rebuild(); }
  $('undo').onclick = () => { if (undo.length) { redo.push(snapshot()); restore(undo.pop()); } };
  $('redo').onclick = () => { if (redo.length) { undo.push(snapshot()); restore(redo.pop()); } };
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $(e.shiftKey ? 'redo' : 'undo').click(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); $('redo').click(); } else if (e.key === 'Escape') { sel = null; selBox.visible = false; } });

  /* controls */
  $('pal').innerHTML = M.PALETTE.map((c, i) => '<button type="button" class="sw" role="radio" data-c="' + i + '" style="background:' + c + '" aria-label="Color ' + (i + 1) + '" aria-checked="' + (i === color) + '"></button>').join('');
  $('skies').innerHTML = M.SKIES.map((c, i) => '<button type="button" class="sw" role="radio" data-s="' + i + '" style="background:' + c + '" aria-label="Sky ' + (i + 1) + '"></button>').join('');
  $('pal').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; color = +b.dataset.c; $('pal').querySelectorAll('.sw').forEach(x => x.setAttribute('aria-checked', String(x === b))); };
  $('skies').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; meta.sky = +b.dataset.s; dirty = true; rebuild(); };
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; sel = null; selBox.visible = false; cur.material.color.setHex(TOOLCOL[tool]); document.querySelectorAll('[data-tool]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); say(''); });

  /* camera orbit + picking */
  let yaw = .8, pitch = .75, dist = 42, moved = 0, multi = false, pinch = 0; const ptrs = new Map(), target = new THREE.Vector3(0, 1, 0), ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  const d2 = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
  function pick(e) {
    const r = cv.getBoundingClientRect(); v2.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(v2, camera);
    const h = ray.intersectObjects([mesh, ground], false)[0]; if (!h) return null;
    if (h.object === mesh) { const b = mesh.userData.blocks[h.instanceId], n = h.face.normal; return { hit: [b[0], b[1], b[2]], adj: [b[0] + Math.round(n.x), b[1] + Math.round(n.y), b[2] + Math.round(n.z)] }; }
    return { hit: null, adj: [Math.floor(h.point.x), 0, Math.floor(h.point.z)] };
  }
  function showCursor(r) {
    const c = r && ((tool === 'erase' || (tool === 'move' && !sel)) ? r.hit : r.adj);
    cur.visible = !!c && M.validCell(c[0], c[1], c[2]); if (c) cur.position.set(c[0] + .5, c[1] + .5, c[2] + .5);
  }
  function act(e) {
    const r = pick(e); showCursor(r); if (!r) return;
    const before = snapshot(); let res = 'none';
    if (tool === 'place') res = M.place(grid, r.adj[0], r.adj[1], r.adj[2], color);
    else if (tool === 'erase') res = r.hit ? M.erase(grid, r.hit[0], r.hit[1], r.hit[2]) : 'none';
    else if (tool === 'move') {
      if (!sel) { if (r.hit) { sel = r.hit; selBox.position.set(sel[0] + .5, sel[1] + .5, sel[2] + .5); selBox.visible = true; say('Now tap where it should go.'); } return; }
      if (r.hit && r.hit.join() === sel.join()) { sel = null; selBox.visible = false; say('Move cancelled.'); return; }
      res = M.move(grid, sel, r.adj); sel = null; selBox.visible = false;
    } else if (tool === 'spawn') {
      if (!M.validCell(r.adj[0], r.adj[1], r.adj[2])) res = 'out';
      else if (grid.has(M.key(r.adj[0], r.adj[1], r.adj[2])) || grid.has(M.key(r.adj[0], r.adj[1] + 1, r.adj[2]))) res = 'occupied';
      else { meta.spawn = r.adj; res = 'ok'; }
    }
    if (res === 'ok') { undo.push(before); if (undo.length > 60) undo.shift(); redo.length = 0; dirty = true; rebuild(); say(''); } else say(MSG[res] || '');
  }
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) { moved = 0; multi = false; } else { multi = true; pinch = d2(); } });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') showCursor(pick(e)); return; }
    if (ptrs.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; yaw -= dx * .006; pitch = Math.max(.1, Math.min(1.5, pitch + dy * .006)); moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY; }
    else { p.x = e.clientX; p.y = e.clientY; const d = d2(); dist = Math.max(6, Math.min(90, dist * pinch / d)); pinch = d; }
  });
  const up = e => { const had = ptrs.delete(e.pointerId); if (had && e.type === 'pointerup' && !multi && moved < 6 && e.button === 0) act(e); if (!ptrs.size) multi = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
  cv.addEventListener('wheel', e => { dist = Math.max(6, Math.min(90, dist * (1 + e.deltaY * .001))); }, { passive: true });
  const vp = $('viewport'); new ResizeObserver(() => { renderer.setSize(vp.clientWidth, vp.clientHeight, false); camera.aspect = vp.clientWidth / Math.max(1, vp.clientHeight); camera.updateProjectionMatrix(); }).observe(vp);
  (function loop() { camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); camera.lookAt(target); renderer.render(scene, camera); requestAnimationFrame(loop); })();

  /* save, publish, list */
  const collect = () => ({ id: meta.id, name: $('name').value, sky: meta.sky, spawn: meta.spawn, blocks: M.fromGrid(grid), published: meta.published });
  function save() {
    try { const m = M.save(collect(), me.name); meta.id = m.id; meta.published = m.published; $('name').value = m.name; dirty = false; rebuild(); list(); say('Saved.'); return m; }
    catch (x) { say(x.message); return null; }
  }
  $('save').onclick = save;
  $('pub').onclick = () => { const m = save(); if (!m) return; try { M.setPublished(m.id, me.name, !meta.published); meta.published = !meta.published; rebuild(); list(); say(meta.published ? 'Published. It now shows on the home page.' : 'Unpublished.'); } catch (x) { say(x.message); } };
  $('test').onclick = () => { const m = save(); if (m) location.href = 'play.html?g=' + m.id; };
  function load(m) { meta = { id: m.id || '', sky: m.sky || 0, spawn: m.spawn || [0, 0, 0], published: !!m.published }; grid = M.toGrid(m.blocks || []); $('name').value = m.name || 'My first map'; undo = []; redo = []; sel = null; selBox.visible = false; dirty = false; rebuild(); }
  $('new').onclick = () => { if (!dirty || confirm('Discard unsaved changes?')) { load({ name: 'My new map', blocks: [] }); say(''); } };
  function list() {
    const ul = $('maps'); ul.textContent = '';
    M.listMine(me.name).forEach(m => {
      const li = document.createElement('li'), b = document.createElement('button'), x = document.createElement('button');
      b.type = x.type = 'button'; b.className = 'chip load'; b.textContent = m.name + (m.published ? ' (published)' : ''); x.className = 'chip'; x.textContent = 'Delete'; x.setAttribute('aria-label', 'Delete ' + m.name);
      b.onclick = () => { if (!dirty || confirm('Discard unsaved changes?')) { load(m); say('Loaded ' + m.name + '.'); } };
      x.onclick = () => { if (confirm('Delete "' + m.name + '"? This cannot be undone.')) { M.remove(m.id, me.name); if (meta.id === m.id) meta.id = ''; list(); } };
      li.append(b, x); ul.append(li);
    });
    if (!ul.children.length) { const li = document.createElement('li'); li.className = 'note'; li.textContent = 'No saved maps yet. Build something and press Save.'; ul.append(li); }
  }
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  const mine = M.listMine(me.name); if (mine.length) load(mine[0]); else load({ name: 'My first map', blocks: [] });
  list();
})();
