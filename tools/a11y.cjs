// Structure and keyboard pass over every page (what a screen reader and a keyboard user meet). Lighthouse/axe covers rule-based checks; this covers the rest.
//   node tools/a11y.cjs
// Per page: one h1, no skipped heading levels, landmarks, unnamed controls, images without alt, a skip link, a tab order that reaches content, a visible focus ring on every stop.
const { launch, withSite } = require('./launch.cjs');
const ROUTES = ['/', '/models', '/design', '/colors', '/customize', '/about', '/suggestions', '/shipping-returns', '/privacy', '/admin/suggestions', '/nope'];
let fails = 0;
const ok = (c, m, d = '') => { if (!c) { fails++; console.log('FAIL ' + m + (d ? '  ' + d : '')); } return c; };
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    for (const route of ROUTES) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 40000 });
      await page.waitForTimeout(800);
      const r = await page.evaluate(() => {
        const vis = (e) => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !e.closest('[hidden],[aria-hidden="true"]'); };
        const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter(vis).map((h) => +h.tagName[1]);
        const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent || e.getAttribute('title') || '').trim();
        const unnamed = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea')].filter(vis).filter((e) => !name(e) && !(e.labels && e.labels.length) && e.type !== 'range').map((e) => e.outerHTML.slice(0, 90));
        const noalt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(-40));
        const unlabelledInputs = [...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(vis).filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map((e) => e.outerHTML.slice(0, 90));
        return { h1: hs.filter((x) => x === 1).length, skip: hs.some((h, i) => i && h > hs[i - 1] + 1), hs: hs.join(''), main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav').length, footer: document.querySelectorAll('footer').length, lang: document.documentElement.lang, unnamed, noalt, unlabelledInputs, skipLink: !!document.querySelector('a.skip, a[href="#view"], a[href="#main"]') };
      });
      ok(r.h1 === 1, `${route}: exactly one visible h1`, `found ${r.h1} (levels ${r.hs})`);
      ok(!r.skip, `${route}: no skipped heading levels`, r.hs);
      ok(r.main === 1 && r.nav >= 1 && r.footer === 1, `${route}: landmarks main/nav/footer`, JSON.stringify({ m: r.main, n: r.nav, f: r.footer }));
      ok(r.lang === 'en', `${route}: html lang`);
      ok(r.unnamed.length === 0, `${route}: every control has a name`, r.unnamed.join(' | '));
      ok(r.noalt.length === 0, `${route}: every img has alt`, r.noalt.join(','));
      ok(r.unlabelledInputs.length === 0, `${route}: every field has a label`, r.unlabelledInputs.join(' | '));
      ok(r.skipLink, `${route}: a skip link exists`);
      // keyboard: tab through up to 60 stops, each must show a focus ring and none may be off screen forever
      let stops = 0, noRing = [];
      await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); const ring = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) || c.boxShadow !== 'none'; return { tag: e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), ring, kb: e.matches(':focus-visible') }; });
        if (!s) break; stops++; if (!s.ring) noRing.push(s.tag);
      }
      ok(stops >= 3, `${route}: Tab reaches the page (${stops} stops)`);
      ok(noRing.length === 0, `${route}: every tab stop has a visible focus ring`, noRing.join(', '));
    }
    // mobile menu by keyboard
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 40000 });
    const btn = page.locator('#menu, .menu-btn, button[aria-controls]').first();
    await btn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    const open = await btn.getAttribute('aria-expanded');
    ok(open === 'true', 'mobile menu opens with Enter and reports aria-expanded', String(open));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    ok((await btn.getAttribute('aria-expanded')) === 'false', 'Escape closes the mobile menu');
    await browser.close();
  });
  console.log(fails ? `\n${fails} a11y check(s) FAILED` : '\nall a11y structure and keyboard checks passed');
  process.exit(fails ? 1 : 0);
})();
