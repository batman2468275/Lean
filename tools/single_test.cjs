// Opens dist/lean-demo.html straight from disk (file://, no server) and checks that the whole site works.
//   node tools/single_test.cjs [outDir]       (run `npm run build:single` first)
const path = require('path');
const { launch } = require('./launch.cjs');
const OUT = process.argv[2] || '.';
const FILE = path.resolve(__dirname, '..', 'dist', 'lean-demo.html');
const URL0 = process.env.DEMO_URL || 'file://' + FILE;   // DEMO_URL=http://127.0.0.1:8123/lean-phone-stand/ tests the file as GitHub Pages would serve it
const ORIGIN = URL0.startsWith('file://') ? 'file://' : new URL(URL0).origin;
let fails = 0;
const ok = (c, m, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d ? '  ' + d : '')); if (!c) fails++; };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__NOSMOOTH = true; });
  const stray = [];
  await page.route((u) => !u.href.startsWith(ORIGIN), (r) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) stray.push(r.request().url()); r.abort(); });
  page.on('request', (r) => { if (r.url().startsWith(ORIGIN) && r.url() !== URL0 && r.url() !== URL0.replace(/\/?$/, '/') && !/\/favicon\.ico$/.test(r.url()) && !r.url().startsWith(URL0 + '#')) stray.push(r.url()); });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
  const route = () => page.evaluate(() => window.LEAN.route());

  await page.goto(URL0, { waitUntil: 'domcontentloaded' }); await ready(); await page.waitForTimeout(1500);
  ok((await route()) === '/', 'the file opens on the Home page');
  ok((await page.evaluate(() => window.__SCENE_BUILDS)) === 1, 'the 3D scene was built from the inline models');
  ok(!(await page.evaluate(() => document.documentElement.classList.contains('no-gl'))), 'WebGL is on (no flat fallback)');
  await page.screenshot({ path: `${OUT}/single_home.png` });

  // navigation by clicking, in the URL hash
  await page.click('#tabs a[data-route="/models"]'); await page.waitForTimeout(1200);
  ok((await route()) === '/models' && /#\/models$/.test(page.url()), 'clicking Models goes to #/models', page.url().slice(-30));
  ok((await page.title()).startsWith('Models'), 'page title follows the page', await page.title());
  await page.evaluate(() => window.LEAN.freeze(0.5)); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/single_models.png` });
  await page.evaluate(() => window.LEAN.freeze(null));
  await page.goBack(); await page.waitForTimeout(1200);
  ok((await route()) === '/', 'Back returns to Home');
  await page.goForward(); await page.waitForTimeout(1200);
  ok((await route()) === '/models', 'Forward returns to Models');
  ok((await page.getAttribute('#tabs a[data-route="/design"]', 'href')) === '#/design', 'links show real demo URLs (#/design)');

  // deep links
  await page.goto(URL0 + '#/customize?color=sky&magsafe=1&phone=large', { waitUntil: 'domcontentloaded' }); await ready(); await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.LEAN.state());
  ok((await route()) === '/customize' && st.colorId === 'sky' && st.magsafe === true && st.phone === 'large', 'a deep link restores page and choices', JSON.stringify({ c: st.colorId, m: st.magsafe, p: st.phone }));
  ok(/#\/customize\?/.test(page.url()), 'the URL keeps describing the choices', page.url().slice(-60));
  const gal = await page.evaluate(() => [...document.querySelectorAll('#view img')].map((i) => i.src.slice(0, 11)));
  ok(gal.length > 0 && gal.every((s) => s === 'data:image/'), 'product photos come from inside the file', gal.join(','));
  await page.click('#add'); await page.waitForTimeout(600);
  ok(/Added 1/.test(await page.textContent('#toast')), 'Add to bag works', (await page.textContent('#toast')).slice(0, 60));
  await page.screenshot({ path: `${OUT}/single_customize.png` });

  // not found
  await page.goto(URL0 + '#/nope', { waitUntil: 'domcontentloaded' }); await ready(); await page.waitForTimeout(800);
  ok((await route()) === '/404' && /isn't here/.test(await page.textContent('#view')), 'an unknown page shows the not-found page');

  // the ideas board, answered by the browser
  await page.goto(URL0 + '#/suggestions', { waitUntil: 'domcontentloaded' }); await ready();
  await page.waitForSelector('#sg-list li', { timeout: 15000 });
  ok((await page.$$('#sg-list li')).length === 5, 'the board shows the five sample ideas');
  ok(/Demo:/.test(await page.textContent('.sg-fine')), 'the board says it is a demo');
  await page.locator('#sg-list .sg-vote').first().click(); await page.waitForTimeout(400);
  ok((await page.locator('#sg-list .sg-vote').first().getAttribute('aria-pressed')) === 'true', 'voting works');
  await page.fill('#sg-text', 'Please add a stand with two phone slots'); await page.click('#sg-send'); await page.waitForTimeout(600);
  ok(/Thank you/.test(await page.textContent('#sg-msg')), 'sending an idea works', await page.textContent('#sg-msg'));
  await page.fill('#sg-text', 'see www.cheap-stands.com for deals'); await page.click('#sg-send'); await page.waitForTimeout(400);
  ok(/links/i.test(await page.textContent('#sg-msg')), 'the same content rules apply (links refused)');
  await page.goto(URL0 + '#/admin/suggestions', { waitUntil: 'domcontentloaded' }); await ready();
  await page.fill('#ad-token', 'wrong'); await page.click('#ad-login button'); await page.waitForTimeout(400);
  ok(/Wrong or missing/.test(await page.textContent('#ad-msg')), 'a wrong admin token is refused');
  await page.fill('#ad-token', 'demo'); await page.click('#ad-login button'); await page.waitForSelector('#ad-main:not([hidden])');
  ok((await page.$$('#ad-list li')).length === 1, 'the new idea waits for approval in the admin list');
  await page.click('#ad-list .btn.primary'); await page.waitForTimeout(500);
  await page.goto(URL0 + '#/suggestions', { waitUntil: 'domcontentloaded' }); await ready(); await page.waitForSelector('#sg-list li');
  ok((await page.$$('#sg-list li')).length === 6, 'once approved it is on the board, and it survives a reload');

  ok(stray.length === 0, 'nothing is requested from outside the file (except the optional Google Fonts)', stray.slice(0, 3).join(' | '));
  ok(errs.length === 0, 'no page errors or console errors', errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nall single-file checks passed');
  process.exit(fails ? 1 : 0);
})();
