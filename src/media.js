/* Optional atmosphere media (docs/higgsfield-brief.md). Background mood only: NEVER the product, a phone, a screen, text, a logo or a person.
   Files live in assets/media/. build.mjs checks which of them exist and writes window.__MEDIA__ = { leafVeins, contours, heroPlate, heroPoster } with their URLs,
   so a missing file is simply absent (no request, no 404, no placeholder) and the page looks finished without any of them.
   What shows where is also governed by <html data-nature>: nothing here appears at level 0, and only on Home (video, veins) or About (contours). */
export const SLOTS = {
  leafVeins: { file: 'leaf-veins.webp', kind: 'still', maxKB: 250, use: 'Home hero underlay at 6 percent opacity' },
  contours: { file: 'contours.webp', kind: 'still', maxKB: 250, use: 'About underlay at 6 percent opacity' },
  heroPlate: { file: 'hero-plate.mp4', kind: 'video', maxKB: 2560, use: 'Home hero underlay, wide screens only' },
  heroPoster: { file: 'hero-plate-poster.webp', kind: 'still', maxKB: 250, use: 'poster for the video; shown instead of it on small screens, reduced motion and Save-Data' },
  ogPlate: { file: 'og-plate.webp', kind: 'still', maxKB: 250, use: 'social image background (tools/make_og.cjs only, not loaded by the site)', siteOnly: false },
};

let video = null, poster = null, cfg = null;
const wide = () => window.innerWidth >= 900;
const saveData = () => !!(navigator.connection && navigator.connection.saveData);

/** called once the page is ready: stills swap in for the built-in line textures; the video (or its poster) is created after the first paint, when the browser is idle */
export function initMedia({ reduce }) {
  const M = window.__MEDIA__ || {}, root = document.documentElement;
  if (M.leafVeins) { root.style.setProperty('--tex-veins', `url("${M.leafVeins}")`); root.classList.add('media-veins'); }
  if (M.contours) { root.style.setProperty('--tex-contours', `url("${M.contours}")`); root.classList.add('media-contours'); }
  if (!M.heroPlate && !M.heroPoster) return;
  cfg = { src: M.heroPlate, poster: M.heroPoster, reduce };
  const start = () => { build(); syncMedia(); };
  if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 2500 }); else setTimeout(start, 1200);   // never part of the first paint or the LCP
  document.addEventListener('visibilitychange', syncMedia);
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(syncMedia, 200); });
}
function build() {
  const host = document.getElementById('underlay'); if (!host || video || poster) return;
  if (cfg.src && wide() && !cfg.reduce && !saveData()) {
    video = document.createElement('video');
    video.className = 'u-video'; video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = 'none';   // preload none: nothing downloads until play()
    video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1; video.disablePictureInPicture = true;
    if (cfg.poster) video.poster = cfg.poster;
    video.src = cfg.src; host.insertBefore(video, host.firstChild);
  } else if (cfg.poster) {   // no video on a phone, with reduced motion or Save-Data: the poster alone
    poster = document.createElement('div'); poster.className = 'u-poster'; poster.style.backgroundImage = `url("${cfg.poster}")`; poster.setAttribute('aria-hidden', 'true'); host.insertBefore(poster, host.firstChild);
  }
}
/** play only while it can be seen: Home, nature level 1 or 2 (CSS decides what is displayed), wide screen, tab visible */
export function syncMedia() {
  if (!video) return;
  const shown = getComputedStyle(video).display !== 'none';
  if (shown && document.visibilityState === 'visible') { const p = video.play(); if (p && p.catch) p.catch(() => { /* autoplay refused: the poster stays */ }); } else video.pause();
}
