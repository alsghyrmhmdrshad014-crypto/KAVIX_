/* KAVIX net: tiny client for the room server (server/server.js). */
(function (root) {
  function defaultUrl() {
    const q = new URLSearchParams(location.search).get('ws'); if (q) return q;
    return /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'ws://localhost:8080';
  }
  function connect(url, room, name, avatar, h) {
    const ws = new WebSocket(url);
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'join', room, name, avatar })); if (h.open) h.open(); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m && typeof h[m.t] === 'function') h[m.t](m); };
    ws.onclose = () => { if (h.close) h.close(); };
    ws.onerror = () => { if (h.error) h.error(); };
    return { send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, close() { ws.close(); } };
  }
  root.KAVIX_NET = { connect, defaultUrl };
})(this);
