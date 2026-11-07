/* KAVIX avatar: config, validation and Three.js builder. Reused by the editor now and the world in phase 4. */
(function (root) {
  const SKIN = [['Cream','#FBE0C3'],['Sand','#F2C9A0'],['Honey','#D9A066'],['Copper','#B97A4B'],['Umber','#8A5230'],['Espresso','#5B3A22']];
  const CLOTH = [['Violet','#B23DFF'],['Sun','#FFC93C'],['Cyan','#2FD3E6'],['Pink','#FF5C8A'],['Mint','#7CE38B'],['Orange','#FF9F43'],['Navy','#2B2A5C'],['Slate','#5E6A8A'],['White','#F3F1FF'],['Charcoal','#33334A']];
  const HAIRC = [['Black','#1E1A24'],['Brown','#4A2C1A'],['Blond','#E8C15A'],['Ginger','#C8542B'],['Ash','#9AA0B4'],['Teal','#1FB6A6'],['Magenta','#D93FA8'],['Blue','#3D6BFF']];
  const OPT = { hair: ['none','flat','spiky','tall'], face: ['smile','grin','sleepy','wow'], acc: ['none','shades','crown','backpack'] };
  const GROUPS = [
    { key: 'skin', label: 'Skin', colors: SKIN }, { key: 'shirt', label: 'Shirt', colors: CLOTH }, { key: 'pants', label: 'Pants', colors: CLOTH },
    { key: 'hair', label: 'Hair style', options: OPT.hair }, { key: 'hairColor', label: 'Hair color', colors: HAIRC },
    { key: 'face', label: 'Face', options: OPT.face }, { key: 'acc', label: 'Extra', options: OPT.acc }];
  const DEFAULT = { skin: '#F2C9A0', shirt: '#B23DFF', pants: '#2B2A5C', hair: 'flat', hairColor: '#4A2C1A', face: 'smile', acc: 'none' };

  const pick = (v, list, d) => { const s = String(v || '').toLowerCase(), m = list.find(p => p[1].toLowerCase() === s); return m ? m[1] : d; };
  const pickOpt = (v, list, d) => list.includes(v) ? v : d;
  function sanitize(c) {
    c = c && typeof c === 'object' ? c : {};
    return { skin: pick(c.skin, SKIN, DEFAULT.skin), shirt: pick(c.shirt, CLOTH, DEFAULT.shirt), pants: pick(c.pants, CLOTH, DEFAULT.pants),
      hair: pickOpt(c.hair, OPT.hair, DEFAULT.hair), hairColor: pick(c.hairColor, HAIRC, DEFAULT.hairColor),
      face: pickOpt(c.face, OPT.face, DEFAULT.face), acc: pickOpt(c.acc, OPT.acc, DEFAULT.acc) };
  }
  function random(rnd) {
    rnd = rnd || Math.random; const p = l => l[Math.floor(rnd() * l.length) % l.length];
    return sanitize({ skin: p(SKIN)[1], shirt: p(CLOTH)[1], pants: p(CLOTH)[1], hair: p(OPT.hair), hairColor: p(HAIRC)[1], face: p(OPT.face), acc: p(OPT.acc) });
  }

  function build(THREE, cfg) {
    cfg = sanitize(cfg);
    const box = (w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0 }));
      m.position.set(x, y, z); return m;
    };
    const pivot = (name, x, y) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, 0); return g; };
    const INK = '#1E1A24', av = new THREE.Group(), body = new THREE.Group(), P = {};
    av.name = 'avatar'; body.name = 'body'; av.add(body); P.body = body;

    [['legL', -.3], ['legR', .3]].forEach(([n, x]) => {
      const l = pivot(n, x, 1.3); l.add(box(.55, 1.3, .55, cfg.pants, 0, -.65, 0)); l.add(box(.57, .25, .7, INK, 0, -1.175, .06)); body.add(l); P[n] = l;
    });
    body.add(box(1.2, 1.3, .7, cfg.shirt, 0, 1.95, 0));
    [['armL', -.83], ['armR', .83]].forEach(([n, x]) => {
      const a = pivot(n, x, 2.5); a.add(box(.45, 1.3, .45, cfg.skin, 0, -.65, 0)); a.add(box(.5, .6, .5, cfg.shirt, 0, -.3, 0)); body.add(a); P[n] = a;
    });
    const head = pivot('head', 0, 3.15); body.add(head); P.head = head;
    head.add(box(1.1, 1.1, 1.1, cfg.skin, 0, 0, 0));

    const eye = (w, h) => [-.24, .24].forEach(x => head.add(box(w, h, .05, INK, x, .08, .56)));
    const f = cfg.face;
    if (f === 'sleepy') eye(.2, .06); else if (f === 'wow') eye(.15, .22); else eye(.13, .17);
    if (f === 'smile') { head.add(box(.34, .06, .05, INK, 0, -.22, .56)); [-.2, .2].forEach(x => head.add(box(.06, .06, .05, INK, x, -.17, .56))); }
    else if (f === 'grin') { head.add(box(.46, .15, .05, INK, 0, -.2, .56)); head.add(box(.38, .06, .05, '#F3F1FF', 0, -.16, .58)); }
    else if (f === 'sleepy') head.add(box(.2, .05, .05, INK, 0, -.22, .56));
    else head.add(box(.14, .18, .05, INK, 0, -.22, .56));

    const hc = cfg.hairColor, tops = { none: .55, flat: .68, spiky: .9, tall: .96 };
    if (cfg.hair !== 'none') {
      head.add(box(1.16, .28, 1.16, hc, 0, .54, 0)); head.add(box(1.16, .7, .14, hc, 0, .2, -.5)); head.add(box(1.16, .16, .14, hc, 0, .46, .5));
      if (cfg.hair === 'spiky') [[-.38, .42, .35], [0, .5, .45], [.38, .4, .35], [-.2, .3, .3], [.2, .3, .32]].forEach(s => head.add(box(.24, s[2] + .1, .24, hc, s[0], .68 + (s[2] + .1) / 2 - .06, s[1] - .5)));
      if (cfg.hair === 'tall') head.add(box(.8, .55, .8, hc, 0, .82, 0));
    }
    if (cfg.acc === 'shades') head.add(box(1, .2, .06, INK, 0, .08, .6));
    if (cfg.acc === 'crown') {
      const y = tops[cfg.hair]; head.add(box(1.02, .18, 1.02, '#FFC93C', 0, y + .09, 0));
      [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]].forEach(c => head.add(box(.18, .24, .18, '#FFC93C', c[0], y + .3, c[1])));
    }
    if (cfg.acc === 'backpack') body.add(box(.9, 1, .4, '#5E6A8A', 0, 1.95, -.55));
    av.userData.parts = P; av.userData.cfg = cfg;
    return av;
  }
  /* walk cycle: amount 1 = walking, 0 = idle */
  function pose(av, t, amount) {
    const p = av.userData.parts, s = Math.sin(t * 8) * .9 * amount;
    p.armL.rotation.x = s; p.armR.rotation.x = -s; p.legL.rotation.x = -s; p.legR.rotation.x = s;
    p.body.position.y = Math.abs(Math.sin(t * 8)) * .08 * amount;
    p.head.rotation.y = Math.sin(t * 1.3) * .15 * (1 - amount);
  }
  function dispose(av) {
    av.traverse && av.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  }
  const api = { GROUPS, DEFAULT, OPT, sanitize, random, build, pose, dispose };
  if (typeof module !== 'undefined') module.exports = api; else root.KAVIX_AVATAR = api;
})(this);
