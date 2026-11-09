/* About. The story told beside the stand: the name (the "n" is the stand's own profile), one piece, why there is a slot, made to order.
   Screens of scroll: 3.2 (--h 4.2). */
import { seq } from '../timeline.js';
import { CONFIG } from '../config.js';
export default { chapters: {
  about: {
    start: { rotY: 0.35, sx: 0.2, sy: 0.02, dist: 330, elev: 12, idle: 1 },
    beats: seq([
      ['story', 0.6, { rotY: -0.2, idle: 0 }],
      ['name', 0.8, { rotY: -Math.PI / 2, elev: 4, dist: 300 }],                                                  // side on: the stand's profile is the "n" of the logo
      ['one-piece', 0.6, { rotY: -1.1, elev: 12, dist: 320, ribs: 7 }, { eases: { ribs: 'spin' } }],
      ['slot', 0.6, { ribs: 0, rotY: -0.3, elev: 54, dist: 290, ty: -16, xray: 1, glow: 1 }, { eases: { xray: 'enter', glow: 'enter', ribs: 'enter' } }],   // looking down through the stand at the slot
      ['made-to-order', 0.6, { xray: 0, glow: 0, rotY: -0.5, elev: 12, dist: 330, ty: 0 }, { color: CONFIG.cycle[2], eases: { xray: 'enter', glow: 'enter' } }],
    ]),
  },
} };
