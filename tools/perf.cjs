// Frame cost of the scroll animation, measured with the page's own counters (window.__perf).
//   node tools/perf.cjs [cpuThrottle=4] [width=1440] [height=900]
// IMPORTANT: this machine has no GPU (software WebGL), so FPS here is NOT a real frame rate. What it can tell you is the main-thread JS cost per frame
// (jsMs, which excludes the time spent inside renderer.render), how many frames actually drew, and the draw-call / triangle / shader-program counts. GPU time must be measured on a real device.
const { launch, withSite } = require('./launch.cjs');
const THROTTLE = +process.argv[2] || 4, W = +process.argv[3] || 1440, H = +process.argv[4] || 900;
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 700, hasTouch: W < 700 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const rows = [];
    for (const route of ['/', '/models', '/design', '/colors', '/customize']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      const r = await page.evaluate(async () => {
        const P = window.__perf, D = window.LEAN.length(), steps = 40, out = { jsOnDraw: [] };
        P.maxJsMs = 0; const f0 = P.frames, r0 = P.renders, j0 = P.jsMs;
        for (let i = 0; i <= steps; i++) {              // a scripted scroll through the whole page, one step per ~120 ms
          const before = P.jsMs; window.scrollTo(0, D * i / steps);
          await new Promise((res) => setTimeout(res, 120));
          out.jsOnDraw.push(P.jsMs - before);
        }
        const draws = P.renders - r0, frames = P.frames - f0;
        const sorted = out.jsOnDraw.slice().sort((a, b) => a - b);
        return { frames, draws, appJsMsPerStep_p50: +sorted[sorted.length >> 1].toFixed(2), appJsMsPerStep_max: +sorted[sorted.length - 1].toFixed(2), maxAppJsFrameMs: +P.maxJsMs.toFixed(1), glMsTotal: +P.glMs.toFixed(0), calls: P.calls, tris: P.tris, geos: P.geos, textures: P.tex, programs: P.progs };
      });
      rows.push({ route, ...r }); console.log(route, JSON.stringify(r));
    }
    await browser.close();
  });
})();
