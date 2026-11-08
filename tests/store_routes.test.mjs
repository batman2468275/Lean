import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { DEFAULT, parseQuery, toQuery, sanitize, loadSession, saveSession, STORAGE_KEY } from '../src/store.js';
import { resolve, routeMeta, PAGE_LIST, REDIRECTS } from '../src/routes.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('URL query sets the state: /customize?model=cutout&color=sky&magsafe=1', () => {
  const s = parseQuery(CONFIG, '?model=cutout&color=sky&magsafe=1&phone=large&logo=text&text=ACME&place=back&size=60&qty=3');
  assert.deepEqual(s, { variant: 'cutout', colorId: 'sky', magsafe: true, phone: 'large', mode: 'text', text: 'ACME', place: 'back', size: 60, qty: 3 });
  assert.equal(parseQuery(CONFIG, '?model=regular').variant, 'plain');
});
test('bad or hostile query values are dropped or clamped, never trusted', () => {
  const s = parseQuery(CONFIG, '?model=evil&color=custom&phone=huge&logo=image&place=top&size=9999&qty=-4&text=' + 'x'.repeat(100));
  assert.equal(s.variant, undefined); assert.equal(s.colorId, undefined); assert.equal(s.phone, undefined); assert.equal(s.mode, undefined); assert.equal(s.place, undefined);
  assert.equal(s.size, 100); assert.equal(s.qty, 1); assert.equal(s.text.length, 20);
  assert.deepEqual(parseQuery(CONFIG, ''), {});
});
test('toQuery writes only what differs from the defaults, and round-trips', () => {
  assert.equal(toQuery({ ...DEFAULT }), '');
  const st = { ...DEFAULT, variant: 'plain', colorId: 'sky', magsafe: true, phone: 'small', qty: 2 };
  const q = toQuery(st); assert.equal(q, '?model=plain&color=sky&magsafe=1&phone=small&qty=2');
  assert.deepEqual(parseQuery(CONFIG, q), { variant: 'plain', colorId: 'sky', magsafe: true, phone: 'small', qty: 2 });
  assert.ok(!toQuery({ ...DEFAULT, phone: 'large' }).includes('phone'), 'phone is only meaningful with MagSafe');
});
test('session storage round-trips state and bag; garbage or blocked storage gives defaults', () => {
  const st = memory(); const bag = [{ variant: 'plain', color: 'sky', magsafe: false, mode: 'brand', text: '', place: 'front', size: 85, qty: 2 }];
  assert.ok(saveSession(st, { ...DEFAULT, colorId: 'orange' }, bag));
  const got = loadSession(CONFIG, st); assert.equal(got.state.colorId, 'orange'); assert.equal(got.bag.length, 1);
  st.setItem(STORAGE_KEY, '{not json'); assert.deepEqual(loadSession(CONFIG, st), { state: {}, bag: [] });
  assert.deepEqual(loadSession(CONFIG, { getItem() { throw new Error('blocked'); } }), { state: {}, bag: [] });
  assert.equal(saveSession({ setItem() { throw new Error('blocked'); } }, DEFAULT, []), false);
  st.setItem(STORAGE_KEY, JSON.stringify({ state: { colorId: 'custom' }, bag: [{ variant: 'nope', color: 'sky', qty: 1 }, { variant: 'plain', color: 'black', qty: 0 }] }));
  const bad = loadSession(CONFIG, st); assert.deepEqual(bad.state, {}); assert.equal(bad.bag.length, 0);
});

test('seven real pages, two footer-only ones and the hidden suggestions admin', () => { assert.equal(PAGE_LIST.length, 10); assert.equal(PAGE_LIST[9], '/admin/suggestions'); assert.deepEqual(PAGE_LIST.slice(0, 7), ['/', '/models', '/design', '/colors', '/customize', '/about', '/suggestions']); });
test('every page has a title and description, and prices in them come from CONFIG', () => {
  const meta = routeMeta(CONFIG);
  for (const p of PAGE_LIST) { assert.ok(meta[p].title.length > 3 && meta[p].description.length > 10, p); assert.ok(!/\$\d/.test(meta[p].description.replace('$5.99', '')), 'no hand-typed price in ' + p); }
  assert.match(meta['/'].description, /From \$5\.99/); assert.match(meta['/'].description, /5 colors/);
});
test('resolve: canonical routes, trailing slashes, query and hash kept', () => {
  assert.deepEqual(resolve('/models/'), { route: '/models', search: '', hash: '', known: true });
  assert.deepEqual(resolve('/customize?color=sky#order'), { route: '/customize', search: '?color=sky', hash: '#order', known: true });
  assert.equal(resolve('/index.html').route, '/'); assert.equal(resolve('').route, '/');
});
test('resolve: old URLs from the brief redirect to the page that holds that story', () => {
  assert.equal(resolve('/buy?model=cutout&color=sky&magsafe=1').route, '/customize');
  assert.equal(resolve('/buy?model=cutout&color=sky&magsafe=1').search, '?model=cutout&color=sky&magsafe=1');
  assert.equal(resolve('/buy').hash, '#order');
  assert.deepEqual([resolve('/charging').route, resolve('/charging').hash], ['/models', '#cutout']);
  assert.deepEqual([resolve('/magsafe').route, resolve('/magsafe').hash], ['/models', '#magsafe']);
  assert.deepEqual([resolve('/specs').route, resolve('/specs').hash], ['/design', '#specs']);
  for (const [from, to] of Object.entries(REDIRECTS)) assert.ok(PAGE_LIST.includes(new URL(to, 'https://x.y').pathname), from + ' -> ' + to);
});
test('resolve: unknown paths are a 404, not the home page', () => { assert.deepEqual(resolve('/nope'), { route: '/404', search: '', hash: '', known: false }); assert.equal(resolve('/models/extra').route, '/404'); });
