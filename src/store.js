/* Shared shopping state: what the visitor picked. Pure functions (unit-tested), no DOM.
   It survives navigation in sessionStorage and can be set from the URL, e.g. /customize?model=cutout&color=sky&magsafe=1&phone=large#order */
export const DEFAULT = Object.freeze({
  variant: 'cutout', colorId: 'mistletoe', magsafe: false, phone: 'medium',
  mode: 'brand', text: 'Your Brand', place: 'front', size: 85, qty: 1,
});
export const STORAGE_KEY = 'lean.v2';
const MODES = ['brand', 'text', 'none'], PLACES = ['front', 'back'];

/** Validate a partial state against CONFIG: unknown values are dropped, numbers clamped. */
export function sanitize(cfg, p) {
  const o = {};
  if (p.variant != null && cfg.variants.some((v) => v.id === p.variant)) o.variant = p.variant;
  if (p.colorId != null && cfg.colors.some((c) => c.id === p.colorId)) o.colorId = p.colorId;
  if (p.magsafe != null) o.magsafe = p.magsafe === true || p.magsafe === 1 || p.magsafe === '1' || p.magsafe === 'true';
  if (p.phone != null && cfg.phoneSizes.some((s) => s.id === p.phone)) o.phone = p.phone;
  if (p.mode != null && MODES.includes(p.mode)) o.mode = p.mode;
  if (p.text != null) o.text = String(p.text).slice(0, 20);
  if (p.place != null && PLACES.includes(p.place)) o.place = p.place;
  if (p.size != null && Number.isFinite(+p.size)) o.size = Math.min(100, Math.max(25, Math.round(+p.size)));
  if (p.qty != null && Number.isFinite(+p.qty)) o.qty = Math.min(20, Math.max(1, Math.round(+p.qty)));
  return o;
}

/** URL query -> partial state. `model=regular` is accepted for `plain`. */
export function parseQuery(cfg, search) {
  const q = new URLSearchParams(search);
  let model = q.get('model'); if (model === 'regular') model = 'plain';
  return sanitize(cfg, { variant: model, colorId: q.get('color'), magsafe: q.get('magsafe'), phone: q.get('phone'), mode: q.get('logo'), text: q.get('text'), place: q.get('place'), size: q.get('size'), qty: q.get('qty') });
}

/** State -> query string with only what differs from the defaults ('' when nothing does). */
export function toQuery(state) {
  const q = new URLSearchParams(); const d = DEFAULT;
  if (state.variant !== d.variant) q.set('model', state.variant);
  if (state.colorId !== d.colorId) q.set('color', state.colorId);
  if (state.magsafe) { q.set('magsafe', '1'); if (state.phone !== d.phone) q.set('phone', state.phone); }
  if (state.mode !== d.mode) q.set('logo', state.mode);
  if (state.mode === 'text' && state.text !== d.text) q.set('text', state.text);
  if (state.mode !== 'none' && state.place !== d.place) q.set('place', state.place);
  if (state.mode !== 'none' && state.size !== d.size) q.set('size', String(state.size));
  if (state.qty !== d.qty) q.set('qty', String(state.qty));
  const s = q.toString(); return s ? '?' + s : '';
}

/** Read the saved session (state and bag). Never throws: private windows and blocked storage just give defaults. */
export function loadSession(cfg, storage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); if (!raw) return { state: {}, bag: [] };
    const bag = Array.isArray(raw.bag) ? raw.bag.filter((l) => l && cfg.variants.some((v) => v.id === l.variant) && cfg.colors.some((c) => c.id === l.color) && l.qty > 0) : [];
    return { state: sanitize(cfg, raw.state || {}), bag };
  } catch (e) { return { state: {}, bag: [] }; }
}
export function saveSession(storage, state, bag) {
  try {
    const { variant, colorId, magsafe, phone, mode, text, place, size, qty } = state;
    storage.setItem(STORAGE_KEY, JSON.stringify({ state: { variant, colorId, magsafe, phone, mode, text, place, size, qty }, bag }));
    return true;
  } catch (e) { return false; }
}
