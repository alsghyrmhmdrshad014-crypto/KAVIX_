(function () {
  const K = window.KAVIX, grid = document.getElementById('grid'), chips = document.getElementById('chips'),
    search = document.getElementById('search'), toast = document.getElementById('toast');
  const M = window.KAVIX_MAPS, esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const all = () => K.GAMES.concat(M.listPublished().map(m => ({ id: m.id, title: m.name, by: m.author, players: 0, likes: 0, tags: ['community'], hue: parseInt(m.id.slice(2, 6), 16) % 360, base: M.PALETTE[m.blocks.length ? m.blocks[0][3] : 1] })));
  let tag = 'all', timer;
  document.getElementById('hero-art').innerHTML = K.hero();
  const A = window.KAVIX_API, who = document.getElementById('who'), me = A.me();
  if (me) {
    who.innerHTML = '<a class="user" href="avatar.html"></a><button class="btn ghost" id="out">Sign out</button>';
    who.querySelector('.user').textContent = me.name;
    document.getElementById('out').onclick = () => { A.logout(); location.reload(); };
  } else who.innerHTML = '<a class="btn" href="auth.html">Sign in</a>';

  chips.innerHTML = K.TAGS.map(t => '<button class="chip" role="tab" aria-selected="' + (t === 'all') + '" data-tag="' + t + '">' + t + '</button>').join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    tag = b.dataset.tag;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', c === b));
    render();
  });
  search.addEventListener('input', render);
  document.querySelectorAll('[data-soon]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); say(el.dataset.soon); }));

  function say(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('on'), 2600); }

  function render() {
    const list = K.filterGames(all(), search.value, tag);
    document.getElementById('count').textContent = list.length + (list.length === 1 ? ' game' : ' games');
    grid.innerHTML = list.length ? list.map(g =>
      '<a class="card" href="play.html?g=' + encodeURIComponent(g.id) + '"><div class="thumb">' + K.thumb(g) + '</div><div class="meta"><h3>' + esc(g.title) +
      '</h3><p>by ' + esc(g.by) + '</p><p class="stats"><span title="Playing now">' + (g.players ? K.formatCount(g.players) + ' playing' : 'New') + '</span><span>' + (g.likes ? K.formatCount(g.likes) + ' likes' : 'Community') + '</span></p></div></a>').join('')
      : '<div class="empty"><p>No games match that search.</p><button class="btn ghost" id="reset">Clear filters</button></div>';
    const r = document.getElementById('reset');
    if (r) r.onclick = () => { search.value = ''; tag = 'all'; chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', c.dataset.tag === 'all')); render(); };
  }
  render();
})();
