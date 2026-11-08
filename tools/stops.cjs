// Scroll-stop screenshots: N evenly spaced stops down each page (viewport only), for reviewing what is on screen at every point of the scroll.
//   node tools/stops.cjs <outDir> <width> <height> <tag> [stops=8] [route,route,...]       e.g.  node tools/stops.cjs /tmp/s 1440 900 d 8 /,/models
// Writes <outDir>/<tag>_<page>_<nn>.png. Software WebGL is slow: each stop waits for a fresh draw before the shot.
const fs = require('fs'); const path = require('path');
const { launch, withSite } = require('./launch.cjs');
const [out = '.', W = '1440', H = '900', tag = 'd', N = '8', only = ''] = process.argv.slice(2);
const ROUTES = (only ? only.split(',') : ['/', '/models', '/design', '/colors', '/customize', '/about', '/suggestions']);
fs.mkdirSync(out, { recursive: true });
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const phone = +W < 600;
    const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    for (const route of ROUTES) {
      await page.goto(base + route + '?nointro', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 90000 });
      await page.waitForTimeout(2500);
      const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      const name = route === '/' ? 'home' : route.slice(1);
      for (let i = 0; i < +N; i++) {
        const y = Math.round(total * (+N === 1 ? 0 : i / (+N - 1)));
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(2200);
        await page.screenshot({ path: path.join(out, `${tag}_${name}_${String(i).padStart(2, '0')}.png`) });
      }
      console.log(route, 'screens:', (total / +H + 1).toFixed(2));
    }
    await browser.close();
  });
})();
