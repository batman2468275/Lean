/* Colors. One beat per colour, built from CONFIG.cycle: each colour is held for its slice of the scroll and the change is a clean radial wipe from the base
   (the beat's `color` starts the wipe). The stand turns one steady revolution and a half... linear, so the spin never speeds up or stops at a beat boundary. */
import { CONFIG } from '../config.js';
const TURN = Math.PI * 2 * 2;
const N = CONFIG.cycle.length;
export default { chapters: {
  colors: {
    start: { rotY: -0.3, sx: 0, sy: -0.03, dist: 350, elev: 10, ty: 0, scale: 1.08 },
    beats: CONFIG.cycle.map((id, i) => ({ name: id, from: i / N, to: (i + 1) / N, ease: 'spin', pose: { rotY: -0.3 + TURN * ((i + 1) / N) }, color: id })),
  },
} };
