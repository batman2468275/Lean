/* The Suggestions board in the browser (public page) and its admin page. Plain DOM, no innerHTML: every piece of user text goes in with textContent,
   so a suggestion can never inject markup. The server (server/) does the real checks; the form only helps people get it right first time. */
import { demoHandle, DEMO_TOKEN } from './demo-board.js';
const DEMO = !!window.__SINGLE__;   // the single-file demo has no server: the board answers from the browser (src/demo-board.js)
const API = '/api/suggestions', ADMIN_API = '/api/admin/suggestions';
const $ = (s) => document.querySelector(s);
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d < 31 ? d + ' d ago' : new Date(t).toLocaleDateString(); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function call(url, opts = {}) {
  if (DEMO) { const { status, body } = demoHandle(url, opts); if (status >= 400 || body.ok === false) throw Object.assign(new Error(body.message || 'Something went wrong.'), { code: body.code || 'error', status }); return body; }
  let r; try { r = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } }); } catch (e) { throw Object.assign(new Error('offline'), { code: 'offline' }); }
  let body = null; try { body = await r.json(); } catch (e) { /* a static host answers the API path with the app's HTML, not JSON */ }
  if (!body || typeof body !== 'object') throw Object.assign(new Error('offline'), { code: 'offline' });
  if (!r.ok || body.ok === false) throw Object.assign(new Error(body.message || 'Something went wrong.'), { code: body.code || 'error', status: r.status });
  return body;
}

/** a random id for this browser, so a vote counts once; it is only ever sent to the board's own server (which stores a hash of it) */
function voterId() {
  try { let v = localStorage.getItem('lean-voter'); if (!v) { const a = new Uint8Array(16); crypto.getRandomValues(a); v = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('lean-voter', v); } return v; } catch (e) { return null; }
}

export function bindBoard() {
  const form = $('#sg-form'), list = $('#sg-list'); if (!form || !list) return;
  const text = $('#sg-text'), name = $('#sg-name'), web = $('#sg-web'), msg = $('#sg-msg'), count = $('#sg-count'), send = $('#sg-send');
  let sort = 'top', token = '';
  const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('bad', !!bad); };
  const voter = voterId();
  if (DEMO) { const f = $('.sg-fine'); if (f) f.append(document.createElement('br'), 'Demo: ideas you send stay in this browser. The first five on the board are samples. To see moderation, open the admin page (#/admin/suggestions) with the token "' + DEMO_TOKEN + '".'); }

  function render(items) {
    list.textContent = '';
    $('#sg-empty').hidden = items.length > 0; $('#sg-offline').hidden = true;
    for (const it of items) {
      const li = el('li', 'sg-item');
      const body = el('div', 'sg-body'); body.append(el('p', 'sg-text', it.text), el('p', 'sg-meta', `${it.name || 'Someone'} · ${ago(it.createdAt)}`));
      const b = el('button', 'sg-vote'); b.type = 'button'; b.dataset.id = it.id;
      const paint = (n, voted) => { b.textContent = ''; b.append(el('span', 'sg-arrow', '▲'), el('span', 'sg-n', String(n))); b.setAttribute('aria-pressed', String(voted)); b.setAttribute('aria-label', `${voted ? 'You voted for' : 'Vote for'} this idea. ${n} ${n === 1 ? 'vote' : 'votes'}`); b.disabled = voted; };
      paint(it.votes, it.voted);
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { const r = await call(`${API}/${encodeURIComponent(it.id)}/vote`, { method: 'POST', body: JSON.stringify({ voter }) }); paint(r.votes, true); }
        catch (e) { paint(it.votes, false); say(e.message, true); }
      });
      li.append(body, b); list.append(li);
    }
  }
  async function load() {
    try { const r = await call(`${API}?sort=${sort}${voter ? '&voter=' + encodeURIComponent(voter) : ''}`); token = r.token; render(r.items); }
    catch (e) { list.textContent = ''; $('#sg-empty').hidden = true; $('#sg-offline').hidden = false; send.disabled = true; say('The board is not available, so ideas cannot be sent right now.', true); }
  }
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 500`; });
  document.querySelectorAll('#sg-sort button').forEach((b) => b.addEventListener('click', () => { sort = b.dataset.sort; document.querySelectorAll('#sg-sort button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); load(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = text.value.trim(); if (t.length < 10) { say('Please write a little more (at least 10 characters).', true); text.focus(); return; }
    send.disabled = true; say('Sending...');
    try { await call(API, { method: 'POST', body: JSON.stringify({ text: t, name: name.value, website: web.value, token }) }); say('Thank you! Your idea will appear on the board once we have read it.'); text.value = ''; count.textContent = '0 / 500'; }
    catch (err) { say(err.message, true); }
    finally { send.disabled = false; load(); }   // a fresh token each time
  });
  load();
}

export function bindAdmin() {
  const login = $('#ad-login'); if (!login) return;
  const main = $('#ad-main'), list = $('#ad-list'), msg = $('#ad-msg'); let status = 'pending', tok = '';
  if (DEMO) { msg.textContent = 'Demo: the admin token is "' + DEMO_TOKEN + '".'; }
  try { tok = sessionStorage.getItem('lean-admin') || ''; } catch (e) { /* storage off: the token is asked for on every visit */ }
  const auth = () => ({ authorization: 'Bearer ' + tok });
  async function load() {
    try {
      const r = await call(`${ADMIN_API}?status=${status}`, { headers: auth() });
      login.hidden = true; main.hidden = false; list.textContent = ''; $('#ad-empty').hidden = r.items.length > 0;
      for (const it of r.items) {
        const li = el('li', 'sg-item'), body = el('div', 'sg-body');
        body.append(el('p', 'sg-text', it.text), el('p', 'sg-meta', `${it.name || 'No name'} · ${ago(it.createdAt)} · ${it.votes} ${it.votes === 1 ? 'vote' : 'votes'}`));
        const act = el('div', 'sg-actions');
        const mk = (label, cls, fn) => { const b = el('button', 'btn sm ' + cls, label); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { msg.textContent = e.message; } load(); }); return b; };
        const set = (s) => () => call(`${ADMIN_API}/${encodeURIComponent(it.id)}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ status: s }) });
        if (it.status !== 'approved') act.append(mk('Approve', 'primary', set('approved')));
        if (it.status !== 'hidden') act.append(mk('Hide', 'ghost', set('hidden')));
        act.append(mk('Delete', 'ghost', () => { if (!confirm('Delete this idea for good?')) return Promise.resolve(); return call(`${ADMIN_API}/${encodeURIComponent(it.id)}`, { method: 'DELETE', headers: auth() }); }));
        li.append(body, act); list.append(li);
      }
    } catch (e) {
      main.hidden = true; login.hidden = false; tok = ''; try { sessionStorage.removeItem('lean-admin'); } catch (x) { /* ignore */ }
      msg.textContent = e.code === 'offline' ? 'The board server is not reachable (this page needs the Lean server, not a plain static host).' : e.message;
    }
  }
  login.addEventListener('submit', (e) => { e.preventDefault(); tok = $('#ad-token').value; try { sessionStorage.setItem('lean-admin', tok); } catch (x) { /* ignore */ } msg.textContent = ''; load(); });
  document.querySelectorAll('#ad-filter button').forEach((b) => b.addEventListener('click', () => { status = b.dataset.status; document.querySelectorAll('#ad-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); load(); }));
  $('#ad-out').addEventListener('click', () => { tok = ''; try { sessionStorage.removeItem('lean-admin'); } catch (x) { /* ignore */ } main.hidden = true; login.hidden = false; $('#ad-token').value = ''; });
  if (tok) load();
}
