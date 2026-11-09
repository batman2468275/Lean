/* The animation system: named beats on a scroll timeline. Pure functions (unit-tested), no DOM, no three.js.

   A page's timeline spec is data:
     chapters: {
       <chapter>: {                         // a section of the page with data-ch="<chapter>"; progress p runs 0..1 over its pinned scroll
         start: { rotY: .6, ... },          // the pose at p = 0 (values not named carry over from the previous chapter)
         beats: [ { name: 'slot-xray', from: 0.18, to: 0.32, pose: { ... }, ease: 'camera', eases: { phone: 'settle' }, color: 'black' }, ... ],
       } }
   `pose` is the pose at the END of the beat; during the beat every value moves from where the previous beat left it. Gaps between beats hold.
   Between two chapters the stand glides from one chapter's last pose to the next one's first (an automatic "link:<a>><b>" beat).
   Copy, camera, stands, phone, cable, callouts and counters all read the same beat names, so they change at exactly the same scroll position.

   EASINGS (one set, used everywhere; the CSS tokens --ease-* mirror enter/sway/settle):
     enter  - things drift in and settle (fast start, long soft landing)
     camera - mild in-out so camera moves never stop dead at a beat boundary
     spin   - linear, for continuous spins and sweeps
     settle - a soft spring: a small overshoot, like a leaf coming to rest
   The camera parameters follow a cardinal SPLINE through the beat poses (not straight lerps) so motion is curved and the velocity is continuous. */

export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    return Y(t);
  };
}
const smooth = (t) => t * t * (3 - 2 * t);
export const EASES = {
  linear: (t) => t,
  spin: (t) => t,
  enter: bezier(.19, .82, .28, 1),
  sway: bezier(.45, .05, .35, 1),
  camera: (t) => t + (smooth(t) - t) * 0.5,
  settle: bezier(.3, 1.28, .5, 1),
  smooth,
};
/* the spring the magnet snap uses: a damped oscillation that lands on 1 (0 at t=0, 1 at t=1, ends at rest) */
export const spring = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(11 * t));

/* parameters the camera spline covers; everything else uses its beat's easing */
export const CAMERA_KEYS = ['rotY', 'elev', 'dist', 'ty', 'sx', 'sy'];

/** Pose at the start of everything. Every value a timeline may animate must exist here. */
export const BASE = {
  rotY: 0.62, scale: 1, sx: 0, sy: 0.12, dist: 360, elev: 9, ty: 0, idle: 0,   // camera and stand
  phone: 0, cable: 0, pct: 12, glow: 0, dim: 0, arc: 0, xray: 0, snap: 0,        // phone, cable, callout, dimension lines, lean-angle arc, x-ray, magnet snap
  ribs: 0, cut: 1,                                                               // ribs lit (0..7), the slot cut (0 = Regular, 1 = With cutout)
  px: 400, cx: 0, pairw: 0, logo: 1, mag: 0, blank: 0,                           // second stand x (parked off screen), main stand x, pair weight, logo opacity, magnets shown, blank phone screen
};
export const KEYS = Object.keys(BASE);

/** Build a chapter's beats from rows [name, screens, pose, extra?]. `screens` is how much scroll the beat gets (in screen heights); the rows' total must equal the chapter's
 *  --h minus 1 (its pinned scroll length), which tests/timeline.test.mjs checks against the page markup. Fractions are computed here so beats always tile 0..1 with no gap. */
export function seq(rows) {
  const T = rows.reduce((a, r) => a + r[1], 0); let c = 0;
  return rows.map(([name, w, pose, extra]) => { const b = { name, from: c / T, to: (c + w) / T, pose, ...(extra || {}) }; c += w; return b; });
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** value on a cardinal spline through p0..p3 at t in 0..1 (between p1 and p2) */
export function hermite(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t, m1 = (p2 - p0) * 0.5, m2 = (p3 - p1) * 0.5;
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
}

/**
 * Compile a timeline spec against the measured chapters.
 * @param spec      { chapters: {...} } as described above
 * @param chapters  { <name>: { top, L } }  page y of the chapter's top and its pinned scroll length (px)
 * @param portrait  (chapterName) => { sy, k, over } | null   optional layout for narrow screens: the camera shifts up by sy, backs off by k, and `over` replaces values outright
 *                  (the raw poses that carry from beat to beat are never adjusted, only the copies the camera reads, so nothing compounds)
 * @returns { segs, sample(y, out), seg(y), beatProgress(y, name), range(name), names }
 */
export function compile(spec, chapters, portrait = null) {
  const order = Object.keys(spec.chapters).filter((c) => chapters[c]).sort((a, b) => chapters[a].top - chapters[b].top);
  const segs = [];
  const adj = (ch, raw) => { const pr = portrait && portrait(ch); return pr ? { ...raw, sx: 0, sy: raw.sy + (pr.sy || 0), dist: raw.dist * (pr.k || 1) } : { ...raw }; };
  const overOf = (ch) => { const pr = portrait && portrait(ch); return (pr && pr.over) || {}; };
  let rawCarry = { ...BASE }, adjCarry = adj(null, BASE);
  let prev = null;                                  // previous chapter name
  for (const ch of order) {
    const C = chapters[ch], S = spec.chapters[ch], over = overOf(ch);
    let raw = { ...rawCarry, ...(S.start || {}), ...over };
    const startPose = adj(ch, raw);
    if (prev) {                                     // the glide between chapters
      const P = chapters[prev];
      segs.push({ name: `link:${prev}>${ch}`, chapter: ch, y0: P.top + P.L, y1: C.top, p0: 0, p1: 0, from: adjCarry, to: startPose, ease: 'camera', eases: {}, link: true });
    }
    let cur = startPose, cursor = 0;
    const beats = [...S.beats].sort((a, b) => a.from - b.from);
    for (const b of beats) {
      if (b.from > cursor + 1e-9) segs.push({ name: 'hold', chapter: ch, y0: C.top + cursor * C.L, y1: C.top + b.from * C.L, p0: cursor, p1: b.from, from: cur, to: cur, ease: 'camera', eases: {} });
      raw = { ...raw, ...(b.pose || {}), ...over };
      const end = adj(ch, raw);
      segs.push({ name: b.name, chapter: ch, y0: C.top + b.from * C.L, y1: C.top + b.to * C.L, p0: b.from, p1: b.to, from: cur, to: end, ease: b.ease || 'camera', eases: b.eases || {}, color: b.color });
      cur = end; cursor = b.to;
    }
    if (cursor < 1 - 1e-9) segs.push({ name: 'hold', chapter: ch, y0: C.top + cursor * C.L, y1: C.top + C.L, p0: cursor, p1: 1, from: cur, to: cur, ease: 'camera', eases: {} });
    rawCarry = raw; adjCarry = cur; prev = ch;
  }
  const ranges = {};                                 // beat name -> { y0, y1 }
  for (const s of segs) if (s.name !== 'hold' && !s.link) ranges[s.name] = { y0: s.y0, y1: s.y1 };
  const n = segs.length;

  function find(y) {                                 // last segment that starts at or before y (segments are contiguous in order)
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].y0 <= y) lo = mid; else hi = mid - 1; }
    return segs[lo];
  }
  const camSet = new Set(CAMERA_KEYS);
  function sample(y, out) {
    if (!n) { for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = BASE[KEYS[i]]; return out; }
    if (y <= segs[0].y0) { for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = segs[0].from[KEYS[i]]; return out; }
    let i = 0; { let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].y0 <= y) lo = mid; else hi = mid - 1; } i = lo; }
    const s = segs[i];
    if (y >= segs[n - 1].y1) { const L = segs[n - 1]; for (let k = 0; k < KEYS.length; k++) out[KEYS[k]] = L.to[KEYS[k]]; return out; }
    const t = s.y1 > s.y0 ? clamp01((y - s.y0) / (s.y1 - s.y0)) : 1;
    const prevS = i > 0 ? segs[i - 1] : s, nextS = i < n - 1 ? segs[i + 1] : s;
    for (let k = 0; k < KEYS.length; k++) {
      const key = KEYS[k], a = s.from[key], b = s.to[key];
      const name = s.eases[key] || s.ease;
      const e = (EASES[name] || EASES.camera)(t);
      if (a === b) out[key] = a;
      else if (camSet.has(key) && name === 'camera') out[key] = hermite(prevS.from[key], a, b, nextS.to[key], e);
      else out[key] = a + (b - a) * e;
    }
    return out;
  }
  return {
    segs, names: Object.keys(ranges),
    sample, seg: find,
    range: (name) => ranges[name] || null,
    /** 0..1 progress of a named beat at page position y (0 before it, 1 after it) */
    beatProgress(y, name) { const r = ranges[name]; return r ? (r.y1 > r.y0 ? clamp01((y - r.y0) / (r.y1 - r.y0)) : (y >= r.y1 ? 1 : 0)) : 0; },
    /** is the named beat the one playing at y? (the last beat of a chapter also owns the position up to the next chapter's link) */
    active(y, names) { const s = find(y); return !s.link && s.name !== 'hold' && names.indexOf(s.name) >= 0; },
  };
}
