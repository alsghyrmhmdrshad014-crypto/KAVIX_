(function () {
  const M = KAVIX_MAPS, AV = KAVIX_AVATAR, A = KAVIX_API, PH = KAVIX_PHYS, N = KAVIX_NET, $ = id => document.getElementById(id);
  const me = A.me(), id = new URLSearchParams(location.search).get('g') || '', map = M.get(id, me && me.name);
  function fail(t) { const m = $('msg'), p = document.createElement('p'), a = document.createElement('a'); m.hidden = false; m.textContent = ''; p.textContent = t; a.className = 'btn'; a.href = 'index.html'; a.textContent = 'Back to games'; m.append(p, a); }
  if (!map) return fail('That game was not found, or it has not been published.');
  $('title').textContent = map.name; document.title = map.name + ' – KAVIX';
  if (!window.THREE) return fail('3D could not load. Check your connection and reload.');
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: true }); } catch (e) { return fail('Your browser cannot show 3D because WebGL is turned off.'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  /* scene */
  const sky = M.SKIES[map.sky], scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 200);
  scene.background = new THREE.Color(sky); scene.fog = new THREE.Fog(sky, 45, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a60c0, .95));
  const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(20, 40, 15); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ color: '#4A4F86', roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const gridLines = new THREE.GridHelper(64, 64, 0x6a70b0, 0x5a5fa0); gridLines.position.y = .01; scene.add(gridLines);
  scene.add(M.blockMesh(THREE, map.blocks));
  const solid = PH.makeSolid(M.toGrid(map.blocks));

  /* player */
  const player = AV.build(THREE, AV.sanitize(A.getAvatar())); player.scale.setScalar(.5); scene.add(player);
  const spawn = { x: map.spawn[0] + .5, y: map.spawn[1], z: map.spawn[2] + .5 }, p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ground: false };
  const respawn = () => Object.assign(p, { x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0 }); respawn();
  $('respawn').onclick = respawn;

  /* input: keyboard, joystick, jump button, camera drag */
  const keys = {}; let stick = { x: 0, y: 0 }, jumpHeld = false, yaw = 0, pitch = .35, dist = 7, face = 0;
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyR') respawn(); if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', e => { keys[e.code] = false; }); addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const st = $('stick'), knob = st.firstElementChild; let stickId = null;
  const setStick = e => { const r = st.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / 48);
    stick = { x: dx / l * k, y: dy / l * k }; knob.style.transform = 'translate(' + stick.x * 40 + 'px,' + stick.y * 40 + 'px)'; };
  st.addEventListener('pointerdown', e => { stickId = e.pointerId; st.setPointerCapture(e.pointerId); setStick(e); });
  st.addEventListener('pointermove', e => { if (e.pointerId === stickId) setStick(e); });
  ['pointerup', 'pointercancel'].forEach(n => st.addEventListener(n, () => { stickId = null; stick = { x: 0, y: 0 }; knob.style.transform = ''; }));
  const jb = $('jump'); jb.addEventListener('pointerdown', e => { jumpHeld = true; jb.setPointerCapture(e.pointerId); });
  ['pointerup', 'pointercancel'].forEach(n => jb.addEventListener(n, () => { jumpHeld = false; }));
  const cv = $('cv'); let look = null;
  cv.addEventListener('pointerdown', e => { look = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!look) return; yaw -= (e.clientX - look.x) * .005; pitch = Math.max(.05, Math.min(1.3, pitch + (e.clientY - look.y) * .005)); look = { x: e.clientX, y: e.clientY }; });
  ['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { look = null; }));
  cv.addEventListener('wheel', e => { dist = Math.max(3, Math.min(14, dist + e.deltaY * .01)); }, { passive: true });
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  /* online play */
  const others = new Map(); let net = null, netT = 0;
  const lerpA = (a, b, k) => a + (((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
  function nameTag(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,18,43,.75)'; g.fillRect(0, 8, 256, 48); g.fillStyle = '#fff'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33, 240);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); s.scale.set(2.8, .7, 1); s.position.y = 4.5; return s;
  }
  const fin = v => (Number.isFinite(v) ? v : 0);
  function setOther(s, snap) {
    let o = others.get(s.id); if (!o) return;
    Object.assign(o, { tx: fin(s.x), ty: fin(s.y), tz: fin(s.z), tr: fin(s.ry), a: s.a ? 1 : 0 });
    if (snap) { o.av.position.set(o.tx, o.ty, o.tz); o.av.rotation.y = o.tr; }
  }
  function addOther(s) {
    if (others.has(s.id)) return;
    const av = AV.build(THREE, AV.sanitize(s.avatar)); av.scale.setScalar(.5); av.add(nameTag(String(s.name || 'Guest').slice(0, 16))); scene.add(av);
    others.set(s.id, { av, tx: 0, ty: 0, tz: 0, tr: 0, a: 0 }); setOther(s, true); status();
  }
  function dropOther(id2) { const o = others.get(id2); if (o) { scene.remove(o.av); AV.dispose(o.av); others.delete(id2); status(); } }
  function status(t) { $('net').textContent = t || (net ? 'Online: ' + (others.size + 1) + (others.size ? ' players' : ' player') : ''); }
  function goOnline() {
    status('Connecting…'); $('online').disabled = true;
    net = N.connect(N.defaultUrl(), map.id, me ? me.name : 'Guest' + (100 + Math.floor(Math.random() * 900)), A.getAvatar(), {
      open() { $('online').disabled = false; $('online').textContent = 'Go offline'; },
      welcome(m) { m.players.forEach(addOther); status(); }, join(m) { addOther(m.p); }, state(m) { setOther(m, false); }, leave(m) { dropOther(m.id); },
      full() { status('That room is full.'); },
      close() { const was = net; net = null; [...others.keys()].forEach(dropOther); $('online').disabled = false; $('online').textContent = 'Go online'; if (was && $('net').textContent.indexOf('full') < 0 && $('net').textContent.indexOf('reach') < 0) status('Offline'); },
      error() { status('Could not reach the game server. Start it with: node server/server.js'); }
    });
  }
  $('online').onclick = () => { if (net) net.close(); else goOnline(); };

  /* loop */
  const t0 = performance.now(); let last = t0;
  (function frame(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now; const t = (now - t0) / 1000;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y, side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    const mx = -Math.sin(yaw) * fwd + Math.cos(yaw) * side, mz = -Math.cos(yaw) * fwd - Math.sin(yaw) * side;
    PH.step(p, { mx, mz, jump: !!keys.Space || jumpHeld }, dt, solid); if (p.y < -20) respawn();
    const moving = Math.hypot(mx, mz) > .1; if (moving) face = lerpA(face, Math.atan2(mx, mz), Math.min(1, dt * 14));
    player.position.set(p.x, p.y, p.z); player.rotation.y = face; AV.pose(player, t, moving ? (p.ground ? 1 : .6) : 0);
    const ty = p.y + 1.2; camera.position.set(p.x + dist * Math.sin(yaw) * Math.cos(pitch), ty + dist * Math.sin(pitch), p.z + dist * Math.cos(yaw) * Math.cos(pitch)); camera.lookAt(p.x, ty, p.z);
    netT += dt; if (net && netT > .066) { netT = 0; net.send({ t: 'state', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +face.toFixed(2), a: moving ? 1 : 0 }); }
    others.forEach(o => { const k = Math.min(1, dt * 12); o.av.position.x += (o.tx - o.av.position.x) * k; o.av.position.y += (o.ty - o.av.position.y) * k; o.av.position.z += (o.tz - o.av.position.z) * k; o.av.rotation.y = lerpA(o.av.rotation.y, o.tr, k); AV.pose(o.av, t, o.a); });
    renderer.render(scene, camera); requestAnimationFrame(frame);
  })(t0);
})();
