/* Models. Two bases side by side -> the slot is cut into the Regular stand -> the cable story -> MagSafe.
   Roles: the MAIN stand (cx) carries the logo, magnets, phone and cable and starts as the Regular model (cut: 0); the SECOND stand (px) is always the With cutout model. */
export default { chapters: {
  pair: {
    start: { rotY: -0.5, sx: 0.17, sy: 0.02, dist: 520, elev: 10, ty: 0, cx: -62, px: 62, pairw: 1, logo: 0, cut: 0, idle: 1 },
    beats: [
      { name: 'two-bases', from: 0, to: 0.5, pose: { rotY: -0.15 } },
      { name: 'which-one', from: 0.5, to: 1, pose: { rotY: 0.3, idle: 0 } },
    ],
  },
  cut: {
    beats: [
      // the With cutout stand leaves, the Regular stand moves to the middle and comes closer
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
    beats: [
      { name: 'approach', from: 0, to: 0.3, pose: { snap: 0.8, rotY: -0.45, dist: 540, ty: 20 }, eases: { snap: 'spin' } },   // the phone floats in; the magnets pull it (curve in main.js)
      { name: 'snap', from: 0.3, to: 0.42, pose: { snap: 1 }, eases: { snap: 'spin' } },                                      // it snaps on with a small spring
      { name: 'sizes', from: 0.42, to: 0.68, pose: { rotY: -0.25 } },
      { name: 'note', from: 0.68, to: 1, pose: { rotY: -0.15, dist: 540, ty: 20 } },
    ],
  },
} };
