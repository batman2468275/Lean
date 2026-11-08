/* Design. The seven ribs light up one by one as the copy counts them, the lean-angle arc sweeps to 67 degrees, the dimension lines draw with leaders. */
export default { chapters: {
  design: {
    start: { rotY: -0.95, sx: 0.19, sy: 0, dist: 300, elev: 8, ribs: 0, arc: 0, dim: 0 },
    beats: [
      { name: 'ribs', from: 0, to: 0.34, pose: { ribs: 7, rotY: -1.2, dist: 290, elev: 10 }, eases: { ribs: 'spin' } },
      { name: 'lean', from: 0.34, to: 0.68, pose: { ribs: 0, rotY: -Math.PI / 2, dist: 296, elev: 4, arc: 1 }, eases: { arc: 'enter', ribs: 'enter' } },
      { name: 'footprint', from: 0.68, to: 1, pose: { dim: 1, elev: 4 }, eases: { dim: 'enter' } },
    ],
  },
} };
