// Contact-sheet frames: 10 pinned progress values per page (window.LEAN.freeze(p), the same thing as loading /route?p=0.42).
//   node tools/contact.cjs <outDir> <width> <height> <tag> ['["/","/models"]']
// Writes <outDir>/<tag>_<page>_<NN>_p<value>.png. Build first. Combine with: python3 tools/sheet.py <outDir> <tag>_<page> <sheet.png> 0 10 5
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.'; const W = +process.argv[3] || 1440, H = +process.argv[4] || 900; const tag = process.argv[5] || 'd';
const PAGES = JSON.parse(process.argv[6] || '["/","/models","/design","/colors","/customize","/about","/suggestions"]');
const PS = [0.02, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.84, 0.96];
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('console error', m.text().slice(0, 300)); });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    for (const route of PAGES) {
      await page.goto(base + route + '?p=' + PS[0], { waitUntil: 'domcontentloaded' });   // also exercises the ?p= parameter
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 });
      await page.waitForTimeout(1200);
      for (let i = 0; i < PS.length; i++) {
        const n0 = await page.evaluate(() => window.__perf.renders);
        await page.evaluate((p) => window.LEAN.freeze(p), PS[i]);
        await page.waitForFunction((n) => window.__perf.renders >= n + 1, n0, { timeout: 30000 });   // wait for a fresh draw (software GL is slow)
        await page.waitForTimeout(1800);   // software GL: the compositor needs a moment after the draw, or the screenshot comes back blank
        await page.screenshot({ path: `${OUT}/${tag}_${route.replace(/\//g, '') || 'home'}_${String(i).padStart(2, '0')}_p${PS[i]}.png` });
      }
    }
    await browser.close();
  });
})();
