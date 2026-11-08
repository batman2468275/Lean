// Studio harness for the PRODUCT STILLS (assets/renders/*, manifest src/shots.js). Bundled and driven by tools/render_shots.cjs.
// It draws the real print meshes (build/model_*.bin) with the real MagSafe geometry (build/magsafe.json via src/props.js, the same code the live scene uses), the site's phone slab,
// plug and cable, and the wordmark decal, on a transparent canvas, in two passes: the stand alone, and only its cast shadow (blurred later, so the shadow is soft and separate).
// Lighting is NEUTRAL white (no coloured rim lights) so a colourway shows its true colour; near-black stands get the same glossier coat as the live scene.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { magnetGeometries, phoneGeometries, plugGeometry, cableCurve, phoneSize, frameOf } from '../src/props.js';
import { SPECS } from './shot_specs.js';

const META = window.__META__, MAG = window.__MAG__, LOGO = window.__LOGO__, PARAMS = window.__PARAMS__;
const GAINS = window.__GAINS__ || {};                // hex (lower case) -> albedo gain that makes the lit face read as that hex (tools/shot_gains.json)
let gainOverride = null;                             // used by the calibration run
const F = frameOf(META), PH = phoneSize(META);

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
renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-150, 270, 230); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5; key.shadow.radius = 7;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(210, 130, -250); scene.add(rim);      // neutral white rims: no green or blue at the edges
const rim2 = new THREE.DirectionalLight(0xffffff, 0.8); rim2.position.set(-250, 90, -150); scene.add(rim2);
scene.add(new THREE.HemisphereLight(0xffffff, 0x1a221d, 0.35));
const under = new THREE.DirectionalLight(0xffffff, 0); under.position.set(60, -220, 140); scene.add(under);   // only switched on for pictures taken from below the floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ opacity: 0.5 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = META.floor_y - 0.05; floor.receiveShadow = true; scene.add(floor);
const root = new THREE.Group(); scene.add(root);
const camera = new THREE.PerspectiveCamera(28, 1, 5, 4000);

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function standMaterial(hex) {
  const k = gainOverride != null ? gainOverride : (GAINS[hex.toLowerCase()] ?? 1);
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex).multiplyScalar(k), roughness: 0.46, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.5 });
  const dk = smooth(1 - lum(new THREE.Color(hex)), 0.86, 0.98);   // near-black: the same glossier coat and extra reflection as the live scene (styledFor in src/main.js)
  m.clearcoat = 0.28 + 0.5 * dk; m.clearcoatRoughness = 0.5 - 0.3 * dk; m.envMapIntensity = 1 + 0.9 * dk;
  return m;
}
const inkFor = (hex) => (lum(new THREE.Color(hex)) > 0.25 ? '#15171a' : '#ffffff');   // same rule as the site

// ---- the wordmark / text decal, projected on the slope exactly like the live scene ----
function decalMesh(d, hex) {
  const ink = inkFor(hex), cv = document.createElement('canvas');
  let aspect;
  if (d.mode === 'text') {
    const fs = 300, font = `700 ${fs}px Geist, "SF Pro Display", system-ui, sans-serif`, c = cv.getContext('2d'); c.font = font; c.letterSpacing = '2px';
    const W = Math.min(4000, Math.max(300, Math.ceil(c.measureText(d.text).width) + 60)), H = Math.round(fs * 1.3);
    cv.width = W; cv.height = H; const c2 = cv.getContext('2d'); c2.font = font; c2.letterSpacing = '2px'; c2.fillStyle = ink; c2.textBaseline = 'middle'; c2.textAlign = 'center';
    c2.fillText(d.text, W / 2 + 1, H / 2 + fs * 0.04); aspect = W / H;
  } else {
    const EXTRA = 8, K = 3.2, PAD = 36, [vx, vy, vw, vh] = LOGO.viewBox, m = EXTRA / 2;
    const W = Math.ceil((vw + EXTRA) * K + PAD * 2), H = Math.ceil((vh + EXTRA) * K + PAD * 2); cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d'); c2.setTransform(K, 0, 0, K, PAD - (vx - m) * K, PAD - (vy - m) * K);
    c2.fillStyle = ink; c2.strokeStyle = ink; c2.lineJoin = 'round'; c2.lineCap = 'round';
    const L = new Path2D(LOGO.letters), N = new Path2D(LOGO.n);
    c2.lineWidth = EXTRA; c2.fill(L); c2.stroke(L); c2.lineWidth = LOGO.stroke + EXTRA; c2.stroke(N); aspect = W / H;
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const point = F.corner.clone().addScaledVector(F.sUp, 33), w = 38 * (d.size || 0.85), h = w / aspect;
  const helper = new THREE.Object3D(); helper.position.copy(point); helper.lookAt(point.clone().add(F.nOut));
  const dg = new DecalGeometry(new THREE.Mesh(geos.plain), point, helper.rotation, new THREE.Vector3(w, h, 14));
  const mesh = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false }));
  mesh.renderOrder = 2; mesh.receiveShadow = true; return mesh;
}

// ---- the phone slab: solid (dark glass, a quiet screen) or a GHOST (see-through, so the magnets behind it stay visible) ----
function screenTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 528; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 528); g.addColorStop(0, '#0c1410'); g.addColorStop(1, '#050706'); c.fillStyle = g; c.fillRect(0, 0, 256, 528);
  c.lineWidth = 12; c.strokeStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.arc(128, 236, 76, 0, Math.PI * 2); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function phoneGroup(p) {
  const h = p.size ? PARAMS.sizes[p.size].height : PH.h, w = h * (PH.w / PH.h), t = PH.t, g = new THREE.Group();
  const { body, screen } = phoneGeometries({ w, h, t });
  const bm = p.ghost ? new THREE.MeshPhysicalMaterial({ color: 0x9fb0c0, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.26, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0x1b1d1f, roughness: 0.35, metalness: 0.75 });
  const bodyMesh = new THREE.Mesh(body, bm); bodyMesh.castShadow = !p.ghost; g.add(bodyMesh);
  if (!p.ghost) { const sm = new THREE.Mesh(screen, new THREE.MeshBasicMaterial({ map: screenTexture(), toneMapped: false })); sm.position.z = t / 2 + 0.04; g.add(sm); }
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.X, F.sUp, F.nOut));
  if (p.orient === 'landscape') q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2));
  g.quaternion.copy(q);
  const along = p.orient === 'landscape' ? w : h;   // how far the phone extends up the slope
  g.position.copy(F.corner).addScaledVector(F.nOut, 0.9 + t / 2 + (p.lift || 0)).addScaledVector(F.sUp, 0.5 + along / 2);
  return g;
}

function buildStand(s) {
  const g = new THREE.Group(); g.position.set(s.x || 0, 0, s.z || 0); g.rotation.y = s.rotY || 0; g.scale.setScalar(s.scale || 1);
  if (s.tiltX) g.rotation.x = s.tiltX;
  const mat = standMaterial(s.color), mesh = new THREE.Mesh(geos[s.variant], mat); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  if (s.mags) {
    const { pads, mags } = magnetGeometries(MAG, s.mags, F.nOut, s.spread || 0);
    const pm = new THREE.Mesh(pads, mat); pm.castShadow = true; pm.receiveShadow = true;
    const mm = new THREE.Mesh(mags, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 1, roughness: 0.42 })); mm.castShadow = true;
    g.add(pm, mm);
  }
  if (s.decal) g.add(decalMesh(s.decal, s.color));
  if (s.phone) g.add(phoneGroup(s.phone));
  if (s.cable) {   // the plug seated in the phone's port, the cable through the slot and out across the floor (the same geometry as the live cable beat)
    const portPos = F.corner.clone().addScaledVector(F.nOut, 0.9 + PH.t / 2).addScaledVector(F.sUp, 0.5);
    const plug = new THREE.Mesh(plugGeometry(), new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.5, metalness: 0.1 })); plug.castShadow = true;
    plug.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.X, F.nOut, F.sDown)); plug.position.copy(portPos); g.add(plug);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(cableCurve(portPos, F.sDown, F.floorY), 260, 1.65, 10, false), new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: 0.55 }));
    tube.castShadow = true; tube.frustumCulled = false; g.add(tube);
  }
  return g;
}

/** render one spec. pass: 'stand' | 'shadow'. `ss` supersamples (the node side downsizes). Returns a PNG data URL. */
window.renderShot = (id, pass, ss = 2, exposure) => {
  const sp = SPECS[id]; if (!sp) throw new Error('no spec ' + id);
  const [w, h] = sp.size; renderer.setSize(w * ss, h * ss, false);
  renderer.toneMappingExposure = exposure || sp.exposure || 0.8;   // one fixed exposure for every picture; colour accuracy comes from the per-colour gain
  while (root.children.length) { const c = root.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  for (const s of sp.stands) root.add(buildStand(s));
  const ext = sp.shadowExtent || 170; Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 20, far: 1200 }); key.shadow.camera.updateProjectionMatrix();
  const c = sp.cam, az = (c.az || 0) * Math.PI / 180, el = (c.el || 0) * Math.PI / 180, t = new THREE.Vector3(...(c.target || [0, -3, 0]));
  camera.fov = c.fov || 28; camera.aspect = w / h;
  camera.position.set(t.x + c.dist * Math.sin(az) * Math.cos(el), t.y + c.dist * Math.sin(el), t.z + c.dist * Math.cos(az) * Math.cos(el));
  camera.up.set(0, 1, 0); camera.lookAt(t); camera.updateProjectionMatrix();
  under.intensity = (c.el || 0) < 0 ? 1.7 : 0;
  floor.visible = pass === 'shadow';
  root.traverse((o) => { if (o.material) { o.material.colorWrite = pass !== 'shadow'; if (pass === 'shadow') o.material.depthWrite = false; } });
  scene.updateMatrixWorld(true); renderer.render(scene, camera);
  return canvas.toDataURL('image/png');
};

/** colour check: draw the stand pass of `id` (optionally with an albedo gain), return the median sRGB of the lit face (opaque pixels between the 50th and 90th luma percentile:
 *  the lit slope, without the deep shade or the specular glints) as [r, g, b] 0..255. */
window.sampleShot = (id, gain) => {
  gainOverride = gain == null ? null : gain;
  const url = window.renderShot(id, 'stand', 1); gainOverride = null;
  const w = canvas.width, h = canvas.height, c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0);
  const d = x.getImageData(0, 0, w, h).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) px.push([0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2], d[i], d[i + 1], d[i + 2]]);
  px.sort((a, b) => a[0] - b[0]);
  const lo = Math.floor(px.length * 0.5), hi = Math.floor(px.length * 0.9), med = (k) => { const v = px.slice(lo, hi).map((p) => p[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  return { rgb: [med(1), med(2), med(3)], n: px.length };
};
window.SHOT_IDS = Object.keys(SPECS);
window.__ready = true;
