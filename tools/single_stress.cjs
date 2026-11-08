// Opens dist/lean-demo.html under the conditions that most often break a downloaded demo, and checks the page still works in each:
//   storage blocked, history changes blocked, WebGL unavailable, a scene that fails to build, and the file shown inside a sandboxed preview pane.
//   node tools/single_stress.cjs      (run `npm run build:single` first)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./launch.cjs');
const FILE = path.resolve(__dirname, '..', 'dist', 'lean-demo.html');
const URL0 = 'file://' + FILE;
let fails = 0;
const ok = (c, m, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d ? '  ' + d : '')); if (!c) fails++; };

const SCENARIOS = {
  'normal': '',
  'storage blocked (localStorage and sessionStorage throw)': `for (const k of ['localStorage','sessionStorage']) Object.defineProperty(window, k, { get() { throw new DOMException('denied', 'SecurityError'); } });`,
  'history.pushState and replaceState throw': `history.pushState = history.replaceState = () => { throw new DOMException('denied', 'SecurityError'); };`,
  'WebGL unavailable': `const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); };`,
  'WebGL context exists but the scene fails to build': `const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = g.call(this, t, ...a); if (c && /webgl/i.test(t)) { c.createBuffer = () => { throw new Error('simulated GPU failure'); }; } return c; };`,
  'everything at once (storage + history + WebGL blocked)': `for (const k of ['localStorage','sessionStorage']) Object.defineProperty(window, k, { get() { throw new DOMException('denied', 'SecurityError'); } }); history.pushState = history.replaceState = () => { throw new DOMException('denied', 'SecurityError'); }; const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); };`,
};

async function run(browser, name, init, { sandbox = false } = {}) {
  console.log('\n== ' + name);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|simulated GPU|Error creating WebGL context/.test(m.text())) errs.push(m.text()); });
  await page.route((u) => !u.href.startsWith('file://'), (r) => r.abort());
  await page.addInitScript(`window.__NOSMOOTH = true; ${init}`);
  let target = page;
  if (sandbox) {
    const wrap = path.join(os.tmpdir(), 'lean-sandbox-wrap.html');
    fs.writeFileSync(wrap, `<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" src="${URL0}" style="border:0;width:100vw;height:100vh"></iframe></body>`);
    await page.goto('file://' + wrap);
    await page.waitForSelector('#f');
    target = await (await page.$('#f')).contentFrame();
  } else await page.goto(URL0, { waitUntil: 'domcontentloaded' });
  let ready = true;
  try { await target.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 }); } catch (e) { ready = false; }
  ok(ready, 'the page finishes starting (class "ready")');
  const txt = await target.evaluate(() => (document.getElementById('view') || document.body).innerText);
  ok(/Add a charging cutout|Small things/i.test(txt), 'the Home page text is on screen');
  ok(await target.evaluate(() => getComputedStyle(document.getElementById('foot')).visibility !== 'hidden'), 'the footer is visible (the page is not stuck booting)');
  // click through to Models and Customize with the mouse
  await target.click('#tabs a[data-route="/models"]'); await target.waitForTimeout(1500);
  ok(/Two bases/i.test(await target.evaluate(() => document.getElementById('view').innerText)), 'clicking Models shows the Models page');
  await target.click('#tabs a[data-route="/customize"]'); await target.waitForTimeout(1500);
  ok(await target.evaluate(() => !!document.getElementById('add')), 'clicking Customize shows the studio');
  await target.click('#add'); await target.waitForTimeout(500);
  ok(/Added 1/.test(await target.evaluate(() => document.getElementById('toast').textContent)), 'Add to bag works');
  await target.click('#tabs a[data-route="/suggestions"]'); await target.waitForTimeout(1500);
  ok(await target.evaluate(() => document.querySelectorAll('#sg-list li').length) >= 5, 'the ideas board lists its sample ideas');
  ok(errs.length === 0, 'no uncaught errors', errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await launch();
  for (const [name, init] of Object.entries(SCENARIOS)) await run(browser, name, init);
  await run(browser, 'inside a sandboxed iframe (like a preview pane): opaque origin, no storage', '', { sandbox: true });
  await browser.close();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nall stress scenarios passed');
  process.exit(fails ? 1 : 0);
})();
