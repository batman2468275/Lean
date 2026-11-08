/* Build: src/ -> dist/
   dist/index.html                  the app shell (nav, canvas, footer) for "/"
   dist/<route>/index.html          the same shell with that page's own <title> and description, so a static host serves every route directly
   dist/404.html                    the shell for unknown paths (the app shows its own "not found" page)
   dist/assets/app.js, style.css    the bundle and the styles
   dist/assets/model_*.bin          the 3D models, fetched at boot (not inlined)
   dist/assets/renders/*.webp       product photos, served as files
   dist/_redirects, vercel.json, .htaccess   hosting fallbacks: every path serves the app
   Serve it with `npm start` (tools/serve.mjs, which does the same fallback). The router needs http(s): opening index.html from disk will not route.
   LEAN_BASE=/sub/ npm run build   builds for a site that lives under a sub-path (assets only; routes assume the site root). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './src/config.js';
import { routeMeta, PAGE_LIST, ADMIN_ROUTE } from './src/routes.js';
import { SLOTS } from './src/media.js';

const BASE = process.env.LEAN_BASE || '/';
const meta = JSON.parse(fs.readFileSync('build/meta.json', 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- the Lean wordmark (src/logo.json): script "Lea" + an "n" that is the stand's own profile ---------- */
const LOGO = JSON.parse(fs.readFileSync('src/logo.json', 'utf8'));
const logoSvg = (extra) => {
  const [x, y, w, h] = LOGO.viewBox; const m = extra / 2;
  return `<svg class="logo" viewBox="${x - m} ${y - m} ${w + extra} ${h + extra}" role="img" aria-label="Lean"><path class="lg-t" d="${LOGO.letters}" stroke-width="${extra}"/><path class="lg-n" d="${LOGO.n}" stroke-width="${LOGO.stroke + extra}"/></svg>`;
};
// standalone logo files for favicon / social images / print (regenerated on every build)
fs.mkdirSync('assets/logo', { recursive: true });
const logoFile = (extra, text, n) => logoSvg(extra).replace('<svg class="logo"', '<svg xmlns="http://www.w3.org/2000/svg"').replace('class="lg-t"', `fill="${text}" stroke="${text}" stroke-linejoin="round" stroke-linecap="round"`).replace('class="lg-n"', `fill="none" stroke="${n}" stroke-linecap="round" stroke-linejoin="round"`);
// brand colours for the standalone files (the page itself uses the tokens in src/style.css): letters white / ink, the "n" in electric green (#35F07F on dark, #0B8A43 on light)
fs.writeFileSync('assets/logo/lean-logo-on-dark.svg', logoFile(1.5, '#F4F6F4', '#35F07F'));
fs.writeFileSync('assets/logo/lean-logo-on-light.svg', logoFile(1.5, '#131513', '#0B8A43'));
fs.writeFileSync('assets/logo/lean-logo-black.svg', logoFile(1.5, '#000000', '#000000'));
// favicon: the "n" (the stand's own profile) in electric green on a charcoal rounded square
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#0d0f0e"/><svg x="11" y="11" width="42" height="42" viewBox="444 -4 74 82"><path d="${LOGO.n}" fill="none" stroke="#35f07f" stroke-width="${LOGO.stroke + 2}" stroke-linecap="round" stroke-linejoin="round"/></svg></svg>`;
fs.writeFileSync('assets/logo/favicon.svg', favicon);

/* ---------- clean dist, copy the files the site serves ---------- */
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/assets/renders', { recursive: true });
const copyDir = (from, to, filter = () => true) => { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) if (filter(f)) fs.copyFileSync(path.join(from, f), path.join(to, f)); };
copyDir('assets/renders', 'dist/assets/renders', (f) => f.endsWith('.webp'));
copyDir('assets/logo', 'dist/assets/logo', (f) => f.endsWith('.svg') || f.endsWith('.png'));
if (fs.existsSync('assets/social')) copyDir('assets/social', 'dist/assets/social');
fs.copyFileSync('build/model_cut.bin', 'dist/assets/model_cut.bin');
fs.copyFileSync('build/model_plain.bin', 'dist/assets/model_plain.bin');

// product renders: <variant>-<view>.webp (white base, tinted in the page) and <variant>-<view>-<look>.webp (a real dark material, e.g. -black, used untinted)
const IMG = {};
for (const f of fs.readdirSync('assets/renders').filter((n) => n.endsWith('.webp'))) {
  const [variant, view, look] = f.slice(0, -5).split('-');
  (IMG[variant] ||= {})[look ? `${view}-${look}` : view] = `${BASE}assets/renders/${f}`;
}

/* ---------- optional atmosphere media (assets/media, see docs/higgsfield-brief.md): only the files that exist are listed and copied ---------- */
const MEDIA_DIR = process.env.LEAN_MEDIA_DIR || 'assets/media';
const MEDIA = {};
for (const [slot, spec] of Object.entries(SLOTS)) {
  const f = path.join(MEDIA_DIR, spec.file); if (!fs.existsSync(f)) continue;
  const kb = fs.statSync(f).size / 1024;
  if (kb > spec.maxKB) console.warn(`  media warning: ${spec.file} is ${kb | 0} KB, over its ${spec.maxKB} KB budget (${spec.use})`);
  if (spec.siteOnly === false) continue;           // used by tools only (the social image), not shipped to the page
  fs.mkdirSync('dist/assets/media', { recursive: true }); fs.copyFileSync(f, `dist/assets/media/${spec.file}`);
  MEDIA[slot] = `${BASE}assets/media/${spec.file}`;
}

/* ---------- bundle ---------- */
const out = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
  loader: { '.html': 'text' },
});
fs.writeFileSync('dist/assets/app.js', out.outputFiles[0].text);
fs.copyFileSync('src/style.css', 'dist/assets/style.css');

/* ---------- html ---------- */
const shell = fs.readFileSync('src/shell.html', 'utf8').replace(/%%LOGO:(\d+(?:\.\d+)?)%%/g, (_, e) => logoSvg(+e));
const M = routeMeta(CONFIG);
const from = M['/'].description.match(/From \$[\d.]+/);
const page = (title, description, noindex = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0d0f0e"><meta name="color-scheme" content="dark">${noindex ? '\n<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="icon" type="image/svg+xml" href="${BASE}assets/logo/favicon.svg">
<link rel="apple-touch-icon" href="${BASE}assets/logo/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${BASE}assets/social/og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"></noscript>
<link rel="stylesheet" href="${BASE}assets/style.css">
<style>[hidden]{display:none!important}</style>
<script>(function(){var n=new URLSearchParams(location.search).get("nature");try{if(n==null)n=sessionStorage.getItem("lean-nature")}catch(e){}if(n!=="0"&&n!=="1"&&n!=="2")n="1";document.documentElement.dataset.nature=n}())</script>
<script>window.__BASE__=${JSON.stringify(BASE)};window.__META__=${JSON.stringify(meta)};window.__IMG__=${JSON.stringify(IMG)};window.__MEDIA__=${JSON.stringify(MEDIA)};</script>
</head><body>
${shell}
<noscript><p style="position:relative;z-index:5;padding:120px 24px;font:17px system-ui;max-width:560px;margin:auto">Lean is a 3D-printed phone stand${from ? ', ' + from[0].toLowerCase().replace('from', 'from') : ''}. This site needs JavaScript to show the 3D stand.</p></noscript>
<script src="${BASE}assets/app.js" defer></script>
</body></html>
`;
fs.writeFileSync('dist/index.html', page(M['/'].title, M['/'].description));
for (const route of PAGE_LIST.filter((r) => r !== '/')) {
  fs.mkdirSync(`dist${route}`, { recursive: true });
  fs.writeFileSync(`dist${route}/index.html`, page(M[route].title, M[route].description, route === ADMIN_ROUTE));
}
fs.writeFileSync('dist/404.html', page('Page not found | Lean', 'This page does not exist.'));

/* ---------- hosting fallbacks: every path serves the app (the app then shows the right page, or its own 404) ---------- */
fs.writeFileSync('dist/_redirects', '/*    /index.html   200\n');                                                      // Netlify, Cloudflare Pages
fs.writeFileSync('dist/vercel.json', JSON.stringify({ cleanUrls: true, rewrites: [{ source: '/((?!assets/).*)', destination: '/index.html' }] }, null, 2) + '\n');   // Vercel
fs.writeFileSync('dist/.htaccess', 'RewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ /index.html [L]\n');   // Apache
fs.writeFileSync('dist/robots.txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n');
console.log('dist/: %d pages, app.js %d KB, models %d KB, renders %d files, media %d file(s)', PAGE_LIST.length + 1, (out.outputFiles[0].text.length / 1024) | 0, (fs.statSync('dist/assets/model_cut.bin').size + fs.statSync('dist/assets/model_plain.bin').size) / 1024 | 0, fs.readdirSync('dist/assets/renders').length, Object.keys(MEDIA).length);
