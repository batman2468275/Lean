/* The pages of the site and how a URL becomes one. Pure (unit-tested); main.js and build.mjs both use it.
   Seven real pages, two footer-only ones, and the hidden suggestions admin. Old/alternative URLs from the brief are redirected to the page that now holds that story. */
import { fromPrice, money } from './pricing.js';

export const ADMIN_ROUTE = '/admin/suggestions';   // not in the nav or the footer, not indexed (noindex meta, robots.txt), protected by the ADMIN_TOKEN
export const PAGE_LIST = ['/', '/models', '/design', '/colors', '/customize', '/about', '/suggestions', '/shipping-returns', '/privacy', ADMIN_ROUTE];

/** Redirects: the brief's separate pages were folded into fewer ones; the old URLs still work. */
export const REDIRECTS = {
  '/buy': '/customize#order',
  '/studio': '/customize',
  '/charging': '/models#cutout',
  '/magsafe': '/models#magsafe',
  '/specs': '/design#specs',
  '/next': '/suggestions',
};

/** Title and meta description per page. Prices come from CONFIG. */
export function routeMeta(cfg) {
  const from = money(cfg, fromPrice(cfg));
  const names = cfg.variants.map((v) => v.name);
  const colors = cfg.colors.length;
  return {
    '/': { title: 'Lean: the phone stand', description: `Lean is a 3D-printed phone stand with seven ribs and a 67 degree lean. From ${from}. ${names.join(' or ')}, in ${colors} colors.` },
    '/models': { title: 'Models | Lean', description: `${names.join(' or ')}: same stand, one with a slot in the base so a charging cable passes through. Optional MagSafe-compatible magnets that hold the phone.` },
    '/design': { title: 'Design and specs | Lean', description: 'Seven ribs, a 67 degree lean and a 56 by 68 by 75 mm footprint. The measurements and the profile drawing.' },
    '/colors': { title: 'Colors | Lean', description: `${colors} clean colors: ${cfg.colors.map((c) => c.name).join(', ')}.` },
    '/customize': { title: 'Customize and buy | Lean', description: `Pick the model, color, MagSafe option and logo, see the price live. From ${from}.` },
    '/about': { title: 'About | Lean', description: 'Who makes Lean, and why a phone stand.' },
    '/suggestions': { title: 'What should we make next? | Lean', description: 'Tell us what to build next or what to change.' },
    '/shipping-returns': { title: 'Shipping and returns | Lean', description: 'Shipping and returns information for Lean.' },
    '/privacy': { title: 'Privacy | Lean', description: 'How Lean handles your data.' },
    [ADMIN_ROUTE]: { title: 'Suggestions admin | Lean', description: 'Review and moderate the ideas board.' },
  };
}

/** Turn any URL (path, optional ?query and #hash) into { route, search, hash, known }. Unknown paths give route '/404'. */
export function resolve(url) {
  const u = new URL(url, 'https://lean.invalid');
  let path = u.pathname.replace(/\/index\.html$/, '/').replace(/(.)\/+$/, '$1') || '/';
  let search = u.search, hash = u.hash;
  const red = REDIRECTS[path];
  if (red) { const r = new URL(red, 'https://lean.invalid'); path = r.pathname; hash = r.hash || hash; search = r.search || search; }
  if (PAGE_LIST.includes(path)) return { route: path, search, hash, known: true };
  return { route: '/404', search: '', hash: '', known: false };
}
