// Router test: one persistent canvas, back/forward, deep links, redirects, shared state, per-page titles.   usage: node tools/navtest.cjs
const { launch, withSite } = require('./launch.cjs');
let failed = 0;
const ok = (cond, msg, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra ? '  ' + extra : '')); if (!cond) failed++; };
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 30000 });
    const route = () => page.evaluate(() => window.LEAN.route());
    const settle = async (r) => { await page.waitForFunction((r) => window.LEAN.route() === r && !document.getElementById('view').classList.contains('view-out'), r, { timeout: 15000 }); await page.waitForTimeout(300); };

    // ---- 1. a persistent canvas across client-side navigation ----
    await page.goto(base + '/'); await ready();
    await page.evaluate(() => { document.getElementById('gl').dataset.keep = 'yes'; window.__noReload = 1; });
    const builds0 = await page.evaluate(() => window.__SCENE_BUILDS);
    ok(builds0 === 1, 'scene built once at boot', 'builds=' + builds0);
    const pose0 = await page.evaluate(() => window.LEAN.pose());
    const trail = [['/models', 'Models'], ['/design', 'Design'], ['/colors', 'Colors'], ['/customize', 'Customize'], ['/about', 'About'], ['/suggestions', 'Suggestions']];
    for (const [r] of trail) { await page.click(`#tabs a[data-route="${r}"]`); await settle(r); }
    await page.click('footer a[href="/privacy"]'); await settle('/privacy');
    await page.click('footer a[href="/shipping-returns"]'); await settle('/shipping-returns');
    await page.click('.brand'); await settle('/');
    const after = await page.evaluate(() => ({ keep: document.getElementById('gl').dataset.keep, noReload: window.__noReload, builds: window.__SCENE_BUILDS, canvases: document.querySelectorAll('canvas#gl').length, path: location.pathname }));
    ok(after.keep === 'yes' && after.noReload === 1, 'same canvas element, no page reload, after visiting all 9 pages');
    ok(after.builds === 1, 'WebGL scene never rebuilt while navigating', 'builds=' + after.builds);
    ok(after.canvases === 1 && after.path === '/', 'one canvas, back on /');

    // ---- 2. (glide: see section 8, it needs a page that is not in instant mode) ----

    // ---- 3. titles, descriptions, active link ----
    const meta = {};
    for (const r of ['/', '/models', '/design', '/colors', '/customize', '/about', '/suggestions', '/shipping-returns', '/privacy']) {
      await page.evaluate((r) => window.LEAN.go(r), r); await settle(r);
      meta[r] = await page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]').content, active: document.querySelector('#tabs a.active')?.getAttribute('href') || null }));
    }
    ok(new Set(Object.values(meta).map((m) => m.title)).size === 9, 'every page has its own title', Object.values(meta).map((m) => m.title).join(' | '));
    ok(Object.values(meta).every((m) => m.desc.length > 10), 'every page has a meta description');
    ok(meta['/models'].active === '/models' && meta['/privacy'].active === null, 'nav highlights the current page (and none on the footer-only pages)');

    // ---- 4. back / forward ----
    await page.evaluate(() => window.LEAN.go('/')); await settle('/');
    await page.click('#tabs a[data-route="/models"]'); await settle('/models');
    await page.click('#tabs a[data-route="/colors"]'); await settle('/colors');
    await page.goBack(); await settle('/models'); ok(new URL(page.url()).pathname === '/models', 'back goes to /models');
    await page.goBack(); await settle('/'); ok(new URL(page.url()).pathname === '/', 'back goes to /');
    await page.goForward(); await settle('/models'); ok(await route() === '/models', 'forward goes to /models');

    // ---- 5. shared state survives navigation, and is saved for the session ----
    await page.click('#tabs a[data-route="/customize"]'); await settle('/customize');
    await page.click('#cz-sw [data-id=sky]'); await page.click('#cz-magsafe'); await page.click('#cz-phone [data-phone=large]'); await page.click('#q-p');
    const q = await page.evaluate(() => location.search);
    ok(q === '?color=sky&magsafe=1&phone=large&qty=2', 'customize URL describes the choices', q);
    await page.click('#tabs a[data-route="/about"]'); await settle('/about');
    await page.click('#tabs a[data-route="/customize"]'); await settle('/customize');
    const st = await page.evaluate(() => window.LEAN.state());
    ok(st.colorId === 'sky' && st.magsafe === true && st.phone === 'large' && st.qty === 2, 'colour, MagSafe, size and quantity survive navigation', JSON.stringify({ c: st.colorId, m: st.magsafe, p: st.phone, q: st.qty }));
    await page.click('#add'); await page.waitForTimeout(300);
    await page.reload(); await ready();
    const st2 = await page.evaluate(() => ({ s: window.LEAN.state(), t: window.LEAN.tickets() }));
    ok(st2.s.bag.length === 1 && st2.s.colorId === 'sky', 'bag and choices survive a reload (sessionStorage)', JSON.stringify(st2.t.map((x) => x.stl)));

    // ---- 6. deep links and redirects ----
    const fresh = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await fresh.addInitScript(() => { window.__NOSMOOTH = true; });
    await fresh.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    const where = async (u) => { await fresh.goto(base + u); await fresh.waitForFunction(() => document.documentElement.classList.contains('ready')); await fresh.waitForTimeout(500); return fresh.evaluate(() => ({ route: window.LEAN.route(), url: location.pathname + location.search + location.hash, s: window.LEAN.state() })); };
    let r = await where('/customize?model=plain&color=sky&magsafe=1&phone=small');
    ok(r.route === '/customize' && r.s.variant === 'plain' && r.s.colorId === 'sky' && r.s.magsafe && r.s.phone === 'small', 'deep link /customize?model=plain&color=sky&magsafe=1&phone=small sets the state');
    r = await where('/buy?model=cutout&color=sky&magsafe=1');
    ok(r.route === '/customize' && r.url.startsWith('/customize?') && r.url.endsWith('#order') && r.s.colorId === 'sky', '/buy?... redirects to /customize and keeps the options', r.url);
    r = await where('/charging'); ok(r.route === '/models' && r.url.endsWith('#cutout'), '/charging -> /models#cutout', r.url);
    r = await where('/magsafe'); ok(r.route === '/models' && r.url.endsWith('#magsafe'), '/magsafe -> /models#magsafe', r.url);
    r = await where('/specs'); ok(r.route === '/design' && r.url.endsWith('#specs'), '/specs -> /design#specs', r.url);
    r = await where('/nope'); ok(r.route === '/404' && (await fresh.textContent('#nf h1')).includes("isn't here"), 'unknown path shows the not-found page');
    r = await where('/models/'); ok(r.route === '/models', 'trailing slash is fine');
    // static hosts without rewrites: each route also exists as its own HTML file with the right title
    const html = await (await fetch(base + '/models')).text(); ok(/<title>Models \| Lean<\/title>/.test(html), 'GET /models serves a page with its own <title>');
    const asset = await fetch(base + '/assets/model_cut.bin'); ok(asset.ok && (await asset.arrayBuffer()).byteLength > 1000, 'models are served as files');
    const img = await fetch(base + '/assets/renders/cutout-front.webp'); ok(img.ok && img.headers.get('content-type') === 'image/webp', 'product images are served as files, not inlined');

    await fresh.close(); await page.close();
    // ---- 7. mobile menu ----
    const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await m.addInitScript(() => { window.__NOSMOOTH = true; });
    await m.route((u) => !u.href.startsWith('http://127.0.0.1'), (r2) => r2.abort());
    await m.goto(base + '/'); await m.waitForFunction(() => document.documentElement.classList.contains('ready')); await m.waitForTimeout(500);
    await m.tap('#menu-btn'); const open = await m.getAttribute('#menu-btn', 'aria-expanded');
    await m.tap('#tabs a[data-route="/colors"]'); await m.waitForFunction(() => window.LEAN.route() === '/colors'); await m.waitForTimeout(300);
    ok(open === 'true' && await m.getAttribute('#menu-btn', 'aria-expanded') === 'false' && await m.evaluate(() => window.LEAN.route()) === '/colors', 'mobile menu opens, navigates and closes');

    await m.close();

    // ---- 8. the stand glides between pages (a page without the test-mode instant switch) ----
    const g = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
    await g.route((u) => !u.href.startsWith('http://127.0.0.1'), (r2) => r2.abort());
    await g.goto(base + '/'); await g.waitForFunction(() => document.documentElement.classList.contains('ready')); await g.waitForTimeout(1500);
    const p0 = await g.evaluate(() => window.LEAN.pose());
    await g.evaluate(() => window.LEAN.go('/design')); await g.waitForFunction(() => window.LEAN.route() === '/design', null, { timeout: 15000 });
    await g.waitForTimeout(300); const p1 = await g.evaluate(() => window.LEAN.pose());
    await g.waitForTimeout(9000); const p2 = await g.evaluate(() => window.LEAN.pose());
    const d = (a, b) => Math.abs(a.rotY - b.rotY) + Math.abs(a.dist - b.dist) / 100;
    ok(d(p1, p0) < d(p2, p0) && d(p1, p2) > 0.05, 'stand glides to the next page (starts near where it was, ends at the new pose)', `from rotY ${p0.rotY.toFixed(2)} -> just after ${p1.rotY.toFixed(2)} -> later ${p2.rotY.toFixed(2)}`);
    await g.close();

    ok(errors.length === 0, 'no page errors or console errors', errors.slice(0, 3).join(' | '));
    await browser.close();
  });
  console.log(failed ? `\n${failed} FAILED` : '\nall navigation checks passed'); process.exit(failed ? 1 : 0);
})();
