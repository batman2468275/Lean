# Branding: favicon and social images

The site is light, natural and organic (see "Theme" in `CLAUDE.md`). Every brand file uses the same two things: the wordmark data in `src/logo.json` (never retyped in a font) and the greens below.

| Use | Colour | Where it must pass |
|---|---|---|
| Wordmark letters on light | ink `#1A241D` | 14:1 on ivory |
| Wordmark "n" on light | deep green `#4F7F3E` | 4.2:1 on ivory (graphic, needs 3:1) |
| Wordmark letters on deep forest | ivory `#F5F2E9` | 14.5:1 on forest |
| Wordmark "n" on deep forest | light green `#8FBE7C` | 7.6:1 on forest |
| Mistletoe `#6E9A5C` | fills and large display only | fails as text on ivory (2.9:1), see the contrast test |

## Files (all generated, none hand-drawn)

| File | Made by | Notes |
|---|---|---|
| `assets/logo/lean-logo-on-light.svg`, `-on-dark.svg`, `-black.svg` | `npm run build` | The full wordmark for print, headers, packaging. Black is for one-colour print. |
| `assets/logo/favicon.svg` | `npm run build` | The "n" (the stand's own profile) in light green on a deep-forest rounded square. Also inlined into the page `<head>` as a data URI. At 16 px the full wordmark is unreadable, the "n" alone still is. |
| `assets/logo/apple-touch-icon.png` (180), `favicon-32.png` | `npm run make:og` | Rendered from `favicon.svg`. |
| `assets/social/og-image.png` (1200 x 630) | `npm run make:og` | Ivory daylight background, the wordmark, "Charge where it stands.", the stand on a sage blob. |

Run `npm run build` first, then `npm run make:og`. The social image headline uses Fraunces when it is installed and otherwise a system serif, so regenerate it on a machine with the fonts before using it for real.

## Plan

1. **Now:** the page `<head>` carries the favicon (SVG data URI), `theme-color` (ivory), Open Graph and Twitter tags. `og:image` is a **relative** path (`assets/social/og-image.png`) because the domain is not known yet. Social networks need an absolute URL: set it in `build.mjs` once the site has an address, and link `apple-touch-icon.png` and `favicon-32.png` the same way.
2. **With the separate pages (Phase 4):** each page gets its own `<title>`, description and image. Suggested image per page: the same layout with that page's headline (Models, Colors, MagSafe, About...) and the matching stand pose or colour. Add a `--page` argument to `tools/make_og.cjs` rather than designing each by hand.
3. **Colours page:** one image per colour (the stand in that colour on the ivory background) for sharing a specific colour.
4. **Rules:** never place "by Astrofield" next to the wordmark; never slant, stretch or recolour the "n" separately; keep clear space around the wordmark of at least the height of the "e".
