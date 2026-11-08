// MagSafe flow: toggle, three phone sizes, prices, order panel, bag, fulfilment tickets.   usage: node tools/interact_magsafe.cjs [outDir]
const { launch, withSite } = require('./launch.cjs');
const OUT = process.argv[2] || '.';
(async () => { await withSite(async (base) => {
  const b = await launch(); const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => { window.__NOSMOOTH = true; });
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('console error', m.text().slice(0, 400)); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base + '/customize'); await page.waitForFunction(() => document.documentElement.classList.contains('ready')); await page.waitForTimeout(2000);
  const state = async () => ({ price: await page.innerText('#cz-price'), note: await page.textContent('#cz-price-note'), tag: await page.textContent('#cz-tag'), sizeHidden: await page.$eval('#cz-ms-size', (e) => e.hidden), logo: await page.textContent('#b-choice') });
  console.log('off   ', JSON.stringify(await state())); await page.screenshot({ path: `${OUT}/ms_0_off.png` });
  await page.click('#cz-magsafe'); await page.waitForTimeout(1800);
  console.log('on    ', JSON.stringify(await state()), 'aria', await page.getAttribute('#cz-magsafe', 'aria-checked')); await page.screenshot({ path: `${OUT}/ms_1_on_medium.png` });
  for (const sz of ['small', 'large']) { await page.click(`#cz-phone [data-phone=${sz}]`); await page.waitForTimeout(1800); console.log(sz.padEnd(6), JSON.stringify(await state())); await page.screenshot({ path: `${OUT}/ms_2_on_${sz}.png` }); }
  await page.click('#cz-variant [data-v=plain]'); await page.waitForTimeout(800); console.log('regular+ms', JSON.stringify(await state()));
  await page.click('#cz-variant [data-v=cutout]'); await page.click('#cz-phone [data-phone=medium]');
  await page.click('a[href="#order"]'); await page.waitForTimeout(1200);
  console.log('order lines:', (await page.textContent('#b-lines')).replace(/\s+/g, ' '), '| total:', await page.innerText('#b-total'));
  await page.screenshot({ path: `${OUT}/ms_3_order.png` });
  await page.click('#add'); await page.waitForTimeout(500);
  await page.evaluate(() => window.LEAN.go('/customize?model=plain&phone=large&magsafe=1')); await page.waitForTimeout(1200);
  await page.click('#add'); await page.waitForTimeout(500);
  console.log('toast:', (await page.textContent('#toast')).replace(/\s+/g, ' '));
  console.log('tickets:', JSON.stringify(await page.evaluate(() => window.LEAN.tickets().map((t) => ({ stl: t.stl, magsafe: t.magsafe, phoneSize: t.phoneSize, qty: t.qty })))));
  await b.close();
}); })();
