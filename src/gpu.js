/* GPU safety: the ONE place that decides how the WebGL scene is built for this device (docs/gpu-safety.md).
   John's iPad shows multicoloured speckle over the floor that software rendering cannot reproduce, so touch devices get the safest pipeline by default and every choice can be
   switched back on the device with a flag in the real query string (before any #):  ?gl=noshadow,nodomfx   (works in the single-file build too: /Lean/?gl=old#/customize?color=sky)

   Flags (a comma list, each turns ONE thing back to its old behaviour or off, on either profile):
     old            every touch default reverted (the exact pre-fix behaviour), for A/B on the device
     alpha aa dpr=<n> maxpx=<n> shadow2048 bigfloor additive domfx      restore one old default
     noshadow noground nocontact noenv nodomfx                           switch one feature off
     profile-touch / profile-apple / profile-desktop                      force the profile (the safe profile is the default on every Apple device)
   ?debug=gl shows the panel with a button per flag and a copyable report. */

const params = new URLSearchParams(location.search);
const raw = (params.get('gl') || '').split(',').map((s) => s.trim()).filter(Boolean);
const flags = {}; for (const f of raw) { const [k, v] = f.split('='); flags[k] = v === undefined ? true : (Number.isFinite(+v) ? +v : v); }

const ua = navigator.userAgent || '';
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const detectedTouch = /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) || coarse;   // iPadOS Safari calls itself a Mac
// The speckle shows on EVERY Apple device (iPad, iPhone and MacBooks, Safari and Chrome alike: all of them draw through Apple's Metal driver), so the safe profile ("touch" in the code)
// is used for anything Apple, not only for touch screens. Macs keep a bigger pixel budget so a retina display is not made soft.
const apple = /Macintosh|iPhone|iPad|iPod|Mac OS X/.test(ua) || (navigator.vendor || '').indexOf('Apple') === 0;
const profile = flags['profile-touch'] || flags['profile-apple'] ? 'touch' : flags['profile-desktop'] ? 'desktop' : ((detectedTouch || apple) ? 'touch' : 'desktop');
const touch = profile === 'touch';
const old = !!flags.old;
const T = touch && !old;   // "the touch defaults are in force"

const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
const MAXPX_TOUCH = 3000000;
const MAXPX_MAC = 8000000;
const maxpx = flags.maxpx ? +flags.maxpx : (T ? (detectedTouch ? MAXPX_TOUCH : MAXPX_MAC) : Infinity);

/** effective pixel ratio for a given CSS size: min(devicePixelRatio, 2, sqrt(maxpx / area)) (an iPad in portrait renders at about 1.46x) */
export function pixelRatioFor(w, h) {
  if (flags.dpr) return +flags.dpr;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(d, Math.sqrt(maxpx / (w * h)));
}

const settings = {
  alpha: flags.alpha ? true : T ? false : true,                       // transparent canvas over the CSS underlay (desktop) / opaque canvas that draws its own background (touch)
  aa: flags.aa ? true : (T ? pixelRatioFor(cssW(), cssH()) < 1.5 : true),   // MSAA: off on touch when the pixel ratio is 1.5 or more (retina hides the edges)
  shadowSize: flags.shadow2048 ? 2048 : T ? 1024 : 2048,
  shadow: !flags.noshadow,
  floorSize: flags.bigfloor ? 1400 : 380,                             // the floor only needs to cover the shadow frustum (340 units) plus a margin
  additive: flags.additive ? true : T ? false : true,                  // additive blending of the pool, slot glow and cut sheet (normal alpha blending on touch)
  env: !flags.noenv,
  ground: !flags.noground,
  contact: !flags.nocontact,
  domfx: flags.nodomfx ? false : flags.domfx ? true : T ? false : true, // backdrop-filter, masks, will-change and the ticked rail
};

export const GPU = {
  touch, profile, flags, settings, old,
  stats: { resizes: 0, setSize: 0 },
  pixelRatioFor,
  info: {},      // filled by main.js once the renderer exists
  report() {
    const i = GPU.info, L = [];
    L.push('user agent: ' + ua);
    L.push(`profile: ${profile}${flags['profile-touch'] || flags['profile-desktop'] || flags['profile-apple'] ? ' (forced)' : ''}   apple: ${apple}   touch screen: ${detectedTouch}   old: ${old}`);
    L.push(`maxTouchPoints: ${navigator.maxTouchPoints || 0}   coarse pointer: ${coarse}`);
    L.push(`devicePixelRatio: ${window.devicePixelRatio}   css size: ${cssW()} x ${cssH()}`);
    L.push(`drawing buffer: ${i.bw || '?'} x ${i.bh || '?'}  (${i.bw ? (i.bw * i.bh / 1e6).toFixed(2) : '?'} MP)   pixel ratio used: ${i.pr ? i.pr.toFixed(2) : '?'}`);
    L.push('gpu: ' + (i.renderer || 'hidden by the browser') + (i.vendor ? ' / ' + i.vendor : ''));
    L.push(`fragment highp: ${i.highp === undefined ? '?' : i.highp}   MAX_TEXTURE_SIZE: ${i.maxTex || '?'}   MSAA samples: ${i.samples === undefined ? '?' : i.samples}`);
    L.push('context attributes: ' + (i.attrs || '?'));
    L.push(`half-float colour buffer: ${i.halfFloat}   float colour buffer: ${i.floatBuf}   webgl2: ${i.gl2}`);
    L.push(`shadow map: ${settings.shadow ? settings.shadowSize : 'off'}   floor: ${settings.floorSize}   additive: ${settings.additive}   environment: ${settings.env}   ground: ${settings.ground}   contact: ${settings.contact}   dom effects: ${settings.domfx}`);
    L.push('flags: ' + (raw.length ? raw.join(',') : '(none)'));
    L.push(`three.js r${i.three || '?'}`);
    L.push(`canvas resized since load: ${GPU.stats.resizes} (renderer.setSize calls: ${GPU.stats.setSize})`);
    return L.join('\n');
  },
};

if (!settings.domfx) document.documentElement.classList.add('nodomfx');
if (!settings.alpha) document.documentElement.classList.add('gl-opaque');
if (T) document.documentElement.classList.add('gl-stable');
window.__GPU = GPU;

/** the ?debug=gl panel: one button per flag (toggles it and reloads) and a selectable report */
export function mountDebugPanel() {
  if (params.get('debug') !== 'gl') return;
  const names = ['old', 'alpha', 'aa', 'shadow2048', 'bigfloor', 'additive', 'domfx', 'noshadow', 'noground', 'nocontact', 'noenv', 'nodomfx', 'profile-touch', 'profile-apple', 'profile-desktop'];
  const box = document.createElement('div'); box.id = 'gl-panel';
  const head = document.createElement('div'); head.className = 'glp-btns';
  for (const n of names) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.setAttribute('aria-pressed', String(!!flags[n]));
    b.addEventListener('click', () => { const cur = raw.filter((x) => x.split('=')[0] !== n); if (!flags[n]) cur.push(n); const q = new URLSearchParams(location.search); if (cur.length) q.set('gl', cur.join(',')); else q.delete('gl'); location.search = q.toString(); });
    head.appendChild(b);
  }
  const pre = document.createElement('pre'); pre.textContent = GPU.report();
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'glp-copy'; copy.textContent = 'Copy report';
  copy.addEventListener('click', () => { pre.textContent = GPU.report(); try { navigator.clipboard.writeText(pre.textContent); copy.textContent = 'Copied'; } catch (e) { copy.textContent = 'Select the text and copy it'; } });
  box.append(head, pre, copy); document.body.appendChild(box);
  setInterval(() => { pre.textContent = GPU.report(); }, 1500);   // the resize counter and buffer size keep updating
}
