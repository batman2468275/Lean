// Studio + order flow on /customize: model toggle, colours, logo modes, price, bag.   usage: node tools/interact.cjs [outDir]
const { launch, withSite } = require('./launch.cjs');
const SP = process.argv[2] || '.';
(async () => { await withSite(async (base) => {
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => { window.__NOSMOOTH = true; });
  await page.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('console error', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(base + '/customize'); await page.waitForFunction(() => document.documentElement.classList.contains('ready')); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SP}/i_0_cutout_default.png` });
  console.log('default:', await page.innerText('#cz-price'), '|', await page.textContent('#cz-tag'), '|', await page.textContent('#cz-price-note'), '| colour:', await page.textContent('#cz-cname'));
  console.log('swatches:', await page.$$eval('#cz-sw .sw', (e) => e.map((x) => x.dataset.id).join(',')), '| custom picker present:', await page.locator('.sw.custom, input[type=color]').count());
  console.log('stale text on page:', await page.evaluate(() => [/Electric/, /Graphite/, /Ocean/, /\bRose\b/, /7\.99/, /\bCustom\b/].filter((r) => r.test(document.body.innerText)).map(String)));
  await page.click('#cz-variant [data-v=plain]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/i_1_regular.png` });
  console.log('regular:', await page.innerText('#cz-price'), '|', await page.textContent('#cz-vname'), '| tag hidden:', await page.$eval('#cz-tag', (e) => e.hidden));
  await page.click('#cz-sw [data-id=orange]'); await page.click('#cz-mode [data-m=text]'); await page.fill('#in-text', 'ACME'); await page.click('#cz-place [data-p=back]');
  await page.waitForTimeout(2500); await page.screenshot({ path: `${SP}/i_2_regular_text_back.png` });
  console.log('image mode button present:', await page.locator('#cz-mode [data-m=image]').count(), '| file input:', await page.locator('input[type=file]').count());
  await page.click('#cz-variant [data-v=cutout]'); await page.click('#cz-mode [data-m=brand]'); await page.click('#cz-place [data-p=front]');
  for (const id of ['sky', 'black', 'arctic', 'orange', 'mistletoe']) { await page.click(`#cz-sw [data-id=${id}]`); await page.waitForTimeout(1800); await page.screenshot({ path: `${SP}/i_3_cutout_${id}.png` }); }
  console.log('cname:', await page.textContent('#cz-cname'), 'price:', await page.innerText('#cz-price'));
  await page.click('a[href="#order"]'); await page.waitForTimeout(1500);
  console.log('gallery:', await page.evaluate(() => ({ main: document.querySelector('#gal-main').complete && document.querySelector('#gal-main').naturalWidth, thumbs: [...document.querySelectorAll('#gal-thumbs img')].map((i) => i.naturalWidth), cap: document.querySelector('#gal-cap').textContent, matrix: document.querySelector('#tint-m').getAttribute('values') })));
  await page.screenshot({ path: `${SP}/i_4a_order_top.png` });
  await page.click('#gal-thumbs button:nth-child(3)'); await page.waitForTimeout(500); await page.screenshot({ path: `${SP}/i_4b_order_detail.png` });
  await page.click('#q-p'); await page.click('#add'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${SP}/i_4_order.png` });
  console.log('toast:', (await page.textContent('#toast')).replace(/\s+/g, ' '));
  console.log('total:', await page.innerText('#b-total'), 'bag:', await page.textContent('#bag-n'), '| choice:', await page.textContent('#b-choice'), '| lines:', (await page.textContent('#b-lines')).replace(/\s+/g, ' '));
  await browser.close();
}); })();
