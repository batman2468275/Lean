// The Home intro must always end in the complete state, on the DEFAULT load (not with ?p= pinned): the wordmark fully written with its "n",
// the stand standing on the floor, within the hard cap (3.5 s of wall-clock), even on a very slow renderer; and a click, key press or scroll skips it.
//   node tools/intro_test.cjs [outDir]
const { launch, withSite } = require('./launch.cjs');
const { execFileSync } = require('child_process');
// stand pixels (Mistletoe green) in the lower middle of a 1440x900 screenshot: the page behind it is near-black, so zero means an empty stage
const count = (file) => +execFileSync('python3', ['-I', '-c', `import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size; n=0\nfor y in range(int(h*.35),int(h*.9),2):\n  for x in range(int(w*.3),int(w*.7),2):\n    r,g,b=im.getpixel((x,y))\n    if g>70 and g>b+20 and g>=r: n+=1\nprint(n)`, file]).toString().trim();
const OUT = process.argv[2] || '.';
let fails = 0;
const ok = (c, m, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d ? '  ' + d : '')); if (!c) fails++; };

async function scenario(browser, base, name, { throttle = 1, skip = null }) {
  console.log('\n== ' + name);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__NOSMOOTH = true; });   // instant scroll smoothing only: the intro itself is NOT disabled by this
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  if (throttle > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  const t0 = Date.now();
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 90000 });
  const readyAt = Date.now() - t0;
  if (skip === 'click') { await page.waitForTimeout(300); await page.mouse.click(700, 500); }
  if (skip === 'key') { await page.waitForTimeout(300); await page.keyboard.press('Space'); }
  if (skip === 'scroll') { await page.waitForTimeout(300); await page.mouse.wheel(0, 120); }
  const tSkip = Date.now();
  // wait for the intro to end
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-play'), null, { timeout: 15000 }).catch(() => {});
  const endedAfter = Date.now() - (skip ? tSkip : t0);
  const st = await page.evaluate(() => ({ playing: document.documentElement.classList.contains('intro-play'), masked: !!document.querySelector('.hero .wm svg defs'), nDash: (document.querySelector('.hero .wm .lg-n') || {}).style && document.querySelector('.hero .wm .lg-n').style.strokeDashoffset }));
  ok(!st.playing && !st.masked && !st.nDash, 'the wordmark is complete (no mask, "n" fully drawn)', JSON.stringify(st));
  if (skip) ok(endedAfter < 1500, `${skip} skips the intro at once`, endedAfter + ' ms after the input');
  else ok(endedAfter <= Math.max(4600, readyAt + 800), 'the intro ended within the hard cap (3.5 s after the page mounted, or right after a long scene build)', `${endedAfter} ms after load start (scene ready at ${readyAt} ms)`);
  await page.waitForTimeout(2500);   // let a few frames draw
  // the stand must be on screen: count stand-green pixels in the lower middle of the page (the stand is Mistletoe, the page is near-black)
  const shot = `${OUT}/intro_${name.replace(/\W+/g, '_')}.png`;
  await page.screenshot({ path: shot });
  const green = count(shot);
  ok(green > 3000, 'the stand is standing on the stage (not an empty stage)', 'stand pixels: ' + green);
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await ctx.close();
}

(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    await scenario(browser, base, 'normal speed', {});
    await scenario(browser, base, 'CPU throttled 6x (a very slow renderer)', { throttle: 6 });
    await scenario(browser, base, 'click skips', { skip: 'click' });
    await scenario(browser, base, 'key skips', { skip: 'key' });
    await scenario(browser, base, 'scroll skips', { skip: 'scroll' });
    await browser.close();
  });
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nall intro checks passed');
  process.exit(fails ? 1 : 0);
})();
