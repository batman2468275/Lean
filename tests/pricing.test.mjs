// Bag maths. Run: npm test
// The expected figures below are the agreed launch prices (written out on purpose: if CONFIG drifts from the spec, these fail).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { unitPrice, fromPrice, lineTotal, bagTotals, addToBag, money, variantOf } from '../src/pricing.js';

const m = (c) => money(CONFIG, c);
const line = (o) => ({ variant: 'plain', color: 'mistletoe', magsafe: false, mode: 'brand', text: '', place: 'front', size: 85, qty: 1, ...o });

test('config: exactly five colours, none custom, cycle matches', () => {
  assert.deepEqual(CONFIG.colors.map((c) => c.id), ['mistletoe', 'black', 'arctic', 'sky', 'orange']);
  assert.equal(CONFIG.colors.find((c) => c.id === 'mistletoe').hex.toLowerCase(), '#5f7f3b');
  assert.equal(CONFIG.colors.find((c) => c.id === 'black').hex.toLowerCase(), '#17181a');
  assert.equal(CONFIG.colors.find((c) => c.id === 'sky').hex.toLowerCase(), '#7ec8f2');
  assert.equal(CONFIG.defaultColor, 'mistletoe');
  assert.deepEqual(CONFIG.cycle, ['black', 'arctic', 'sky', 'orange', 'mistletoe']);
  assert.deepEqual([...CONFIG.cycle].sort(), CONFIG.colors.map((c) => c.id).sort());
});

test('Regular: $5.99, no list price', () => {
  const u = unitPrice(CONFIG, { variant: 'plain' });
  assert.equal(u.now, 599); assert.equal(u.list, null); assert.equal(u.save, 0);
});

test('With cutout: $8.49 now, $9.99 list, save $1.50', () => {
  const u = unitPrice(CONFIG, { variant: 'cutout' });
  assert.equal(u.now, 849); assert.equal(u.list, 999); assert.equal(u.save, 150);
});

test('MagSafe is +$1.50 and is not discounted', () => {
  const reg = unitPrice(CONFIG, { variant: 'plain', addons: ['magsafe'] });
  assert.equal(reg.now, 749); assert.equal(m(reg.now), '$7.49'); assert.equal(reg.list, null);
  const cut = unitPrice(CONFIG, { variant: 'cutout', addons: ['magsafe'] });
  assert.equal(cut.now, 999); assert.equal(m(cut.now), '$9.99'); assert.equal(cut.list, 1149); assert.equal(m(cut.list), '$11.49');
  assert.equal(cut.save, 150);   // same saving as without the add-on
});

test('From price is the cheapest model', () => { assert.equal(fromPrice(CONFIG), 599); assert.equal(m(fromPrice(CONFIG)), '$5.99'); });

test('line totals scale with quantity (both models, with and without MagSafe)', () => {
  assert.equal(lineTotal(CONFIG, line({ variant: 'plain', qty: 3 })).now, 1797);
  assert.equal(lineTotal(CONFIG, line({ variant: 'plain', qty: 3, magsafe: true })).now, 2247);
  const c = lineTotal(CONFIG, line({ variant: 'cutout', qty: 2 }));
  assert.deepEqual([c.now, c.list, c.save], [1698, 1998, 300]);
  const cm = lineTotal(CONFIG, line({ variant: 'cutout', qty: 2, magsafe: true }));
  assert.deepEqual([cm.now, cm.list, cm.save], [1998, 2298, 300]);
});

test('bag totals mix models and add-ons; list total falls back to the real price where there is no list price', () => {
  const lines = [line({ variant: 'plain', qty: 2 }), line({ variant: 'cutout', qty: 1, magsafe: true }), line({ variant: 'plain', magsafe: true, qty: 1 })];
  const t = bagTotals(CONFIG, lines);
  assert.equal(t.count, 4);
  assert.equal(t.now, 2 * 599 + 999 + 749);     // 2946
  assert.equal(t.list, 2 * 599 + 1149 + 749);   // 3096
  assert.equal(t.save, 150);
  assert.equal(t.list - t.now, t.save);
});

test('empty bag is all zeros', () => { assert.deepEqual(bagTotals(CONFIG, []), { count: 0, now: 0, list: 0, save: 0 }); });

test('showListPrice off hides every list price and saving', () => {
  const cfg = { ...CONFIG, showListPrice: false };
  const u = unitPrice(cfg, { variant: 'cutout', addons: ['magsafe'] });
  assert.equal(u.now, 999); assert.equal(u.list, null); assert.equal(u.save, 0);
  assert.equal(bagTotals(cfg, [line({ variant: 'cutout', qty: 2 })]).save, 0);
});

test('a list price that is not above the price is ignored', () => {
  const cfg = { ...CONFIG, variants: [{ id: 'plain', name: 'Regular', price: 5.99, listPrice: 5.99 }] };
  assert.equal(unitPrice(cfg, { variant: 'plain' }).list, null);
});

test('no floating-point drift (e.g. 8.49 x 3)', () => {
  assert.equal(lineTotal(CONFIG, line({ variant: 'cutout', qty: 3 })).now, 2547);
  assert.equal(money(CONFIG, 2547), '$25.47');
});

test('addToBag merges identical lines and keeps different ones apart', () => {
  let bag = [];
  bag = addToBag(bag, line({ qty: 1 }));
  bag = addToBag(bag, line({ qty: 2 }));
  assert.equal(bag.length, 1); assert.equal(bag[0].qty, 3);
  bag = addToBag(bag, line({ magsafe: true }));
  bag = addToBag(bag, line({ color: 'sky' }));
  bag = addToBag(bag, line({ mode: 'text', text: 'ACME' }));
  assert.equal(bag.length, 4);
  assert.equal(bagTotals(CONFIG, bag).count, 6);
});

test('unknown ids throw rather than silently pricing at zero', () => {
  assert.throws(() => variantOf(CONFIG, 'nope'));
  assert.throws(() => unitPrice(CONFIG, { variant: 'plain', addons: ['nope'] }));
});

/* ---------- MagSafe: sizes, files, tickets ---------- */
import { stlFile, ticket, magsafeLabel } from '../src/order.js';
import fs from 'node:fs';

test('three phone sizes in CONFIG match the geometry that was generated (build/magsafe.json)', () => {
  const mj = JSON.parse(fs.readFileSync(new URL('../build/magsafe.json', import.meta.url)));
  assert.deepEqual(CONFIG.phoneSizes.map((p) => p.id), ['small', 'medium', 'large']);
  assert.deepEqual(Object.keys(mj.sizes), CONFIG.phoneSizes.map((p) => p.id));
  assert.ok(CONFIG.phoneSizes.some((p) => p.id === CONFIG.defaultPhoneSize));
  for (const p of CONFIG.phoneSizes) for (const v of CONFIG.variants) {
    const f = stlFile(CONFIG, { variant: v.id, magsafe: true, phone: p.id });
    assert.ok(fs.existsSync(new URL('../models/' + f, import.meta.url)), 'missing print file ' + f);
    assert.equal(mj.sizes[p.id].files[v.file], f);
  }
});

test('stlFile picks the plain file without MagSafe and the sized file with it', () => {
  assert.equal(stlFile(CONFIG, line({ variant: 'plain' })), 'lean-regular.stl');
  assert.equal(stlFile(CONFIG, line({ variant: 'cutout' })), 'lean-cutout.stl');
  assert.equal(stlFile(CONFIG, line({ variant: 'cutout', magsafe: true, phone: 'large' })), 'lean-cutout-magsafe-large.stl');
  assert.equal(stlFile(CONFIG, line({ variant: 'plain', magsafe: true, phone: 'small' })), 'lean-regular-magsafe-small.stl');
  assert.throws(() => stlFile(CONFIG, line({ magsafe: true })));          // MagSafe without a size is an error
});

test('ticket names MagSafe, the size and the right STL', () => {
  const t = ticket(CONFIG, line({ variant: 'cutout', magsafe: true, phone: 'medium', color: 'black', qty: 2 }));
  assert.equal(t.magsafe, true); assert.equal(t.stl, 'lean-cutout-magsafe-medium.stl'); assert.equal(t.phoneSize, 'medium');
  assert.equal(t.color, 'Black'); assert.equal(t.qty, 2); assert.match(t.magnets, /N52/);
  const plainT = ticket(CONFIG, line({ variant: 'plain' }));
  assert.equal(plainT.magsafe, false); assert.equal(plainT.phoneSize, undefined);
  assert.match(magsafeLabel(CONFIG, line({ magsafe: true, phone: 'small' })), /MagSafe, Small/);
});

test('bag lines with different phone sizes stay separate, and MagSafe prices do not depend on size', () => {
  let bag = addToBag([], line({ magsafe: true, phone: 'small' }));
  bag = addToBag(bag, line({ magsafe: true, phone: 'large' }));
  bag = addToBag(bag, line({ magsafe: true, phone: 'small' }));
  assert.equal(bag.length, 2); assert.equal(bag.find((l) => l.phone === 'small').qty, 2);
  assert.equal(bagTotals(CONFIG, bag).now, 3 * 749);
});
