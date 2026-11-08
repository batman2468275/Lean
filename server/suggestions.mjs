/* The Suggestions board: all the rules, with no I/O of its own. Pure enough to unit-test with the in-memory adapter (tests/suggestions.test.mjs).

   STORAGE ADAPTER (the only thing a real provider has to implement):   adapter.transact(async (db) => result)
     reads the whole database, runs the function (which may change `db`), writes it back atomically, returns the function's result.
   The database shape is exactly the tables in docs/suggestions.md:
     db.suggestions : [{ id, text, name, status: 'pending'|'approved'|'hidden', votes, createdAt, ipHash }]
     db.votes       : { [suggestionId]: [voterHash, ...] }          one entry per voter, so a voter cannot vote twice
     db.hits        : [{ k: 'submit:<ipHash>' | 'vote:<ipHash>' | 'admin:<ipHash>', t: ms }]   rate-limit events (pruned after a day)

   SPAM CONTROL, in the order it is applied to a new suggestion:
     1. honeypot   a hidden "website" field that people never fill: bots that do get a fake success and nothing is stored
     2. form token the page fetches a signed token (HMAC of the time it was issued); a submission must be 3 s to 24 h old, so a bot cannot post instantly and cannot forge the age
     3. rate limit 3 suggestions per hour and 8 per day per visitor (a salted hash of the IP, the IP itself is never stored); 40 votes per hour
     4. content    10 to 500 characters, no links, no email addresses, no long runs of one character, a short list of spam words, no duplicates of an existing idea
     5. moderation every new suggestion is `pending` and only shows publicly once approved in /admin/suggestions; a full queue (200 pending) stops new ones
   Admin calls need the ADMIN_TOKEN bearer token; wrong tries are rate-limited too. */
import crypto from 'node:crypto';

import { LIMITS, STATUSES, HOUR, DAY, Rejection, validate, clean, key } from './rules.mjs';
export { LIMITS, STATUSES, Rejection, validate };

export function createService({ adapter, secret, now = Date.now, newId = () => crypto.randomBytes(8).toString('hex') }) {
  if (!adapter || !secret) throw new Error('createService needs an adapter and a secret');
  const hmac = (s) => crypto.createHmac('sha256', secret).update(s).digest('hex');
  const hash = (s) => hmac('h:' + s).slice(0, 32);
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  const count = (db, k, since) => db.hits.reduce((n, h) => n + (h.k === k && h.t > since ? 1 : 0), 0);
  const hit = (db, k) => { db.hits.push({ k, t: now() }); };
  const prune = (db) => { const cut = now() - DAY; if (db.hits.length && db.hits[0].t < cut) db.hits = db.hits.filter((h) => h.t > cut); };
  const publicView = (s, db, voter) => ({ id: s.id, text: s.text, name: s.name, votes: s.votes, createdAt: s.createdAt, voted: !!(voter && (db.votes[s.id] || []).includes(hash('v:' + voter))) });

  /** a signed, timestamped token the form sends back with the suggestion (the time-on-form check) */
  const formToken = () => { const t = String(now()); return t + '.' + hmac('form:' + t).slice(0, 24); };
  function checkToken(tok) {
    const [t, sig] = String(tok || '').split('.');
    if (!/^\d{10,15}$/.test(t || '') || !sig || !same(sig, hmac('form:' + t).slice(0, 24))) return false;
    const age = now() - +t; return age >= LIMITS.minFillMs && age <= LIMITS.maxFillMs;
  }

  return {
    formToken,
    hashIp: (ip) => hash('ip:' + ip),

    /** approved ideas, newest or most voted first; `voter` marks the ones this visitor already voted for */
    async list({ sort = 'top', voter } = {}) {
      return adapter.transact(async (db) => {
        const rows = db.suggestions.filter((s) => s.status === 'approved').map((s) => publicView(s, db, voter));
        rows.sort(sort === 'new' ? (a, b) => b.createdAt - a.createdAt : (a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
        return rows;
      });
    },

    /** a new suggestion. A honeypot hit returns the same success shape but stores nothing. */
    async submit(input, ctx) {
      const ipHash = hash('ip:' + ctx.ip);
      if (clean(input && input.website)) return { ok: true, pending: true };
      if (!checkToken(input && input.token)) throw new Rejection('too_fast', 'Please take a moment, then send it again.');
      const { text, name } = validate(input);
      return adapter.transact(async (db) => {
        prune(db); const t = now();
        if (count(db, 'submit:' + ipHash, t - HOUR) >= LIMITS.submitsPerHour || count(db, 'submit:' + ipHash, t - DAY) >= LIMITS.submitsPerDay) throw new Rejection('rate', 'You have sent a few already. Please try again later.', 429);
        if (db.suggestions.filter((s) => s.status === 'pending').length >= LIMITS.maxPending) throw new Rejection('full', 'The queue is full right now. Please try again later.', 503);
        const k = key(text); if (db.suggestions.some((s) => s.status !== 'hidden' && key(s.text) === k)) throw new Rejection('duplicate', 'Someone already suggested that. Look for it on the board and vote for it.');
        hit(db, 'submit:' + ipHash);
        db.suggestions.push({ id: newId(), text, name, status: 'pending', votes: 0, createdAt: t, ipHash });
        return { ok: true, pending: true };
      });
    },

    /** one vote per visitor per idea; returns the new total (voting twice is not an error, the count just does not change) */
    async vote(id, voter, ctx) {
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(voter || ''))) throw new Rejection('voter', 'Voting needs cookies or storage turned on.');
      const ipHash = hash('ip:' + ctx.ip), vh = hash('v:' + voter);
      return adapter.transact(async (db) => {
        prune(db); const t = now();
        const s = db.suggestions.find((x) => x.id === id && x.status === 'approved'); if (!s) throw new Rejection('missing', 'That idea is not on the board.', 404);
        const list = (db.votes[id] ||= []);
        if (list.includes(vh)) return { ok: true, votes: s.votes, voted: true, already: true };
        if (count(db, 'vote:' + ipHash, t - HOUR) >= LIMITS.votesPerHour) throw new Rejection('rate', 'Too many votes. Please try again later.', 429);
        hit(db, 'vote:' + ipHash); list.push(vh); s.votes = list.length;
        return { ok: true, votes: s.votes, voted: true };
      });
    },

    /* ---- admin (the HTTP layer has already checked the token; failures are counted here so guessing is slow) ---- */
    async adminAllowed(token, expected, ctx) {
      const ipHash = hash('ip:' + ctx.ip);
      return adapter.transact(async (db) => {
        prune(db);
        if (count(db, 'admin:' + ipHash, now() - HOUR) >= LIMITS.adminFailsPerHour) throw new Rejection('rate', 'Too many attempts. Try again later.', 429);
        if (expected && token && same(token, expected)) return true;
        hit(db, 'admin:' + ipHash); return false;
      });
    },
    async adminList({ status } = {}) {
      return adapter.transact(async (db) => db.suggestions.filter((s) => !status || s.status === status).sort((a, b) => b.createdAt - a.createdAt).map((s) => ({ id: s.id, text: s.text, name: s.name, status: s.status, votes: s.votes, createdAt: s.createdAt })));
    },
    async adminSetStatus(id, status) {
      if (!STATUSES.includes(status)) throw new Rejection('status', 'Unknown status.');
      return adapter.transact(async (db) => { const s = db.suggestions.find((x) => x.id === id); if (!s) throw new Rejection('missing', 'No such suggestion.', 404); s.status = status; return { ok: true, id, status }; });
    },
    async adminRemove(id) {
      return adapter.transact(async (db) => { const n = db.suggestions.length; db.suggestions = db.suggestions.filter((x) => x.id !== id); delete db.votes[id]; if (db.suggestions.length === n) throw new Rejection('missing', 'No such suggestion.', 404); return { ok: true, id }; });
    },
  };
}
