// The optional atmosphere media (assets/media, src/media.js, docs/higgsfield-brief.md).
//   node tools/media_test.cjs
// Part A: the site with assets/media EMPTY must look finished and request nothing from /assets/media (no 404s, no video, no poster).
// Part B: with fixtures present (generated here: stills, a poster, a short mp4), the rules hold:
//         stills at 6 percent or less, the video only on wide screens, muted, looped, playsinline, preload none, started after the page is ready and never in the first paint,
//         and NO video (poster instead) on a phone, with reduced motion or Save-Data; paused on other pages, at nature level 0 and when the tab is hidden.
// It rebuilds dist/ itself (with fixtures, then without) and leaves the normal build behind.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, withSite } = require('./launch.cjs');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d ? '  ' + d : '')); if (!c) fails++; };
const build = (env = {}) => execFileSync('node', ['build.mjs'], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

async function open(browser, base, { width = 1440, height = 900, reduced = false, saveData = false, nature = '1', route = '/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: width < 700, hasTouch: width < 700 });
  const page = await ctx.newPage();
  const reqs = [], errs = [];
  page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => errs.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && /\/assets\/media\//.test(r.url())) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.addInitScript((a) => { window.__NOSMOOTH = true; try { sessionStorage.setItem('lean-nature', a.nature); } catch (e) { /* ignore */ } if (a.saveData) Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }); }, { nature, saveData });
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
  await page.waitForTimeout(3500);   // past the idle callback that creates the video
  return { ctx, page, reqs, errs };
}

(async () => {
  const browser = await launch();
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-media-empty-'));
  try {

  // ---------------- Part A: nothing in assets/media ----------------
  console.log('== A. empty assets/media');
  build({ LEAN_MEDIA_DIR: empty });
  ok(!fs.existsSync(path.join(root, 'dist/assets/media')), 'no media folder is shipped');
  await withSite(async (base) => {
    const { ctx, page, reqs, errs } = await open(browser, base);
    ok((await page.evaluate(() => JSON.stringify(window.__MEDIA__))) === '{}', 'window.__MEDIA__ is empty');
    ok(await page.evaluate(() => !document.querySelector('.u-video, .u-poster')), 'no video and no poster element');
    ok(!reqs.some((u) => /assets\/media/.test(u)), 'nothing is requested from /assets/media (so no 404s either)');
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('foot')).visibility !== 'hidden' && document.documentElement.classList.contains('ready')), 'the site is finished (ready, footer visible)');
    ok(errs.length === 0, 'no errors', errs.join(' | '));
    await ctx.close();
  });

  // ---------------- Part B: fixtures ----------------
  console.log('\n== B. with media files present');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-media-fix-'));
  const py = `from PIL import Image, ImageDraw\nimport sys, random\nd=sys.argv[1]; r=random.Random(3)\ndef still(name,w,h):\n  im=Image.new('RGB',(w,h),(8,12,10)); g=ImageDraw.Draw(im)\n  for i in range(40): g.line([(r.randint(0,w),r.randint(0,h)),(r.randint(0,w),r.randint(0,h))],fill=(30,120,70),width=2)\n  im.save(d+'/'+name,'WEBP',quality=60)\nstill('leaf-veins.webp',1400,600); still('contours.webp',1200,675); still('hero-plate-poster.webp',1280,720); still('og-plate.webp',1200,675)\n`;
  execFileSync('python3', ['-I', '-c', py, dir]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x0a120d:s=1280x720:d=2:r=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dir, 'hero-plate.mp4')]);
  const out = build({ LEAN_MEDIA_DIR: dir });
  ok(/media 4 file\(s\)/.test(out), 'the build lists the 4 site files (og-plate is for tools only)', out.trim().split('\n').pop());
  ok(!fs.existsSync(path.join(root, 'dist/assets/media/og-plate.webp')), 'og-plate.webp is not shipped to the page');
  ok(fs.statSync(path.join(dir, 'hero-plate.mp4')).size < 2.5 * 1024 * 1024, 'the fixture video is within the 2.5 MB budget');

  await withSite(async (base) => {
    const first = await (await fetch(base + '/')).text();
    ok(!/<video/i.test(first), 'there is no <video> in the page HTML: it is never part of the first paint');

    // desktop, level 1
    let r = await open(browser, base);
    const info = await r.page.evaluate(() => { const v = document.querySelector('video.u-video'); if (!v) return null; return { muted: v.muted, loop: v.loop, playsInline: v.playsInline, preload: v.preload, poster: !!v.poster, aria: v.getAttribute('aria-hidden'), shown: getComputedStyle(v).display !== 'none', src: v.currentSrc || v.src, paused: v.paused, err: v.error && v.error.code, canH264: v.canPlayType('video/mp4; codecs="avc1.42E01E"') }; });
    ok(!!info, 'desktop: a video element exists', JSON.stringify(info));
    if (info) {
      ok(info.muted && info.loop && info.playsInline && info.preload === 'none' && info.aria === 'true' && info.poster, 'desktop: muted, loop, playsinline, preload none, hidden from screen readers, with a poster');
      ok(info.shown, 'desktop, Home, level 1: the video is displayed');
      if (info.canH264) ok(!info.paused, 'desktop: the video is playing', info.paused ? 'paused (err ' + info.err + ')' : '');
      else console.log('NOTE this Chromium cannot decode H.264 (no proprietary codecs), so playback itself is not asserted here; the element wiring above is');
    }
    const st = await r.page.evaluate(() => { const t = document.querySelector('.u-texture'), cs = getComputedStyle(t); return { veins: getComputedStyle(document.documentElement).getPropertyValue('--tex-veins').includes('leaf-veins.webp'), display: cs.display, opacity: +cs.opacity }; });
    ok(st.veins && st.display === 'block' && st.opacity <= 0.0601, 'the leaf-veins still replaces the line texture, at 6 percent or less', JSON.stringify(st));
    // other page: paused and hidden
    await r.page.evaluate(() => window.LEAN.go('/models')); await r.page.waitForTimeout(1500);
    ok(await r.page.evaluate(() => { const v = document.querySelector('video.u-video'); return !v || (getComputedStyle(v).display === 'none' && v.paused); }), 'on another page the video is hidden and paused');
    await r.page.evaluate(() => window.LEAN.go('/about')); await r.page.waitForTimeout(1500);
    ok(await r.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tex-contours').includes('contours.webp') && +getComputedStyle(document.querySelector('.u-texture')).opacity <= 0.0601), 'About: the contours still, at 6 percent or less');
    // hidden tab
    await r.page.evaluate(() => window.LEAN.go('/')); await r.page.waitForTimeout(1200);
    await r.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok(await r.page.evaluate(() => document.querySelector('video.u-video').paused), 'a hidden tab pauses the video');
    ok(r.errs.length === 0, 'desktop: no errors', r.errs.join(' | '));
    await r.ctx.close();

    // phone, reduced motion, Save-Data: poster, no video, no mp4 requested
    for (const [name, o] of [['phone (390 wide)', { width: 390, height: 844 }], ['reduced motion', { reduced: true }], ['Save-Data', { saveData: true }]]) {
      r = await open(browser, base, o);
      const s = await r.page.evaluate(() => ({ video: !!document.querySelector('video'), poster: !!document.querySelector('.u-poster'), bg: (document.querySelector('.u-poster') || {}).style && document.querySelector('.u-poster').style.backgroundImage }));
      ok(!s.video && s.poster && /hero-plate-poster\.webp/.test(s.bg), `${name}: the poster only, no video`, JSON.stringify(s));
      ok(!r.reqs.some((u) => /hero-plate\.mp4/.test(u)), `${name}: the mp4 is never requested`);
      ok(r.errs.length === 0, `${name}: no errors`, r.errs.join(' | '));
      await r.ctx.close();
    }
    // nature level 0: nothing shows
    r = await open(browser, base, { nature: '0' });
    ok(await r.page.evaluate(() => [...document.querySelectorAll('.u-video, .u-poster, .u-texture')].every((e) => getComputedStyle(e).display === 'none')), 'nature level 0: no video, poster or texture is displayed');
    await r.ctx.close();
  });

  // single-file build: stills inline, the video left out, no stray references
  execFileSync('node', ['build-single.mjs'], { cwd: root, env: { ...process.env }, stdio: 'pipe' });
  const single = fs.readFileSync(path.join(root, 'dist/lean-demo.html'), 'utf8');
  const med = JSON.parse(/window\.__MEDIA__=(\{.*?\});/.exec(single)[1]);
  ok(med.leafVeins && med.leafVeins.startsWith('data:image/webp') && med.contours && !med.heroPlate && med.heroPoster, 'single-file demo: stills and poster inline as data URLs, the video is left out');

  } finally {   // whatever happened, leave the normal (empty media) build and demo file behind
    build({ LEAN_MEDIA_DIR: empty }); execFileSync('node', ['build-single.mjs'], { cwd: root, stdio: 'pipe' });
    await browser.close();
  }
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nall media checks passed');
  process.exit(fails ? 1 : 0);
})();
