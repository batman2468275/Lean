// Renders the product STILLS (the many pictures on every page) from the real print meshes, with this repo's own pipeline. No AI images, no photos.
//   npm run render:shots                      render every spec in tools/shot_specs.js into assets/renders/ (1200 and @640 webp, transparent, soft separate shadow)
//   npm run render:shots -- --only a,b        only these ids
//   npm run render:shots -- --preview <dir>   quick 1x previews (600 px) into <dir> for framing; writes nothing into the project
//   npm run render:shots -- --calibrate       find the albedo gain that makes each colour's lit face read as its CONFIG hex -> tools/shot_gains.json, and print the table
//   npm run render:shots -- --check           print the colour-accuracy table for the current gains (and write docs/colour-accuracy.json)
// Needs build/model_*.bin, build/meta.json, build/magsafe.json (npm run prep:model, npm run prep:magsafe). Software WebGL: about 20 seconds a picture, so run it once and look at the contact sheet.
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execFileSync } = require('child_process');
const launch = require('./launch.cjs'); const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = (val('--only') || '').split(',').filter(Boolean);
const PREVIEW = flag('--preview') ? path.resolve(val('--preview') || path.join(os.tmpdir(), 'lean-shot-preview')) : null;
const GAINS_FILE = path.join(__dirname, 'shot_gains.json');
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const Y = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function lab([r, g, b]) {   // sRGB -> CIE Lab (D65)
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = (0.2126 * R + 0.7152 * G + 0.0722 * B), z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

(async () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const gains = fs.existsSync(GAINS_FILE) ? JSON.parse(fs.readFileSync(GAINS_FILE, 'utf8')) : {};
  const js = (await esbuild.build({ entryPoints: [path.join(__dirname, 'shots_harness.js')], bundle: true, format: 'iife', write: false, minify: true, target: 'es2020' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const cut = fs.readFileSync(path.join(root, 'build/model_cut.bin')).toString('base64'), plain = fs.readFileSync(path.join(root, 'build/model_plain.bin')).toString('base64');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-shots-'));
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block;width:300px;height:300px}</style><canvas id="c"></canvas>
<script>window.__META__=${read('build/meta.json')};window.__MAG__=${read('build/magsafe.json')};window.__LOGO__=${read('src/logo.json')};window.__PARAMS__=${read('tools/magsafe_params.json')};window.__GAINS__=${JSON.stringify(gains)};window.__MODEL_CUT__="${cut}";window.__MODEL_PLAIN__="${plain}";</script><script>${js}</script>`;
  const htmlPath = path.join(work, '_shots.html'); fs.writeFileSync(htmlPath, html);
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 320, height: 320 } })).newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('console', m.type(), m.text().slice(0, 240)); });
  await page.goto('file://' + htmlPath);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const allIds = await page.evaluate(() => window.SHOT_IDS);
  const { CONFIG } = await import(path.join(root, 'src/config.js'));

  if (flag('--calibrate')) {
    const out = {};
    for (const c of CONFIG.colors) {   // minimise the colour difference directly: a coarse log scan, then a finer scan around the best (tone mapping shifts hue a little, so matching brightness alone is not enough)
      const id = `plain-3q-${c.id}`, want = hexToRgb(c.hex); let best = null;
      const tryK = async (k) => { const { rgb } = await page.evaluate(([i, g]) => window.sampleShot(i, g), [id, k]); const err = dE(rgb, want); if (!best || err < best.err) best = { k, rgb, err }; };
      for (let i = 0; i < 16; i++) await tryK(0.06 * Math.pow(2.6 / 0.06, i / 15));
      const k0 = best.k; for (let i = -6; i <= 6; i++) if (i) await tryK(k0 * Math.pow(1.12, i / 3));
      out[c.hex.toLowerCase()] = +best.k.toFixed(4);
      console.log(c.id.padEnd(10), c.hex, '-> sampled', toHex(best.rgb), 'dE', best.err.toFixed(1), 'gain', best.k.toFixed(3));
    }
    fs.writeFileSync(GAINS_FILE, JSON.stringify(out, null, 2) + '\n'); console.log('wrote', path.relative(root, GAINS_FILE));
    await browser.close(); fs.rmSync(work, { recursive: true, force: true }); return;
  }

  if (flag('--check')) {
    const rows = [];
    for (const c of CONFIG.colors) for (const m of ['plain', 'cutout']) {
      const { rgb } = await page.evaluate((i) => window.sampleShot(i), `${m}-3q-${c.id}`);
      rows.push({ colour: c.name, id: c.id, model: m, target: c.hex.toLowerCase(), sampled: toHex(rgb), dE: +dE(rgb, hexToRgb(c.hex)).toFixed(1) });
    }
    console.table(rows); fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/colour-accuracy.json'), JSON.stringify(rows, null, 2) + '\n'); console.log('wrote docs/colour-accuracy.json');
    await browser.close(); fs.rmSync(work, { recursive: true, force: true }); return;
  }

  const ids = ONLY.length ? ONLY : allIds;
  for (const id of ids) if (!allIds.includes(id)) throw new Error('unknown shot id ' + id);
  const ss = PREVIEW ? 1 : 2, t0 = Date.now();
  for (const id of ids) {
    for (const pass of ['stand', 'shadow']) {
      const url = await page.evaluate(([i, p, s]) => window.renderShot(i, p, s), [id, pass, ss]);
      fs.writeFileSync(path.join(work, `${id}.${pass}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('rendered', id, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close(); fs.unlinkSync(htmlPath);
  const dest = PREVIEW || path.join(root, 'assets', 'renders'); fs.mkdirSync(dest, { recursive: true });
  execFileSync('python3', [path.join(__dirname, 'finish_shots.py'), work, dest, ...(PREVIEW ? ['--preview'] : [])], { stdio: 'inherit' });
  fs.rmSync(work, { recursive: true, force: true });
  console.log('wrote', ids.length, 'pictures to', dest);
})();
