// Reduced-motion check: no scrubbing, each beat shows its static end pose, the canvas fades between beats, no intro, no idle sway.
//   node tools/reduced.cjs <outDir>
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.';
(async () => { await withSite(async (base) => {
  const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await page.goto(base + '/models', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const seen = new Set(), poses = [];
  for (const p of [0.05, 0.3, 0.45, 0.6, 0.8, 0.95]) {
    await page.evaluate((p) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)); }, p);
    await page.waitForTimeout(2800);
    const r = await page.evaluate(() => ({ beat: window.LEAN.beat(), pose: window.LEAN.pose(), swap: document.getElementById('gl').classList.contains('swap'), anim: document.getAnimations().filter((a) => a.playState === 'running').length }));
    poses.push(r); console.log(p, r.beat && r.beat.name, 'rotY', r.pose.rotY.toFixed(2), 'dist', r.pose.dist, 'running CSS animations:', r.anim, 'swap:', r.swap);
    if (p === 0.6) await page.screenshot({ path: `${OUT}/reduced_models_0.6.png` });
  }
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close(); }); })();
