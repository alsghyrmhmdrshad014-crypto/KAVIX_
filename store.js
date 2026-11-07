/* KAVIX store: sample games + pure helpers (works in browser and Node for tests) */
(function (root) {
  const GAMES = [
    { id: 'sky-hop',    title: 'Sky Hop',    by: 'Nora',   players: 1240, likes: 9800, tags: ['obby','parkour'], hue: 200, base: '#FFC93C' },
    { id: 'block-rally',title: 'Block Rally',by: 'Tariq',  players: 860,  likes: 6100, tags: ['racing'],         hue: 330, base: '#2FD3E6' },
    { id: 'lava-climb', title: 'Lava Climb', by: 'Mika',   players: 2310, likes: 15400,tags: ['obby'],           hue: 15,  base: '#FF5C8A' },
    { id: 'pixel-farm', title: 'Pixel Farm', by: 'Sam',    players: 420,  likes: 3300, tags: ['chill','build'],  hue: 130, base: '#7CE38B' },
    { id: 'maze-run',   title: 'Maze Run',   by: 'Layla',  players: 97,   likes: 1200, tags: ['puzzle'],         hue: 265, base: '#B23DFF' },
    { id: 'tower-tag',  title: 'Tower Tag',  by: 'Omar',   players: 1580, likes: 7200, tags: ['tag','parkour'],  hue: 45,  base: '#FF9F43' }
  ];
  const TAGS = ['all', 'obby', 'parkour', 'racing', 'build', 'puzzle', 'tag', 'chill', 'community'];

  function formatCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function filterGames(list, query, tag) {
    const q = (query || '').trim().toLowerCase();
    return list.filter(g =>
      (!tag || tag === 'all' || g.tags.includes(tag)) &&
      (!q || g.title.toLowerCase().includes(q) || g.by.toLowerCase().includes(q) || g.tags.some(t => t.includes(q))));
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(Math.min(255, v * f)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function seedOf(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

  /* isometric cube: grid (gx,gy,gz), edge a, origin (ox,oy) */
  function cube(gx, gy, gz, a, ox, oy, base) {
    const px = ox + (gx - gy) * a, py = oy + (gx + gy) * a / 2 - gz * a;
    const P = (x, y) => x + ',' + y;
    return '<polygon points="' + [P(px, py), P(px + a, py + a / 2), P(px, py + a), P(px - a, py + a / 2)] + '" fill="' + base + '"/>' +
      '<polygon points="' + [P(px - a, py + a / 2), P(px, py + a), P(px, py + 2 * a), P(px - a, py + 1.5 * a)] + '" fill="' + shade(base, .72) + '"/>' +
      '<polygon points="' + [P(px, py + a), P(px + a, py + a / 2), P(px + a, py + 1.5 * a), P(px, py + 2 * a)] + '" fill="' + shade(base, .55) + '"/>';
  }
  function scene(cells, a, ox, oy, base) { // cells: [gx,gy,gz,color?]
    return cells.slice().sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]))
      .map(c => cube(c[0], c[1], c[2], a, ox, oy, c[3] || base)).join('');
  }
  function thumb(game) {
    const r = rng(seedOf(game.id)), cells = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
      const h = 1 + Math.floor(r() * 3);
      for (let z = 0; z < h; z++) cells.push([x, y, z, z === h - 1 ? game.base : shade(game.base, .85)]);
    }
    const id = 'g' + game.id.replace(/\W/g, '');
    return '<svg viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + game.hue + ',70%,28%)"/><stop offset="1" stop-color="hsl(' + ((game.hue + 40) % 360) + ',60%,14%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#' + id + ')"/>' + scene(cells, 22, 160, 34, game.base) + '</svg>';
  }
  function hero() {
    const cols = ['#FFC93C', '#B23DFF', '#2FD3E6', '#FF5C8A'], cells = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      const h = Math.max(0, 3 - Math.max(x, y) + (x === y ? 1 : 0));
      for (let z = 0; z < Math.max(1, h); z++) cells.push([x, y, z, cols[(x + y + z) % 4]]);
    }
    return '<svg viewBox="0 0 440 400" aria-hidden="true">' + scene(cells, 40, 220, 70, '#FFC93C') + '</svg>';
  }

  const api = { GAMES, TAGS, formatCount, filterGames, shade, cube, thumb, hero };
  if (typeof module !== 'undefined') module.exports = api; else root.KAVIX = api;
})(this);
