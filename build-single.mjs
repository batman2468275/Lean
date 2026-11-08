/* Single-file demo: dist/lean-demo.html  (npm run build:single)
   One HTML file with everything inside it (scripts, styles, the 3D models as base64, the product renders as data URLs), so it can be emailed, downloaded and
   opened by double-clicking, with no server. It is the same site; the differences are only what a file with no server forces:
     - pages live in the URL hash (#/models, #/customize?color=sky) instead of paths                   (HASHMODE in src/main.js)
     - the ideas board answers from the browser's own storage instead of a server                      (src/demo-board.js)
   Needs a built dist/ first (the npm script does that). The Google Fonts link is kept: online you get Fraunces and Geist, offline the fallback fonts are used. */
import fs from 'node:fs';

const need = (f) => { if (!fs.existsSync(f)) throw new Error(`${f} is missing: run "npm run build" first`); return f; };
let html = fs.readFileSync(need('dist/index.html'), 'utf8');
const b64 = (f) => fs.readFileSync(need(f)).toString('base64');
const mime = { webp: 'image/webp', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
const dataUrl = (f) => `data:${mime[f.split('.').pop()]};base64,${b64(f)}`;
const must = (cond, msg) => { if (!cond) throw new Error('single-file build: ' + msg); };

// product renders: /assets/renders/x.webp -> data URL
const IMG = JSON.parse(/window\.__IMG__=(\{.*?\});/.exec(html)[1]);
for (const set of Object.values(IMG)) for (const [view, url] of Object.entries(set)) set[view] = dataUrl('dist' + url);
html = html.replace(/window\.__IMG__=\{.*?\};/, () => `window.__IMG__=${JSON.stringify(IMG)};window.__SINGLE__=true;window.__MODELS__={cut:"${b64('dist/assets/model_cut.bin')}",plain:"${b64('dist/assets/model_plain.bin')}"};`);

// optional atmosphere media: stills go inline as data URLs (they are small); the video is left out of the one-file demo (its poster, if there is one, stays)
const MEDIA = JSON.parse(/window\.__MEDIA__=(\{.*?\});/.exec(html)[1]);
for (const [slot, url] of Object.entries(MEDIA)) { if (slot === 'heroPlate') { delete MEDIA[slot]; continue; } MEDIA[slot] = dataUrl('dist' + url); }
html = html.replace(/window\.__MEDIA__=\{.*?\};/, () => `window.__MEDIA__=${JSON.stringify(MEDIA)};`);

// head: no files to point at
html = html.replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" type="image/svg+xml" href="${dataUrl('dist/assets/logo/favicon.svg')}">`);
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '').replace(/<meta property="og:image"[^>]*>/, '').replace(/<meta name="twitter:card"[^>]*>/, '');
html = html.replace('<title>', '<title>Lean (demo) | ').replace('<meta name="description"', '<meta name="robots" content="noindex"><meta name="description"');

// styles and the app inline. In a <script>, "</script" and "<!--" would end or confuse the element, so they are escaped (identical inside a JS string).
const css = fs.readFileSync(need('dist/assets/style.css'), 'utf8');
must(!css.includes('</style'), 'CSS contains </style');
html = html.replace(/<link rel="stylesheet" href="\/assets\/style\.css">/, () => `<style>\n${css}\n</style>`);
const js = fs.readFileSync(need('dist/assets/app.js'), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
html = html.replace(/<script src="\/assets\/app\.js" defer><\/script>/, () => `<script>\n${js}\n</script>`);

// nothing may still point at a file next to the page
const left = [...html.matchAll(/(?:src|href|content)="(\/assets\/[^"]*)"/g)].map((m) => m[1]);
must(left.length === 0, 'still references files: ' + left.join(', '));

fs.writeFileSync('dist/lean-demo.html', html);
fs.writeFileSync('index.html', html);   // GENERATED copy at the repo root: GitHub Pages (Settings > Pages > main / root) serves it as the demo site
console.log('dist/lean-demo.html: %s KB (one file, no other files needed)', (html.length / 1024) | 0);
