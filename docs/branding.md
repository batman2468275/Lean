# Branding: favicon and social images

The site is dark and precise, with a little nature (see "Theme" in `CLAUDE.md`). Every brand file uses the same two things: the wordmark data in `src/logo.json` (never retyped in a font) and the colours below.

| Use | Colour | Where it must pass |
|---|---|---|
| Wordmark letters on dark | white `#F4F6F4` | 17.7:1 on charcoal `#0d0f0e` |
| Wordmark "n" on dark | electric green `#35F07F` | 12.8:1 on charcoal (graphic, needs 3:1) |
| Wordmark letters on paper | ink `#131513` | 16.4:1 on `#F1F3F0` |
| Wordmark "n" on paper | deep green `#0B8A43` | 4.0:1 on paper (graphic, needs 3:1) |
| Electric green `#35F07F` | the UI accent: buttons, eyebrows, focus rings, glow, the "n" | text on a green button is `#04210F` (11.3:1) |
| Mistletoe `#789A52` | the PRODUCT's default colour only, never a UI colour | fails as small text on paper (2.9:1); see the contrast test |

## Files (all generated, none hand-drawn)

| File | Made by | Notes |
|---|---|---|
| `assets/logo/lean-logo-on-dark.svg`, `-on-light.svg`, `-black.svg` | `npm run build` | The full wordmark for print, headers, packaging. On dark: white letters and a green "n". On light: ink letters and a deep green "n". Black is for one-colour print. |
| `assets/logo/favicon.svg` | `npm run build` | The "n" (the stand's own profile) in electric green on a `#0d0f0e` rounded square. Also inlined into the page `<head>` as a data URI. At 16 px the full wordmark is unreadable, the "n" alone still is. |
| `assets/logo/apple-touch-icon.png` (180), `favicon-32.png` | `npm run make:og` | Rendered from `favicon.svg`. |
| `assets/social/og-image.png` (1200 x 630) | `npm run make:og` | Charcoal with a green pool of light, the wordmark, "Charge where it stands.", the real Mistletoe render, corner registration marks. If `assets/media/og-plate.webp` exists (see `docs/higgsfield-brief.md`) it becomes the backdrop and the real render and wordmark are composited on top. |

Run `npm run build` first, then `npm run make:og`. The headline uses Geist when it is installed and otherwise the system sans, so regenerate the image on a machine with the font before using it for real.

## Plan

1. **Now:** the page `<head>` carries the favicon (SVG data URI), `theme-color` (`#0d0f0e`) with `color-scheme: dark`, Open Graph and Twitter tags. `og:image` is a **relative** path (`assets/social/og-image.png`) because the domain is not known yet. Social networks need an absolute URL: set it in `build.mjs` once the site has an address, and link `apple-touch-icon.png` and `favicon-32.png` the same way.
2. **Per page:** each page has its own `<title>`, description and (later) image. Suggested image per page: the same layout with that page's headline and the matching stand pose or colour. Add a `--page` argument to `tools/make_og.cjs` rather than designing each by hand.
3. **Colours page:** one image per colour (the stand in that colour on the dark stage) for sharing a specific colour.
4. **Rules:** never place "by Astrofield" next to the wordmark; never slant, stretch or recolour the "n" separately; keep clear space around the wordmark of at least the height of the "e".
