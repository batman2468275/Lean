/* Colors. An intro (both models, the default colour), then one beat per colour built from CONFIG.cycle: each colour is held for its slice of the scroll and the change is a clean
   radial wipe from the base (the beat's `color` starts the wipe). Both models stand side by side. The pair turns one steady revolution and a half... linear, so the spin never
   speeds up or stops at a beat boundary. Then a line-up beat with all five in a row and a buy button.
   Screens of scroll: intro 1.0 + 5 x 1.05 + lineup 1.15 = 7.4 (--h 8.4). */
import { seq } from '../timeline.js';
import { CONFIG } from '../config.js';
const TURN = Math.PI * 2 * 2;
const N = CONFIG.cycle.length, W = 1.05;
export default { chapters: {
  colors: {
    start: { rotY: -0.3, sx: 0, sy: -0.03, dist: 480, elev: 10, ty: 0, scale: 1, cx: -52, px: 52, pairw: 1, cut: 0, logo: 1 },
    beats: seq([
      ['intro', 1.0, { rotY: -0.3 }],
      ...CONFIG.cycle.map((id, i) => [id, W, { rotY: -0.3 + TURN * ((i + 1) / N) }, { ease: 'spin', color: id }]),
      ['lineup', 1.15, { rotY: -0.3 + TURN + 0.35, elev: 14 }],
    ]),
  },
} };
