// WCAG contrast for the design tokens in src/style.css. Colours are read from the CSS itself, so changing a token re-runs the check.
// Text needs 4.5:1, graphics (the wordmark's "n", focus ring, switch) 3:1. Translucent colours are blended over the surface they sit on.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const block = (sel) => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, 'no block ' + sel); return css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i)); };
const vars = (txt) => Object.fromEntries([...txt.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const ROOT = vars(block(':root'));
const TONES = { light: { ...ROOT, ...vars(block('[data-tone="light"]')) }, deep: { ...ROOT, ...vars(block('[data-tone="deep"]')) } };

function resolve(v, map, depth = 0) {            // follow var(--x) references
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (!m) return v; assert.ok(depth < 8 && map[m[1]] !== undefined, 'unresolved ' + v); return resolve(map[m[1]], map, depth + 1);
}
function rgba(v, map) {                          // -> [r, g, b, a]
  v = resolve(v, map);
  let m = /^#([0-9a-f]{6})$/i.exec(v); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^#([0-9a-f]{3})$/i.exec(v); if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/.exec(v); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error('cannot parse colour: ' + v);
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

for (const [tone, map] of Object.entries(TONES)) {
  const C = (name, base) => { const c = rgba(map[name], map); return c[3] < 1 ? over(c, base || rgba(map['--bg'], map)) : c; };
  const bg = C('--bg'), surface = C('--surface', bg), surface2 = C('--surface-2', bg);
  const check = (label, fg, back, min) => { const r = ratio(fg, back); assert.ok(r >= min, `${tone}: ${label} is ${r.toFixed(2)}:1, needs ${min}:1`); };

  test(`${tone}: body, secondary and tertiary text on every surface`, () => {
    for (const [sn, s] of [['bg', bg], ['surface', surface], ['surface-2', surface2]])
      for (const t of ['--text', '--text-2', '--text-3']) check(`${t} on ${sn}`, C(t, s), s, 4.5);
  });
  test(`${tone}: accent text, crossed-out price and launch tag`, () => {
    for (const [sn, s] of [['bg', bg], ['surface', surface]]) { check(`--accent-text on ${sn}`, C('--accent-text', s), s, 4.5); check(`--was on ${sn}`, C('--was', s), s, 4.5); }
    const tagBg = over(rgba(map['--tag-bg'], map), surface); check('--tag-text on --tag-bg', C('--tag-text', tagBg), tagBg, 4.5);
  });
  test(`${tone}: form error text (ideas board) on the bg and on the form surface`, () => {
    for (const [sn, sv] of [['bg', bg], ['surface', surface]]) check(`--error on ${sn}`, C('--error', sv), sv, 4.5);
  });
  test(`${tone}: buttons`, () => {
    check('--on-accent on --accent', C('--on-accent'), C('--accent'), 4.5);
    check('--on-accent on --accent-hi (hover)', C('--on-accent'), C('--accent-hi'), 4.5);
    check('--btn-dark-text on --btn-dark-bg', C('--btn-dark-text'), C('--btn-dark-bg'), 4.5);
    check('--btn-dark-text on --btn-dark-hover', C('--btn-dark-text'), C('--btn-dark-hover'), 4.5);
  });
  test(`${tone}: selected segment text, wordmark n and focus ring`, () => {
    const on = over(rgba(map['--seg-on'], map), surface); check('--text on selected segment', C('--text', on), on, 4.5);
    check('--n-ink (wordmark n) on --bg', C('--n-ink'), bg, 3);
    check('--focus on --bg', C('--focus'), bg, 3);
    check('--accent-text (switch / checked) on --surface', C('--accent-text', surface), surface, 3);
  });
}

test('Mistletoe is a fill, not text: it must NOT be relied on for small text on ivory (documents why --accent-text exists)', () => {
  const m = rgba(TONES.light['--mistletoe'], TONES.light), iv = rgba(TONES.light['--ivory'], TONES.light);
  assert.ok(ratio(m, iv) < 3.2, 'if Mistletoe ever passes on ivory, --accent-text could be simplified');
  assert.notEqual(TONES.light['--accent-text'], TONES.light['--mistletoe']);
});
test('every semantic token the deep set uses is also defined for light (no token falls through)', () => {
  const deep = Object.keys(vars(block('[data-tone="deep"]')));
  for (const k of deep) assert.ok(TONES.light[k] !== undefined, 'light is missing ' + k);
});
