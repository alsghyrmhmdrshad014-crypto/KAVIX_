/* KAVIX api: accounts. Local demo backend (localStorage). Replace the bodies later with server calls; keep the same function names. */
(function (root) {
  const U = 'kavix.users', S = 'kavix.session', F = 'kavix.fails';
  const MAX_FAILS = 5, LOCK_MS = 30000, NAME = /^[A-Za-z0-9_]{3,16}$/;
  let store = typeof localStorage !== 'undefined' ? localStorage : null;
  const setStorage = s => { store = s; };
  const read = (k, d) => { try { const v = JSON.parse(store.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => store.setItem(k, JSON.stringify(v));
  const pub = u => ({ name: u.name, created: u.created });

  function validate(name, pw) {
    if (!NAME.test(name || '')) return 'Username must be 3–16 letters, numbers or underscores.';
    if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }
  const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
  async function hash(pw, saltHex) {
    const c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!c || !c.subtle) throw new Error('Secure hashing is unavailable here. Open the site over https or http://localhost.');
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await c.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await c.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256));
  }
  const newSalt = () => hex((root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(16)));
  const same = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return d === 0; };

  async function signup(name, pw) {
    name = (name || '').trim();
    const err = validate(name, pw); if (err) throw new Error(err);
    const users = read(U, {}), key = name.toLowerCase();
    if (users[key]) throw new Error('That username is taken. Try another.');
    const salt = newSalt();
    users[key] = { name, salt, hash: await hash(pw, salt), created: Date.now() };
    write(U, users); write(S, { user: key });
    return pub(users[key]);
  }
  async function login(name, pw) {
    const key = (name || '').trim().toLowerCase(), fails = read(F, {}), f = fails[key] || { n: 0, until: 0 };
    if (f.until > Date.now()) throw new Error('Too many attempts. Try again in ' + Math.ceil((f.until - Date.now()) / 1000) + ' seconds.');
    const u = read(U, {})[key];
    // always hash, so a missing user takes as long as a wrong password
    const h = await hash(pw || '', u ? u.salt : '00'.repeat(16));
    if (!u || !same(h, u.hash)) {
      f.n += 1; if (f.n >= MAX_FAILS) { f.n = 0; f.until = Date.now() + LOCK_MS; }
      fails[key] = f; write(F, fails);
      throw new Error('Wrong username or password.');
    }
    delete fails[key]; write(F, fails); write(S, { user: key });
    return pub(u);
  }
  function me() { const s = read(S, null), u = s && read(U, {})[s.user]; return u ? pub(u) : null; }
  function logout() { store.removeItem(S); }

  function getAvatar() { const s = read(S, null), u = s && read(U, {})[s.user]; return (u && u.avatar) || null; }
  function setAvatar(cfg) {
    const s = read(S, null), users = read(U, {}), u = s && users[s.user];
    if (!u) throw new Error('Sign in to save your avatar.');
    if (!cfg || typeof cfg !== 'object' || JSON.stringify(cfg).length > 600) throw new Error('Invalid avatar.');
    u.avatar = cfg; write(U, users); return cfg;
  }
  const api = { validate, signup, login, me, logout, setStorage, getAvatar, setAvatar };
  if (typeof module !== 'undefined') module.exports = api; else root.KAVIX_API = api;
})(this);
