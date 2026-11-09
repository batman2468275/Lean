// GPU regression guard (npm run check:gl). It CANNOT reproduce John's iPad speckle (software GL renders the floor cleanly either way, see docs/gpu-safety.md);
// it guards the properties that keep the pipeline safe on real mobile GPUs: no invalid premultiplied alpha, an opaque canvas on touch, a pixel budget, no floor chroma noise,
// no GL errors, and a canvas that is NOT re-allocated when the phone's toolbar shows and hides.
//   npm run check:gl [-- --quick]          (--quick: one page per profile)
const { launch, withSite } = require('./launch.cjs');
const QUICK = process.argv.includes('--quick');
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, touch: false },
  ipad: { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, touch: true, ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, touch: true, mobile: true },
};
const ROUTES = process.env.GLROUTES ? process.env.GLROUTES.split(',') : QUICK ? ['/customize?color=sky'] : ['/', '/models', '/design', '/colors', '/customize?color=sky', '/customize?color=black'];
const MAXPX = 3000000;
// crops of the bare floor, as fractions of the viewport [x0, y0, x1, y1]: left of the stand, outside the cast shadow; the page text is hidden while we measure
const CROP = { desktop: [0.0, 0.55, 0.11, 0.85], ipad: [0.0, 0.60, 0.14, 0.85], phone: [0.0, 0.50, 0.16, 0.70] };

const initScript = () => {
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) { if (/webgl/.test(type)) attrs = Object.assign({}, attrs, { preserveDrawingBuffer: true }); return gc.call(this, type, attrs); };
  window.__NOSMOOTH = true; window.__glWrites = 0;
  const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { configurable: true, get: d.get, set(v) { if (this.id === 'gl') window.__glWrites++; d.set.call(this, v); } });
};

const readBuffer = () => {   // alpha checks on the real drawing buffer
  const c = document.getElementById('gl'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return null;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let bad = 0, nonOpaque = 0;
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]; if (a !== 255) nonOpaque++; if (px[i] > a + 1 || px[i + 1] > a + 1 || px[i + 2] > a + 1) bad++; }
  return { w, h, bad, nonOpaque, attrs: gl.getContextAttributes() };
};

const noise = ([x0, y0, x1, y1], dataUrl) => new Promise((resolve) => {   // chroma noise of a crop (blur radius 3, residual, chroma std and off-hue share)
  const img = new Image(); img.onload = () => {
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const X0 = Math.round(x0 * W), Y0 = Math.round(y0 * H), w = Math.round((x1 - x0) * W), h = Math.round((y1 - y0) * H), d = x.getImageData(X0, Y0, w, h).data, R = 3;
    const ch = (k) => { const a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + k]; return a; };
    const blur = (a) => { const t = new Float32Array(w * h), o = new Float32Array(w * h), n = 2 * R + 1;
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { let s = 0; for (let k = -R; k <= R; k++) s += a[y * w + Math.min(w - 1, Math.max(0, xx + k))]; t[y * w + xx] = s / n; }
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { let s = 0; for (let k = -R; k <= R; k++) s += t[Math.min(h - 1, Math.max(0, y + k)) * w + xx]; o[y * w + xx] = s / n; }
      return o; };
    const r = ch(0), g = ch(1), b = ch(2), br = blur(r), bg = blur(g), bb = blur(b); let s = 0, dev = 0, cnt = 0;
    for (let i = 0; i < w * h; i++) { const rr = r[i] - br[i], gg = g[i] - bg[i], bl = b[i] - bb[i]; s += ((rr - gg) ** 2 + (bl - gg) ** 2) / 2; if (Math.max(Math.abs(rr - gg), Math.abs(bl - gg)) > 6) dev++; cnt++; }
    resolve({ chroma: Math.sqrt(s / cnt), huePct: 100 * dev / cnt, w, h });
  }; img.src = dataUrl;
});

(async () => {
  const rows = [], fails = [];
  await withSite(async (base) => {
    const browser = await launch();
    for (const [pname, P] of Object.entries(PROFILES)) {
      if (process.env.GLONLY && process.env.GLONLY !== pname) continue;
      const ctx = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.deviceScaleFactor, hasTouch: P.touch, isMobile: !!P.mobile, userAgent: P.ua });
      const page = await ctx.newPage(); await page.addInitScript(initScript);
      const logs = []; page.on('console', (m) => { const t = m.text(); if (/GL_INVALID|INVALID_|Could not compile|shader|context lost|CONTEXT_LOST/i.test(t)) logs.push(t.slice(0, 160)); });
      page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
      await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
      for (const route of ROUTES) {
        const tag = `${pname} ${route}`; logs.length = 0;
        console.log('checking', tag);
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        try { await page.waitForFunction(() => document.documentElement.classList.contains('ready') && window.__perf && window.__perf.renders >= 1, null, { timeout: 120000 }); } catch (e) { fails.push(`${tag}: the page never finished drawing its first frames`); continue; }
        await page.waitForTimeout(6000);
        const buf = await page.evaluate(readBuffer); const row = { tag };
        if (!buf) { fails.push(`${tag}: no WebGL buffer`); continue; }
        Object.assign(row, { buffer: `${buf.w}x${buf.h}`, mp: +(buf.w * buf.h / 1e6).toFixed(2), alpha: buf.attrs.alpha, bad: buf.bad });
        if (buf.bad) fails.push(`${tag}: ${buf.bad} pixels with a colour channel above alpha (invalid premultiplied alpha)`);
        if (P.touch) {
          if (buf.attrs.alpha !== false) fails.push(`${tag}: touch profile must create the context with alpha: false (it has ${buf.attrs.alpha})`);
          if (buf.nonOpaque) fails.push(`${tag}: touch profile must draw an opaque canvas, ${buf.nonOpaque} pixels are not alpha 255`);
          if (buf.w * buf.h > MAXPX * 1.02) fails.push(`${tag}: drawing buffer ${(buf.w * buf.h / 1e6).toFixed(2)} MP is over the ${MAXPX / 1e6} MP touch budget`);
        }
        await page.addStyleTag({ content: '#view, .nav, .overlay, .fallback, #toast, footer { visibility: hidden !important }' });   // the bare stage only
        await page.waitForTimeout(400);
        const shot = await page.screenshot({ type: 'png' });
        if (process.env.GLSHOTS) require('fs').writeFileSync(`${process.env.GLSHOTS}/${pname}_${route.replace(/\W+/g, '_')}.png`, shot);
        const n = await page.evaluate(`(${noise.toString()})(${JSON.stringify(CROP[pname])}, "data:image/png;base64,${shot.toString('base64')}")`);
        Object.assign(row, { chroma: +n.chroma.toFixed(2), huePct: +n.huePct.toFixed(2) });
        if (n.chroma > 1.0 || n.huePct > 0.5) fails.push(`${tag}: floor chroma noise ${n.chroma.toFixed(2)} (max 1.0), off-hue ${n.huePct.toFixed(2)} percent (max 0.5)`);
        if (logs.length) fails.push(`${tag}: GL problems in the console: ${logs.slice(0, 2).join(' | ')}`);
        rows.push(row);
      }
      if (P.touch) {   // the toolbar shows and hides while you scroll: the canvas must not be re-allocated
        await page.goto(base + '/models', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.documentElement.classList.contains('ready') && window.__perf && window.__perf.renders >= 1, null, { timeout: 180000 });
        await page.waitForTimeout(1500);
        const before = await page.evaluate(() => window.__glWrites), total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        for (let i = 1; i <= 30; i++) { await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * i / 30)); if (i % 6 === 0) { await page.setViewportSize({ width: P.viewport.width, height: P.viewport.height - (i % 12 === 0 ? 0 : 70) }); } await page.waitForTimeout(120); }
        await page.waitForTimeout(600);
        const writes = (await page.evaluate(() => window.__glWrites)) - before; rows.push({ tag: `${pname} scroll+toolbar`, canvasResizes: writes });
        if (writes > 0) fails.push(`${pname}: the canvas was re-allocated ${writes} time(s) while scrolling and the toolbar changed height`);
      }
      await ctx.close();
    }
    await browser.close();
  });
  console.table(rows);
  if (fails.length) { console.log('\nFAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('\nall GPU safety checks passed');
})();
