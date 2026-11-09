/* Models. Two bases side by side -> the Regular stand on its own -> the slot is cut into it -> the cable story -> MagSafe, one beat per phone size.
   Roles: the MAIN stand (cx) carries the logo, magnets, phone and cable and starts as the Regular model (cut: 0); the SECOND stand (px) is always the With cutout model.
   Screens of scroll per chapter = --h minus 1 (pair 1.4, regular 1.2, cut 1.6, cutout 3.2, magsafe 3.5); seq() weights are in screens. */
import { seq } from '../timeline.js';
import { CONFIG } from '../config.js';
const SIZES = CONFIG.phoneSizes.map((p, i) => [`size-${p.id}`, 0.65, { rotY: -0.38 + 0.1 * i }]);   // one beat per phone size (the copy and picture come from CONFIG, see buildShotGrids in main.js)
export default { chapters: {
  pair: {
    start: { rotY: -0.5, sx: 0.17, sy: 0.02, dist: 520, elev: 10, ty: 0, cx: -62, px: 62, pairw: 1, logo: 0, cut: 0, idle: 1 },
    beats: [
      { name: 'two-bases', from: 0, to: 0.5, pose: { rotY: -0.15 } },
      { name: 'which-one', from: 0.5, to: 1, pose: { rotY: 0.3, idle: 0 } },
    ],
  },
  regular: {                                                                                                      // the Regular stand on its own: the With cutout stand leaves, a closer look at the solid base
    beats: seq([
      ['regular-leaves', 0.6, { cx: 0, px: 420, pairw: 0, rotY: -0.2, dist: 340, elev: 12 }, { eases: { cx: 'enter', px: 'enter' } }],
      ['regular-solid', 0.6, { rotY: -0.7, elev: 26, dist: 320 }],
    ]),
  },
  cut: {
    beats: [
      { name: 'bases-part', from: 0, to: 0.3, pose: { cx: 0, px: 420, pairw: 0, rotY: -0.35, dist: 340, elev: 14 }, eases: { cx: 'enter', px: 'enter' } },
      // a clip plane sweeps across the base: the slot appears (the Regular geometry turns into the With cutout geometry behind the plane, no swap pop)
      { name: 'cut-sweep', from: 0.3, to: 0.7, pose: { cut: 1, rotY: -0.55, elev: 22 }, eases: { cut: 'spin' } },
      { name: 'cut-done', from: 0.7, to: 1, pose: { rotY: -0.4, elev: 14, logo: 1 } },
    ],
  },
  cutout: {
    start: { rotY: -0.4, sx: 0.17, sy: 0, dist: 290, elev: 56, ty: -16, dim: 0, scale: 1, phone: 0, cable: 0, glow: 1, xray: 1, logo: 1, pct: 12 },
    beats: [
      { name: 'slot-xray', from: 0, to: 0.21, pose: { rotY: -0.3, elev: 54 } },                                         // looking down through the stand, the slot glowing
      { name: 'phone-on', from: 0.21, to: 0.37, pose: { rotY: -0.38, phone: 1, elev: 17, dist: 520, ty: 18, xray: 0, glow: 0 }, eases: { phone: 'enter', xray: 'enter', glow: 'enter' } },
      { name: 'plug-in', from: 0.37, to: 0.72, pose: { rotY: -0.3, cable: 1, pct: 14, elev: 12, dist: 520, ty: 18 }, eases: { cable: 'spin' } },   // the plug travels in from below, seats, the cable pushes through the slot
      { name: 'charging', from: 0.72, to: 1, pose: { rotY: -0.2, dist: 540, elev: 12, ty: 14, pct: 86 }, eases: { pct: 'spin' } },
    ],
  },
  magsafe: {
    start: { rotY: -0.55, sx: 0.17, sy: 0, dist: 540, elev: 12, ty: 18, phone: 0, cable: 0, glow: 0, xray: 0, pct: 12, logo: 0, mag: 1, blank: 1, snap: 0 },
    beats: seq([
      ['approach', 0.6, { snap: 0.8, rotY: -0.45, dist: 540, ty: 20 }, { eases: { snap: 'spin' } }],             // the phone floats in; the magnets pull it (curve in main.js)
      ['snap', 0.4, { snap: 1 }, { eases: { snap: 'spin' } }],                                                    // it snaps on with a small spring
      ...SIZES,
      ['note', 0.55, { rotY: -0.15, dist: 540, ty: 20 }],
    ]),
  },
} };
