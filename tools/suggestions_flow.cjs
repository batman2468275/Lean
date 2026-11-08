// End-to-end check of the Suggestions board and its admin page in a real browser (throw-away in-memory store, admin token 'test-admin').
//   node tools/suggestions_flow.cjs <outDir>
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.';
let fails = 0;
const ok = (c, m, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d ? '  ' + d : '')); if (!c) fails++; };
(async () => {
  await withSite(async (base) => {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__NOSMOOTH = true; });
    await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    const open = async (route) => { await page.goto(base + route, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 40000 }); };
    const msg = () => page.textContent('#sg-msg');
    const submit = async (text, name = '', web = '') => {
      await page.fill('#sg-text', text); await page.fill('#sg-name', name); await page.fill('#sg-web', web); await page.click('#sg-send');
      await page.waitForFunction(() => document.querySelector('#sg-msg').textContent !== 'Sending...', null, { timeout: 10000 });
      await page.waitForTimeout(300);
    };

    await open('/suggestions');
    await page.waitForSelector('#sg-empty:not([hidden])', { timeout: 10000 });
    ok(true, 'board loads and shows the empty state');
    ok((await page.textContent('#sg-count')) === '0 / 500', 'counter starts at 0');
    await page.fill('#sg-text', 'hello');
    ok((await page.textContent('#sg-count')) === '5 / 500', 'counter follows typing');

    await submit('short');
    ok(/at least 10/.test(await msg()), 'too short is refused in the form', await msg());
    await page.waitForTimeout(3300);
    await submit('Please visit www.cheap-stands.com for more');
    ok(/links/i.test(await msg()), 'links are refused by the server', await msg());
    await page.waitForTimeout(3300);
    await submit('Email me at someone@mail.com about a new base');
    ok(/email/i.test(await msg()), 'email addresses are refused', await msg());
    await page.waitForTimeout(3300);
    await submit('A stand that folds flat for travel bags', 'Sam');
    ok(/Thank you/.test(await msg()), 'a good idea is accepted', await msg());
    ok((await page.$$('#sg-list li')).length === 0, 'it is NOT public until approved');
    await submit('A stand that folds flat for travel bags', 'Sam');
    ok(/take a moment|already/i.test(await msg()), 'sending again at once is refused (fresh token too young, or a duplicate)', await msg());
    await page.waitForTimeout(3300);
    await submit('A stand that FOLDS flat for travel bags!', 'Sam');
    ok(/already suggested/.test(await msg()), 'a duplicate is refused', await msg());
    await page.waitForTimeout(3300);
    await submit('<img src=x onerror=window.__pwned=1> a wider base please', '<b>Bob</b>', '');
    ok(/Thank you/.test(await msg()), 'markup in text is accepted as plain text', await msg());
    await page.waitForTimeout(3300);
    await submit('A bot says hello with a very long idea', 'Bot', 'http://spam.example');
    ok(/Thank you/.test(await msg()), 'honeypot gets a fake success', await msg());

    // ---- admin
    await open('/admin/suggestions');
    ok((await page.title()).startsWith('Suggestions admin'), 'admin page title');
    ok(await page.$eval('#ad-main', (e) => e.hidden), 'the list is hidden before login');
    await page.fill('#ad-token', 'wrong'); await page.click('#ad-login button'); await page.waitForTimeout(800);
    ok(/Wrong or missing/.test(await page.textContent('#ad-msg')), 'wrong token is refused', await page.textContent('#ad-msg'));
    await page.fill('#ad-token', 'test-admin'); await page.click('#ad-login button');
    await page.waitForSelector('#ad-main:not([hidden])', { timeout: 8000 });
    const waiting = await page.$$eval('#ad-list .sg-text', (n) => n.map((x) => x.textContent));
    ok(waiting.length === 2, 'two ideas are waiting (the honeypot one was never stored)', JSON.stringify(waiting));
    await page.screenshot({ path: `${OUT}/sg_admin_desktop.png` });
    for (let i = 0; i < 2; i++) { await page.click('#ad-list .btn.primary'); await page.waitForTimeout(500); }
    ok(await page.$eval('#ad-empty', (e) => !e.hidden), 'approving moves them out of the waiting list');

    // ---- public board now shows them, escaped
    await open('/suggestions');
    await page.waitForSelector('#sg-list li', { timeout: 10000 });
    const items = await page.$$eval('#sg-list .sg-text', (n) => n.map((x) => x.textContent));
    ok(items.length === 2, 'approved ideas are on the board', JSON.stringify(items));
    ok((await page.$$('#sg-list img')).length === 0 && !(await page.evaluate(() => window.__pwned)), 'no markup from a suggestion is ever run');
    ok((await page.$$eval('#sg-list .sg-meta', (n) => n.map((x) => x.textContent))).some((t) => t.startsWith('<b>Bob</b>')), 'names are shown as plain text too');
    const btn = page.locator('#sg-list .sg-vote').first();
    await btn.click(); await page.waitForTimeout(600);
    ok((await btn.getAttribute('aria-pressed')) === 'true' && /1/.test(await btn.textContent()), 'voting counts and the button shows it', await btn.getAttribute('aria-label'));
    ok(await btn.isDisabled(), 'the button cannot be pressed twice');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#sg-list li', { timeout: 40000 });
    ok((await page.locator('#sg-list .sg-vote').first().getAttribute('aria-pressed')) === 'true', 'the vote is remembered after a reload, and top sort puts it first');
    await page.click('#sg-sort [data-sort="new"]'); await page.waitForTimeout(800);
    ok((await page.locator('#sg-sort [data-sort="new"]').getAttribute('aria-pressed')) === 'true', 'sort switch works');
    await page.focus('#sg-text'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    ok((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'sg-send', 'Tab goes idea, name, send (the honeypot is skipped)');
    await page.evaluate(() => document.getElementById('board').scrollIntoView());
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/sg_board_desktop.png` });

    // ---- mobile look
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mp = await m.newPage();
    await mp.addInitScript(() => { window.__NOSMOOTH = true; });
    await mp.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
    await mp.goto(base + '/suggestions', { waitUntil: 'domcontentloaded' });
    await mp.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 40000 });
    await mp.waitForSelector('#sg-list li');
    await mp.evaluate(() => document.getElementById('board').scrollIntoView());
    await mp.waitForTimeout(2500);
    await mp.screenshot({ path: `${OUT}/sg_board_mobile.png` });
    ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on a phone');
    await m.close();

    // ---- static-host behaviour: the API path answers with HTML -> the board says it is offline, no crash
    await page.route('**/api/suggestions**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>app</title>' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#sg-offline:not([hidden])', { timeout: 40000 });
    ok(await page.$eval('#sg-send', (e) => e.disabled), 'offline: the board says so and the send button is disabled');
    ok(errs.length === 0, 'no page errors or console errors', errs.join(' | '));
    await browser.close();
  });
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nall suggestions checks passed');
  process.exit(fails ? 1 : 0);
})();
