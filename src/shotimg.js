/* Turns the page token %%SHOT:<id>[:eager][:nocap][:sm|:md|:lg|:wide]%% into a <figure class="pic"> with a responsive <img> (srcset 640 / 1200, reserved width and height, alt from src/shots.js).
   Below the first screen images are lazy; `:eager` is for the first screen only. A render carries the small caption "Render"; a real photo (assets/photos/<id>.webp) does not.
   The one-file demo has no files next to it: it only shows the few stills it inlines (window.__SHOTDATA__) and a token for any other id becomes nothing, so there is never a broken image. */
import { SHOT_BY_ID, shotSources } from './shots.js';

const SIZES = {
  sm: '(max-width: 700px) 44vw, 260px', md: '(max-width: 700px) 88vw, 480px',
  lg: '(max-width: 700px) 92vw, 760px', wide: '(max-width: 700px) 92vw, 1100px',
};
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function figureHtml(id, mods = [], env = {}) {
  const s = SHOT_BY_ID[id]; if (!s) return '';
  const data = env.data || null, single = !!env.single;
  let src, srcset = '', real = false;
  if (single) { if (!data || !data[id]) return ''; src = data[id]; }
  else { const t = shotSources(id, env.base || '/', env.photos ? new Set(env.photos) : null); src = t.src; srcset = t.srcset; real = t.real; }
  const size = ['sm', 'md', 'lg', 'wide'].find((m) => mods.includes(m)) || 'md';
  const eager = mods.includes('eager'), cap = !mods.includes('nocap') && !real;
  // Below the first screen the file is only requested when the picture is about to scroll into view (bindLazy in main.js, a 300 px margin), so a page's first-screen weight never grows.
  // The browser's own loading="lazy" starts far earlier (about 1250 px), which is why it is not used here. Until then the <img> holds its space (width, height) and shows nothing.
  const deferred = !eager && !single;
  const imgSrc = deferred ? PLACEHOLDER : src, set = deferred ? ['data-src', 'data-srcset'] : ['src', 'srcset'];
  return `<figure class="pic pic-${size}" data-shot-id="${esc(id)}"><img src="${esc(imgSrc)}"${deferred ? ` data-src="${esc(src)}"` : ''}${srcset ? ` ${set[1]}="${esc(srcset)}" sizes="${SIZES[size]}"` : ''} width="${s.width}" height="${s.height}" alt="${esc(s.alt)}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>${cap ? '<figcaption class="pic-cap">Render</figcaption>' : ''}</figure>`;
}

/** replace every %%SHOT:...%% token in a page fragment */
export const expandShots = (html, env) => html.replace(/%%SHOT:([\w-]+)((?::\w+)*)%%/g, (_, id, mods) => figureHtml(id, mods.split(':').filter(Boolean), env));

/** request the pictures that are about to scroll into view (call after a page is mounted); returns a stop function. Without IntersectionObserver every picture loads at once. */
export function bindLazy(root) {
  const imgs = [...root.querySelectorAll('img[data-src]')]; if (!imgs.length) return () => {};
  const load = (img) => { const ss = img.getAttribute('data-srcset'); if (ss) img.setAttribute('srcset', ss); img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); img.removeAttribute('data-srcset'); };
  if (!('IntersectionObserver' in window)) { imgs.forEach(load); return () => {}; }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); load(en.target); } }), { rootMargin: '300px 300px 300px 300px' });
  imgs.forEach((i) => io.observe(i));
  return () => io.disconnect();
}
