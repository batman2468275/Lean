// Frames of the Home intro at fixed times (window.__INTRO_FREEZE), so the wordmark write, the "n" draw and the stand rise can be looked at without real time.
//   node tools/intro.cjs <outDir> [width=1440] [height=900]
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.', W = +process.argv[3] || 1440, H = +process.argv[4] || 900;
const TIMES = [0.15, 0.6, 1.1, 1.6, 2.0, 2.5, 3.0, 3.5];
(async () => { await withSite(async (base) => {
  const b = await launch(); const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 700, hasTouch: W < 700 }); const page = await ctx.newPage();
  await page.addInitScript(() => { window.__NOSMOOTH = true; window.__INTRO_FREEZE = 0; });
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 });
  for (let i = 0; i < TIMES.length; i++) {
    await page.evaluate((t) => { window.__INTRO_FREEZE = t; }, TIMES[i]);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/i_${String(i).padStart(2, '0')}_t${TIMES[i]}.png` });
  }
  await b.close(); }); })();
