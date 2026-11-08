/* Geometry of the things that sit ON the stand: the MagSafe pads and magnets, the phone slab, the plug and the cable.
   ONE code path: src/main.js (the live scene) and tools/render_harness.js (the product stills, `npm run render:shots`) both build these from here, driven by
   build/magsafe.json and build/meta.json, so a picture of the magnets shows them exactly where the print files put them. Pure geometry: no scene, no DOM. */
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Pad top above the rib crest plane. The print file uses 0.02 (tools/magsafe_params.json), but the web mesh still has its ribs (they are only cut in the print file),
 *  so the overlay sits 0.45 mm proud: the uncut rib tops stay hidden under the pad and under the magnet instead of poking through. */
export const PAD_TOP = 0.45;
/** the phone slab (a generic phone shape, no brand): width, height, thickness in mm; thickness comes from the model metadata */
export const phoneSize = (META) => ({ w: 71.5, h: 147, t: META.phone_t });

export const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** the model frame: slope up/normal, the corner where the slope meets the lip, the floor */
export function frameOf(META) {
  const sUp = V3(META.slope.up).normalize(), nOut = V3(META.slope.normal).normalize();
  return { sUp, nOut, sDown: sUp.clone().negate(), corner: V3(META.corner), X: new THREE.Vector3(1, 0, 0), floorY: META.floor_y };
}

export function roundedRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** the five pads (flared skirt, flat top, chamfered pocket) and the five magnets for one phone size, baked into MODEL space (so a colour wipe lines up with the stand).
 *  Returns two merged geometries; `spread` lifts the magnets out of their pockets along the slope normal (the exploded view). */
export function magnetGeometries(MAG, sizeId, nOut, spread = 0) {
  const g = MAG.pocket, mg = MAG.magnet;
  // pad profile (radius, height above the crest plane): flared skirt up to the flat top, chamfered pocket, pocket floor. Same numbers as the print file.
  const prof = [[6.2, -3.5], [4.4, PAD_TOP], [g.radius + g.chamfer, PAD_TOP], [g.radius, PAD_TOP - g.chamfer], [g.radius, PAD_TOP - g.depth], [0, PAD_TOP - g.depth]].map(([r, y]) => new THREE.Vector2(r, y));
  const pad0 = toCreasedNormals(new THREE.LatheGeometry(prof, 48), 0.6);
  const mag0 = new THREE.CylinderGeometry(mg.diameter / 2, mg.diameter / 2, mg.thickness, 40).translate(0, PAD_TOP - g.depth + mg.thickness / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nOut);
  const pads = [], mags = [];
  for (const m of MAG.sizes[sizeId].magnets) {
    const M = new THREE.Matrix4().compose(V3(m.centre), q, new THREE.Vector3(1, 1, 1));
    pads.push(pad0.clone().applyMatrix4(M));
    const mg1 = mag0.clone(); if (spread) mg1.translate(0, spread, 0); mags.push(mg1.applyMatrix4(M));
  }
  pad0.dispose(); mag0.dispose();
  return { pads: mergeGeometries(pads), mags: mergeGeometries(mags) };
}

/** the phone slab: a rounded body and a screen face (uv-mapped for a canvas texture). Both are centred on the origin, facing +Z. */
export function phoneGeometries(PH) {
  const body = new THREE.ExtrudeGeometry(roundedRect(PH.w, PH.h, 10), { depth: PH.t - 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 14 });
  body.translate(0, 0, -(PH.t - 0.6) / 2);
  const screen = new THREE.ShapeGeometry(roundedRect(PH.w - 3.4, PH.h - 3.4, 8), 12);
  const sp = screen.attributes.position, su = new Float32Array(sp.count * 2);
  for (let i = 0; i < sp.count; i++) { su[i * 2] = (sp.getX(i) + (PH.w - 3.4) / 2) / (PH.w - 3.4); su[i * 2 + 1] = (sp.getY(i) + (PH.h - 3.4) / 2) / (PH.h - 3.4); }
  screen.setAttribute('uv', new THREE.BufferAttribute(su, 2));
  return { body, screen };
}

/** the USB plug (a rounded block, 10 mm long) */
export const plugGeometry = () => new THREE.ExtrudeGeometry(roundedRect(11.6, 5.8, 2.4), { depth: 10, bevelEnabled: false, curveSegments: 10 });

/** the charging cable: from the phone's port, down through the slot in the base, out across the floor. `portPos` is where the plug meets the phone. */
export function cableCurve(portPos, sDown, floorY) {
  const yT = floorY + 1.65;
  const C = portPos.clone().addScaledVector(sDown, (portPos.y - (yT + 4.5)) / -sDown.y);
  const pts = [
    portPos.clone().addScaledVector(sDown, 10), portPos.clone().addScaledVector(sDown, 16), C,
    new THREE.Vector3(C.x + 0.6, yT, C.z + 6), new THREE.Vector3(C.x + 7, yT, C.z + 20),
    new THREE.Vector3(C.x + 20, yT, C.z + 36), new THREE.Vector3(C.x + 40, yT, C.z + 52),
  ].reverse();
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}
