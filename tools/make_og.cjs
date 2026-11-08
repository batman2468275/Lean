// Social image + icon PNGs from the wordmark data (src/logo.json) and the product render. Run after `npm run build` (which writes assets/logo/favicon.svg).
//   node tools/make_og.cjs      -> assets/social/og-image.png (1200x630), assets/logo/apple-touch-icon.png (180), assets/logo/favicon-32.png
// The headline font falls back to a system serif when Fraunces is not installed, so run it on a machine with the fonts for the final image.
const fs = require('fs'); const path = require('path'); const launch = require('./launch.cjs');
const root = path.join(__dirname, '..'); const LOGO = JSON.parse(fs.readFileSync(path.join(root, 'src/logo.json'), 'utf8'));
const [x, y, w, h] = LOGO.viewBox, e = 1.5, m = e / 2;
const wordmark = (ink, n) => `<svg viewBox="${x - m} ${y - m} ${w + e} ${h + e}" xmlns="http://www.w3.org/2000/svg"><path d="${LOGO.letters}" fill="${ink}" stroke="${ink}" stroke-width="${e}" stroke-linejoin="round"/><path d="${LOGO.n}" fill="none" stroke="${n}" stroke-width="${LOGO.stroke + e}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'assets/renders/cutout-front.webp')).toString('base64');
const og = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;color:#1A241D;
background:radial-gradient(60% 70% at 12% 0%,rgba(255,233,184,.8),transparent 70%),radial-gradient(45% 55% at 96% 6%,rgba(140,203,240,.35),transparent 72%),linear-gradient(180deg,#F8F5EC,#E4EAD8)}
.blob{position:absolute;right:-60px;top:70px;width:640px;height:560px;background:#E3EADC;border-radius:58% 42% 50% 50%/46% 54% 46% 54%}
.stand{position:absolute;right:40px;top:50px;width:560px;height:560px;filter:url(#t)}
.wm{position:absolute;left:78px;top:150px;width:520px}
.tag{position:absolute;left:84px;top:392px;font-size:42px;line-height:1.15;letter-spacing:-.01em}
.sub{position:absolute;left:86px;top:500px;font:500 22px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#46564A}
</style><svg width="0" height="0"><filter id="t" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.61 0 0 0 0  0 0.78 0 0 0  0 0 0.42 0 0  0 0 0 1 0"/></filter></svg>
<div class="blob"></div><img class="stand" src="${img}"><div class="wm">${wordmark('#1A241D', '#4F7F3E')}</div><div class="tag">Charge where<br>it stands.</div><div class="sub">3D-printed phone stand</div>`;
(async () => {
  const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 630 } }); const page = await ctx.newPage();
  fs.mkdirSync(path.join(root, 'assets/social'), { recursive: true });
  await page.setContent(og); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, 'assets/social/og-image.png') });
  const fav = fs.readFileSync(path.join(root, 'assets/logo/favicon.svg'), 'utf8');
  for (const [size, file] of [[180, 'apple-touch-icon.png'], [32, 'favicon-32.png']]) {
    const p2 = await (await b.newContext({ viewport: { width: size, height: size } })).newPage();
    await p2.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${fav}`);
    await p2.screenshot({ path: path.join(root, 'assets/logo', file), omitBackground: true });
  }
  await b.close(); console.log('wrote assets/social/og-image.png, assets/logo/apple-touch-icon.png, assets/logo/favicon-32.png');
})();
