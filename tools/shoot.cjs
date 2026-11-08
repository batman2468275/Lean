// Screenshots of the pages at chosen scroll positions.
//   node tools/shoot.cjs <outDir> [width=1440] [height=900] [tag=d] ['[["/",0],["/models",0.5]]']
// Each stop is [route, progress, hash?, dy?]: progress 0..1 of that page's whole scroll (top to bottom). With a hash and dy, it scrolls to that section
// plus dy screens instead (e.g. ["/models", 0, "#magsafe", 1.2]). A fresh load per stop, so each frame is independent.
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.'; const W = +process.argv[3] || 1440, H = +process.argv[4] || 900; const tag = process.argv[5] || 'd';
const DEFAULT = [['/', 0], ['/', 0.6], ['/models', 0.12], ['/models', 0.4], ['/models', 0.62], ['/models', 0.86], ['/design', 0.2], ['/design', 0.5], ['/colors', 0.15], ['/colors', 0.55], ['/customize', 0], ['/customize', 1], ['/about', 0.3], ['/suggestions', 0.2], ['/privacy', 0]];
const stops = JSON.parse(process.argv[6] || JSON.stringify(DEFAULT));
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    if (process.env.NATURE) await page.addInitScript((n) => { try { sessionStorage.setItem('lean-nature', n); } catch (e) { /* ignore */ } }, process.env.NATURE);   // NATURE=0|1|2 picks the nature level for the run
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('console error', m.text().slice(0, 300)); });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    let i = 0;
    for (const [route, p, hash, dy] of stops) {
      await page.goto(base + route + (hash || ''), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.evaluate(([p, hash, dy]) => { document.documentElement.style.scrollBehavior = 'auto'; const el = hash && dy != null ? document.getElementById(hash.slice(1)) : null; const max = document.documentElement.scrollHeight - innerHeight; scrollTo(0, el ? el.getBoundingClientRect().top + scrollY + dy * innerHeight : p * max); }, [p, hash, dy]);
      await page.waitForTimeout(3200);
      await page.screenshot({ path: `${OUT}/${tag}_${String(i).padStart(2, '0')}_${route.replace(/\//g, '') || 'home'}_${hash ? hash.slice(1) + dy : p}.png` });
      i++;
    }
    await browser.close();
  });
})();
