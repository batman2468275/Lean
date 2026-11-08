/* Home. The wordmark writes itself and the stand rises on load (a time-based intro in main.js), then scrolling turns the stand slowly. */
export default { chapters: {
  hero: {
    start: { rotY: 0.62, sy: 0.2, dist: 400, elev: 9, idle: 1 },
    beats: [
      { name: 'hello', from: 0, to: 0.34, pose: { rotY: 0.3, sy: 0.2, dist: 400, elev: 10 } },                        // headline and buttons on screen, the stand drifting
      { name: 'turn', from: 0.34, to: 1, pose: { rotY: -0.42, sy: -0.09, dist: 330, elev: 12, idle: 0 } },               // a slow turn to show the profile
    ],
  },
} };
