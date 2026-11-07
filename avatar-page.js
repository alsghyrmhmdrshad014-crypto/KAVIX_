(function () {
  const AV = window.KAVIX_AVATAR, A = window.KAVIX_API;
  if (!A.me()) { location.replace('auth.html?next=avatar.html'); return; }
  let cfg = AV.sanitize(A.getAvatar()), saved = JSON.stringify(cfg), walking = false, rotY = -.5, drag = null, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('stage'), canvas = document.getElementById('cv'), ctl = document.getElementById('controls'), status = document.getElementById('status');
  document.querySelectorAll('[data-soon]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); say(el.dataset.soon); }));
  const say = m => { status.textContent = m; };

  /* controls */
  ctl.innerHTML = AV.GROUPS.map(g => '<fieldset><legend>' + g.label + '</legend><div class="opts" role="radiogroup" aria-label="' + g.label + '">' +
    (g.colors ? g.colors.map(c => '<button type="button" class="sw" role="radio" data-k="' + g.key + '" data-v="' + c[1] + '" style="background:' + c[1] + '" aria-label="' + c[0] + '"></button>').join('')
      : g.options.map(o => '<button type="button" class="chip" role="radio" data-k="' + g.key + '" data-v="' + o + '">' + o + '</button>').join('')) + '</div></fieldset>').join('');
  function sync() {
    ctl.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-checked', String(cfg[b.dataset.k].toLowerCase() === b.dataset.v.toLowerCase())));
    const dirty = JSON.stringify(cfg) !== saved; document.getElementById('save').disabled = !dirty; if (dirty) say('Unsaved changes.');
  }
  ctl.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; cfg = AV.sanitize(Object.assign({}, cfg, { [b.dataset.k]: b.dataset.v })); refresh(); });
  document.getElementById('rand').onclick = () => { cfg = AV.random(); refresh(); };
  document.getElementById('walk').onclick = e => { walking = !walking; e.currentTarget.setAttribute('aria-pressed', walking); };
  document.getElementById('save').onclick = () => { try { A.setAvatar(cfg); saved = JSON.stringify(cfg); say('Saved.'); sync(); } catch (x) { say(x.message); } };
  addEventListener('beforeunload', e => { if (JSON.stringify(cfg) !== saved) { e.preventDefault(); e.returnValue = ''; } });

  /* 3D */
  let renderer, scene, camera, av;
  try {
    if (!window.THREE) throw 0;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { stage.innerHTML = '<p class="nogl">The 3D preview needs WebGL. Your choices still save and will appear in the world.</p>'; refresh = sync; sync(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.set(0, 2.6, 9.5); camera.lookAt(0, 1.9, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4fcf, .9));
  const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(4, 8, 6); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, .15, 32), new THREE.MeshStandardMaterial({ color: '#322E5C', roughness: 1 })); floor.position.y = -.075; scene.add(floor);
  function refresh() {
    if (av) { scene.remove(av); AV.dispose(av); }
    av = AV.build(THREE, cfg); av.rotation.y = rotY; scene.add(av); sync();
  }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage);
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag !== null) { rotY += (e.clientX - drag) * .012; drag = e.clientX; } });
  ['pointerup', 'pointercancel'].forEach(n => canvas.addEventListener(n, () => { drag = null; }));
  canvas.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') rotY -= .2; if (e.key === 'ArrowRight') rotY += .2; });
  let t0 = performance.now();
  (function loop(now) {
    const t = (now - t0) / 1000;
    if (drag === null && !reduce) rotY += walking ? 0 : .004;
    av.rotation.y = rotY; AV.pose(av, reduce ? 0 : t, walking && !reduce ? 1 : 0);
    renderer.render(scene, camera); requestAnimationFrame(loop);
  })(t0);
  resize(); refresh();
})();
