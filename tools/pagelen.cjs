// Page length in screens (document scrollHeight / window height, footer included) for every story page, at 1440x900 and 390x844.
//   npm run measure:scroll              measure and GATE: exit 1 if a page is more than 10 percent away from its target
//   node tools/pagelen.cjs --report     only print the numbers (no gate); add --json to print machine-readable output
// Targets are the owner's request ("make the scroll down longer for each page"). Every extra screen has to carry something new (copy, camera pose, a counter, an image):
// the beat tests in tests/timeline.test.mjs check that, this tool checks the total.
const { launch, withSite } = require('./launch.cjs');
const REPORT = process.argv.includes('--report'), JSON_OUT = process.argv.includes('--json');
const TARGETS = { '/': 10, '/models': 20, '/design': 9, '/colors': 10, '/customize': 6, '/about': 6, '/suggestions': 5 };
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const TOL = 0.10;
(async () => {
  const out = {};
  await withSite(async (base) => {
    const browser = await launch();
    for (const [name, vp] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'phone', hasTouch: name === 'phone' });
      const page = await ctx.newPage();
      await page.addInitScript(() => { window.__NOSMOOTH = true; });
      await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
      for (const route of Object.keys(TARGETS)) {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
        await page.waitForTimeout(2500);
        const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
        (out[route] ||= {})[name] = +screens.toFixed(2);
      }
      await ctx.close();
    }
    await browser.close();
  });
  if (JSON_OUT) { console.log(JSON.stringify(out)); }
  else {
    console.log('route'.padEnd(14) + 'desktop'.padStart(9) + 'phone'.padStart(8) + '   target');
    for (const [route, t] of Object.entries(TARGETS)) console.log(route.padEnd(14) + String(out[route].desktop).padStart(9) + String(out[route].phone).padStart(8) + '   ' + t);
  }
  const bad = [];
  for (const [route, t] of Object.entries(TARGETS)) for (const name of Object.keys(SIZES)) { const v = out[route][name]; if (Math.abs(v - t) / t > TOL) bad.push(`${route} on ${name}: ${v} screens, target ${t} (+/-10 percent = ${(t * 0.9).toFixed(1)} to ${(t * 1.1).toFixed(1)})`); }
  if (REPORT) process.exit(0);
  if (bad.length) { console.log('\nOUTSIDE THE TARGET:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('\nall pages are within 10 percent of their target length');
})();
