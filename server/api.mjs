/* HTTP layer for the Suggestions board. createApi({ service, adminToken, trustProxy }) -> async (req, res) => boolean (true = handled).
     GET    /api/suggestions?sort=top|new&voter=<id>      public: approved ideas + a fresh form token
     POST   /api/suggestions                              { text, name?, token, website }   new idea (goes to the moderation queue)
     POST   /api/suggestions/<id>/vote                    { voter }
     GET    /api/admin/suggestions?status=pending         Authorization: Bearer <ADMIN_TOKEN>
     PATCH  /api/admin/suggestions/<id>                   { status: 'approved' | 'hidden' | 'pending' }
     DELETE /api/admin/suggestions/<id>
   Bodies are JSON, 4 KB at most. Every response is no-store JSON. */
import { Rejection } from './suggestions.mjs';

const MAX_BODY = 4096;
const send = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(obj)); };
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Rejection('too_big', 'That is too large.', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Rejection('bad_json', 'Could not read that.')); } });
    req.on('error', reject);
  });
}

export function createApi({ service, adminToken, trustProxy = false }) {
  const ipOf = (req) => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    if (!p.startsWith('/api/')) return false;
    try {
      const ctx = { ip: ipOf(req) };
      const m = p.match(/^\/api\/suggestions(?:\/([A-Za-z0-9_-]+)\/vote)?\/?$/);
      if (m) {
        if (!m[1] && req.method === 'GET') {
          const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'top';
          return send(res, 200, { ok: true, items: await service.list({ sort, voter: url.searchParams.get('voter') || undefined }), token: service.formToken() }), true;
        }
        if (!m[1] && req.method === 'POST') return send(res, 201, await service.submit(await readJson(req), ctx)), true;
        if (m[1] && req.method === 'POST') { const body = await readJson(req); return send(res, 200, await service.vote(m[1], body.voter, ctx)), true; }
        return send(res, 405, { ok: false, code: 'method', message: 'Method not allowed.' }), true;
      }
      const a = p.match(/^\/api\/admin\/suggestions(?:\/([A-Za-z0-9_-]+))?\/?$/);
      if (a) {
        const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '');
        if (!(await service.adminAllowed(bearer && bearer[1], adminToken, ctx))) return send(res, 401, { ok: false, code: 'auth', message: 'Wrong or missing admin token.' }), true;
        if (!a[1] && req.method === 'GET') { const st = url.searchParams.get('status'); return send(res, 200, { ok: true, items: await service.adminList({ status: st || undefined }) }), true; }
        if (a[1] && req.method === 'PATCH') return send(res, 200, await service.adminSetStatus(a[1], (await readJson(req)).status)), true;
        if (a[1] && req.method === 'DELETE') return send(res, 200, await service.adminRemove(a[1])), true;
        return send(res, 405, { ok: false, code: 'method', message: 'Method not allowed.' }), true;
      }
      return send(res, 404, { ok: false, code: 'not_found', message: 'Unknown API route.' }), true;
    } catch (e) {
      if (e instanceof Rejection) return send(res, e.status, { ok: false, code: e.code, message: e.message }), true;
      console.error('suggestions api:', e); return send(res, 500, { ok: false, code: 'server', message: 'Something went wrong. Please try again.' }), true;
    }
  };
}
