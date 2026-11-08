/* Price and bag maths. Pure functions over a CONFIG object, so they can be unit-tested without a browser (npm test).
   Everything is calculated in whole cents to avoid floating-point drift; format with money(). */

const cents = (dollars) => Math.round(dollars * 100);

export const variantOf = (cfg, id) => {
  const v = cfg.variants.find((x) => x.id === id);
  if (!v) throw new Error('Unknown model: ' + id);
  return v;
};
export const addonOf = (cfg, id) => {
  const a = (cfg.addons || []).find((x) => x.id === id);
  if (!a) throw new Error('Unknown add-on: ' + id);
  return a;
};

/** Format cents as "$8.49". */
export const money = (cfg, c) => (c < 0 ? '-' : '') + cfg.currency + (Math.abs(c) / 100).toFixed(2);

/** Price of one stand: { now, list|null, save }. `list` is null when there is no list price or showListPrice is off.
    Add-ons are added to both the current and the list price and are never discounted. */
export function unitPrice(cfg, { variant, addons = [] }) {
  const v = variantOf(cfg, variant);
  const extra = addons.reduce((sum, id) => sum + cents(addonOf(cfg, id).price), 0);
  const now = cents(v.price) + extra;
  const listBase = v.listPrice != null ? cents(v.listPrice) : null;
  const useList = cfg.showListPrice && listBase != null && listBase > cents(v.price);
  const list = useList ? listBase + extra : null;
  return { now, list, save: list != null ? list - now : 0 };
}

/** The lowest price someone pays for a stand ("From $5.99"). */
export const fromPrice = (cfg) => Math.min(...cfg.variants.map((v) => unitPrice(cfg, { variant: v.id }).now));

/** One bag line: a configured stand times a quantity. */
export function lineTotal(cfg, line) {
  const u = unitPrice(cfg, { variant: line.variant, addons: line.magsafe ? ['magsafe'] : [] });
  const qty = Math.max(0, Math.floor(line.qty || 0));
  return { qty, unit: u, now: u.now * qty, list: u.list != null ? u.list * qty : null, save: u.save * qty };
}

/** Totals for a bag: items, what you pay, the list total (what it would cost without the launch price) and the saving. */
export function bagTotals(cfg, lines) {
  let count = 0, now = 0, list = 0, save = 0;
  for (const l of lines) {
    const t = lineTotal(cfg, l);
    count += t.qty; now += t.now; save += t.save;
    list += t.list != null ? t.list : t.now;
  }
  return { count, now, list, save };
}

/** Add a line to a bag, merging it into an identical existing line. Returns a new array. */
export function addToBag(lines, line) {
  const key = (l) => [l.variant, l.color, !!l.magsafe, l.magsafe ? l.phone : '', l.mode, l.mode === 'text' ? l.text : '', l.mode === 'none' ? '' : l.place, l.mode === 'none' ? '' : l.size].join('|');
  const out = lines.map((l) => ({ ...l }));
  const hit = out.find((l) => key(l) === key(line));
  if (hit) hit.qty += line.qty; else out.push({ ...line });
  return out;
}
