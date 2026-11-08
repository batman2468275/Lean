// No business or company names anywhere a visitor, a reader of the repo or a search engine can see them (git history aside).
// Scans EVERY text file in the project except node_modules, .git, .claude (third-party skills that are git-ignored) and this file, including the generated dist/ and the root index.html
// when they exist, so a stale build cannot carry an old footer. The patterns are built from fragments so this file does not match itself.
//   Names (always checked):         the owner's company and ventures, "corporation", "all rights reserved"
//   Legal suffixes (prose lines):   Inc / Llc / Ltd as whole words. Lines longer than 2000 characters are minified code or base64 data, not prose, and a random base64 run could
//                                   spell a short word by chance, so the three short suffixes skip those lines.
// To allow a hit you cannot reword, fix the source, never this test. (The wordmark font's own licence text names its author, a person, and does not match any pattern.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const NAMES = [
  ['astro', '\\s*-?\\s*', 'field'],
  ['launch', 'pad'],
  ['echo', '\\s*', 'studio'],
  ['life', '\\s*', 'unfolded'],
  ['corpo', 'ration'],
  ['all', '\\s+', 'rights', '\\s+', 'reserved'],
].map((parts) => new RegExp(parts.join(''), 'i'));
const SUFFIXES = [['\\b', 'in', 'c\\b'], ['\\b', 'll', 'c\\b'], ['\\b', 'lt', 'd\\b']].map((parts) => new RegExp(parts.join(''), 'i'));
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude']);
const LONG_LINE = 2000;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name)); continue; }
    if (e.isFile()) yield path.join(dir, e.name);
  }
}

function scan() {
  const hits = [];
  let files = 0;
  for (const f of walk(ROOT)) {
    if (f === SELF) continue;
    const buf = fs.readFileSync(f);
    if (buf.includes(0)) continue;                         // binary: images, fonts, models. (Screenshots are checked by being regenerated, see CLAUDE.md.)
    files++;
    const rel = path.relative(ROOT, f);
    buf.toString('utf8').split('\n').forEach((line, i) => {
      for (const re of NAMES) if (re.test(line)) hits.push(`${rel}:${i + 1}: matches ${re}`);
      if (line.length <= LONG_LINE) for (const re of SUFFIXES) if (re.test(line)) hits.push(`${rel}:${i + 1}: matches ${re}`);
    });
  }
  return { hits, files };
}

test('no company or business name appears in any text file (source, docs, tools, generated build output)', () => {
  const { hits, files } = scan();
  assert.ok(files > 50, `the scan looked at only ${files} files: is the project root right?`);
  assert.deepEqual(hits, [], 'banned business reference(s):\n  ' + hits.join('\n  '));
});

test('the footer names no company', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src/shell.html'), 'utf8');
  assert.ok(!shell.includes(['Corpo', 'ration'].join('')), 'src/shell.html still says Corporation');
  assert.match(shell, /&copy; 2026 Lean\b/, 'the footer line should be "&copy; 2026 Lean"');
});

test('the scan covers the generated build output when it exists', () => {
  const generated = ['dist/index.html', 'index.html'].filter((f) => fs.existsSync(path.join(ROOT, f)));
  for (const f of generated) assert.ok(fs.readFileSync(path.join(ROOT, f)).length > 1000, f + ' is empty');
});
