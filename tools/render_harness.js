// Studio render harness: draws the real Lean meshes on a transparent canvas with the same lights/material as the site.
// Bundled and driven by tools/render_views.cjs. Exposes window.renderView(variant, view).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const META = window.__META__;
const SIZE = window.__SIZE__ || 2400;

function loadGeo(b64) {
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = u8.buffer; const dv = new DataView(buf); const nV = dv.getUint32(0, true), nF = dv.getUint32(4, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nV * 3), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, 8 + nV * 12, nF * 3), 1));
  return toCreasedNormals(g, 0.62);
}
const geos = { cutout: loadGeo(window.__MODEL_CUT__), plain: loadGeo(window.__MODEL_PLAIN__) };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = window.__EXPOSURE__ || 1.0;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-150, 270, 230); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 20, far: 800 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5; key.shadow.radius = 7;
scene.add(key);
const rim = new THREE.DirectionalLight(0xcfffe2, 2.1); rim.position.set(210, 130, -250); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xbfd6ff, 1.1); rim2.position.set(-250, 90, -150); scene.add(rim2);
scene.add(new THREE.HemisphereLight(0xffffff, 0x1a221d, 0.35));

// neutral white plastic: any colour is applied on top later (multiply), so the shading stays the same
const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.46, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.5 });
const stand = new THREE.Mesh(geos.cutout, mat); stand.castShadow = true; stand.receiveShadow = true; scene.add(stand);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShadowMaterial({ opacity: 0.5 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = META.floor_y - 0.05; floor.receiveShadow = true; scene.add(floor);

const camera = new THREE.PerspectiveCamera(28, 1, 20, 3000);

// views: rotY of the stand, camera elevation (deg), distance, look-at height (ty) or an explicit target
export const VIEWS = {
  front:  { rotY: 0.55,  elev: 13, dist: 222, ty: -3, tx: -4 },
  side:   { rotY: -Math.PI / 2, elev: 2, dist: 222, ty: -3, tx: 0 },
  // from under the lip, looking up the slot: shows the cable opening (or the solid base on the Regular model), no cropping
  detail: { rotY: -0.35, rel: [-120, 95], ty: 6 },
};
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const slotTarget = V3(META.corner).addScaledVector(V3(META.slope.normal).normalize(), 3.2).addScaledVector(V3(META.slope.up).normalize(), 3.5);

// pass 'stand': the stand alone (transparent). pass 'shadow': only the cast shadow (blurred later, so it is soft)
// neutral: white rim lights instead of the site's tinted ones, so a dark colour (Black) is not tinted green/blue at its edges
window.setLook = ({ color = 0xffffff, exposure = 1, neutral = false } = {}) => {
  mat.color.set(color); renderer.toneMappingExposure = exposure;
  rim.color.set(neutral ? 0xffffff : 0xcfffe2); rim2.color.set(neutral ? 0xffffff : 0xbfd6ff);
};
window.renderView = (variant, view, over = {}) => {
  const v = { ...VIEWS[view], ...over };
  const pass = over.pass || 'stand';
  stand.geometry = geos[variant];
  stand.rotation.y = v.rotY;
  floor.visible = pass === 'shadow';
  mat.colorWrite = pass !== 'shadow'; mat.depthWrite = pass !== 'shadow';
  if (v.rel) {
    // free camera in the model frame: target on the slot, camera = target + sUp*rel[0] + nOut*rel[1] (negative rel[0] looks up from under the lip)
    const Y = new THREE.Vector3(0, 1, 0);
    const t = slotTarget.clone().add(new THREE.Vector3(0, v.ty || 0, 0)).applyAxisAngle(Y, v.rotY);
    const off = V3(META.slope.up).normalize().multiplyScalar(v.rel[0]).add(V3(META.slope.normal).normalize().multiplyScalar(v.rel[1])).applyAxisAngle(Y, v.rotY);
    camera.position.copy(t).add(off); camera.up.set(0, 1, 0); camera.lookAt(t);
  } else if (v.slot) {
    // aim at a point on the slope face a little above the corner, look from the front at v.elev so the slot opening reads
    const Y = new THREE.Vector3(0, 1, 0);
    const tm = V3(META.corner).addScaledVector(V3(META.slope.normal).normalize(), 3).addScaledVector(V3(META.slope.up).normalize(), v.up);
    const t = tm.applyAxisAngle(Y, v.rotY);
    const el = v.elev * Math.PI / 180;
    camera.position.set(t.x, t.y + Math.sin(el) * v.dist, t.z + Math.cos(el) * v.dist); camera.up.set(0, 1, 0); camera.lookAt(t);
  } else {
    const el = v.elev * Math.PI / 180; const t = new THREE.Vector3(v.tx || 0, v.ty, 0);
    camera.position.set(t.x, t.y + Math.sin(el) * v.dist, t.z + Math.cos(el) * v.dist);
    camera.lookAt(t);
  }
  camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  return canvas.toDataURL('image/png');
};
window.__ready = true;
