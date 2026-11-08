// Renders the product images (white base, transparent background) from the real meshes.
//   node tools/render_views.cjs [outDir=assets/renders] [view...]      (needs build/model_*.bin: npm run prep:model)
// Output: <outDir>/<variant>-<view>.webp (1200px, what the site embeds). Env: EXPOSURE (default 0.55), VARIANTS=plain,cutout, OVER='{"rotY":0.3}'
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execFileSync } = require('child_process');
const launch = require('./launch.cjs'); const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'assets', 'renders'));
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-render-'));   // big intermediates (2400px stand + shadow passes) live here
(async () => {
  const meta = fs.readFileSync(path.join(root, 'build/meta.json'), 'utf8');
  const cut = fs.readFileSync(path.join(root, 'build/model_cut.bin')).toString('base64');
  const plain = fs.readFileSync(path.join(root, 'build/model_plain.bin')).toString('base64');
  const js = (await esbuild.build({ entryPoints: [path.join(__dirname, 'render_harness.js')], bundle: true, format: 'iife', write: false, minify: true, target: 'es2020' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block;width:600px;height:600px}</style><canvas id="c"></canvas>
<script>window.__META__=${meta};window.__MODEL_CUT__="${cut}";window.__MODEL_PLAIN__="${plain}";window.__SIZE__=2400;window.__EXPOSURE__=1;</script><script>${js}</script>`;
  const htmlPath = path.join(work, '_harness.html'); fs.writeFileSync(htmlPath, html);
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 600, height: 600 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('console', m.type(), m.text().slice(0, 200)); });
  await page.goto('file://' + htmlPath);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  const views = only.length ? only : ['front', 'side', 'detail'];
  const look = process.env.LOOK ? JSON.parse(process.env.LOOK) : { color: 0xffffff, exposure: +(process.env.EXPOSURE || 0.55) };
  const tag = process.env.TAG || '';
  await page.evaluate((l) => window.setLook(l), look);
  const variants = process.env.VARIANTS ? process.env.VARIANTS.split(',') : ['plain', 'cutout'];
  for (const variant of variants) for (const view of views) for (const pass of ['stand', 'shadow']) {
    const url = await page.evaluate(([a, b, c, OVER]) => window.renderView(a, b, Object.assign({ pass: c }, JSON.parse(OVER))), [variant, view, pass, process.env.OVER || '{}']);
    const png = path.join(work, `${variant}-${view}${tag}.${pass}.png`);
    fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('rendered', variants.join(','), views.join(','));
  await browser.close(); fs.unlinkSync(htmlPath);
  execFileSync('python3', [path.join(__dirname, 'finish_renders.py'), work], { stdio: 'inherit' });
  for (const f of fs.readdirSync(work).filter((n) => n.endsWith('.webp'))) fs.copyFileSync(path.join(work, f), path.join(out, f));
  fs.rmSync(work, { recursive: true, force: true });
  console.log('wrote webp files to', out);
})();
