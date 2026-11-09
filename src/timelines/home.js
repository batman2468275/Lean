/* Home. The wordmark writes itself and the stand rises on load (a time-based intro in main.js), then scrolling tells the product in order:
   one piece -> seven ribs -> charge where it stands -> two colour moments -> the MagSafe snap. Then the page's panels (pictures, cards, buy).
   Chapter lengths in screens: hero --h 1.8 (L 0.8), story --h 4.4 (L 3.4). The `seq` weights below are screens of scroll and must add up to --h minus 1. */
import { seq } from '../timeline.js';
import { CONFIG } from '../config.js';
const [C1, C2] = [CONFIG.cycle[2], CONFIG.cycle[3]];   // two colours from the cycle (the Colors page shows all of them)
export default { chapters: {
  hero: {
    start: { rotY: 0.62, sy: 0.2, dist: 400, elev: 9, idle: 1 },
    beats: seq([
      ['hello', 0.4, { rotY: 0.3, sy: 0.2, dist: 400, elev: 10 }],                                            // headline and buttons on screen, the stand drifting
      ['turn', 0.4, { rotY: -0.42, sy: -0.09, dist: 330, elev: 12, idle: 0 }],                                // a slow turn to show the profile
    ]),
  },
  story: {
    start: { rotY: -0.5, sx: 0.17, sy: 0, dist: 340, elev: 12 },
    beats: seq([
      ['one-piece', 0.5, { rotY: -0.95, dist: 320, elev: 10 }],
      ['ribs', 0.6, { ribs: 7, rotY: -1.2, dist: 300, elev: 10 }, { eases: { ribs: 'spin' } }],              // the ribs light up one by one, the counter follows
      ['charge', 0.7, { ribs: 0, rotY: -0.3, phone: 1, cable: 1, pct: 86, elev: 12, dist: 520, ty: 18 }, { eases: { phone: 'enter', cable: 'spin', pct: 'spin', ribs: 'enter' } }],
      ['shade-1', 0.5, { rotY: 0.2, phone: 0, cable: 0, pct: 12, dist: 340, ty: 0, elev: 12 }, { color: C1, eases: { phone: 'enter', cable: 'enter' } }],
      ['shade-2', 0.5, { rotY: 0.9 }, { color: C2, ease: 'spin' }],
      ['snap', 0.6, { rotY: -0.45, mag: 1, blank: 1, logo: 0, snap: 1, dist: 540, ty: 20 }, { eases: { snap: 'spin' } }],   // five magnets, the phone snaps on
    ]),
  },
} };
