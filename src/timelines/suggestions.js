/* Suggestions. A slow turn beside the headline, then how it works and what voting does. Screens of scroll: 2.2 (--h 3.2). */
import { seq } from '../timeline.js';
export default { chapters: {
  ideas: {
    start: { rotY: -0.2, sx: 0.2, sy: 0.02, dist: 340, elev: 11, idle: 1 },
    beats: seq([
      ['ideas', 0.7, { rotY: 0.3, idle: 0 }],
      ['how', 0.8, { rotY: 0.9, elev: 14 }],
      ['vote', 0.7, { rotY: 1.5, elev: 11 }],
    ]),
  },
} };
