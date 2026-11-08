/* The ideas board for the single-file demo (lean-demo.html): there is no server, so the same API the page normally calls is answered here, with the
   data kept in this browser's localStorage. Same content rules as the real server (server/rules.mjs). It is a DEMO: nothing leaves the browser.
   Moderation still works: new ideas wait as "pending"; the admin page (#/admin/suggestions) opens with the token "demo". */
import { LIMITS, STATUSES, Rejection, validate, clean, key } from '../server/rules.mjs';

export const DEMO_TOKEN = 'demo';
const KEY = 'lean-demo-board';
const SAMPLE = [   // sample ideas so the board is not empty; clearly demo content (no names)
  ['A stand that folds flat so it fits in a bag', 12], ['A wider base for a small tablet', 9], ['A warm white color, not pure white', 7], ['A built-in clip to keep the cable tidy', 5], ['A landscape-angle version for watching video', 4],
];
function load() {
  try { const db = JSON.parse(localStorage.getItem(KEY)); if (db && Array.isArray(db.suggestions)) return db; } catch (e) { /* fall through to a fresh board */ }
  const t = Date.now();
  return { suggestions: SAMPLE.map(([text, votes], i) => ({ id: 'sample' + i, text, name: '', status: 'approved', votes, createdAt: t - (i + 1) * 86400e3 })), votes: {}, sends: [] };
}
let mem = null;   // if storage is blocked the board still works for this visit
const read = () => { if (mem) return mem; mem = load(); return mem; };
const write = (db) => { mem = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage off: kept in memory for this visit */ } };
const pub = (s, db, voter) => ({ id: s.id, text: s.text, name: s.name, votes: s.votes, createdAt: s.createdAt, voted: !!(voter && (db.votes[s.id] || []).includes(voter)) });
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** answer one API call. Returns { status, body }. */
export function demoHandle(url, opts = {}) {
  const u = new URL(url, 'https://demo.invalid'), method = (opts.method || 'GET').toUpperCase(), body = opts.body ? JSON.parse(opts.body) : {};
  const out = (status, b) => ({ status, body: b });
  try {
    const db = read();
    let m = u.pathname.match(/^\/api\/suggestions(?:\/([A-Za-z0-9_-]+)\/vote)?\/?$/);
    if (m) {
      if (!m[1] && method === 'GET') {
        const voter = u.searchParams.get('voter') || '', rows = db.suggestions.filter((s) => s.status === 'approved').map((s) => pub(s, db, voter));
        rows.sort(u.searchParams.get('sort') === 'new' ? (a, b) => b.createdAt - a.createdAt : (a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
        return out(200, { ok: true, items: rows, token: 'demo' });
      }
      if (!m[1] && method === 'POST') {
        if (clean(body.website)) return out(201, { ok: true, pending: true });
        const { text, name } = validate(body), now = Date.now();
        db.sends = (db.sends || []).filter((t) => t > now - 3600e3);
        if (db.sends.length >= LIMITS.submitsPerHour) throw new Rejection('rate', 'You have sent a few already. Please try again later.', 429);
        const k = key(text); if (db.suggestions.some((s) => s.status !== 'hidden' && key(s.text) === k)) throw new Rejection('duplicate', 'Someone already suggested that. Look for it on the board and vote for it.');
        db.sends.push(now); db.suggestions.push({ id: newId(), text, name, status: 'pending', votes: 0, createdAt: now }); write(db);
        return out(201, { ok: true, pending: true });
      }
      if (m[1] && method === 'POST') {
        const s = db.suggestions.find((x) => x.id === m[1] && x.status === 'approved'); if (!s) throw new Rejection('missing', 'That idea is not on the board.', 404);
        const v = String(body.voter || ''); if (v.length < 16) throw new Rejection('voter', 'Voting needs cookies or storage turned on.');
        const list = (db.votes[s.id] ||= []); if (!list.includes(v)) { list.push(v); s.votes += 1; write(db); }
        return out(200, { ok: true, votes: s.votes, voted: true });
      }
    }
    m = u.pathname.match(/^\/api\/admin\/suggestions(?:\/([A-Za-z0-9_-]+))?\/?$/);
    if (m) {
      const auth = (opts.headers && (opts.headers.authorization || opts.headers.Authorization)) || '';
      if (auth !== 'Bearer ' + DEMO_TOKEN) return out(401, { ok: false, code: 'auth', message: 'Wrong or missing admin token. In this demo it is: ' + DEMO_TOKEN });
      if (!m[1] && method === 'GET') { const st = u.searchParams.get('status'); return out(200, { ok: true, items: db.suggestions.filter((s) => !st || s.status === st).sort((a, b) => b.createdAt - a.createdAt).map((s) => ({ id: s.id, text: s.text, name: s.name, status: s.status, votes: s.votes, createdAt: s.createdAt })) }); }
      const s = m[1] && db.suggestions.find((x) => x.id === m[1]); if (m[1] && !s) throw new Rejection('missing', 'No such suggestion.', 404);
      if (m[1] && method === 'PATCH') { if (!STATUSES.includes(body.status)) throw new Rejection('status', 'Unknown status.'); s.status = body.status; write(db); return out(200, { ok: true, id: s.id, status: s.status }); }
      if (m[1] && method === 'DELETE') { db.suggestions = db.suggestions.filter((x) => x !== s); delete db.votes[s.id]; write(db); return out(200, { ok: true, id: s.id }); }
    }
    return out(404, { ok: false, code: 'not_found', message: 'Unknown API route.' });
  } catch (e) {
    if (e instanceof Rejection) return out(e.status, { ok: false, code: e.code, message: e.message });
    throw e;
  }
}
