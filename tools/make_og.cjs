// Social image + icon PNGs from the wordmark data (src/logo.json) and the product render. Run after `npm run build` (which writes assets/logo/favicon.svg).
//   node tools/make_og.cjs      -> assets/social/og-image.png (1200x630), assets/logo/apple-touch-icon.png (180), assets/logo/favicon-32.png
// Dark theme: charcoal, electric green, Geist. If assets/media/og-plate.webp exists (docs/higgsfield-brief.md) it is the backdrop, with the REAL render and the wordmark on top;
// without it a CSS gradient does the job. Geist falls back to the system sans when it is not installed, so run this on a machine with the font for the final image.
const fs = require('fs'); const path = require('path'); const launch = require('./launch.cjs');
const root = path.join(__dirname, '..'); const LOGO = JSON.parse(fs.readFileSync(path.join(root, 'src/logo.json'), 'utf8'));
const [x, y, w, h] = LOGO.viewBox, e = 1.5, m = e / 2;
const wordmark = (ink, n) => `<svg viewBox="${x - m} ${y - m} ${w + e} ${h + e}" xmlns="http://www.w3.org/2000/svg"><path d="${LOGO.letters}" fill="${ink}" stroke="${ink}" stroke-width="${e}" stroke-linejoin="round" stroke-linecap="round"/><path d="${LOGO.n}" fill="none" stroke="${n}" stroke-width="${LOGO.stroke + e}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'assets/renders/cutout-front.webp')).toString('base64');
const plateFile = path.join(root, 'assets/media/og-plate.webp');
const plate = fs.existsSync(plateFile) ? 'data:image/webp;base64,' + fs.readFileSync(plateFile).toString('base64') : null;
const backdrop = plate
  ? `background:linear-gradient(90deg,rgba(13,15,14,.82) 0%,rgba(13,15,14,.35) 60%,rgba(13,15,14,.1) 100%),url(${plate}) center/cover,#0d0f0e`
  : `background:radial-gradient(60% 75% at 74% 104%,rgba(53,240,127,.34),transparent 70%),radial-gradient(50% 50% at 8% 0%,rgba(53,240,127,.07),transparent 70%),linear-gradient(180deg,#0b100d,#0d0f0e)`;
const og = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:"Geist",-apple-system,"SF Pro Display","Segoe UI",system-ui,sans-serif;color:#f4f6f4;${backdrop}}
.pool{position:absolute;right:20px;bottom:-130px;width:700px;height:320px;border-radius:50%;background:radial-gradient(closest-side,rgba(95,127,59,.5),transparent);}
.stand{position:absolute;right:50px;top:48px;width:540px;height:540px;filter:url(#t) drop-shadow(0 30px 40px rgba(0,0,0,.6))}
.reg{position:absolute;width:22px;height:22px;opacity:.5}.reg:before,.reg:after{content:"";position:absolute;background:#a5aca6}.reg:before{left:0;right:0;top:50%;height:1px}.reg:after{top:0;bottom:0;left:50%;width:1px}
.wm{position:absolute;left:78px;top:126px;width:500px}
.tag{position:absolute;left:84px;top:384px;font-size:60px;line-height:1.04;font-weight:700;letter-spacing:-.035em}
.sub{position:absolute;left:86px;top:520px;font:500 20px ui-monospace,"Geist Mono",Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#35f07f}
.sub:before{content:"";display:inline-block;width:26px;height:1px;background:#35f07f;vertical-align:middle;margin-right:12px}
</style><svg width="0" height="0"><filter id="t" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.61 0 0 0 0  0 0.78 0 0 0  0 0 0.42 0 0  0 0 0 1 0"/></filter></svg>
<i class="reg" style="left:28px;top:28px"></i><i class="reg" style="right:28px;top:28px"></i><i class="reg" style="left:28px;bottom:28px"></i><i class="reg" style="right:28px;bottom:28px"></i>
<div class="pool"></div><img class="stand" src="${img}"><div class="wm">${wordmark('#f4f6f4', '#35f07f')}</div><div class="tag">Charge where<br>it stands.</div><div class="sub">3D-printed phone stand</div>`;
(async () => {
  const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 630 } }); const page = await ctx.newPage();
  fs.mkdirSync(path.join(root, 'assets/social'), { recursive: true });
  await page.setContent(og); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(root, 'assets/social/og-image.png') });
  const fav = fs.readFileSync(path.join(root, 'assets/logo/favicon.svg'), 'utf8');
  for (const [size, file] of [[180, 'apple-touch-icon.png'], [32, 'favicon-32.png']]) {
    const p2 = await (await b.newContext({ viewport: { width: size, height: size } })).newPage();
    await p2.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${fav}`);
    await p2.screenshot({ path: path.join(root, 'assets/logo', file), omitBackground: true });
  }
  await b.close(); console.log('wrote assets/social/og-image.png (%s), assets/logo/apple-touch-icon.png, assets/logo/favicon-32.png', plate ? 'with og-plate.webp' : 'CSS backdrop');
})();
