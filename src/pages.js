/* The pages: markup (src/pages/*.html), title/description (routes.js) and each page's scroll timeline (src/timelines/<page>.js).
   A timeline is chapters (the sections with data-ch) made of named beats; src/timeline.js compiles it. `portrait` adjusts a chapter on narrow screens. */
import { CONFIG } from './config.js';
import { routeMeta, ADMIN_ROUTE } from './routes.js';
import homeHtml from './pages/home.html';
import modelsHtml from './pages/models.html';
import designHtml from './pages/design.html';
import colorsHtml from './pages/colors.html';
import customizeHtml from './pages/customize.html';
import aboutHtml from './pages/about.html';
import suggestionsHtml from './pages/suggestions.html';
import shippingHtml from './pages/shipping-returns.html';
import privacyHtml from './pages/privacy.html';
import adminHtml from './pages/admin-suggestions.html';
import notFoundHtml from './pages/404.html';

import homeTL from './timelines/home.js';
import modelsTL from './timelines/models.js';
import designTL from './timelines/design.js';
import colorsTL from './timelines/colors.js';
import customizeTL from './timelines/customize.js';
import aboutTL from './timelines/about.js';
import suggestionsTL from './timelines/suggestions.js';

const M = routeMeta(CONFIG);
// Narrow screens: copy sits below the model, so no sideways shift, the camera backs off (k) and the model moves up (sy). `over` replaces values outright.
const PORTRAIT_DEFAULT = { sy: -0.12, k: 1.4 };
export const PORTRAIT_FALLBACK = PORTRAIT_DEFAULT;

/* Each page: its markup (src/pages/*.html), title and description (routes.js), and its TIMELINE of named beats (src/timelines/*.js). */
export const PAGES = {
  '/': { route: '/', ...M['/'], html: homeHtml, timeline: homeTL, portrait: { hero: { sy: 0.05, k: 1.3 } } },
  '/models': {
    route: '/models', ...M['/models'], html: modelsHtml, timeline: modelsTL,
    portrait: { pair: { sy: -0.05, k: 1, over: { cx: -150, px: 150 } }, cut: { sy: -0.12, k: 1.25 }, cutout: { sy: -0.13, k: 1.42 }, magsafe: { sy: -0.13, k: 1.42 } },
  },
  '/design': { route: '/design', ...M['/design'], html: designHtml, timeline: designTL, portrait: { design: { sy: -0.12, k: 1.74, over: { cx: -11 } } } },
  '/colors': { route: '/colors', ...M['/colors'], html: colorsHtml, timeline: colorsTL, portrait: { colors: { sy: -0.05, k: 1.1, over: { cx: -150, px: 150 } } } },
  '/customize': { route: '/customize', ...M['/customize'], html: customizeHtml, timeline: customizeTL, portrait: { studio: { sy: -0.26, k: 1.78 } } },
  '/about': { route: '/about', ...M['/about'], html: aboutHtml, timeline: aboutTL, portrait: { about: PORTRAIT_DEFAULT } },
  '/suggestions': { route: '/suggestions', ...M['/suggestions'], html: suggestionsHtml, timeline: suggestionsTL, portrait: { ideas: PORTRAIT_DEFAULT } },
  // text-only pages: no 3D stage, the page is just panels
  '/shipping-returns': { route: '/shipping-returns', ...M['/shipping-returns'], html: shippingHtml, stage: false, timeline: { chapters: {} }, portrait: {} },
  '/privacy': { route: '/privacy', ...M['/privacy'], html: privacyHtml, stage: false, timeline: { chapters: {} }, portrait: {} },
  [ADMIN_ROUTE]: { route: ADMIN_ROUTE, ...M[ADMIN_ROUTE], html: adminHtml, stage: false, timeline: { chapters: {} }, portrait: {} },
  '/404': { route: '/404', title: 'Page not found | Lean', description: 'This page does not exist.', html: notFoundHtml, stage: false, timeline: { chapters: {} }, portrait: {} },
};
