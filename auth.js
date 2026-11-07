(function () {
  const A = window.KAVIX_API, form = document.getElementById('form'), err = document.getElementById('err'),
    tabs = document.querySelectorAll('.tab'), go = document.getElementById('go'), pw = document.getElementById('pw');
  let mode = 'login';
  const next = (new URLSearchParams(location.search).get('next') || 'index.html');
  const safe = /^[\w./-]+\.html(\?[\w=&%.-]*)?$/.test(next) ? next : 'index.html';
  if (A.me()) location.replace(safe);
  document.getElementById('art').innerHTML = window.KAVIX.hero();

  function setMode(m) {
    mode = m; err.textContent = '';
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.mode === m));
    go.textContent = m === 'login' ? 'Sign in' : 'Create account';
    pw.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    document.getElementById('hint').hidden = m === 'login';
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  document.getElementById('show').addEventListener('change', e => { pw.type = e.target.checked ? 'text' : 'password'; });
  if (location.hash === '#signup') setMode('signup');

  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = ''; go.disabled = true;
    const name = document.getElementById('name').value;
    try { await (mode === 'login' ? A.login(name, pw.value) : A.signup(name, pw.value)); location.replace(safe); }
    catch (x) { err.textContent = x.message; go.disabled = false; pw.focus(); }
  });
  setMode(mode);
})();
