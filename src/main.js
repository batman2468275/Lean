import { bindBoard, bindAdmin } from './suggestions.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import LOGO from './logo.json';
import { CONFIG } from './config.js';   // names, colours and prices: the only place they are defined
import * as PR from './pricing.js';     // price and bag maths (unit-tested)
import { ticket, magsafeLabel } from './order.js';   // fulfilment ticket + print file name (unit-tested)
import MAG from '../build/magsafe.json';             // magnet positions per phone size (made by tools/make_magsafe.py)
import * as ST from './store.js';                    // shared state: session + URL (unit-tested)
import { resolve } from './routes.js';               // URL -> page (unit-tested)
import { PAGES, PORTRAIT_FALLBACK } from './pages.js';   // page markup + timelines
import { compile, EASES, spring, BASE, KEYS } from './timeline.js';   // the animation system: named beats, easings, camera splines (unit-tested)

const META = window.__META__;
const BASE_URL = window.__BASE__ || '/';
/* Single-file demo (lean-demo.html, build-single.mjs): opened from disk there is no server, so pages live in the URL hash (#/models, #/customize?color=sky#order)
   and the 3D models come inline as base64. Everything else is the same code. */
const HASHMODE = !!window.__SINGLE__;
const appUrl = () => (HASHMODE ? (location.hash.slice(1) || '/') : location.pathname + location.search + location.hash);   // the page the visitor is on
const appSearch = () => (HASHMODE ? new URL(appUrl(), 'https://demo.invalid').search : location.search);
const appHash = () => (HASHMODE ? new URL(appUrl(), 'https://demo.invalid').hash : location.hash);
// History can be refused (a sandboxed preview pane, a locked-down browser): the page must still work then, just without URL updates and Back.
const writeUrl = (replace, state, url) => { try { history[replace ? 'replaceState' : 'pushState'](state, '', HASHMODE ? '#' + url : url); } catch (e) { /* ignore */ } };
const b64 = (t) => { const bin = atob(t), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; };   // where the site is served from (assets live under BASE_URL + 'assets/')
const MODELS = {};                         // model meshes, fetched at boot (assets/model_*.bin)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const instant = reduce || !!window.__NOSMOOTH;
/* $ never returns null: a missing element resolves to a detached one, so page code can touch ids that only exist on some pages (the pages share one script) */
const SINK = document.createElement('div');
const $ = (s, r = document) => r.querySelector(s) || SINK;
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const EASE = EASES;   // the named easings (enter, camera, spin, settle, sway) live in timeline.js; the CSS --ease-* tokens mirror them
const money = (cents) => PR.money(CONFIG, cents);
const byId = (id) => CONFIG.colors.find((c) => c.id === id);
const variantOf = (id) => PR.variantOf(CONFIG, id);
document.documentElement.classList.add('js');
const NUMWORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/* ====================================================================
   App state (shared by studio, price card and 3D scene)
   ==================================================================== */
const S = {
  variant: 'cutout',
  colorId: CONFIG.defaultColor, hex: byId(CONFIG.defaultColor).hex,
  magsafe: false,   // add-on (CONFIG.addons)
  phone: CONFIG.defaultPhoneSize,   // small | medium | large: which phone's MagSafe ring the magnets are placed for
  mode: 'brand', text: 'Your Brand',
  place: 'front', size: 85, qty: 1,
  bag: [],          // bag lines (see pricing.js addToBag)
};
const colorName = () => byId(S.colorId).name;
const selAddons = () => (S.magsafe ? ['magsafe'] : []);
const unitNow = () => PR.unitPrice(CONFIG, { variant: S.variant, addons: selAddons() });
// "$9.99 $8.49" with the list price crossed out when there is one (the markup is built here so no price lives in the HTML)
const priceHTML = (u) => (u.list != null ? `<s class="was">${money(u.list)}</s> <span class="now">${money(u.now)}</span>` : `<span class="now">${money(u.now)}</span>`);
const launchTag = (u) => (u.list != null ? `${CONFIG.launchLabel}, save ${money(u.save)}` : '');

/* ====================================================================
   Three.js scene
   ==================================================================== */
const canvas = $('#gl');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-gl');
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 20, 3000);
const pivot = new THREE.Group();   // rotates with scroll; holds stand, decal, phone and cable
scene.add(pivot);
const pivotB = new THREE.Group();  // the second (Regular) stand, only shown on the Models page
scene.add(pivotB); pivotB.visible = false;

let standMat, standMesh, standMeshC, standMesh2, floor, ground, groundTo, contact, contact2, slotGlow, cutLine, arcMesh, arcBase, magMat, phoneRoot, phoneBody, phoneScreen, plugGroup, cableMesh;
const floorY = META.floor_y;
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sUp = V3(META.slope.up).normalize();
const nOut = V3(META.slope.normal).normalize();
const sDown = sUp.clone().negate();
const corner = V3(META.corner);
const X = new THREE.Vector3(1, 0, 0);

function b64ToBuf(b64) {
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 256; screenCanvas.height = 528;
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
let screenKey = '';
function drawScreen(pct, charging, blank = false) {
  const key = pct + '|' + charging + '|' + blank;
  if (key === screenKey) return; screenKey = key;
  const c = screenCanvas.getContext('2d'); const W = 256, H = 528;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1410'); g.addColorStop(1, '#050706');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.lineWidth = 12; c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.arc(W / 2, 236, 76, 0, TAU); c.stroke();
  if (blank) { screenTex.needsUpdate = true; return; }   // MagSafe story: a plain dark screen, no charging UI
  c.strokeStyle = '#8fc27a'; c.shadowColor = 'rgba(143,194,122,.7)'; c.shadowBlur = charging ? 18 : 0;
  c.beginPath(); c.arc(W / 2, 236, 76, -Math.PI / 2, -Math.PI / 2 + TAU * (pct / 100)); c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '600 54px Geist, system-ui, sans-serif';
  c.fillText(pct + '%', W / 2, 254);
  c.fillStyle = charging ? '#8fc27a' : 'rgba(255,255,255,.5)'; c.font = '500 17px Geist, system-ui, sans-serif';
  c.fillText(charging ? 'Charging' : 'Plug in to charge', W / 2, 400);
  screenTex.needsUpdate = true;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const PH = { w: 71.5, h: 147, t: META.phone_t };
const portPos = corner.clone().addScaledVector(nOut, 0.9 + PH.t / 2).addScaledVector(sUp, 0.5);
const phoneRest = corner.clone().addScaledVector(nOut, 0.9 + PH.t / 2).addScaledVector(sUp, 0.5 + PH.h / 2);
const phoneQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, sUp, nOut));
const slotAnchor = corner.clone().addScaledVector(nOut, 4.4).addScaledVector(sUp, -0.5);
const CABLE_SEG = 260, CABLE_RAD = 10;
const cablePts = new Float32Array((CABLE_SEG + 1) * 3);   // sampled cable path (model space), for the plug
const ARC = { r: 46, seg: 48, rad: 6, az: 0, ay: 0, ang: 1 };   // lean-angle arc

const geos = {};
let logoDecal = null; let proxy = null;
const logoCanvas = document.createElement('canvas');
let logoTex = null;
function newLogoTex() {
  if (logoTex) logoTex.dispose();
  logoTex = new THREE.CanvasTexture(logoCanvas); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
}
let logoAspect = 2.6;
const surf = {
  front: { point: corner.clone().addScaledVector(sUp, 33), normal: nOut.clone(), maxW: 38 },
  back:  { point: new THREE.Vector3(0, META.rear.mid_y, META.rear.y_plane_z), normal: new THREE.Vector3(0, 0, -1), maxW: 36 },
};

/* ---------- MagSafe: where the logo goes, and the magnets in 3D ---------- */
// With MagSafe on, the front logo moves into the larger free strip of the slope (below or above the five pads) and shrinks to fit it.
function magsafeFront() {
  const z = MAG.sizes[S.phone].logo_zones; const above = (z.high[1] - z.high[0]) > (z.low[1] - z.low[0]);
  const [a, b] = above ? z.high : z.low;
  return { point: corner.clone().addScaledVector(sUp, (a + b) / 2), normal: nOut.clone(), maxW: surf.front.maxW, maxH: (b - a) * 0.82, where: above ? 'above' : 'below' };
}
let magGroup = null;
// Pad top above the rib crest plane. The print file uses 0.02 (tools/magsafe_params.json), but the web mesh still has its ribs (they are only cut in the print file),
// so the overlay sits 0.45 mm proud: the uncut rib tops stay hidden under the pad and under the magnet instead of poking through.
const PAD_TOP = 0.45;
function buildMagnets() {
  if (!renderer || !standMat) return;
  if (magGroup) { pivot.remove(magGroup); magGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = MAG.pocket, mg = MAG.magnet;
  // pad profile (radius, height above the crest plane): flared skirt up to the flat top, chamfered pocket, pocket floor. Same numbers as the print file.
  const prof = [[6.2, -3.5], [4.4, PAD_TOP], [g.radius + g.chamfer, PAD_TOP], [g.radius, PAD_TOP - g.chamfer], [g.radius, PAD_TOP - g.depth], [0, PAD_TOP - g.depth]].map(([r, y]) => new THREE.Vector2(r, y));
  const pad0 = toCreasedNormals(new THREE.LatheGeometry(prof, 48), 0.6);
  const mag0 = new THREE.CylinderGeometry(mg.diameter / 2, mg.diameter / 2, mg.thickness, 40).translate(0, PAD_TOP - g.depth + mg.thickness / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nOut);
  const pads = [], mags = [];
  for (const m of MAG.sizes[S.phone].magnets) {
    const M = new THREE.Matrix4().compose(V3(m.centre), q, new THREE.Vector3(1, 1, 1));
    pads.push(pad0.clone().applyMatrix4(M)); mags.push(mag0.clone().applyMatrix4(M));   // baked into model space so the colour wipe lines up with the stand
  }
  magGroup = new THREE.Group();
  const padMesh = new THREE.Mesh(mergeGeometries(pads), standMat); padMesh.castShadow = true; padMesh.receiveShadow = true;
  const magMesh = new THREE.Mesh(mergeGeometries(mags), magMat || (magMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 1, roughness: 0.46, emissive: 0x9ad98a, emissiveIntensity: 0 }))); magMesh.receiveShadow = true;
  magGroup.add(padMesh, magMesh); magGroup.visible = S.magsafe; pivot.add(magGroup);
  pad0.dispose(); mag0.dispose();
  invalidate();
}

/* ---------- colour changes: a clean wipe, never a blend ----------
   The stand (and the ground glow) hold one flat colour. A change radiates outward from the base of the stand: inside the front the new
   colour, outside the old one, with a soft edge. No in-between hue ever appears on the model. */
const WIPE_SECONDS = 0.95, WIPE_SOFT = 0.22;
const wipe = { from: new THREE.Color(S.hex), to: new THREE.Color(S.hex), t: 1, toHex: S.hex, fromHex: S.hex };
const wipeUniforms = [];
const SHADE = { uRibs: { value: 0 }, uXray: { value: 0 }, uScan: { value: 0 }, uScanR: { value: new THREE.Vector2(0, 75) }, uGlowCol: { value: new THREE.Color('#35f07f') } };   // shared by every stand material: ribs lit (0..7) and the x-ray look
const standMats = [];
function patchWipe(material, { origin, reach, axes, colorB = wipe.to, shade = false }) {
  const u = { uColB: { value: colorB }, uWipe: { value: 0 }, uOrigin: { value: origin }, uReach: { value: reach }, uSoft: { value: WIPE_SOFT } };
  wipeUniforms.push(u);
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (shade) Object.assign(sh.uniforms, SHADE);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = position;');
    let fs = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform vec3 uColB; uniform vec3 uOrigin; uniform float uWipe, uReach, uSoft;' + (shade ? ' uniform float uRibs, uXray, uScan; uniform vec2 uScanR; uniform vec3 uGlowCol;' : ''))
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float d = distance(${axes === 'xy' ? 'vWp.xy, uOrigin.xy' : 'vWp, uOrigin'}) / uReach;
          float f = uWipe * (1.0 + uSoft);
          diffuseColor.rgb = mix(diffuseColor.rgb, uColB, 1.0 - smoothstep(f - uSoft, f, d)); }`);
    if (shade) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float ri = floor(vWp.x / 8.3333 + 3.5);                                     // which of the seven ribs this fragment is on (0..6)
          float lit = (ri >= 0.0 && ri <= 6.0) ? clamp(uRibs - ri, 0.0, 1.0) : 0.0;   // lit one at a time as uRibs counts up
          totalEmissiveRadiance += uGlowCol * lit * 0.55;
          float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));      // x-ray: a soft glowing rim
          totalEmissiveRadiance += uGlowCol * uXray * (0.15 + 0.85 * pow(fr, 2.2)) * 0.9;
          float yc = mix(uScanR.x, uScanR.y, uScan), bd = vWp.y - yc;                  // a scan line sweeping up the stand while it is x-rayed
          totalEmissiveRadiance += uGlowCol * uXray * (1.5 * exp(-bd * bd / 1.2) + 0.22 * exp(-bd * bd / 70.0)); }`);
    sh.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => 'wipe' + axes + (shade ? 's' : '');
}
const easeWipe = EASE.sway;
const lumOf = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
let styledFor = '';
let inkHex = S.hex;   // colour the logo decal ink is chosen for (follows the colour that is showing)
function commitWipe() {   // the new colour now covers everything: make it the base colour
  wipe.from.copy(wipe.to); wipe.fromHex = wipe.toHex; wipe.t = 1;
  for (const u of wipeUniforms) u.uWipe.value = 0;
  for (let i = 0; i < standMats.length; i++) standMats[i].color.copy(wipe.to);
}
function setStandColor(hex) {
  if (hex === wipe.toHex) return;
  if (wipe.t < 1 && wipe.t >= 0.5) commitWipe();   // interrupted late: the new colour is mostly showing, start from it. Interrupted early (or settled): wipe.from is already the base.
  wipe.to.set(hex); wipe.toHex = hex; wipe.t = 0;
  for (const u of wipeUniforms) u.uWipe.value = 0;
  if (instant && window.__WIPE_FREEZE == null) commitWipe();   // reduced motion / test mode: no animation (the freeze hook lets tests pin a wipe)
}
const showingHex = () => (wipe.t < 0.5 ? wipe.fromHex : wipe.toHex);

const planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5), planeNever = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
const cutKeepPlain = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e5), cutKeepCut = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -1e5);
const cutModelPlain = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), cutModelCut = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
// The pool of light under the stand (added to the dark stage): the stand colour at about a third strength, or a cool white for a near-black stand so it still has something to stand out against.
const POOL_COOL = new THREE.Color('#a9bbff'), POOL_NEUTRAL = new THREE.Color('#9db0a4');
function poolFor(c, out, k) {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, t = THREE.MathUtils.smoothstep(l, 0.02, 0.14);
  out.copy(POOL_COOL).multiplyScalar(0.17).lerp(tmpColor.copy(c).multiplyScalar(0.17 * (1 - 0.5 * THREE.MathUtils.smoothstep(l, 0.45, 0.9))), t);   // near-black: cool white pool, light colours: their own colour
  if (document.documentElement.dataset.nature === '0') out.lerp(tmpColor.copy(POOL_NEUTRAL).multiplyScalar(0.13), 0.5);   // level 0: a neutral pool, not a green one
  return out.multiplyScalar(k);
}
function buildScene() {
  window.__SCENE_BUILDS = (window.__SCENE_BUILDS || 0) + 1;   // test hook: the scene must be built exactly once, however many pages you visit
  SHADE.uScanR.value.set(META.floor_y, META.floor_y + 76);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;

  // a dark studio: a warm-white key from the upper left, a green-tinted rim from behind right and a cool rim from behind left (they outline the ribs and carry the glints), a low hemisphere fill
  const key = new THREE.DirectionalLight(0xfff3e2, 2.1);
  key.position.set(-150, 270, 230); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 20, far: 800 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfffe2, 2.4); rim.position.set(210, 130, -250); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xbfd6ff, 1.5); rim2.position.set(-250, 90, -150); scene.add(rim2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a221d, 0.3));

  // stand
  const loadGeo = (buf) => {
    const dv = new DataView(buf); const nV = dv.getUint32(0, true), nF = dv.getUint32(4, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nV * 3), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, 8 + nV * 12, nF * 3), 1));
    return toCreasedNormals(g, 0.62);
  };
  geos.cutout = loadGeo(MODELS.cut);     // base with the cable slot
  geos.plain = loadGeo(MODELS.plain);    // same model, solid base
  // Clip planes (world space; updated every frame in the render loop): planeFloor hides whatever is below the floor while the stand rises on the Home page,
  // the two cut planes split the main stand into the Regular geometry (one side) and the With cutout geometry (the other) so a sweep "cuts" the slot with no pop.
  renderer.localClippingEnabled = true;
  const makeStandMat = (planes) => {
    const m = new THREE.MeshPhysicalMaterial({ color: S.hex, roughness: 0.46, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.5, clippingPlanes: planes, clipShadows: true });
    patchWipe(m, { origin: new THREE.Vector3(0, META.floor_y, 6), reach: 105, axes: 'xyz', shade: true });   // the colour front starts at the foot of the stand
    standMats.push(m); return m;
  };
  const matMain = makeStandMat([planeFloor, cutKeepPlain]), matCut = makeStandMat([planeFloor, cutKeepCut]), matB = makeStandMat([planeFloor, planeNever]);
  standMat = makeStandMat([planeFloor, planeNever]);   // the magnet pads
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  standMesh = mk(geos.plain, matMain, pivot);       // main stand, Regular geometry (keeps the side of the cut plane that has not been cut yet)
  standMeshC = mk(geos.cutout, matCut, pivot);      // main stand, With cutout geometry (the other side)
  standMesh2 = mk(geos.cutout, matB, pivotB);       // the second stand (Models page): always With cutout
  proxy = new THREE.Mesh(geos.plain);   // identity-transform twin used to project decals in model space (logo sits clear of the slot)

  // ground: the cast shadow, a small soft contact shadow, and a light oat (moss in the deep chapters) disc the stand stands on
  const radial = (stops) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShadowMaterial({ opacity: 0.6, color: 0x000000 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.renderOrder = 0; scene.add(floor);
  groundTo = new THREE.Color('#223028');
  const groundMat = new THREE.MeshBasicMaterial({ map: radial([[0, 1], [0.45, 0.6], [0.78, 0.18], [1, 0]]), color: '#223028', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  patchWipe(groundMat, { origin: new THREE.Vector3(0, 0, 0), reach: 150, axes: 'xy', colorB: groundTo });   // the ground tint follows the colour wipe, radiating from under the stand
  ground = new THREE.Mesh(new THREE.PlaneGeometry(470, 470), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.renderOrder = -2; scene.add(ground);
  contact = new THREE.Mesh(new THREE.PlaneGeometry(150, 130), new THREE.MeshBasicMaterial({ map: radial([[0, 0.9], [0.55, 0.45], [1, 0]]), color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2; contact.renderOrder = -1; scene.add(contact);
  contact2 = contact.clone(); contact2.visible = false; scene.add(contact2);   // the same soft shadow under the second stand

  // phone
  phoneRoot = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(PH.w, PH.h, 10), { depth: PH.t - 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 14 });
  bodyGeo.translate(0, 0, -(PH.t - 0.6) / 2);
  phoneBody = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({ color: 0x1b1d1f, roughness: 0.35, metalness: 0.75, transparent: true }));
  phoneBody.castShadow = true;
  const scrGeo = new THREE.ShapeGeometry(roundedRect(PH.w - 3.4, PH.h - 3.4, 8), 12);
  const sp = scrGeo.attributes.position, su = new Float32Array(sp.count * 2);
  for (let i = 0; i < sp.count; i++) { su[i * 2] = (sp.getX(i) + (PH.w - 3.4) / 2) / (PH.w - 3.4); su[i * 2 + 1] = (sp.getY(i) + (PH.h - 3.4) / 2) / (PH.h - 3.4); }
  scrGeo.setAttribute('uv', new THREE.BufferAttribute(su, 2));
  phoneScreen = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, toneMapped: false }));
  phoneScreen.position.z = PH.t / 2 + 0.04;
  phoneRoot.add(phoneBody, phoneScreen);
  phoneRoot.quaternion.copy(phoneQuat); phoneRoot.visible = false;
  pivot.add(phoneRoot);

  // plug + cable
  plugGroup = new THREE.Group();
  const plugGeo = new THREE.ExtrudeGeometry(roundedRect(11.6, 5.8, 2.4), { depth: 10, bevelEnabled: false, curveSegments: 10 });
  const plug = new THREE.Mesh(plugGeo, new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.5, metalness: 0.1 }));
  plug.castShadow = true; plugGroup.add(plug);
  plugGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, nOut, sDown));
  plugGroup.position.copy(portPos); plugGroup.visible = false; pivot.add(plugGroup);

  const yT = floorY + 1.65;
  const C = portPos.clone().addScaledVector(sDown, (portPos.y - (yT + 4.5)) / -sDown.y);
  const pts = [
    portPos.clone().addScaledVector(sDown, 10), portPos.clone().addScaledVector(sDown, 16), C,
    new THREE.Vector3(C.x + 0.6, yT, C.z + 6), new THREE.Vector3(C.x + 7, yT, C.z + 20),
    new THREE.Vector3(C.x + 20, yT, C.z + 36), new THREE.Vector3(C.x + 40, yT, C.z + 52),
  ].reverse();
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const tube = new THREE.TubeGeometry(curve, CABLE_SEG, 1.65, CABLE_RAD, false);
  cableMesh = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: 0.55 }));
  cableMesh.castShadow = true; cableMesh.frustumCulled = false; pivot.add(cableMesh);
  tube.setDrawRange(0, 0);
  const spaced = curve.getSpacedPoints(CABLE_SEG);   // the same points the tube is built on: the plug rides the head of the cable
  for (let i = 0; i <= CABLE_SEG; i++) { cablePts[i * 3] = spaced[i].x; cablePts[i * 3 + 1] = spaced[i].y; cablePts[i * 3 + 2] = spaced[i].z; }

  // the slot, outlined: a glowing stadium on the lip where the cable goes through (the x-ray beat)
  const ring = roundedRect(17.8, 10.8, 5.4); ring.holes.push(new THREE.Path(roundedRect(16, 9, 4.5).getPoints(24)));
  slotGlow = new THREE.Mesh(new THREE.ShapeGeometry(ring, 16), new THREE.MeshBasicMaterial({ color: 0x9ad98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  slotGlow.position.copy(corner).addScaledVector(nOut, 4.1).addScaledVector(sUp, 0.2);
  slotGlow.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, nOut, sDown)); slotGlow.renderOrder = 5; slotGlow.visible = false; pivot.add(slotGlow);
  // the cut: a thin glowing sheet at the clip plane while it sweeps across the base
  cutLine = new THREE.Mesh(new THREE.PlaneGeometry(84, 100), new THREE.MeshBasicMaterial({ color: 0x9ad98a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  cutLine.rotation.y = Math.PI / 2; cutLine.renderOrder = 4; cutLine.visible = false; pivot.add(cutLine);
  // the lean angle: an arc around the point where the slope meets the floor, drawn on with setDrawRange like the cable
  ARC.az = corner.z + ((floorY - corner.y) / sUp.y) * sUp.z; ARC.ay = floorY + 0.4; ARC.ang = META.slope.angle_deg * Math.PI / 180;
  const arcPts = []; for (let i = 0; i <= 40; i++) { const a = ARC.ang * i / 40; arcPts.push(new THREE.Vector3(0, ARC.ay + Math.sin(a) * ARC.r, ARC.az - Math.cos(a) * ARC.r)); }
  arcMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), ARC.seg, 0.55, ARC.rad, false), new THREE.MeshBasicMaterial({ color: 0x3f7a33, toneMapped: false }));
  arcBase = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, ARC.ay, ARC.az), new THREE.Vector3(0, ARC.ay, ARC.az - ARC.r - 14)), ARC.seg, 0.4, ARC.rad, false), new THREE.MeshBasicMaterial({ color: 0x3f7a33, toneMapped: false }));
  arcMesh.visible = arcBase.visible = false; arcMesh.frustumCulled = arcBase.frustumCulled = false; pivot.add(arcMesh, arcBase);

  drawScreen(12, false);
  buildMagnets();
  rebuildLogoGeometry();
  try { renderer.compile(scene, camera); } catch (e) { /* older drivers: the first draw compiles instead */ }   // compile every shader up front so the first scroll frames do not hitch
}

/* ---------- logo / decal ---------- */
function inkColor() {
  const c = new THREE.Color(inkHex); const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;   // linear luminance of the colour that is showing
  return l > 0.25 ? '#15171a' : '#ffffff';
}
/* the Lean wordmark (src/logo.json, made by tools/logo/make_logo.py): script "Lea" + an "n" that is the stand's own side profile.
   On the stand it is one ink colour; EXTRA thickens every stroke so it stays readable on the ribbed face. */
const LOGO_P = { letters: new Path2D(LOGO.letters), n: new Path2D(LOGO.n) };
const LOGO_EXTRA = 8, LOGO_PX = 3.2, LOGO_PAD = 36;
function drawLogoTexture() {
  const mode = S.mode; const ink = inkColor(); const ctx = logoCanvas.getContext('2d'); let resized = true;
  if (mode === 'none' || (mode === 'text' && !S.text.trim())) { return false; }
  const fs = 300; const font = `700 ${fs}px Geist, "SF Pro Display", system-ui, sans-serif`;
  if (mode === 'brand') {
    const [vx, vy, vw, vh] = LOGO.viewBox, k = LOGO_PX, m = LOGO_EXTRA / 2;
    const W = Math.ceil((vw + LOGO_EXTRA) * k + LOGO_PAD * 2), H = Math.ceil((vh + LOGO_EXTRA) * k + LOGO_PAD * 2);
    resized = logoCanvas.width !== W || logoCanvas.height !== H; logoCanvas.width = W; logoCanvas.height = H;
    const c2 = logoCanvas.getContext('2d'); c2.clearRect(0, 0, W, H);
    c2.setTransform(k, 0, 0, k, LOGO_PAD - (vx - m) * k, LOGO_PAD - (vy - m) * k);
    c2.fillStyle = ink; c2.strokeStyle = ink; c2.lineJoin = 'round'; c2.lineCap = 'round';
    c2.lineWidth = LOGO_EXTRA; c2.fill(LOGO_P.letters); c2.stroke(LOGO_P.letters);
    c2.lineWidth = LOGO.stroke + LOGO_EXTRA; c2.stroke(LOGO_P.n);
    c2.setTransform(1, 0, 0, 1, 0, 0);
    logoAspect = W / H;
  } else {
    const txt = S.text.trim(); ctx.font = font; ctx.letterSpacing = '2px';
    const tw = Math.ceil(ctx.measureText(txt).width);
    const W = clamp(tw + 60, 300, 4000), H = Math.round(fs * 1.3);
    resized = logoCanvas.width !== W || logoCanvas.height !== H; logoCanvas.width = W; logoCanvas.height = H;
    const c2 = logoCanvas.getContext('2d'); c2.clearRect(0, 0, W, H);
    c2.font = font; c2.letterSpacing = '2px'; c2.fillStyle = ink; c2.textBaseline = 'middle'; c2.textAlign = 'center';
    c2.fillText(txt, W / 2 + 1, H / 2 + fs * 0.04);
    logoAspect = W / H;
  }
  if (resized || !logoTex) newLogoTex(); else logoTex.needsUpdate = true;
  return true;
}
function rebuildLogoGeometry() {
  if (!renderer) return;
  if (logoDecal) { pivot.remove(logoDecal); logoDecal.geometry.dispose(); logoDecal = null; }
  if (!drawLogoTexture()) return;
  const s = S.place === 'front' && S.magsafe ? magsafeFront() : surf[S.place];
  let w = s.maxW * (S.size / 100), h = w / logoAspect;
  if (s.maxH && h > s.maxH) { h = s.maxH; w = h * logoAspect; }   // MagSafe: fit the strip beside the magnets
  const helper = new THREE.Object3D(); helper.position.copy(s.point); helper.lookAt(s.point.clone().add(s.normal));
  const dg = new DecalGeometry(proxy, s.point, helper.rotation, new THREE.Vector3(w, h, 14));
  const mat = new THREE.MeshStandardMaterial({
    map: logoTex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false,
  });
  logoDecal = new THREE.Mesh(dg, mat); logoDecal.receiveShadow = true; logoDecal.renderOrder = 2;
  pivot.add(logoDecal); invalidate();
}
let rebuildTimer = 0;
function queueRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuildLogoGeometry, 90); }
function redrawInk() { if (logoDecal && (S.mode === 'brand' || S.mode === 'text')) drawLogoTexture(); }

/* ====================================================================
   Pages, timelines and tone
   A page is a fragment of markup mounted into #view (src/pages/*.html) plus a timeline of keyframes over its chapters (src/pages.js).
   The canvas, nav, footer, underlay and the scene are never rebuilt when you navigate.
   ==================================================================== */
let page = null, layout = null, tl = null;   // tl: the compiled timeline (named beats) of the mounted page
const view = $('#view'), nav = $('#nav'), menuBtn = $('#menu-btn');
const metaDesc = document.querySelector('meta[name="description"]');
const glEl = $('#gl');
const lastPose = { ...BASE };                  // the pose actually on screen, so the next page can glide from it
const trans = { t: 1, from: null };            // pose glide between pages
const blendOut = { ...BASE };
const pose = { ...BASE };                      // the sampled pose, reused every frame (no allocations in the frame loop)
const holdPose = { ...BASE };                  // reduced motion: the static pose being shown
const drawn = { ...BASE };                     // the pose last rendered: when nothing moved, the frame is skipped
let dirty = true;                              // something outside the pose changed (colour, decal, size...): render once
function invalidate() { dirty = true; }
const qs = new URLSearchParams(location.search);
let FREEZE = qs.has('p') ? Math.min(1, Math.max(0, parseFloat(qs.get('p')) || 0)) : null;   // ?p=0.42 pins the page at that progress (exact screenshots)
// temporary nature dial (?nature=0|1|2): 0 pure tech, 1 a little nature (the default), 2 level 1 plus thin vines, leaf glyphs and filled waves. It is remembered for the visit. Remove once the owner has picked a level.
{ let n = qs.get('nature'); if (n == null) { try { n = sessionStorage.getItem('lean-nature'); } catch (e) { /* ignore */ } } if (!['0', '1', '2'].includes(n)) n = '1'; try { sessionStorage.setItem('lean-nature', n); } catch (e) { /* ignore */ } document.documentElement.dataset.nature = n; }
const DEBUG = qs.has('debug');                                                              // ?debug shows page, progress, beat and FPS
if (FREEZE != null) document.documentElement.classList.add('frozen');

const logoSvg = (extra) => {
  const [x, y, w, h] = LOGO.viewBox, m = extra / 2;
  return `<svg class="logo" viewBox="${x - m} ${y - m} ${w + extra} ${h + extra}" role="img" aria-label="Lean"><path class="lg-t" d="${LOGO.letters}" stroke-width="${extra}"/><path class="lg-n" d="${LOGO.n}" stroke-width="${LOGO.stroke + extra}"/></svg>`;
};

/* ---------- tone: the fixed underlay, the ground disc and the nav move between light and deep forest ----------
   Chapters carry data-tone; between two chapters the tone blends over the scroll that carries one pin away and the next in.
   After the story, the panel under the nav decides. */
let toneStory = 0, toneName = '';
function toneAt(y) {
  const k = layout.toneKf; if (!k.length) return 0;
  if (y <= k[0].pos) return k[0].v;
  for (let i = 0; i < k.length - 1; i++) if (y < k[i + 1].pos) { const a = k[i], b = k[i + 1]; return lerp(a.v, b.v, smooth((y - a.pos) / (b.pos - a.pos || 1))); }
  return k[k.length - 1].v;
}
function updateTone(y) {
  const inStory = layout.toneKf.length > 0 && y < layout.storyEnd - layout.vh * 0.2;
  toneStory = inStory ? toneAt(y) : 0;
  let name;
  if (inStory) name = toneStory > 0.5 ? 'deep' : 'dark';
  else { name = 'dark'; const line = y + 70; for (const p of layout.panels) if (line >= p.top) name = p.tone; }
  if (name !== toneName) { toneName = name; document.documentElement.dataset.tone = name; nav.dataset.tone = name; }
  const o = (inStory ? toneStory : 0).toFixed(3);
  if (o !== updateTone.last) { updateTone.last = o; $('#u-deep').style.opacity = o; }
}

function measure() {
  if (!page) return;
  const y = window.scrollY;
  const pin = document.querySelector('.pin');
  const vh = pin ? pin.offsetHeight : window.innerHeight;
  const portrait = window.innerWidth < 900;
  const chapters = {};
  $$('.chapter').forEach((el) => {
    const top = el.getBoundingClientRect().top + y;
    chapters[el.dataset.ch] = { el, top, h: el.offsetHeight, L: Math.max(0, el.offsetHeight - vh) };
  });
  tl = compile(page.timeline, chapters, portrait ? (ch) => (page.portrait && page.portrait[ch]) || PORTRAIT_FALLBACK : null);
  const order = Object.values(chapters).sort((a, b) => a.top - b.top), toneKf = [];
  for (const c of order) { const v = c.el.dataset.tone === 'deep' ? 1 : 0; toneKf.push({ pos: c.top, v }, { pos: c.top + c.L, v }); }
  const panels = $$('.panel').map((el) => ({ top: el.getBoundingClientRect().top + y, tone: el.dataset.tone || 'dark' }));
  const foot = document.getElementById('foot'); panels.push({ top: foot.getBoundingClientRect().top + y, tone: 'deep' });
  const storyEnd = order.length ? Math.max(...order.map((c) => c.top + c.h)) : 0;
  layout = { vh, portrait, chapters, storyEnd, studioTop: chapters.studio ? chapters.studio.top : 0, toneKf, panels, D: Math.max(1, storyEnd - vh) };
  invalidate();
}

/* gliding from the previous page's last pose to this page's first pose: eased, the long way round avoided, and a small arc so it flows */
function blendPose(s, dt) {
  if (trans.t >= 1 || !trans.from) return s;
  trans.t = Math.min(1, trans.t + dt / 1.3);
  const e = EASE.enter(trans.t), f = trans.from, o = blendOut;
  for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; o[k] = f[k] + (s[k] - f[k]) * e; }
  let d = s.rotY - f.rotY; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
  o.rotY = f.rotY + d * e;
  const arc = Math.sin(Math.PI * e);
  o.ty += arc * 14; o.elev += arc * 5; o.dist += arc * 30;
  return o;
}

/* ====================================================================
   DOM per page: copy blocks, nav, colours chapter
   ==================================================================== */
let blocks = [], counters = [], hintEl = $('#hint');
let chapterSw = [];
function bindBlocks() {
  blocks = $$('.blk[data-beat]').map((b) => ({ b, names: b.dataset.beat.split(' '), on: false }));
  counters = $$('[data-count]').map((el) => ({ el, beat: el.dataset.beat, to: +el.dataset.to, ease: EASES[el.dataset.ease || 'enter'] || EASES.enter, last: -1 }));
  hintEl = $('#hint');
}
/* Copy, counters, camera, stands, phone, cable and callouts all read the same named beats, so they change at exactly the same scroll position. */
function updateDom(pos, y) {
  for (let i = 0; i < blocks.length; i++) {
    const k = blocks[i], on = tl.active(pos, k.names);
    if (on !== k.on) { k.on = on; k.b.classList.toggle('on', on); }
  }
  for (let i = 0; i < counters.length; i++) {   // numbers count up with their beat (written only when the integer changes)
    const c = counters[i], v = Math.round(c.to * c.ease(tl.beatProgress(pos, c.beat)));
    if (v !== c.last) { c.last = v; c.el.textContent = v; }
  }
  hintEl.classList.toggle('off', y > 40);
  updateTone(y);
  if (!renderer) {   // no WebGL: tell the CSS which chapter is on screen so the flat picture stays clear of the copy
    let ch = 'hero'; for (const k in layout.chapters) if (y + layout.vh * 0.5 >= layout.chapters[k].top) ch = k;
    if (fallbackEl.dataset.ch !== ch) fallbackEl.dataset.ch = ch;
  }
  const sg = tl.seg(pos);   // colour chapter: the swatch of the colour beat that is playing
  for (let i = 0; i < chapterSw.length; i++) chapterSw[i].classList.toggle('cur', sg.color === CONFIG.cycle[i]);
}
const fallbackEl = $('#fallback');

function scrollToEl(el) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior: instant ? 'auto' : 'smooth' });
}
function scrollToHash(hash) {
  if (!hash || hash === '#') { return; }
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (el) scrollToEl(el);
}
function setMenu(open) { nav.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); }
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
const skipLink = document.querySelector('.skip'); if (skipLink) skipLink.addEventListener('click', (e) => { e.preventDefault(); view.focus({ preventScroll: true }); view.scrollIntoView({ block: 'start' }); });

/* ---------- swatches ---------- */
const swGroups = [];
function buildSwatches(el, { radio = true, onPick }) {
  el.innerHTML = '';
  CONFIG.colors.forEach((c) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.setProperty('--c', c.hex);
    b.setAttribute('aria-label', c.name); b.dataset.id = c.id; b.title = c.name;
    if (radio) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); }
    b.addEventListener('click', () => onPick(c.id)); el.appendChild(b);
  });
  swGroups.push({ el });
}
function syncSwatches() {
  swGroups.forEach(({ el }) => $$('.sw', el).forEach((s) => s.setAttribute('aria-checked', String(s.dataset.id === S.colorId))));
}

/* ---------- silhouette drawing on the Design page (real profile from the model) ---------- */
const P = META.profile;
function specDrawing() {
  const el = $('#draw'); if (el === SINK) return;
  const W = P.w, H = P.h; const px = 17.27, py = H, th = META.slope.angle_deg * Math.PI / 180, r = 16;
  const ex = px + r * Math.cos(th), ey = py - r * Math.sin(th);
  const gx2 = px + 62 * Math.cos(th), gy2 = py - 62 * Math.sin(th);
  const x0 = W + 8, y0 = H + 8;
  el.innerHTML = `<svg viewBox="-12 -8 ${W + 38} ${H + 30}">
    <line class="gnd" x1="-8" y1="${H}" x2="${W + 6}" y2="${H}"/>
    <path class="sil" d="${P.d}"/>
    <line class="guide" x1="${px}" y1="${py}" x2="${gx2}" y2="${gy2}"/>
    <path class="dim" d="M${px + r} ${py} A${r} ${r} 0 0 0 ${ex} ${ey}"/>
    <text class="dimt" x="${px + r + 2.5}" y="${py - 5}">${Math.round(META.slope.angle_deg)}°</text>
    <line class="dim" x1="${x0}" y1="0" x2="${x0}" y2="${H}"/><line class="dim" x1="${x0 - 2}" y1="0" x2="${x0 + 2}" y2="0"/><line class="dim" x1="${x0 - 2}" y1="${H}" x2="${x0 + 2}" y2="${H}"/>
    <text class="dimt" text-anchor="middle" transform="translate(${x0 + 6.5} ${H / 2}) rotate(-90)">${H.toFixed(1)} mm</text>
    <line class="dim" x1="0" y1="${y0}" x2="${W}" y2="${y0}"/><line class="dim" x1="0" y1="${y0 - 2}" x2="0" y2="${y0 + 2}"/><line class="dim" x1="${W}" y1="${y0 - 2}" x2="${W}" y2="${y0 + 2}"/>
    <text class="dimt" text-anchor="middle" x="${W / 2}" y="${y0 + 7}">${W.toFixed(1)} mm</text>
  </svg>`;
}

/* ====================================================================
   Product images: white studio renders (assets/renders, served as files), painted in the chosen colour by the #tint SVG filter
   ==================================================================== */
const IMG = window.__IMG__ || {};
const VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'detail', label: 'Base' },
];
const viewCaption = (v, variant) => v === 'front' ? 'Front view'
  : v === 'side' ? 'Side view, 67° lean'
  : variant === 'cutout' ? 'Cable cutout, 16 × 9 mm' : 'Solid base, no cutout';
let galView = 'front';
const tintM = $('#tint-m');
function buildGallery() {
  lastShot = '';
  const galThumbs = $('#gal-thumbs'); galThumbs.innerHTML = '';
  VIEWS.forEach((v) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.view = v.id; b.setAttribute('aria-label', v.label + ' view');
    const im = document.createElement('img'); im.className = 'shot'; im.alt = ''; im.decoding = 'async'; b.appendChild(im);
    b.addEventListener('click', () => { galView = v.id; paintImages(true); });
    galThumbs.appendChild(b);
  });
}
let lastShot = '';
// Images are white renders that the #tint filter paints in the chosen colour. A colour with `look` (Black) has its own set rendered with a real
// dark material (assets/renders/<variant>-<view>-<look>.webp): multiplying white by near-black would flatten the ribs. Those images skip the filter.
const lookOf = () => { const l = byId(S.colorId).look; return l && IMG[S.variant] && IMG[S.variant]['front-' + l] ? l : ''; };
const shotSrc = (variant, view) => { const l = lookOf(); const set = IMG[variant] || {}; return (l && set[view + '-' + l]) || set[view]; };
function paintImages(animate) {
  const set = IMG[S.variant]; if (!set) return;
  const look = lookOf();
  if (look) tintM.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
  else {
    // colour: the filter multiplies the white render by the chosen colour (x1.3 puts back the light the renders were shot without)
    const c = new THREE.Color(S.hex).convertLinearToSRGB(); const k = 1.3;
    tintM.setAttribute('values', `${(c.r * k).toFixed(4)} 0 0 0 0  0 ${(c.g * k).toFixed(4)} 0 0 0  0 0 ${(c.b * k).toFixed(4)} 0 0  0 0 0 1 0`);
  }
  const galMain = $('#gal-main'), galThumbs = $('#gal-thumbs'), galCap = $('#gal-cap');
  const key = S.variant + '/' + galView + '/' + look;
  if (key !== lastShot) {
    galMain.src = shotSrc(S.variant, galView); lastShot = key;
    if (animate) { galMain.classList.remove('in'); void galMain.offsetWidth; galMain.classList.add('in'); }
  }
  galMain.alt = `Lean phone stand, ${variantOf(S.variant).name.toLowerCase()}, ${colorName()}. ${viewCaption(galView, S.variant)}.`;
  galCap.textContent = viewCaption(galView, S.variant);
  $$('button', galThumbs).forEach((b, i) => {
    const v = VIEWS[i].id; const im = b.firstChild; const k = S.variant + v + look; if (im.dataset.k !== k) { im.src = shotSrc(S.variant, v); im.dataset.k = k; }
    b.setAttribute('aria-selected', String(v === galView));
  });
  $$('[data-shot]').forEach((im) => { const [vr, vw] = im.dataset.shot.split('/'); const k = vr + vw + look; if (im.dataset.k !== k) { im.src = shotSrc(vr, vw); im.dataset.k = k; } });
  if (!renderer) { const fb = $('#fallback'); if (!fb.firstChild) { fb.innerHTML = '<img class="shot" alt="">'; } fb.firstChild.src = shotSrc(S.variant, 'front'); }
}

/* ====================================================================
   Studio / order UI (state is shared by every page: see store.js)
   ==================================================================== */
function tint(hex) {
  const c = new THREE.Color(hex); const w = new THREE.Color('#e9ece7'); return '#' + c.lerp(w, 0.78).getHexString();
}
function logoDesc() {
  const where = S.place === 'front' ? 'front' + (S.magsafe ? ', ' + magsafeFront().where + ' the magnets' : '') : 'back';
  if (S.mode === 'brand') return 'Lean logo, ' + where;
  if (S.mode === 'none') return 'No logo';
  return S.text.trim() ? `“${S.text.trim()}”, ${where}` : 'Add your text';
}
const FROM = PR.fromPrice(CONFIG);
const ADDON = PR.addonOf(CONFIG, 'magsafe');
const MS_NOTE = `${ADDON.note} Thick cases weaken the hold. Pick the size of your phone: the magnets sit where its MagSafe ring lands.`;
const priceLine = (label, right, cls = '') => `<li${cls ? ` class="${cls}"` : ''}><span>${label}</span><span>${right}</span></li>`;
const msPrice = () => '+' + money(Math.round(ADDON.price * 100));

/* things that come from CONFIG, filled into whatever page is mounted */
function fillStatic() {
  $$('[data-from]').forEach((el) => { el.textContent = money(FROM); });
  $$('[data-vname]').forEach((el) => { el.textContent = variantOf(el.dataset.vname).name; });
  $$('[data-ms-price]').forEach((el) => { el.textContent = msPrice(); });
  $$('[data-phone-list]').forEach((el) => { el.textContent = CONFIG.phoneSizes.map((p) => `${p.name} (${p.short})`).join(', '); });
  $$('[data-color-count]').forEach((el) => { el.textContent = `${NUMWORD[CONFIG.colors.length] || CONFIG.colors.length} colors.`; });
  $('#cmeta-copy').textContent = `${NUMWORD[CONFIG.colors.length] || CONFIG.colors.length} colors. Pick yours in the studio.`;
  const cn = $('#cnames'); const N = CONFIG.cycle.length;
  CONFIG.cycle.forEach((id, i) => {
    const d = document.createElement('div'); d.className = 'blk cname'; d.textContent = byId(id).name; d.dataset.beat = id; cn.appendChild(d);
  });
  CONFIG.cycle.forEach((id) => {   // chapter swatches: jump to that colour's slice of the story
    const c = byId(id); const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.setProperty('--c', c.hex);
    b.setAttribute('aria-label', 'Jump to ' + c.name); b.title = c.name;
    b.addEventListener('click', () => { const i = CONFIG.cycle.indexOf(id); const L = layout.chapters.colors; window.scrollTo({ top: L.top + ((i + 0.5) / CONFIG.cycle.length) * L.L, behavior: instant ? 'auto' : 'smooth' }); });
    $('#sw-colors').appendChild(b);
  });
  chapterSw = $$('#sw-colors .sw');
  $('#color-links').innerHTML = CONFIG.colors.map((c) => `<a class="swatch-card rv" href="/customize?color=${c.id}#order" style="--c:${c.hex}"><i></i><b>${c.name}</b><span>Choose</span></a>`).join('');
  buildCompare();
}
/* the comparison table on the Models page: every figure from CONFIG */
function buildCompare() {
  const el = $('#cmp'); if (el === SINK) return;
  const V = CONFIG.variants, U = V.map((v) => PR.unitPrice(CONFIG, { variant: v.id }));
  const rows = [
    ['Base', ...V.map((v) => v.base)],
    ['Cable passes through the base', ...V.map((v) => (v.cable ? 'Yes' : 'No'))],
    ['Price', ...U.map((u, i) => `<span class="cmp-price">${priceHTML(u)}</span>${u.list != null ? `<em class="tag">${launchTag(u)}</em>` : ''}`)],
    [`${ADDON.name} magnets (optional)`, ...V.map(() => msPrice())],
    ['Colors', ...V.map(() => `${NUMWORD[CONFIG.colors.length]}`)],
    ['Size', ...V.map(() => `${Math.round(META.size_mm[0])} × ${Math.round(META.size_mm[1])} × ${Math.round(META.size_mm[2])} mm`)],
  ];
  el.innerHTML = `<table class="cmp-t"><thead><tr><td></td>${V.map((v) => `<th scope="col">${v.name}</th>`).join('')}</tr></thead><tbody>${rows.map(([h, ...c]) => `<tr><th scope="row">${h}</th>${c.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
/* model buttons (Customize) are built from CONFIG, so names, blurbs and prices never live in the markup */
function buildModelButtons() {
  $('#cz-variant').innerHTML = CONFIG.variants.map((v) => `<button type="button" role="radio" data-v="${v.id}" aria-checked="false"><span>${v.name}</span><small data-vprice="${v.id}"></small></button>`).join('');
}
function buildMagsafeUI() {
  $('#cz-ms-title').textContent = ADDON.name;
  $('#cz-ms-note').textContent = MS_NOTE;
  $('#cz-phone').classList.add('phones');
  $('#cz-phone').innerHTML = CONFIG.phoneSizes.map((p) => `<button type="button" role="radio" data-phone="${p.id}" aria-checked="false"><span>${p.name}</span><small>${p.short}</small></button>`).join('');
}
function setMagsafe(on) { applyState({ magsafe: on }); }
function setPhone(id) { applyState({ phone: id }); }

function refreshUI() {
  const nm = colorName(); const v = variantOf(S.variant); const unit = unitNow();
  $('#cz-cname').textContent = nm;
  $('#cz-vname').textContent = v.name;
  syncSwatches();
  document.documentElement.style.setProperty('--sil', S.hex);
  $('#buy-pic').style.setProperty('--tint', tint(S.hex));
  $('#draw').style.setProperty('--sil', S.hex);
  paintImages(false);
  $('#cz-lname').textContent = S.mode === 'brand' ? 'Lean logo' : S.mode === 'none' ? 'No logo' : 'Your text';
  $('#cz-size-v').textContent = S.size + '%';
  $('#f-text').hidden = S.mode !== 'text';
  $('#in-text').value !== S.text && ($('#in-text').value = S.text);
  $('#in-size').value = S.size;
  $('#g-place').style.opacity = S.mode === 'none' ? 0.4 : 1; $('#g-place').style.pointerEvents = S.mode === 'none' ? 'none' : '';
  $$('#cz-mode button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.m === S.mode)));
  $$('#cz-place button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.p === S.place)));
  $$('#cz-variant button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === S.variant)));
  const psz = CONFIG.phoneSizes.find((p) => p.id === S.phone);
  $('#cz-magsafe').setAttribute('aria-checked', String(S.magsafe));
  $('#cz-ms-state').textContent = S.magsafe ? 'On' : 'Off';
  $('#cz-ms-size').hidden = !S.magsafe;
  $$('#cz-phone button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phone === S.phone)));
  $('#cz-phone-name').textContent = psz.phones;
  // prices: every figure below comes from CONFIG through pricing.js
  CONFIG.variants.forEach((cv) => {
    const cu = PR.unitPrice(CONFIG, { variant: cv.id, addons: selAddons() });
    $$(`[data-vprice="${cv.id}"]`).forEach((el) => { el.innerHTML = priceHTML(cu); });
  });
  $('#cz-price').innerHTML = priceHTML(unit);
  $('#cz-tag').textContent = launchTag(unit); $('#cz-tag').hidden = unit.list == null;
  $('#cz-price-note').textContent = v.name + (S.magsafe ? ` + MagSafe (${psz.name})` : '') + (S.mode === 'brand' ? ', Lean logo' : S.mode === 'none' ? ', no logo' : ', your text');
  const tot = PR.lineTotal(CONFIG, { variant: S.variant, magsafe: S.magsafe, qty: S.qty });
  $('#q-v').textContent = S.qty;
  $('#b-total').innerHTML = tot.list != null ? `<s class="was">${money(tot.list)}</s> ${money(tot.now)}` : money(tot.now);
  $('#b-choice').textContent = [nm, v.name + (S.magsafe ? ` + MagSafe (${psz.name})` : ''), logoDesc()].join(' · ');
  const model = PR.unitPrice(CONFIG, { variant: S.variant });
  $('#b-lines').innerHTML = [
    priceLine(`Lean stand, ${v.name.toLowerCase()}`, priceHTML(model)),
    S.magsafe ? priceLine(`${ADDON.name} add-on, ${psz.name} phone`, msPrice()) : '',
    priceLine(`Color, ${nm}`, 'Included'),
    priceLine(S.mode === 'none' ? 'Logo' : 'Logo or text', S.mode === 'none' ? 'None' : 'Included'),
    priceLine('Quantity', '× ' + S.qty),
    tot.save > 0 ? priceLine(CONFIG.launchLabel, 'You save ' + money(tot.save), 'save') : '',
  ].join('');
  persist();
}
function setVariant(id) { const was = S.variant; S.variant = id; refreshUI(); if (was !== id) { const g = $('#gal-main'); g.classList.remove('in'); void g.offsetWidth; g.classList.add('in'); } }
function setColor(id) {
  S.colorId = id; S.hex = byId(id).hex;   // the 3D stand wipes to it (setStandColor) and the logo ink follows once the new colour is showing
  refreshUI();
}
function setPlace(p) { S.place = p; flip.target = p === 'back' ? Math.PI : 0; refreshUI(); queueRebuild(); }

/* ---------- shared state: saved for the session and settable from the URL (see store.js) ---------- */
const store = (() => { try { return window.sessionStorage; } catch (e) { return { getItem: () => null, setItem() { throw new Error('blocked'); } }; } })();
function persist() {
  ST.saveSession(store, S, S.bag);
  if (page && page.route === '/customize') {   // on the customize page the URL always describes the current choices, so it can be shared
    const keep = new URLSearchParams(); if (DEBUG) keep.set('debug', ''); if (FREEZE != null) keep.set('p', String(FREEZE));
    let q = ST.toQuery(S); const ks = keep.toString().replace('debug=', 'debug'); if (ks) q += (q ? '&' : '?') + ks;
    const url = '/customize' + q + appHash();
    if (appUrl() !== url) writeUrl(true, history.state, url);
  }
}
function applyState(p) {
  const was = S.phone;
  Object.assign(S, p); S.hex = byId(S.colorId).hex;
  flip.target = S.place === 'back' ? Math.PI : 0;
  if (renderer && standMat) { if (S.phone !== was) buildMagnets(); queueRebuild(); }
  refreshUI();
}

const toast = $('#toast'); let toastT = 0;
function say(html) { toast.innerHTML = html; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 3600); }
const bagTotals = () => PR.bagTotals(CONFIG, S.bag);
function bagUI() { const n = bagTotals().count; $('#bag').classList.toggle('has', n > 0); $('#bag-n').textContent = n; }
const bagSummary = () => { const t = bagTotals(); return `${t.count} item${t.count > 1 ? 's' : ''}, ${money(t.now)}${t.save > 0 ? ` (you save ${money(t.save)})` : ''}`; };
$('#bag').addEventListener('click', () => say(S.bag.length ? `In your bag: ${bagSummary()}. <b>Checkout isn’t connected in this draft.</b>` : 'Your bag is empty.'));

/* ---------- Models page: two stands side by side; on a narrow screen a swipeable pair ---------- */
const pairUI = { index: 0, shift: 0, target: 0 };
function setPair(i) {
  pairUI.index = i;
  $$('#pair-switch button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  pairUI.target = (window.innerWidth < 900 ? (i === 0 ? 150 : -150) : 0);
}
function bindPair() {
  const host = $('#pair-switch'); if (host === SINK) return;
  host.innerHTML = CONFIG.variants.map((v, i) => `<button type="button" aria-pressed="false" data-i="${i}">${v.name}</button>`).join('');
  $$('button', host).forEach((b) => b.addEventListener('click', () => setPair(+b.dataset.i)));
  const pin = $('#pair .pin'); let x0 = null;
  pin.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  pin.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40 && window.innerWidth < 900) setPair(dx < 0 ? 1 : 0); });
  setPair(pairUI.index);
}

/* ---------- spores: at most 24 tiny electric-green dots drifting slowly upward (CSS animation only; shown on Home at nature level 1 and 2; none under reduced motion) ---------- */
(function spores() {
  const host = $('#drift'); if (!host || reduce) return;
  const n = innerWidth < 700 ? 12 : 24, rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), d = rnd(46, 90);
    p.style.setProperty('--x', rnd(2, 98).toFixed(1) + 'vw'); p.style.setProperty('--dx', rnd(-5, 5).toFixed(1) + 'vw');
    p.style.setProperty('--s', rnd(2, 3).toFixed(1) + 'px'); p.style.setProperty('--o', rnd(.18, .28).toFixed(2));   // about 25 percent
    p.style.setProperty('--d', d.toFixed(0) + 's'); p.style.setProperty('--delay', (-rnd(0, d)).toFixed(1) + 's');
    host.appendChild(p);
  }
})();

/* scroll reveals for opaque panels (rebuilt for every page) */
let rvObserver = null;
function bindReveals() {
  if (rvObserver) rvObserver.disconnect();
  if (!('IntersectionObserver' in window)) return;
  rvObserver = new IntersectionObserver((es) => es.filter((en) => en.isIntersecting).forEach((en, i) => { en.target.style.transitionDelay = (i * 110) + 'ms'; en.target.classList.add('rv-in'); en.target.classList.remove('rv-wait'); rvObserver.unobserve(en.target); }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach((el) => { if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('rv-wait'); rvObserver.observe(el); } });
}

/* ====================================================================
   Interaction: drag to rotate in the studio
   ==================================================================== */
const userRot = { cur: 0, target: 0 }; const flip = { cur: 0, target: 0 };
let drag = null;
function bindStage() {
  const stage = $('#cz-stage'); if (stage === SINK) return;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, id: e.pointerId, base: userRot.target }; try { stage.setPointerCapture(e.pointerId); } catch (_) {} });
  stage.addEventListener('pointermove', (e) => { if (drag && e.pointerId === drag.id) userRot.target = drag.base + (e.clientX - drag.x) * 0.009; });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
}

/* wire up whatever the mounted page contains (all the ids are optional: a missing one resolves to a harmless detached element) */
function bindPage() {
  swGroups.length = 0; chapterSw = [];
  fillStatic();
  buildModelButtons(); buildMagsafeUI(); buildGallery(); specDrawing();
  buildSwatches($('#cz-sw'), { onPick: setColor });
  $$('#cz-mode button').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.m; refreshUI(); queueRebuild(); }));
  $$('#cz-place button').forEach((b) => b.addEventListener('click', () => setPlace(b.dataset.p)));
  $('#in-text').addEventListener('input', (e) => { S.text = e.target.value; refreshUI(); queueRebuild(); });
  $('#in-size').addEventListener('input', (e) => { S.size = +e.target.value; refreshUI(); queueRebuild(); });
  $$('#cz-variant button').forEach((b) => b.addEventListener('click', () => setVariant(b.dataset.v)));
  $$('#cz-tabs button').forEach((b) => b.addEventListener('click', () => {
    $('#cz-panel').dataset.t = b.dataset.t; $$('#cz-tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#cz-magsafe').addEventListener('click', () => setMagsafe(!S.magsafe));
  $$('#cz-phone button').forEach((b) => b.addEventListener('click', () => setPhone(b.dataset.phone)));
  $('#q-m').addEventListener('click', () => { S.qty = Math.max(1, S.qty - 1); refreshUI(); });
  $('#q-p').addEventListener('click', () => { S.qty = Math.min(20, S.qty + 1); refreshUI(); });
  $('#add').addEventListener('click', () => {
    S.bag = PR.addToBag(S.bag, { variant: S.variant, color: S.colorId, magsafe: S.magsafe, phone: S.phone, mode: S.mode, text: S.text.trim(), place: S.place, size: S.size, qty: S.qty });
    bagUI(); persist();
    say(`Added ${S.qty} × Lean, ${variantOf(S.variant).name.toLowerCase()}${S.magsafe ? ` + MagSafe (${CONFIG.phoneSizes.find((p) => p.id === S.phone).name})` : ''}, ${colorName()}. Bag: ${bagSummary()}. <b>Checkout isn’t connected in this draft.</b>`);
  });
  bindPair(); bindStage(); bindBlocks(); bindReveals();
  bindBoard(); bindAdmin();   // the Suggestions board and its admin page (no-ops on other pages)
  refreshUI();
}

/* ====================================================================
   Render loop
   Hot path rules: no new objects or arrays per frame (everything is preallocated and reused), DOM writes only when a value changed,
   the canvas is not drawn when nothing moved, and not at all when the story is scrolled out of view.
   ==================================================================== */
let W = 1, H = 1, scrollCur = 0, lastT = performance.now(), glowKey = '', frameN = 0;
const tmp = new THREE.Vector3(); let PX = 0, PY = 0;
function projTo(x, y, z) { tmp.set(x, y, z); pivot.localToWorld(tmp); tmp.project(camera); PX = (tmp.x * 0.5 + 0.5) * W; PY = (-tmp.y * 0.5 + 0.5) * H; }
const overlay = $('#overlay'), coSlot = $('#co-slot'), arcLbl = $('#arc-lbl'), stageCount = $('#stage-count'), railEl = $('#rail');
let countKey = '', railKey = '';
/* spec-sheet counter ("03 / 13": which beat of the page's story is playing) and the progress rail, both read from the same timeline */
function updateStageChrome(pos, sg) {
  if (sg) {   // a hold or a glide between chapters shows the nearest beat before it (or the first one after it)
    let name = sg.name; if (name === 'hold' || sg.link) { const at = tl.segs.indexOf(sg); name = ''; for (let j = at; j >= 0 && !name; j--) if (tl.segs[j].name !== 'hold' && !tl.segs[j].link) name = tl.segs[j].name; for (let j = at; j < tl.segs.length && !name; j++) if (tl.segs[j].name !== 'hold' && !tl.segs[j].link) name = tl.segs[j].name; }
    const n = tl.names.length, i = tl.names.indexOf(name) + 1, k = i + '/' + n; if (k !== countKey) { countKey = k; const pad = (v) => String(v).padStart(2, '0'); stageCount.innerHTML = `<b>${pad(i)}</b> / ${pad(n)}`; } }
  const P = Math.min(1, Math.max(0, pos / layout.D)).toFixed(3); if (P !== railKey) { railKey = P; railEl.style.setProperty('--p', P); }
}
const grabDim = (g) => ({ g, l: $('.l', g), t1: $('.t1', g), t2: $('.t2', g), ld: $('.ld', g), tx: $('text', g), last: -1 });
const dimA = grabDim($('#dimH')), dimB = grabDim($('#dimD'));
const hv = META.half_height;
/* a dimension line that draws on (0..1), with end ticks, a leader to its label and a number that counts up */
function setDim(d, ax, ay, az, bx, by, bz, lx, ly, anchor, draw, value) {
  if (draw < 0.004) { if (d.on) { d.on = false; d.g.style.opacity = 0; } return; }
  if (!d.on) { d.on = true; d.g.style.opacity = 1; }
  projTo(ax, ay, az); const x1 = PX, y1 = PY; projTo(bx, by, bz); const x2 = PX, y2 = PY;
  const xe = x1 + (x2 - x1) * draw, ye = y1 + (y2 - y1) * draw;
  const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1, px = -dy / n * 6, py = dx / n * 6;
  d.l.setAttribute('x1', x1); d.l.setAttribute('y1', y1); d.l.setAttribute('x2', xe); d.l.setAttribute('y2', ye);
  d.t1.setAttribute('x1', x1 - px); d.t1.setAttribute('y1', y1 - py); d.t1.setAttribute('x2', x1 + px); d.t1.setAttribute('y2', y1 + py);
  const e2 = draw > 0.985 ? 1 : 0; d.t2.style.opacity = e2;
  d.t2.setAttribute('x1', x2 - px); d.t2.setAttribute('y1', y2 - py); d.t2.setAttribute('x2', x2 + px); d.t2.setAttribute('y2', y2 + py);
  const mx = (x1 + xe) / 2, my = (y1 + ye) / 2;
  d.ld.setAttribute('x1', mx); d.ld.setAttribute('y1', my); d.ld.setAttribute('x2', mx + lx * 0.7 * draw); d.ld.setAttribute('y2', my + ly * 0.7 * draw);
  d.tx.setAttribute('x', mx + lx); d.tx.setAttribute('y', my + ly); d.tx.setAttribute('text-anchor', anchor);
  const v = Math.round(value * draw); if (v !== d.last) { d.last = v; d.tx.textContent = v + ' mm'; }
}
/* the lean-angle arc sweeps from the floor line up to the slope; its label counts to 67 */
let arcLast = -1;
function updateArc(a) {
  const on = a > 0.005; arcMesh.visible = arcBase.visible = on;
  if (!on) { if (arcLast !== -1) { arcLast = -1; arcLbl.classList.remove('on'); } return; }
  const k = Math.min(1, a);
  arcMesh.geometry.setDrawRange(0, Math.floor(k * ARC.seg) * ARC.rad * 6);
  arcBase.geometry.setDrawRange(0, Math.floor(Math.min(1, k * 3) * ARC.seg) * ARC.rad * 6);
  const mid = ARC.ang * k * 0.5, R = ARC.r + 16;
  projTo(0, ARC.ay + Math.sin(mid) * R, ARC.az - Math.cos(mid) * R);
  arcLbl.style.transform = `translate(${PX.toFixed(1)}px, ${PY.toFixed(1)}px)`;
  const v = Math.round(META.slope.angle_deg * k); if (v !== arcLast) { arcLast = v; arcLbl.textContent = v + '°'; arcLbl.classList.add('on'); }
}

/* the phone, floating in and pulled onto the magnets: slow at first, faster as the pull grows, then a small spring bounce as it lands */
const tiltQ = new THREE.Quaternion(), snapV = new THREE.Vector3();
const SNAP_D0 = 120;
function snapPhone(sn) {
  let dist, pullN;
  if (sn < 0.8) { const u = sn / 0.8; pullN = 0.92 * Math.pow(u, 2.3); dist = SNAP_D0 * (1 - pullN); }
  else { const u = (sn - 0.8) / 0.2; dist = SNAP_D0 * 0.08 * Math.abs(1 - spring(u)); pullN = 1 - dist / SNAP_D0; }   // lands (dist 0) with a rebound of about a millimetre
  const far = 1 - pullN;
  snapV.copy(phoneRest).addScaledVector(nOut, dist).addScaledVector(sUp, 22 * far).addScaledVector(X, 9 * far);
  phoneRoot.position.copy(snapV);
  tiltQ.setFromAxisAngle(X, 0.16 * far); phoneRoot.quaternion.copy(tiltQ).multiply(phoneQuat);   // tips in as it comes
  const bump = sn >= 0.8 ? Math.exp(-14 * (sn - 0.8) / 0.2) : 0;
  magMat.emissiveIntensity = 0.8 * Math.min(1, Math.max(0, (pullN - 0.5) / 0.4)) + 1.6 * bump;   // the magnets glow as the phone arrives and flash at contact
  const o = smooth(clamp(sn / 0.12, 0, 1)); phoneBody.material.opacity = o; phoneScreen.material.opacity = o;
}
/* the plug rides the head of the cable: it travels in from below, through the slot, and seats in the phone as the cable finishes */
const plugT = new THREE.Vector3(), plugX = new THREE.Vector3(), plugY = new THREE.Vector3(), plugZ = new THREE.Vector3(), plugM = new THREE.Matrix4(), UPV = new THREE.Vector3(0, 1, 0);
function placePlug(cb) {
  const f = cb * CABLE_SEG, i = Math.min(CABLE_SEG - 1, Math.floor(f)), u = f - i, a = i * 3, b = (i + 1) * 3;
  const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(CABLE_SEG, i + 2) * 3;
  plugT.set(cablePts[i1] - cablePts[i0], cablePts[i1 + 1] - cablePts[i0 + 1], cablePts[i1 + 2] - cablePts[i0 + 2]).normalize();   // direction of travel
  plugZ.copy(plugT).negate();                                    // the plug body runs from its tip back along the cable
  plugX.crossVectors(UPV, plugZ).normalize(); plugY.crossVectors(plugZ, plugX);
  plugM.makeBasis(plugX, plugY, plugZ); plugGroup.quaternion.setFromRotationMatrix(plugM);
  plugGroup.position.set(cablePts[a] + (cablePts[b] - cablePts[a]) * u, cablePts[a + 1] + (cablePts[b + 1] - cablePts[a + 1]) * u, cablePts[a + 2] + (cablePts[b + 2] - cablePts[a + 2]) * u).addScaledVector(plugT, 10);   // tip = head of the cable + one plug length ahead
}

/* ---------- the Home intro: the wordmark writes itself, the "n" is drawn, then the stand rises and settles (time based, plays once per visit) ---------- */
const intro = { on: false, t: 0, played: false };
let wm = null;
function setupWordmark() {
  wm = null;
  const svg = document.querySelector('.hero .wm svg.logo'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg', [x, y, w, h] = LOGO.viewBox;
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const grad = el('linearGradient', { id: 'wm-g', gradientUnits: 'userSpaceOnUse', x1: x - 4, x2: x + w + 4, y1: 0, y2: 0 });
  const s1 = el('stop', { offset: 0, 'stop-color': '#fff' }), s2 = el('stop', { offset: 0, 'stop-color': '#000' }); grad.append(s1, s2);
  const mask = el('mask', { id: 'wm-m', maskUnits: 'userSpaceOnUse', x: x - 30, y: y - 30, width: w + 60, height: h + 60 });
  mask.append(el('rect', { x: x - 30, y: y - 30, width: w + 60, height: h + 60, fill: 'url(#wm-g)' }));
  const defs = el('defs', {}); defs.append(grad, mask); svg.prepend(defs);
  const letters = svg.querySelector('.lg-t'), n = svg.querySelector('.lg-n');
  letters.setAttribute('mask', 'url(#wm-m)'); n.setAttribute('pathLength', '1'); n.style.strokeDasharray = '1'; n.style.strokeDashoffset = '1';
  wm = { svg, s1, s2, letters, n, last: -1 };
  applyWordmark(0, 0);
}
function applyWordmark(write, nDraw) {
  if (!wm) return; const k = Math.round(write * 400) + Math.round(nDraw * 400) * 1000; if (k === wm.last) return; wm.last = k;
  const edge = 0.16, a = write * (1 + edge);
  wm.s1.setAttribute('offset', Math.max(0, a - edge).toFixed(3)); wm.s2.setAttribute('offset', Math.min(1, a).toFixed(3));   // writing direction: left to right, with a soft edge
  wm.n.style.strokeDashoffset = (1 - nDraw).toFixed(3);
}
function finishWordmark(glow) {
  if (!wm) return;
  wm.letters.removeAttribute('mask'); wm.n.style.strokeDasharray = ''; wm.n.style.strokeDashoffset = ''; wm.svg.querySelector('defs').remove();
  if (glow) { wm.svg.classList.add('n-glow'); setTimeout(() => wm && wm.svg.classList.remove('n-glow'), 1800); }
  wm = null; document.documentElement.classList.remove('intro-play');
}
function startIntro(def) {
  intro.on = false; wm = null;
  if (def.route !== '/' || intro.played) return;
  intro.played = true;
  if (reduce || FREEZE != null) return;
  intro.on = true; intro.t = 0; document.documentElement.classList.add('intro-play'); setupWordmark();
}
function stepIntro(dt) {
  if (!intro.on) return;
  const pin = window.__INTRO_FREEZE; if (pin != null) intro.t = pin; else intro.t += dt;   // __INTRO_FREEZE: test hook, pins the Home intro at a time in seconds
  const t = intro.t;
  applyWordmark(EASE.sway(clamp(t / 1.5, 0, 1)), EASE.enter(clamp((t - 1.35) / 0.8, 0, 1)));
  if (t > 3.6 && pin == null) { intro.on = false; finishWordmark(true); }
}

/* reduced motion: no scrub. The stand shows each beat's static end pose; when the beat changes the canvas fades out, the pose swaps, it fades back in */
const rm = { name: '', swapAt: 0 };
function staticPose(sg, now) {
  if (rm.name === '') { rm.name = sg.name; for (let i = 0; i < KEYS.length; i++) holdPose[KEYS[i]] = sg.to[KEYS[i]]; }
  else if (sg.name !== rm.name && !rm.swapAt) { rm.name = sg.name; rm.swapAt = now + 170; glEl.classList.add('swap'); }
  if (rm.swapAt && now >= rm.swapAt) { rm.swapAt = 0; for (let i = 0; i < KEYS.length; i++) holdPose[KEYS[i]] = tl.seg(scrollCur).to[KEYS[i]]; glEl.classList.remove('swap'); invalidate(); }
  return holdPose;
}

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  if (renderer) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false); }   // pixel ratio capped at 2
  camera.aspect = W / H; camera.updateProjectionMatrix();
  measure(); if (page) setPair(pairUI.index);
}
let rsT = 0; window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(resize, 80); });

/* debug HUD (?debug) and frame statistics (read by tools/perf.cjs) */
const perf = { frames: 0, renders: 0, jsMs: 0, glMs: 0, maxJsMs: 0 };
window.__perf = perf;
let hud = null, hudT = 0, fpsN = 0, fpsT = performance.now(), fps = 0;
if (DEBUG) { hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('aria-hidden', 'true'); document.body.appendChild(hud); }
function updateHud(now, pos, sg) {
  fpsN++; if (now - fpsT >= 500) { fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  if (!hud || now - hudT < 150) return; hudT = now;
  const P = layout ? Math.min(1, Math.max(0, pos / layout.D)) : 0, r = sg && sg.name !== 'hold' && !sg.link ? Math.round(tl.beatProgress(pos, sg.name) * 100) : 0;
  hud.textContent = `${page ? page.route : '-'}  P ${P.toFixed(3)}${FREEZE != null ? ' (frozen)' : ''}\n${sg ? sg.chapter : '-'} / ${sg ? sg.name : '-'}${sg && !sg.link && sg.name !== 'hold' ? ' ' + r + '%' : ''}\n${fps} fps  draws ${perf.renders}/${perf.frames}`;
}

let cutShown = NaN;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  frameN++; perf.frames++;
  if (!layout || !page || !tl) return;
  const t0 = performance.now(), glBefore = perf.glMs;
  stepIntro(dt);
  const frozen = FREEZE != null;
  const y = frozen ? FREEZE * layout.D : window.scrollY;
  scrollCur += (y - scrollCur) * ((instant || frozen) ? 1 : 1 - Math.exp(-dt * 8));
  const pos = scrollCur;                                  // the copy, the camera and the stands all read this one position
  updateDom(pos, y);
  const sg = tl.seg(pos);
  updateHud(now, pos, sg);
  updateStageChrome(pos, sg);
  if (!renderer || page.stage === false || !tl.segs.length || y > layout.storyEnd + 4) { overlay.classList.remove('live'); return; }

  tl.sample(pos, pose);
  const s = reduce ? staticPose(sg, now) : blendPose(pose, dt);
  for (let i = 0; i < KEYS.length; i++) lastPose[KEYS[i]] = s[KEYS[i]];   // remembered, so the next page can glide from here
  const t = now / 1000;

  // colour: each colour beat of the Colors chapter holds its colour; the change is a clean radial wipe from the base (setStandColor)
  setStandColor(sg.color ? byId(sg.color).hex : S.hex);
  if (wipe.t < 1) {
    wipe.t = window.__WIPE_FREEZE != null ? window.__WIPE_FREEZE : Math.min(1, wipe.t + dt / WIPE_SECONDS);   // __WIPE_FREEZE: test hook, pins a wipe at a given progress for screenshots
    const e = easeWipe(wipe.t);
    for (let i = 0; i < wipeUniforms.length; i++) wipeUniforms[i].uWipe.value = e;
    if (wipe.t >= 1) commitWipe();
  }
  const shown = showingHex();
  if (shown !== inkHex) { inkHex = shown; redrawInk(); }   // logo ink flips for the colour that is showing
  if (shown !== styledFor) { styledFor = shown; const dk = THREE.MathUtils.smoothstep(1 - lumOf(shown), 0.86, 0.98); for (let i = 0; i < standMats.length; i++) { const m = standMats[i]; m.clearcoat = 0.28 + 0.5 * dk; m.clearcoatRoughness = 0.5 - 0.3 * dk; m.envMapIntensity = 1 + 0.9 * dk; } }   // near-black stands get a glossier coat and more reflection so they read on the dark stage
  if (shown !== glowKey) {   // the page glow behind the stand follows the colour (crossfades via @property --glow); very light colours glow white, near-black a cool blue-white so the stand reads
    glowKey = shown; const hx = parseInt(shown.slice(1), 16), c = tmpColor.set(shown), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    document.documentElement.style.setProperty('--glow', lum > 0.55 ? 'rgba(255,255,255,.15)' : lum < 0.06 ? 'rgba(170,190,255,.2)' : `rgba(${hx >> 16 & 255},${hx >> 8 & 255},${hx & 255},.2)`);
  }

  // which geometry the main stand shows: the timeline's `cut` (0 Regular, 1 With cutout), or on Customize the selected model, swapped by a sweep so it never pops
  const hasStudio = !!layout.chapters.studio;
  const cutTarget = hasStudio ? (S.variant === 'cutout' ? 1 : 0) : s.cut;
  if (hasStudio && !instant && !frozen && cutShown === cutShown) cutShown += clamp(cutTarget - cutShown, -dt / 0.8, dt / 0.8); else cutShown = cutTarget;
  const cutting = cutShown > 0.002 && cutShown < 0.998;

  // studio-only user rotation, weighted in as the studio arrives
  const wStudio = hasStudio ? smooth(clamp((scrollCur - (layout.studioTop - layout.vh * 0.6)) / (layout.vh * 0.5), 0, 1)) : 0;
  userRot.cur += (userRot.target - userRot.cur) * (instant ? 1 : 1 - Math.exp(-dt * 10));
  flip.cur += (flip.target - flip.cur) * (instant ? 1 : 1 - Math.exp(-dt * 5));
  const idle = reduce ? 0 : Math.sin(t * 0.55) * 0.07 * s.idle;
  // Home intro: the stand rises out of the floor (clipped there) and settles into its 3/4 turn with a soft spring
  const rise = intro.on ? EASE.enter(clamp((intro.t - 1.5) / 1.7, 0, 1)) : 1;
  const settleRot = intro.on ? (1 - EASE.settle(clamp((intro.t - 1.5) / 2.1, 0, 1))) * -1.1 : 0;
  const rot = s.rotY + idle + settleRot + (userRot.cur + flip.cur) * wStudio;
  pairUI.shift += (pairUI.target - pairUI.shift) * (instant ? 1 : 1 - Math.exp(-dt * 7));
  const shiftX = pairUI.shift * s.pairw;
  pivot.position.set(s.cx + shiftX, -(1 - rise) * 105, 0); pivotB.position.set(s.px + shiftX, 0, 0);
  pivotB.visible = s.px + shiftX < 300;
  pivot.rotation.y = rot; pivotB.rotation.y = rot;
  pivot.scale.setScalar(s.scale); pivotB.scale.setScalar(s.scale);
  pivot.updateMatrixWorld(true);
  planeFloor.constant = rise < 1 ? -(floorY * s.scale - 0.25) : 1e5;
  const xc = -36 + 72 * cutShown;                           // the clip plane's x in model space
  cutModelPlain.constant = -xc; cutModelCut.constant = xc;
  cutKeepPlain.copy(cutModelPlain).applyMatrix4(pivot.matrixWorld); cutKeepCut.copy(cutModelCut).applyMatrix4(pivot.matrixWorld);
  standMesh.visible = cutShown < 0.998; standMeshC.visible = cutShown > 0.002;
  cutLine.visible = cutting; if (cutting) { cutLine.position.x = xc; cutLine.material.opacity = 0.28 + 0.14 * Math.sin(t * 9); }
  const fl = floorY * s.scale;
  floor.position.y = fl - 0.05; ground.position.y = fl + 0.15; contact.position.y = fl + 0.3; contact2.position.y = fl + 0.3;
  ground.scale.setScalar(s.scale * (1 + 0.55 * s.pairw)); contact.scale.setScalar(s.scale); contact2.scale.setScalar(s.scale);
  contact.position.x = pivot.position.x; contact2.position.x = pivotB.position.x; contact2.visible = pivotB.visible;
  { const k = 1 - 0.3 * toneStory; poolFor(wipe.from, ground.material.color, k); poolFor(wipe.to, groundTo, k); }   // the pool follows the colour wipe, a little dimmer in the deep chapters
  if (logoDecal) { logoDecal.visible = s.logo > 0.02; logoDecal.material.opacity = s.logo; }
  if (magGroup) magGroup.visible = S.magsafe || s.mag > 0.5;
  // ribs lighting up one at a time, and the x-ray look
  SHADE.uRibs.value = s.ribs; SHADE.uXray.value = s.xray; SHADE.uScan.value = (t * 0.32) % 1;
  const xr = s.xray > 0.01;
  for (let i = 0; i < standMats.length; i++) { const m = standMats[i]; if (m.transparent !== xr) m.transparent = xr; m.opacity = 1 - 0.62 * s.xray; m.depthWrite = s.xray < 0.5; }
  slotGlow.visible = s.glow > 0.01; slotGlow.material.opacity = s.glow * (0.55 + 0.45 * Math.sin(t * 3.2));

  // phone (slides on along the slope, or floats in and snaps onto the magnets), cable and plug, screen
  const ph = clamp(s.phone, 0, 1);
  let phoneOn = true;
  if (s.snap > 0.001) snapPhone(s.snap);
  else if (ph > 0.002) {
    const e = 1 - Math.pow(1 - ph, 3);
    phoneRoot.quaternion.copy(phoneQuat);
    phoneRoot.position.copy(phoneRest).addScaledVector(sUp, (1 - e) * 170);
    const o = smooth(clamp(ph * 3.2, 0, 1)); phoneBody.material.opacity = o; phoneScreen.material.opacity = o;
    magMat.emissiveIntensity = 0;
  } else { phoneOn = false; magMat.emissiveIntensity = 0; }
  phoneRoot.visible = phoneOn;
  const cb = clamp(s.cable, 0, 1);
  cableMesh.geometry.setDrawRange(0, Math.floor(cb * CABLE_SEG) * CABLE_RAD * 6);
  plugGroup.visible = cb > 0.01; if (plugGroup.visible) placePlug(cb);
  drawScreen(Math.round(s.pct), cb > 0.985, s.blank > 0.5);

  // camera
  const el = s.elev * Math.PI / 180;
  camera.position.set(0, s.ty + Math.sin(el) * s.dist, Math.cos(el) * s.dist);
  camera.lookAt(0, s.ty, 0);
  camera.setViewOffset(W, H, -s.sx * W, -s.sy * H, W, H);

  // Is there anything new to draw? (Static scroll positions, finished wipes and idle pages cost no GPU time; a gently swaying stand is drawn at 30 fps.)
  let moved = dirty;
  for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; if (Math.abs(s[k] - drawn[k]) > 1e-4) { moved = true; drawn[k] = s[k]; } }
  const busy = wipe.t < 1 || s.xray > 0.01 || intro.on || trans.t < 1 || cutting || Math.abs(userRot.cur - userRot.target) > 1e-4 || Math.abs(flip.cur - flip.target) > 1e-3 || Math.abs(pairUI.shift - pairUI.target) > 0.05 || Math.abs(cutShown - cutTarget) > 1e-3 || s.glow > 0.01 || snapBusy(s.snap);
  const swaying = s.idle > 0.001 && !reduce;
  const toneMoved = Math.abs(toneStory - drawnTone) > 0.002; if (toneMoved) drawnTone = toneStory;
  if (moved || busy || toneMoved || (swaying && (frameN & 1) === 0)) {
    dirty = false;
    scene.updateMatrixWorld(true);
    const tr = performance.now(); renderer.render(scene, camera); perf.glMs += performance.now() - tr;   // time inside render() is GL submission (and, with software GL, the rasterising itself): reported separately from the app's own JS
    perf.renders++; { const ri = renderer.info; perf.calls = ri.render.calls; perf.tris = ri.render.triangles; perf.geos = ri.memory.geometries; perf.tex = ri.memory.textures; perf.progs = ri.programs ? ri.programs.length : 0; }
    // overlays tied to 3D points
    overlay.classList.add('live');
    const cOn = s.glow > 0.6;
    coSlot.classList.toggle('on', cOn);
    if (cOn) { projTo(slotAnchor.x, slotAnchor.y, slotAnchor.z); coSlot.style.transform = `translate(${PX.toFixed(1)}px, ${PY.toFixed(1)}px)`; }
    setDim(dimA, 0, -hv, -48, 0, hv, -48, 12, 4, 'start', s.dim, 75.21);
    setDim(dimB, 0, floorY - 11, 34.06, 0, floorY - 11, -34.06, 0, 26, 'middle', s.dim, 68.12);
    updateArc(s.arc);
  }
  const ms = performance.now() - t0 - (perf.glMs - glBefore); perf.jsMs += ms; if (ms > perf.maxJsMs) perf.maxJsMs = ms;   // app JS only, render() excluded
}
let drawnTone = -1; const tmpColor = new THREE.Color();
const snapBusy = (sn) => sn > 0.001 && sn < 0.999;

/* ====================================================================
   Router: one persistent canvas, pages swapped into #view, back/forward and deep links work
   ==================================================================== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let navToken = 0;
const hashLinks = (root) => { if (HASHMODE) root.querySelectorAll('a[href^="/"]').forEach((a) => { const h = a.getAttribute('href'); if (!h.startsWith('//')) a.setAttribute('href', '#' + h); }); };
async function mount(def, hash, animate) {
  const token = ++navToken;
  if (animate && !instant && page) { view.classList.add('view-out'); await sleep(240); if (token !== navToken) return; }
  if (lastPose && layout) { trans.from = { ...lastPose }; trans.t = (instant || !page) ? 1 : 0; }   // glide from wherever the stand is now
  page = def;
  view.innerHTML = def.html.replace(/%%LOGO:(\d+(?:\.\d+)?)%%/g, (_, e) => logoSvg(+e));
  document.title = def.title; if (metaDesc) metaDesc.content = def.description || '';
  document.documentElement.dataset.stage = def.stage === false ? 'off' : 'on'; document.documentElement.dataset.page = def.route;
  $$('#tabs a').forEach((a) => { const on = a.dataset.route === def.route; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  setMenu(false);
  hashLinks(view);
  bindPage();
  hashLinks(view);   // links the page builds itself (colour cards) too
  let savedY = 0; try { savedY = history.state && history.state.y ? history.state.y : 0; } catch (e) { /* ignore */ }
  window.scrollTo(0, savedY);
  measure(); scrollCur = window.scrollY;
  cutShown = NaN; rm.name = ''; rm.swapAt = 0; glEl.classList.remove('swap'); drawnTone = -1;
  startIntro(def);
  if (FREEZE != null && def.stage !== false) { window.scrollTo(0, FREEZE * layout.D); scrollCur = FREEZE * layout.D; }
  view.classList.remove('view-out');
  if (hash) requestAnimationFrame(() => setTimeout(() => scrollToHash(hash), 80));
}
async function navigate(url, { replace = false, pop = false, initial = false } = {}) {
  const r = resolve(url);
  const target = r.route === '/404' ? (HASHMODE ? url : new URL(url, location.href).pathname) : r.route + r.search + r.hash;
  if (r.search) { const q = ST.parseQuery(CONFIG, r.search); if (Object.keys(q).length) applyState(q); }
  if (!pop) {
    if (!initial) { try { history.replaceState({ y: window.scrollY }, ''); } catch (e) { /* ignore */ } }
    writeUrl(replace || initial, { y: 0 }, target);
  }
  if (page && page.route === r.route && !initial) { if (r.hash) scrollToHash(r.hash); else if (!pop) window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' }); return; }
  await mount(PAGES[r.route], r.hash, !initial);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a || a.target || a.hasAttribute('download') || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  const href = a.getAttribute('href'); if (!href) return;
  if (HASHMODE && href.startsWith('#/')) { e.preventDefault(); navigate(href.slice(1)); return; }
  if (href.startsWith('#')) {   // same-page anchors are scrolled in JS (the artifact viewer and some hosts intercept hashes)
    const el = document.getElementById(href.slice(1)); if (!el) return;
    e.preventDefault(); scrollToEl(el); setMenu(false); return;
  }
  if (href.startsWith('/') && !href.startsWith('//')) { e.preventDefault(); navigate(href); }
});
window.addEventListener('popstate', () => navigate(appUrl(), { pop: true }));
try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }

/* ====================================================================
   Boot
   ==================================================================== */
window.LEAN = {
  state: () => S, tickets: () => S.bag.map((l) => ticket(CONFIG, l)), route: () => page && page.route, go: navigate, pose: () => ({ ...lastPose }),
  beat: () => { if (!tl || !layout) return null; const sg = tl.seg(scrollCur); return { chapter: sg.chapter, name: sg.name, link: !!sg.link, P: scrollCur / layout.D }; },
  freeze: (p) => { FREEZE = p == null ? null : Math.min(1, Math.max(0, p)); document.documentElement.classList.toggle('frozen', FREEZE != null); if (FREEZE != null && layout) { window.scrollTo(0, FREEZE * layout.D); scrollCur = FREEZE * layout.D; } invalidate(); },   // pin the page at progress p (null releases it)
  length: () => layout && layout.D, beats: () => (tl ? tl.names : []),
};   // read-only handle for tests and the print shop preview
async function boot() {
  const sess = ST.loadSession(CONFIG, store);
  S.bag = sess.bag; Object.assign(S, sess.state, ST.parseQuery(CONFIG, appSearch())); S.hex = byId(S.colorId).hex; flip.target = S.place === 'back' ? Math.PI : 0;
  if (renderer) {
    try {
      const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); };
      if (window.__MODELS__) { MODELS.cut = b64(window.__MODELS__.cut); MODELS.plain = b64(window.__MODELS__.plain); }   // single-file demo: inline
      else [MODELS.cut, MODELS.plain] = await Promise.all([get(BASE_URL + 'assets/model_cut.bin'), get(BASE_URL + 'assets/model_plain.bin')]);
    } catch (e) { console.error(e); renderer = null; document.documentElement.classList.add('no-gl'); }
  }
  hashLinks(document.getElementById('nav')); hashLinks(document.getElementById('foot'));
  bagUI();
  await navigate(appUrl(), { initial: true });   // the page's text first: it is what the visitor reads while the 3D scene is built
  if (renderer) {
    await new Promise((r) => setTimeout(r, 0));
    try { buildScene(); } catch (e) { console.error('3D scene failed, showing the flat page', e); renderer = null; document.documentElement.classList.add('no-gl'); }
  }              // (a macrotask later, so the browser can paint the text before the heavy scene work)
  resize();
  if (renderer) { buildMagnets(); rebuildLogoGeometry(); }
  scrollCur = window.scrollY;
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); if (renderer) { screenKey = ''; rebuildLogoGeometry(); } });
  window.addEventListener('load', measure);
  document.documentElement.classList.add('ready');
}
boot();
