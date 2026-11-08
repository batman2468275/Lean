/* The product pictures: ONE entry per image. Pages ask for a picture by id (see `shot()` in main.js and the `[data-shot]` markup); nothing else lists images.
   Every picture is a RENDER of the real print files (tools/shot_specs.js, tools/render_shots.cjs), never a photo and never AI-made. Each exists at 1200 px and at 640 px (`<id>@640.webp`).
   Real photos: put `assets/photos/<id>.webp` (any size, same framing idea) next to a render's id and the build uses it instead and drops the "Render" caption (docs/images.md).
   Names (models, colours, phone sizes) come from CONFIG, so alt text never goes stale. Alt text says what is actually visible in the picture. */
import { CONFIG } from './config.js';

const V = Object.fromEntries(CONFIG.variants.map((v) => [v.id, v]));
const C = Object.fromEntries(CONFIG.colors.map((c) => [c.id, c]));
const P = Object.fromEntries(CONFIG.phoneSizes.map((p) => [p.id, p]));
const DEF = CONFIG.defaultColor;
const vn = (m) => V[m].name, cn = (c) => C[c].name;
const stand = (m, c = DEF) => `The ${vn(m)} stand in ${cn(c)}`;
const SQ = [1200, 1200];

const list = [];
const add = (id, [width, height], alt, model, colour, view) => list.push({ id, file: id + '.webp', width, height, alt, model, colour, view });

for (const m of ['plain', 'cutout']) {
  const slot = m === 'cutout' ? ', with the slot for a cable in its base' : ', with a solid base';
  add(`${m}-3q-left`, SQ, `${stand(m)} seen from the front left: seven rounded ribs, the leaning face and the lip at the bottom`, m, DEF, '3q-left');
  add(`${m}-3q-right`, SQ, `${stand(m)} seen from the front right, the ribs running up the leaning face`, m, DEF, '3q-right');
  add(`${m}-back`, SQ, `${stand(m)} seen from behind: the rear leg and the foot${slot}`, m, DEF, 'back');
  add(`${m}-top`, SQ, `${stand(m)} seen from above, the ribbed face and the lip${m === 'cutout' ? ' and the slot in the base' : ''}`, m, DEF, 'top');
  add(`${m}-lip`, SQ, `Close-up of the lip at the bottom of the ${vn(m)} stand, where the phone's edge rests`, m, DEF, 'lip');
  add(`${m}-ribs`, SQ, `Close-up of the ${vn(m)} stand's ribs where they arch over the top, each one rounded`, m, DEF, 'ribs');
  add(`${m}-phone-portrait`, SQ, `A phone standing upright in portrait on the ${vn(m)} stand, leaning back against the ribs`, m, DEF, 'phone-portrait');
  add(`${m}-phone-landscape`, SQ, `A phone lying sideways in landscape on the ${vn(m)} stand`, m, DEF, 'phone-landscape');
}
add('cutout-cable-slot', SQ, `A charging cable passing through the slot in the base of the ${vn('cutout')} stand, plugged into a phone that stands on it`, 'cutout', DEF, 'cable');
add('cutout-underside', SQ, `The ${vn('cutout')} stand seen from underneath, showing the slot through the base`, 'cutout', DEF, 'underside');

add('magsafe-arc', SQ, `Close-up of the five round magnets set in pockets, one in each rib, along a gentle arc on the ${vn('cutout')} stand's face`, 'cutout', DEF, 'magsafe-arc');
for (const p of CONFIG.phoneSizes) add(`magsafe-${p.id}`, SQ, `The ${p.name} MagSafe stand (${p.short}) with a see-through phone of that size on it, showing where the five magnets land`, 'cutout', DEF, `magsafe-${p.id}`);
add('magsafe-exploded', SQ, `The five magnets lifted out of their pockets above the stand's face, to show how they sit one per rib`, 'cutout', DEF, 'magsafe-exploded');

for (const c of CONFIG.colors) for (const m of ['plain', 'cutout']) add(`${m}-3q-${c.id}`, SQ, `${stand(m, c.id)}, seen from the front left`, m, c.id, '3q-left');

add('group-colors', [1200, 400], `The stand in all ${CONFIG.colors.length} colours in a row: ${CONFIG.colors.map((c) => c.name).join(', ')}`, 'cutout', null, 'group-colors');
add('group-pair', [1200, 640], `The ${vn('plain')} stand and the ${vn('cutout')} stand side by side`, null, DEF, 'group-pair');
add('group-range', [1200, 760], `The whole range: both models in every colour, ${vn('plain')} at the back and ${vn('cutout')} at the front`, null, null, 'group-range');

add('plain-logo-light', SQ, `The Lean wordmark printed on the leaning face of the ${cn('arctic')} ${vn('plain')} stand, in dark ink`, 'plain', 'arctic', 'logo');
add('cutout-logo-dark', SQ, `The Lean wordmark printed on the leaning face of the ${cn('black')} ${vn('cutout')} stand, in white ink`, 'cutout', 'black', 'logo');
add('plain-logo-text', SQ, `A line of the customer's own text, an example word, printed on the leaning face of the ${cn('sky')} ${vn('plain')} stand`, 'plain', 'sky', 'logo-text');

// the original studio set: white-base renders that the page tints (and a real dark set for Black). Kept as they were.
for (const m of ['plain', 'cutout']) {
  add(`${m}-front`, SQ, `${stand(m)} from the front`, m, null, 'front');
  add(`${m}-side`, SQ, `${stand(m)} from the side, showing the lean`, m, null, 'side');
  add(`${m}-detail`, SQ, m === 'cutout' ? `Close-up of the ${vn(m)} stand's base with the slot` : `Close-up of the ${vn(m)} stand's solid base`, m, null, 'detail');
  add(`${m}-front-black`, SQ, `${stand(m, 'black')} from the front`, m, 'black', 'front');
  add(`${m}-side-black`, SQ, `${stand(m, 'black')} from the side, showing the lean`, m, 'black', 'side');
  add(`${m}-detail-black`, SQ, m === 'cutout' ? `Close-up of the ${cn('black')} ${vn(m)} stand's base with the slot` : `Close-up of the ${cn('black')} ${vn(m)} stand's solid base`, m, 'black', 'detail');
}

export const SHOTS = list;
export const SHOT_BY_ID = Object.fromEntries(list.map((s) => [s.id, s]));
/** the pictures a page can ask for, by model/colour/view, e.g. shotsFor({ model: 'cutout' }) */
export const shotsFor = (q) => list.filter((s) => Object.entries(q).every(([k, v]) => s[k] === v));
/** 1200 px and 640 px URLs plus a srcset for an <img>. `base` is the asset base ('/' or ''), `photos` the set of ids that have a real photo in assets/photos. */
export function shotSources(id, base = '/', photos = null) {
  const s = SHOT_BY_ID[id]; if (!s) return null;
  const real = !!(photos && photos.has(id)), dir = real ? 'assets/photos/' : 'assets/renders/';
  const big = `${base}${dir}${id}.webp`, small = real ? big : `${base}${dir}${id}@640.webp`;
  return { ...s, src: big, srcset: real ? '' : `${small} 640w, ${big} 1200w`, real };
}
