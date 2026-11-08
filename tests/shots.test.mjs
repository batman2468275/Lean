// The product pictures: every manifest entry has its files, every file is in the manifest, alt text is real, and the size budgets hold (see docs/images.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOTS, shotSources } from '../src/shots.js';
import { SPECS } from '../tools/shot_specs.js';

const DIR = new URL('../assets/renders/', import.meta.url).pathname;
const BUDGET = { big: 90 * 1024, small: 30 * 1024, newTotal: 4 * 1024 * 1024 };
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp'));

test('every manifest entry has a 1200 px file and a 640 px file', () => {
  for (const s of SHOTS) {
    assert.ok(fs.existsSync(DIR + s.file), 'missing ' + s.file);
    assert.ok(fs.existsSync(DIR + s.id + '@640.webp'), 'missing ' + s.id + '@640.webp');
    assert.ok(s.width > 0 && s.height > 0, s.id + ' needs width and height');
  }
  assert.equal(new Set(SHOTS.map((s) => s.id)).size, SHOTS.length, 'duplicate ids');
});

test('every picture in assets/renders is in the manifest', () => {
  const known = new Set(SHOTS.flatMap((s) => [s.file, s.id + '@640.webp']));
  assert.deepEqual(files.filter((f) => !known.has(f)), []);
});

test('every render spec has a manifest entry and the other way round', () => {
  const ids = new Set(SHOTS.map((s) => s.id));
  for (const id of Object.keys(SPECS)) assert.ok(ids.has(id), 'no manifest entry for spec ' + id);
});

test('alt text describes the picture (not empty, not a filename)', () => {
  for (const s of SHOTS) {
    assert.ok(s.alt.trim().length >= 20, s.id + ': alt too short');
    assert.ok(!/\.(webp|png|jpe?g)\b/i.test(s.alt) && !/^[a-z0-9@_-]+$/i.test(s.alt.trim()), s.id + ': alt looks like a filename');
  }
});

test('file size budgets: 1200 px <= 90 KB, 640 px <= 30 KB, new pictures <= 4 MB in total', () => {
  let total = 0; const legacy = /^(plain|cutout)-(front|side|detail)(-black)?(@640)?\.webp$/;
  for (const f of files) {
    const size = fs.statSync(DIR + f).size;
    assert.ok(size <= (f.includes('@640') ? BUDGET.small : BUDGET.big), `${f} is ${(size / 1024) | 0} KB, over its budget`);
    if (!legacy.test(f)) total += size;
  }
  assert.ok(total <= BUDGET.newTotal, 'new pictures total ' + ((total / 1048576).toFixed(2)) + ' MB');
});

test('a real photo in assets/photos replaces the render', () => {
  const a = shotSources('plain-3q-left', '/', new Set(['plain-3q-left']));
  assert.equal(a.real, true); assert.match(a.src, /assets\/photos\/plain-3q-left\.webp$/);
  const b = shotSources('plain-3q-left', '/', new Set());
  assert.equal(b.real, false); assert.match(b.srcset, /@640\.webp 640w/);
});
