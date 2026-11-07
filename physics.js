/* KAVIX physics: a walking box against a block grid. Block cell (x,y,z) fills x..x+1, y..y+1, z..z+1; the ground is the top of y=-1 inside the map. */
(function (root) {
  const R = .3, H = 1.8, G = -30, SPEED = 6, JUMP = 10.2, STEP = .1;
  const makeSolid = grid => (cx, cy, cz) => (cy < 0 && cx >= -32 && cx < 32 && cz >= -32 && cz < 32) || grid.has(cx + ',' + cy + ',' + cz);
  function hits(s, x, y, z) {
    const x0 = Math.floor(x - R), x1 = Math.floor(x + R - 1e-6), z0 = Math.floor(z - R), z1 = Math.floor(z + R - 1e-6), y0 = Math.floor(y + 1e-6), y1 = Math.floor(y + H - 1e-6);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) if (s(cx, cy, cz)) return true;
    return false;
  }
  /* p: {x,y,z,vy,ground}; inp: {mx,mz,jump} (world-space move direction) */
  function step(p, inp, dt, solid) {
    dt = Math.min(dt, .05);
    for (let i = 0; i < 40 && hits(solid, p.x, p.y, p.z); i++) p.y += 1;
    const len = Math.hypot(inp.mx, inp.mz), k = len > 1 ? 1 / len : 1;
    p.vx = inp.mx * k * SPEED; p.vz = inp.mz * k * SPEED;
    if (inp.jump && p.ground) { p.vy = JUMP; p.ground = false; }
    p.vy = Math.max(p.vy + G * dt, -40);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz)) * dt / STEP)), h = dt / n;
    p.ground = false;
    for (let i = 0; i < n; i++) {
      let t = p.x + p.vx * h; if (!hits(solid, t, p.y, p.z)) p.x = t;
      t = p.z + p.vz * h; if (!hits(solid, p.x, p.y, t)) p.z = t;
      t = p.y + p.vy * h;
      if (!hits(solid, p.x, t, p.z)) p.y = t;
      else { if (p.vy < 0) { p.y = Math.floor(t + 1e-6) + 1; p.ground = true; } else p.y = Math.floor(t + H - 1e-6) - H; p.vy = 0; }
    }
  }
  const api = { R, H, SPEED, JUMP, makeSolid, hits, step };
  if (typeof module !== 'undefined') module.exports = api; else root.KAVIX_PHYS = api;
})(this);
