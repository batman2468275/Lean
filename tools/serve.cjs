// Static server for dist/ with the same fallback the production hosts use: a path that is not a file serves the app
// (a route with its own folder, e.g. /models, serves that page's index.html so titles are right; anything else serves /index.html).
//   node tools/serve.cjs [port]        or      npm start
// Also used by the test tools: require('./serve.cjs').start(0) -> { url, close }
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.txt': 'text/plain', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg' };
// The Suggestions API (server/) is ESM, this file is CJS: load it once, lazily. Test tools pass their own env (temp store, known admin token).
async function start(port = 0, env = process.env) {
  const { makeApi } = await import('../server/index.mjs');
  const api = makeApi(env);
  const server = http.createServer(async (req, res) => {
    if (await api.handle(req, res)) return;
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const safe = path.normalize(u).replace(/^(\.\.[/\\])+/, '');
    let file = path.join(root, safe);
    const tryFile = (f) => { try { return fs.statSync(f).isFile() ? f : null; } catch (e) { return null; } };
    let hit = tryFile(file) || tryFile(path.join(file, 'index.html'));
    let status = 200;
    if (!hit) { if (path.extname(safe)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return; } hit = path.join(root, 'index.html'); }
    const type = TYPES[path.extname(hit)] || 'application/octet-stream', size = fs.statSync(hit).size, range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {   // video needs byte ranges (seeking and looping)
      const start = range[1] ? +range[1] : Math.max(0, size - +range[2]), end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start >= size || start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      fs.createReadStream(hit, { start, end }).pipe(res); return;
    }
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-length': size });
    fs.createReadStream(hit).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + server.address().port, adminToken: api.adminToken, close: () => new Promise((r) => server.close(r)) })));
}
module.exports = { start };
if (require.main === module) start(+process.argv[2] || +process.env.PORT || 4173).then((s) => console.log('Lean: ' + s.url + '  (Ctrl+C to stop)'));
