// Shared helpers for the test and render tools.
//   launch()        Chromium with software WebGL (works without a GPU). Set CHROMIUM_PATH to use a specific browser binary,
//                   e.g. when npm's Playwright and the installed browser differ in version.
//   withSite(fn)    serves dist/ on a free local port (same fallback as production), runs fn(baseUrl), then stops the server.
const { chromium } = require('playwright');
const { start } = require('./serve.cjs');
const launch = (extra = {}) => chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
  ...extra,
});
// Tools get a throw-away in-memory suggestions store and a known admin token ('test-admin'), so tests never touch data/suggestions.json.
async function withSite(fn, env = {}) { const s = await start(0, { ...process.env, SUGGESTIONS_FILE: ':memory:', ADMIN_TOKEN: 'test-admin', SPAM_SALT: 'test-salt', ...env }); try { return await fn(s.url, s); } finally { await s.close(); } }
module.exports = launch; module.exports.launch = launch; module.exports.withSite = withSite;
