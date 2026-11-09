import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, EASES, BASE, KEYS, CAMERA_KEYS, hermite, spring } from '../src/timeline.js';
import home from '../src/timelines/home.js';
import models from '../src/timelines/models.js';
import design from '../src/timelines/design.js';
import colors from '../src/timelines/colors.js';
import customize from '../src/timelines/customize.js';
import about from '../src/timelines/about.js';
import suggestions from '../src/timelines/suggestions.js';
import { CONFIG } from '../src/config.js';

const VH = 900;
/* chapters stacked like the real page: each chapter is h x vh tall and pins for L = h*vh - vh; the next starts right after */
function stack(heights) { let top = 0; const out = {}; for (const [name, h] of Object.entries(heights)) { out[name] = { top, L: Math.max(0, h * VH - VH) }; top += h * VH; } return out; }
/* the chapter heights come from the real page markup (style="--h:N" on each section with data-ch), so the tests always check what ships */
import fs from 'node:fs';
const PAGE_FILE = { '/': 'home', '/models': 'models', '/design': 'design', '/colors': 'colors', '/customize': 'customize', '/about': 'about', '/suggestions': 'suggestions' };
const HEIGHTS = {};
for (const [route, f] of Object.entries(PAGE_FILE)) {
  const html = fs.readFileSync(new URL(`../src/pages/${f}.html`, import.meta.url), 'utf8'); HEIGHTS[route] = {};
  for (const m of html.matchAll(/<section[^>]*data-ch="([\w-]+)"[^>]*style="--h:([\d.]+)"/g)) HEIGHTS[route][m[1]] = +m[2];
}
const SPECS = { '/': home, '/models': models, '/design': design, '/colors': colors, '/customize': customize, '/about': about, '/suggestions': suggestions };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('easings: all named easings start at 0 and end at 1', () => {
  for (const [n, f] of Object.entries(EASES)) { assert.ok(near(f(0), 0, 1e-9) && near(f(1), 1, 1e-6), n); }
  assert.ok(near(EASES.spin(0.37), 0.37), 'spin is linear');
  assert.ok(EASES.settle(0.8) > 1, 'settle overshoots a little (a soft spring)');
  assert.ok(Math.max(...Array.from({ length: 101 }, (_, i) => EASES.settle(i / 100))) < 1.12, 'but only a little');
  assert.ok(near(spring(0), 0) && near(spring(1), 1));
});
test('every page timeline compiles, and every key it names exists in BASE', () => {
  for (const [route, spec] of Object.entries(SPECS)) {
    const tl = compile(spec, stack(HEIGHTS[route]));
    assert.ok(tl.segs.length > 0, route);
    for (const s of tl.segs) for (const k of Object.keys(s.to)) assert.ok(k in BASE, `${route}: unknown pose key ${k}`);
    for (const ch of Object.values(spec.chapters)) for (const b of ch.beats) for (const k of Object.keys(b.pose || {})) assert.ok(k in BASE, `${route}/${b.name}: unknown key ${k}`);
  }
});
test('beats are named, ordered inside 0..1 and do not overlap', () => {
  for (const [route, spec] of Object.entries(SPECS)) for (const [ch, c] of Object.entries(spec.chapters)) {
    let end = 0; const seen = new Set();
    for (const b of [...c.beats].sort((a, b) => a.from - b.from)) {
      assert.ok(b.name && !seen.has(b.name), `${route}/${ch}: duplicate or missing beat name ${b.name}`); seen.add(b.name);
      assert.ok(b.from >= end - 1e-9 && b.to > b.from && b.to <= 1 + 1e-9, `${route}/${ch}/${b.name}: ${b.from}..${b.to} overlaps or is out of range`); end = b.to;
    }
  }
});
test('no jitter or snapping at beat boundaries: every value is continuous across every boundary', () => {
  const out1 = {}, out2 = {};
  for (const [route, spec] of Object.entries(SPECS)) {
    const tl = compile(spec, stack(HEIGHTS[route]));
    for (const s of tl.segs) {
      const eps = 0.01;
      tl.sample(s.y0 + eps, out1); tl.sample(s.y0 - eps, out2);
      if (s.y0 - eps < 0) continue;
      for (const k of KEYS) assert.ok(Math.abs(out1[k] - out2[k]) < 0.5 + Math.abs(out1[k]) * 0.01, `${route} ${s.name} @${s.y0}: ${k} jumps ${out2[k]} -> ${out1[k]}`);
    }
  }
});
test('each beat lands exactly on its declared pose (the spline passes through the knots)', () => {
  const out = {};
  const tl = compile(models, stack(HEIGHTS['/models']));
  const cut = tl.segs.find((s) => s.name === 'cut-sweep'); tl.sample(cut.y1, out);
  assert.equal(out.cut, 1); assert.equal(out.px, 420); assert.equal(out.cx, 0);
  const pair = tl.segs.find((s) => s.name === 'two-bases'); tl.sample(pair.y0, out); assert.equal(out.cut, 0); assert.equal(out.cx, -62); assert.equal(out.px, 62);
  tl.sample(1e9, out); assert.ok(out.snap === 1 && out.mag === 1);
  tl.sample(-5, out); assert.equal(out.cut, 0, 'before the page: its first pose');
});
test('the slot is cut during its own beat, linearly, and stays cut', () => {
  const tl = compile(models, stack(HEIGHTS['/models'])); const out = {}; const r = tl.range('cut-sweep');
  const at = (t) => { tl.sample(r.y0 + t * (r.y1 - r.y0), out); return out.cut; };
  assert.ok(near(at(0), 0) && near(at(0.25), 0.25, 1e-9) && near(at(0.5), 0.5, 1e-9) && near(at(1), 1));
  tl.sample(tl.range('cut-done').y1, out); assert.equal(out.cut, 1);
});
test('colour spin is linear: rotY advances at a constant rate across all colour beats', () => {
  const tl = compile(colors, stack(HEIGHTS['/colors'])); const out = {};
  const r0 = tl.range(CONFIG.cycle[0]), r1 = tl.range(CONFIG.cycle[CONFIG.cycle.length - 1]); let prev = null, rate = null;
  for (let i = 1; i < 40; i++) { tl.sample(r0.y0 + i * (r1.y1 - r0.y0) / 40, out); if (prev !== null) { const d = out.rotY - prev; if (rate === null) rate = d; assert.ok(near(d, rate, 1e-9), 'rotY step ' + i); } prev = out.rotY; }
});
test('one colour beat per colour, in the CONFIG order, each carrying its colour', () => {
  const tl = compile(colors, stack(HEIGHTS['/colors']));
  assert.deepEqual(tl.segs.filter((s) => s.color).map((s) => s.color), CONFIG.cycle);
  assert.deepEqual(tl.names.filter((n) => CONFIG.cycle.includes(n)), CONFIG.cycle);
  assert.deepEqual(tl.names.filter((n) => !CONFIG.cycle.includes(n)), ['intro', 'lineup'], 'an intro and a line-up around the colours');
});
test('beatProgress and active() read the same beat positions the camera uses', () => {
  const tl = compile(design, stack(HEIGHTS['/design'])); const r = tl.range('lean');
  assert.equal(tl.beatProgress(r.y0 - 1, 'lean'), 0); assert.ok(near(tl.beatProgress((r.y0 + r.y1) / 2, 'lean'), 0.5)); assert.equal(tl.beatProgress(r.y1 + 5, 'lean'), 1);
  assert.ok(tl.active((r.y0 + r.y1) / 2, ['lean'])); assert.ok(!tl.active((r.y0 + r.y1) / 2, ['ribs', 'footprint']));
  assert.equal(tl.beatProgress(0, 'nope'), 0);
});
test('ribs light up one at a time over the ribs beat (0 to 7, linear), and the count is 7 at its end', () => {
  const tl = compile(design, stack(HEIGHTS['/design'])); const out = {}; const r = tl.range('ribs');
  tl.sample(r.y0, out); assert.equal(out.ribs, 0); tl.sample((r.y0 + r.y1) / 2, out); assert.ok(near(out.ribs, 3.5, 1e-9)); tl.sample(r.y1, out); assert.equal(out.ribs, 7);
});
test('the camera follows a spline: smooth through a three-knot path and with no overshoot past 8 percent', () => {
  const spec = { chapters: { a: { start: { dist: 300 }, beats: [{ name: 'b1', from: 0, to: 0.5, pose: { dist: 500 } }, { name: 'b2', from: 0.5, to: 1, pose: { dist: 300 } }] } } };
  const tl = compile(spec, stack({ a: 3 })); const out = {}; let max = 0;
  for (let i = 0; i <= 200; i++) { tl.sample(i * 1800 / 200, out); max = Math.max(max, out.dist); }
  assert.ok(max >= 500 - 1e-6 && max < 540, 'peak ' + max);
  assert.ok(near(hermite(0, 1, 2, 3, 0), 1) && near(hermite(0, 1, 2, 3, 1), 2) && near(hermite(0, 1, 2, 3, 0.5), 1.5), 'hermite is linear on a straight line');
});
test('portrait adjustment never compounds: backing off by k is applied once per pose, however many beats carry it forward', () => {
  const spec = { chapters: { a: { start: { dist: 300, sy: 0.1 }, beats: [{ name: 'b1', from: 0, to: 0.5, pose: { rotY: 1 } }, { name: 'b2', from: 0.5, to: 1, pose: { rotY: 2 } }] }, b: { beats: [{ name: 'b3', from: 0, to: 1, pose: { rotY: 3 } }] } } };
  const tl = compile(spec, stack({ a: 3, b: 3 }), () => ({ sy: -0.2, k: 1.5 })); const out = {};
  tl.sample(1e9, out); assert.ok(near(out.dist, 450) && near(out.sy, -0.1), `dist ${out.dist} sy ${out.sy}`);
  const plain = compile(spec, stack({ a: 3, b: 3 })); plain.sample(1e9, out); assert.ok(near(out.dist, 300) && near(out.sy, 0.1));
});
test('portrait overrides persist into the next chapter (the pair stays where the narrow layout put it until a beat moves it)', () => {
  const tl = compile(models, stack(HEIGHTS['/models']), (ch) => (ch === 'pair' ? { sy: -0.05, k: 1, over: { cx: -150, px: 150 } } : null)); const out = {};
  const cut = tl.range('regular-leaves'); tl.sample(cut.y0 + 0.01, out); assert.ok(near(out.cx, -150, 0.5) && near(out.px, 150, 0.5), `cx ${out.cx} px ${out.px}`);
  tl.sample(cut.y1, out); assert.equal(out.cx, 0); assert.equal(out.px, 420);
});
test('sampling does not allocate objects (it writes into the object it is given)', () => {
  const tl = compile(models, stack(HEIGHTS['/models'])); const out = {}; const res = tl.sample(1234, out); assert.equal(res, out);
});

const MIN_BEAT_SCREENS = 0.4, MAX_HOLD = 0.12;
test('every chapter: beats cover 0 to 1 (no hold longer than 0.12), none shorter than 0.4 screens, and each chapter has a measured height', () => {
  for (const [route, spec] of Object.entries(SPECS)) for (const [ch, c] of Object.entries(spec.chapters)) {
    const h = HEIGHTS[route][ch]; assert.ok(h, `${route}/${ch}: no section with data-ch="${ch}" and --h in the page markup`);
    const L = Math.max(0, h - 1), beats = [...c.beats].sort((a, b) => a.from - b.from); let end = 0;
    for (const b of beats) {
      assert.ok(b.from - end <= MAX_HOLD + 1e-9, `${route}/${ch}: ${(b.from - end).toFixed(2)} of nothing happening before ${b.name}`); end = b.to;
      if (L > 0.5) assert.ok((b.to - b.from) * L >= MIN_BEAT_SCREENS - 1e-9, `${route}/${ch}/${b.name}: ${((b.to - b.from) * L).toFixed(2)} screens, minimum ${MIN_BEAT_SCREENS}`);
    }
    assert.ok(1 - end <= MAX_HOLD + 1e-9, `${route}/${ch}: ${(1 - end).toFixed(2)} of nothing happening after the last beat`);
  }
});
test('every beat name used by a copy block exists in its page timeline', () => {
  for (const [route, f] of Object.entries(PAGE_FILE)) {
    const html = fs.readFileSync(new URL(`../src/pages/${f}.html`, import.meta.url), 'utf8'); const names = new Set(compile(SPECS[route], stack(HEIGHTS[route])).names);
    for (const m of html.matchAll(/class="blk[^"]*" data-beat="([^"]+)"/g)) for (const n of m[1].split(' ')) assert.ok(names.has(n), `${route}: copy block for beat "${n}" has no beat`);
  }
});
