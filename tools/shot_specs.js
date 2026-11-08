// What to photograph, as data: one spec per product still. Used by tools/shots_harness.js (the scene) and checked against the manifest (src/shots.js) by tests/shots.test.mjs.
// Colours come from CONFIG (never typed here). Camera: az = degrees around the stand (0 = from the front, where the lip points; negative = from the viewer's left),
// el = elevation in degrees, dist in mm, target in model mm (the stand's centre is about y = 0, the floor is at y = -37.6).
// Colours show their TRUE colour: tools/shot_gains.json holds one albedo gain per colour (written by `npm run render:shots -- --calibrate`), applied in the harness, so a mixed group is right too.
import { CONFIG } from '../src/config.js';

const hex = (id) => CONFIG.colors.find((c) => c.id === id).hex;
const DEF = CONFIG.defaultColor;
const SQ = [1200, 1200];
export const MODELS = ['plain', 'cutout'];
const stand = (variant, color, extra = {}) => ({ variant, color: hex(color), ...extra });
const cam = (az, el, dist, target = [0, -3, 0], fov = 28) => ({ az, el, dist, target, fov });

export const SPECS = {};
const add = (id, spec) => { SPECS[id] = { size: SQ, ...spec }; };

for (const m of MODELS) {
  const s = (extra) => [stand(m, DEF, extra)];
  add(`${m}-3q-left`, { stands: s(), cam: cam(-35, 14, 228) });
  add(`${m}-3q-right`, { stands: s(), cam: cam(35, 14, 228) });
  add(`${m}-back`, { stands: s({ rotY: Math.PI }), cam: cam(-30, 12, 228) });   // turn the stand, not the camera, so the key light and the shadow fall the same way as in every other picture
  add(`${m}-top`, { stands: s(), cam: cam(-18, 80, 250) });
  add(`${m}-lip`, { stands: s(), cam: cam(-38, 20, 120, [0, -22, 16]) });
  add(`${m}-ribs`, { stands: s(), cam: cam(-34, 42, 105, [0, 24, -14], 26) });
  add(`${m}-phone-portrait`, { stands: s({ phone: { orient: 'portrait' } }), cam: cam(-30, 12, 410, [0, 28, 6]) });
  add(`${m}-phone-landscape`, { stands: s({ phone: { orient: 'landscape' } }), cam: cam(-26, 12, 360, [0, 10, 6]) });
}
add('cutout-cable-slot', { stands: [stand('cutout', DEF, { phone: { orient: 'portrait' }, cable: true })], cam: cam(-28, 12, 300, [10, -12, 20]) });
add('cutout-underside', { stands: [stand('cutout', DEF)], cam: cam(-14, -62, 150, [0, -37, 17], 28) });

// MagSafe: the arc of five magnets (from the same geometry the print files use), the three phone sizes with a see-through phone of that size, and an exploded view
add('magsafe-arc', { stands: [stand('cutout', DEF, { mags: CONFIG.defaultPhoneSize })], cam: cam(-30, 24, 150, [0, 14, 4], 26) });
for (const p of CONFIG.phoneSizes) add(`magsafe-${p.id}`, { stands: [stand('cutout', DEF, { mags: p.id, phone: { size: p.id, ghost: true, orient: 'portrait' } })], cam: cam(-28, 12, 440, [0, 26, 6]) });
add('magsafe-exploded', { stands: [stand('cutout', DEF, { mags: CONFIG.defaultPhoneSize, spread: 20 })], cam: cam(-50, 20, 150, [0, 14, 12], 26) });

// colourways: every colour on both models, true colour (calibrated exposure, neutral light)
for (const c of CONFIG.colors) for (const m of MODELS) add(`${m}-3q-${c.id}`, { stands: [stand(m, c.id)], cam: cam(-35, 14, 228) });

// groups
add('group-colors', { size: [1200, 400], shadowExtent: 280, stands: CONFIG.colors.map((c, i) => stand('cutout', c.id, { x: (i - 2) * 66, rotY: 0.42 })), cam: cam(0, 11, 312, [0, 0, 0]) });
add('group-pair', { size: [1200, 640], shadowExtent: 200, stands: [stand('plain', DEF, { x: -42, rotY: 0.4 }), stand('cutout', DEF, { x: 42, rotY: 0.4 })], cam: cam(0, 12, 215, [0, 0, 0]) });
add('group-range', { size: [1200, 760], shadowExtent: 340, stands: [...CONFIG.colors.map((c, i) => stand('plain', c.id, { x: (i - 2) * 72, z: -90, rotY: 0.42 })), ...CONFIG.colors.map((c, i) => stand('cutout', c.id, { x: (i - 2) * 72, z: 30, rotY: 0.42 }))], cam: cam(0, 27, 575, [0, 0, -30]) });

// logo: the wordmark decal on a light and on a dark stand (ink follows the colour, as on the site), and a line of the customer's own text
add('plain-logo-light', { stands: [stand('plain', 'arctic', { decal: { mode: 'brand' } })], cam: cam(-26, 11, 205, [0, 4, 2], 26) });
add('cutout-logo-dark', { stands: [stand('cutout', 'black', { decal: { mode: 'brand' } })], cam: cam(-26, 11, 205, [0, 4, 2], 26) });
add('plain-logo-text', { stands: [stand('plain', 'sky', { decal: { mode: 'text', text: 'Wren' } })], cam: cam(-26, 11, 205, [0, 4, 2], 26) });
