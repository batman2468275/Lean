/* Design. The seven ribs light up one by one as the copy counts them, the lean-angle arc sweeps to 67 degrees, the dimension lines draw with leaders;
   then a walk round the stand: the rear leg and foot, the lip, one piece. Screens of scroll: design 2.0 (--h 3), parts 2.4 (--h 3.4). */
import { seq } from '../timeline.js';
export default { chapters: {
  design: {
    start: { rotY: -0.95, sx: 0.19, sy: 0, dist: 300, elev: 8, ribs: 0, arc: 0, dim: 0 },
    beats: seq([
      ['ribs', 0.7, { ribs: 7, rotY: -1.2, dist: 290, elev: 10 }, { eases: { ribs: 'spin' } }],
      ['lean', 0.65, { ribs: 0, rotY: -Math.PI / 2, dist: 296, elev: 4, arc: 1 }, { eases: { arc: 'enter', ribs: 'enter' } }],
      ['footprint', 0.65, { dim: 1, elev: 4 }, { eases: { dim: 'enter' } }],
    ]),
  },
  parts: {
    start: { sx: 0.19 },
    beats: seq([
      ['rear', 0.8, { dim: 0, arc: 0, rotY: -2.7, elev: 12, dist: 320 }, { eases: { dim: 'enter', arc: 'enter' } }],        // round to the back: rear leg and foot
      ['lip', 0.8, { rotY: -0.7, elev: 30, dist: 190, ty: -14 }],                                                         // close to the lip at the bottom of the face
      ['one-piece', 0.8, { rotY: -1.0, elev: 10, dist: 330, ty: 0 }],                                                     // pull back: one piece
    ]),
  },
} };
