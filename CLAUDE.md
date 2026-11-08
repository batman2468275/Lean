# Lean: phone stand website

Marketing and ordering site for **Lean**, a 3D-printed phone stand. A real 3D model of the stand animates as the visitor scrolls. It is a small multi-page app (7 pages, 2 footer-only pages and a hidden admin page) with **one persistent WebGL canvas**, plus a small Node backend for the public ideas board.

Read this file first. Deeper notes: `docs/magsafe.md`, `docs/magsafe-feasibility.md`, `docs/suggestions.md`, `docs/hosting.md`, `docs/branding.md`, `docs/animation-check/` (contact sheets).

## Status: what is done, what is NOT

Done: products, prices and colours in `CONFIG`; MagSafe add-on (design, print files, site); the dark tech theme with nature levels (v2's natural look was rejected as too nature-like); separate pages on one canvas; the named-beat animation system; the Suggestions board with moderation; accessibility and performance pass.

**Not done / owner must do** (nothing here may be invented by a developer):
- Every `[EDIT: ...]` placeholder (`mark.edit`): About (the Lean story), Shipping and returns, Privacy (retention, removal, contact). `grep -rn "\[EDIT" src`.
- **There is no checkout.** "Add to bag" builds real bag lines and shows a toast; nothing is sent anywhere.
- **Suggestions storage is a local JSON file because the owner chose a demo.** It needs the Node server and is not for production (below).
- **Physical tests before selling MagSafe** (see "Physical tests needed"). Nothing about the magnets has been tried on a real phone or printer.
- Confirm the crossed-out $9.99 is a real price before launch (note in `src/config.js`). Set an absolute `og:image` URL in `build.mjs` once the domain is known.
- Real-device performance (60 fps on a phone) has not been measured: this machine only has software WebGL.
- **The nature level is not chosen yet.** Level 1 ships as the default and the temporary `?nature=0|1|2` switch is still in `main.js` and `build.mjs`. Remove it (and the level that was not picked) once the owner decides.
- **The Higgsfield media files do not exist yet** (the connector cannot generate). Generate them from `docs/higgsfield-brief.md` into `assets/media/`; the site is finished without them.

## Brand

- Name: **Lean**. The logo is a **cursive script wordmark**: "Lea" in a monoline script (Sacramento, SIL OFL) and a final **"n" that is the stand's own side profile**, so the word literally turns into the product. The tail of the "a" flows into the lip hook of the "n".
- The wordmark is **data, not a font**: `src/logo.json` (`letters`, `n`, `viewBox`, `stroke`). Regenerate with `python3 tools/logo/make_logo.py 0 14 0` (slant of the n in degrees, n x offset, n y offset; `0 14 0` is the chosen setting; needs `fonttools`). Sacramento's licence is `tools/logo/OFL-Sacramento.txt` and must stay with the font file.
- `npm run build` also writes standalone files to `assets/logo/` (on-dark, on-light, black SVGs, favicon). Use them for the favicon, social images and print.
- **No company names anywhere.** No company or "by" line next to the wordmark or anywhere else on the site, in the footer, About, Privacy, Shipping and returns, meta tags, the docs or the repo text. The footer says `&copy; 2026 Lean` and nothing more. `tests/no-business-refs.test.mjs` fails the build if one comes back. The only name that may appear is the wordmark font's own licence file (`tools/logo/OFL-Sacramento.txt`), which the OFL requires.
- Letters take the page text colour (`currentColor`); the "n" uses `--n-ink` (electric green on dark, a deeper green on paper; 3:1 on every tone). On the stand the whole wordmark is one ink (dark on light stands, white on Black). Small sizes get a heavier stroke (`%%LOGO:5%%` nav, `%%LOGO:1.5%%` hero, `LOGO_EXTRA` for the decal).
- Keep the wordmark identical everywhere; never retype it in a font; never slant, stretch or recolour the "n" separately.
- Voice: short, plain, no hype. "Charge where it stands."

## Products and prices (source of truth: `CONFIG` in `src/config.js`; maths in `src/pricing.js`)

| Item | id | List price | Price now | What it is |
|---|---|---|---|---|
| Regular | `plain` | none | $5.99 | The stand with a solid base |
| With cutout | `cutout` | $9.99 | $8.49 ("Launch price, save $1.50") | Same stand with a 16 x 9 mm slot so a charging cable passes through the base |
| MagSafe add-on | `magsafe` | none | +$1.50 (either model, any size, never discounted) | Five passive magnets that hold a MagSafe iPhone. Does not charge it. Three phone sizes |

- `pricing.js` works in whole cents (`unitPrice`, `lineTotal`, `bagTotals`, `addToBag`, `fromPrice`). `CONFIG.showListPrice` switches every crossed-out price off in one place. The discount is always "Launch price", never "limited time".
- Nothing in markup or other code may contain a price or a model/colour name. `main.js` fills prices, model cards, "From $x" (`[data-from]`) and the meta description (`build.mjs`) from `CONFIG`.
- **Five colours, exactly:** Mistletoe Green `#789A52` (default), Black `#17181a`, Arctic White, Sky Blue `#7EC8F2`, Signal Orange. No custom colour, no mixing. Removed for good: Electric Green, Graphite, Ocean Blue, Rose.
- Logo options: the Lean logo, a line of the customer's own text, or none. All free. **There is no image/logo upload. It was removed on purpose. Do not add it back.**

## Pages and routing

| Route | What it is | Chapters (the scroll story) |
|---|---|---|
| `/` | Home | `hero`, then a panel of three cards |
| `/models` | Regular vs With cutout, the cut, the cable story, MagSafe, comparison table, "Which one?" | `pair`, `cut`, `cutout` (deep tone), `magsafe`, then a compare panel |
| `/design` | Ribs, lean angle, footprint, then the Specs drawing and table | `design`, then the specs panel |
| `/colors` | The five colours | `colors`, then colour cards linking to `/customize?color=` |
| `/customize` | The studio and the order panel in one page | `studio`, then the `#order` panel |
| `/about`, `/suggestions` | About (deep panel, `[EDIT]` placeholders); the public ideas board | `about` / `ideas`, then a panel |
| `/admin/suggestions` | Moderation (token login). Hidden: not in nav/footer, `noindex`, `robots.txt` Disallow | none |
| `/shipping-returns`, `/privacy` | Placeholders for the owner, footer links only, no 3D | none |

- **Redirects** (`src/routes.js`): `/buy` -> `/customize#order`, `/charging` -> `/models#cutout`, `/magsafe` -> `/models#magsafe`, `/specs` -> `/design#specs`, `/studio`, `/next`. Unknown paths show the in-app 404. Tested in `tests/store_routes.test.mjs`. The brief's 13 routes were folded into fewer pages on purpose ("not too many pages").
- **Files**: `src/shell.html` is the persistent shell (SVG defs, underlay, drift layer, `#gl` canvas, overlay, nav, skip link, `<main id="view">`, footer, toast). `src/pages/*.html` are fragments mounted into `#view`. `src/pages.js` pairs each fragment with its meta (`src/routes.js`), its timeline and its `portrait` tweaks.
- **Persistent canvas**: navigation swaps `#view` only. The scene is built once (`window.__SCENE_BUILDS` must stay 1; navtest checks). `mount(page)` renders the fragment, then `bindPage()` wires whatever ids it contains. `$()` returns a detached element for a missing id, so shared code can touch ids that exist on only some pages. If you rename an id, grep for it.
- **Boot order matters for speed**: `boot()` mounts the page text first, yields a macrotask, then builds the 3D scene. Do not move `buildScene()` back in front of `navigate()`: the first paint and LCP then wait for the whole scene.
- **No layout shift while booting**: `html:not(.ready) #view { min-height: 100svh }` and the footer is `visibility:hidden` until `.ready`. Keep it, or CLS jumps (it was 1.0 on Models before).
- **Glide**: on navigation `trans` blends the last on-screen pose into the new page's first pose (`blendPose`). Skipped when `instant` (reduced motion or `window.__NOSMOOTH`).
- **Router**: History API in `main.js` (`navigate`, `mount`, click and popstate). Back/forward restore scroll. Same-page `#hash` links are scrolled in JS. Internal `<a href="/...">` are intercepted. The skip link focuses `#view`.
- **Shared state** (`src/store.js`): `S` (model, colour, MagSafe, phone, logo mode and text, placement, size, quantity) plus the bag, kept in `sessionStorage` and settable from the URL: `/customize?model=cutout&color=sky&magsafe=1&phone=large&logo=text&text=ACME&place=back&size=60&qty=2` (`model=regular` also works). Bad values are dropped or clamped. On `/customize` the URL mirrors the choices (replaceState).
- **Two stands on `/models`**: the second stand is `standMesh2` in `pivotB`, driven by `px`, `cx`, `pairw`. On a narrow screen it becomes a swipeable pair (`pairUI`). Other timeline-only values: `logo`, `mag`, `blank`, `cut`.

## Layout of the project

```
src/config.js    CONFIG: models, prices, add-ons, colours, colour cycle. The only place names and prices are defined
src/pricing.js   Pure price/bag maths (unit-tested)
src/order.js     Which STL to print for a bag line, and the fulfilment ticket (unit-tested)
src/store.js     Shared state: defaults, URL query <-> state, sessionStorage (unit-tested)
src/routes.js    Page list, redirects, title/description per page, URL -> route (unit-tested)
src/pages.js     Each page: markup, meta, timeline, portrait overrides
src/timeline.js  The animation system: easings, beat compiler, camera spline (pure, unit-tested)
src/timelines/   One file per page: chapters made of NAMED BEATS
src/pages/       HTML fragments: home, models, design, colors, customize, about, suggestions, admin-suggestions, shipping-returns, privacy, 404
src/shell.html   The persistent shell. %%LOGO:<extra stroke>%% becomes the inline wordmark
src/main.js      The engine: three.js scene, per-page mount/measure, timeline sampling, studio + order UI, router, boot
src/suggestions.js   The ideas board and admin in the browser (textContent only)
src/demo-board.js    The same board answered from the browser's storage (the one-file demo)
src/media.js     Optional atmosphere media manifest and loader (assets/media, docs/higgsfield-brief.md)
src/logo.json    Wordmark paths
src/style.css    All styling; the theme is TOKENS at the top (see "Theme")
server/          Suggestions backend: suggestions.mjs (rules, spam control, pure), api.mjs (HTTP), adapters/file.mjs (demo JSON store), index.mjs (env)
data/            suggestions.json, the demo store (git-ignored, created on first use)
tests/           pricing, store/routes, contrast, timeline, suggestions (npm test)
build.mjs        Bundles with esbuild (HTML fragments as text), copies assets, writes dist/
dist/            Build output, git-ignored: index.html + one folder per route + assets/ + hosting fallbacks
build/           model_cut.bin, model_plain.bin, meta.json (measurements, silhouette), magsafe.json
models/          lean-regular.stl, lean-cutout.stl, six lean-<model>-magsafe-<size>.stl, source/
docs/            magsafe*.md, suggestions.md, hosting.md, branding.md, animation-check/ (contact sheets)
assets/          renders/ (product images), logo/, social/, media/ (optional generated atmosphere files)
tools/           serve.cjs (static server + API), launch.cjs (Chromium + withSite), shoot/contact/intro/reduced/perf/a11y/interact*/navtest (checks),
                 make_magsafe.py + params + check/fit (MagSafe), make_og.cjs, logo/make_logo.py, prep_model.py, render_views.cjs + render_harness.js + finish_renders.py, sheet.py
```

Commands:

```
npm install
npm run build              # -> dist/
npm start                  # dist/ + the suggestions API at http://127.0.0.1:4173 (npm run dev = build + start)
npm test                   # bag/price/order, store/routes, contrast (AA), timeline, suggestions
npm run interact:nav       # router: one canvas, back/forward, deep links, redirects, state, titles, no errors
npm run interact           # studio + order flow
npm run interact:magsafe -- <outDir>       # MagSafe flow and tickets
npm run interact:suggestions -- <outDir>   # board + admin end to end
node tools/a11y.cjs        # headings, landmarks, names, skip link, tab order, focus rings, menu keys, on every page
node tools/contact.cjs <outDir> 1440 900 d # 10 pinned ?p= frames per page (390 844 m for mobile); join: python3 tools/sheet.py <outDir> d_<page> <sheet.png> 0 10 5
node tools/intro.cjs <outDir>              # the Home intro at fixed times (frames for review)
npm run interact:intro                     # the Home intro on the DEFAULT load: ends complete within the cap, even 6x throttled; click, key and scroll skip it
npm run test:media                         # optional media: empty folder and populated folder (stills, video, poster rules); rebuilds dist/
python3 tools/make_textures.py --css src/style.css   # regenerate the vein and contour line textures embedded in the CSS
node tools/reduced.cjs <outDir>            # reduced-motion check
node tools/perf.cjs 4 1440 900             # app JS time per frame (render() excluded), draws, triangles, programs at 4x CPU throttle
npm run shoot -- <outDir> 1440 900 d '[["/",0],["/models",0,"#magsafe",0.5]]'
npm run build:single       # dist/lean-demo.html: the whole site in ONE file (opens from disk, no server), for demos
node tools/single_test.cjs <outDir>   # opens that file via file:// and checks routing, 3D, shop, board, no stray requests
npm run make:og            # social image + icon PNGs (after build)
npm run prep:magsafe       # regenerate the six MagSafe print files + build/magsafe.json
npm run prep:model         # re-export models after the STL changes (pip install -r tools/requirements.txt)
npm run render:images      # re-render assets/renders (about a minute)
```

The router needs http(s): `dist/index.html` opened from disk will not route. See `docs/hosting.md`. Lighthouse is not a dependency: run it from outside the project (`npm i lighthouse` in a scratch folder, `CHROME_PATH=/opt/pw-browsers/chromium`, flags `--headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader`).

## How the 3D page works

- One fixed `<canvas id="gl">` behind the page. Scene: stand (MeshPhysicalMaterial), cast-shadow floor, soft contact shadow, the additive colour pool under the stand, phone slab with a canvas screen texture, cable (TubeGeometry grown with `setDrawRange`), plug, magnets.
- **Scroll timeline = named beats.** Each `.chapter` is `--h` x 100svh tall with a sticky `.pin`; its progress p runs 0..1. A timeline (`src/timelines/<page>.js`) lists per chapter `start` (pose at p=0) and `beats: [{ name, from, to, pose, ease, eases, color }]`. `pose` is the pose at the END of the beat; values not named carry over; gaps hold. Between chapters an automatic `link:<a>><b>` beat glides from the last pose to the next chapter's first. `compile()` turns it into absolute scroll segments; `sample(y, out)` is allocation-free; `beatProgress` / `active` let everything else follow the same beats.
- **One source of truth for timing.** Copy blocks (`<div class="blk" data-beat="a b">`), counters (`<span data-count data-beat="x" data-to="67" data-ease="enter">`), camera, stands, phone, cable, plug, callouts, dimension lines, lean arc and x-ray all read the same beats. To change when something happens, edit the beat's `from`/`to`.
- **Named easings** (`EASES`; CSS tokens mirror enter/sway/settle): `enter` (fast start, soft landing), `camera` (mild in-out), `spin` (linear, for spins and sweeps), `settle` (small overshoot), `sway`, `smooth`, `spring()` for the magnet snap. Camera values (rotY, elev, dist, ty, sx, sy) follow a cardinal spline through the beat poses; everything else eases per beat (`eases: { phone: 'enter' }`).
- **Sequences**: Home `hello`, `turn` plus an intro (wordmark written left to right, the "n" drawn and glowing, stand rising out of the floor through a clip plane and settling with a spring; once per visit). **It runs on wall-clock time, not frame counts, with a hard cap of 3.5 s and a failsafe timer, so it always ends complete (full wordmark, stand standing) even at 1 to 2 fps; any click, key press, wheel or scroll skips to the end** (`INTRO` in main.js, `tools/intro_test.cjs`). Models `pair` (`two-bases`, `which-one`), `cut` (`bases-part`, `cut-sweep`, `cut-done`: a model-space clip plane swaps Regular for With cutout geometry on the same stand, no pop), `cutout` (`slot-xray`, `phone-on`, `plug-in`, `charging`), `magsafe` (`approach`, `snap`, `sizes`, `note`). Design `ribs` (lights ribs 0..7, counter), `lean` (arc to 67 deg, counting label), `footprint` (dimension lines draw on and count). Colors one beat per colour in `CONFIG.cycle`, linear spin. Customize `studio` (model swap uses the cut sweep). About `story`, Suggestions `ideas`.
- **Portrait**: a page's `portrait` entry per chapter (`sy` shift, `k` camera factor, `over` outright values such as `cx`) adjusts narrow screens only for the copies the camera reads, so raw poses never compound (unit-tested).
- **Debug and testing hooks**: `?debug` HUD (page, progress, chapter/beat and %, fps, draws). `?p=0.42` or `LEAN.freeze(0.42)` pins the page and skips the intro. `window.__NOSMOOTH` makes scroll, wipes and glides instant. `window.__INTRO_FREEZE = seconds` pins the intro. `window.__WIPE_FREEZE = 0.5` pins a colour wipe. `window.__perf` exposes frames, draws, app JS ms, GL ms, calls, triangles, programs.
- **Reduced motion**: no scrubbing, no intro. Each beat shows its static END pose; on a beat change the canvas fades out (`#gl.swap`, 170 ms), the pose swaps, it fades back. Idle sway, drifting specks and CSS animations are off.
- **Performance rules** (keep them): the frame loop allocates nothing; render-on-demand (a frame is drawn only if something moved; idle sway at 30 fps); pixel ratio capped at 2; `renderer.compile()` after the scene is built; the font stylesheet is non-blocking (`media="print" onload`).
- **Models**: two geometries, `geos.cutout` and `geos.plain`, identical in position so they swap in place. Story pages show the cutout model (the phone and cable need the slot); `/customize` shows the selected one. Logo decals are projected on the plain geometry.
- **Logo decal**: canvas texture (`drawLogoTexture`) projected with `DecalGeometry` onto the slope face (front) or rear leg (back); drawn from `src/logo.json` with `Path2D`. Default size is 85% of the face.
- Mesh coordinates: Y up, the lip points toward +Z. `meta.json` holds the slope normal/up, trough corner, floor Y and the silhouette path used by the Design drawing. Models load at boot; if that fails the site falls back to the flat no-WebGL picture.

## Product images

- Six renders in `assets/renders/` (`plain|cutout` x `front|side|detail`), plus the Black set. `build.mjs` copies them to `dist/assets/renders/` and passes URLs as `window.__IMG__` (served as files).
- **Black has its own set** (`<variant>-<view>-black.webp`, `look: 'black'` in `CONFIG`): tinting a white render near-black flattens ribs and slot. Render it with `TAG=-black LOOK='{"color":1579034,"exposure":1.0,"neutral":true}' node tools/render_views.cjs assets/renders`. Any colour with a `look` needs such a set.
- The white set is neutral white plastic at exposure 0.55 on transparent, with a separate soft shadow. The page paints it with the SVG filter `#tint` (`feColorMatrix`, set from `paintImages()`). One white set serves the other four colours. Do not apply the tint filter to anything that is not white-base.
- The "detail" view shows the slot on the cutout and the solid base on the Regular. Used in the order gallery and the no-WebGL fallback. To change a camera edit `VIEWS` in `tools/render_harness.js`, then `npm run render:images`. The renders do not include the decal or the phone.

## Theme: dark, precise, spec-sheet ("tech first, nature as seasoning"; read before touching CSS)

The owner's brief: bring back the tech feel of the original (dark, Apple-style, electric green, big bold sans, mono labels, hairlines), keep a little nature. A calm ivory-and-sage wellness look (v2) was rejected as "way too nature".

- **Everything is tokens.** `src/style.css` starts with the raw palette (`--charcoal #0d0f0e`, `--charcoal-2`, `--deep`, `--electric #35f07f`, `--paper #f1f3f0`, `--mistletoe`) and *semantic* tokens (`--bg --surface --surface-2 --text --text-2 --text-3 --accent --on-accent --accent-text --n-ink --line --glass --seg-on --error --glow ...`). Components use only semantic tokens. Never hard-code a colour in a component; add a token.
- **Two greens, kept apart.** **Electric green `#35f07f`** is the UI accent (buttons, eyebrows, focus rings, glow, the wordmark "n", the progress rail). **Mistletoe `#789A52`** is the PRODUCT's default colour and the nature accent. Never use both in one component (a test checks that no accent token resolves to Mistletoe).
- **Tones** (`data-tone` on chapters and panels; `updateTone()` blends them): **dark** (default: charcoal), **deep** (darker charcoal: About panel, the charging story, the footer; not green), **paper** (light grey-white; used for ONE panel only, the order form). Text-3 was lifted from v1's `#737a74` (4.4:1) to `#868d87` so small text passes 4.5:1.
- **AA is enforced.** `tests/contrast.test.mjs` reads the tokens and checks every text/surface pair in all three tones (4.5:1 text, 3:1 graphics: the wordmark "n", focus ring), the green button text, `--error`, and that Mistletoe never becomes the UI accent. Run `npm test` after any colour change.
- **Type.** Geist for everything; headlines bold (700), very large, tracking about -0.035em, tabular figures for numbers (67 degrees, 56 mm, prices); Geist Mono for small uppercase eyebrow labels with wide tracking. No serif and no italics (emphasis is the electric green). Fonts are blocked in test runs, so screenshots show the fallback stack. The wordmark is never a font.
- **Shape.** Clean rounded rectangles (`--r-sm/md/lg` = 14 / 22 / 28 px) and pill buttons, 1 px hairlines, a glass nav (blur 22px). No blobs, no soft pastel shadows.
- **Spec-sheet language** (the "tech" part): dimension lines with tick ends and mono labels, corner registration marks on the stage, a "05 / 13" beat counter (hidden on single-beat pages), a thin tick-marked scroll progress rail (all in `#overlay`, driven by the same timeline), a faint perspective blueprint grid behind the stand on Design and Models (`.u-grid`), a scan-line sweep up the stand during the cutout X-ray beat (shader, `uScan`), tabular live counters.
- **Nature levels** (`<html data-nature="0|1|2">`, set by an inline script in `build.mjs` and `main.js` from the temporary `?nature=0|1|2` switch, remembered in sessionStorage; **remove the switch and the unused level once the owner picks**):
  - **0** pure tech: neutral graphite stage, none of the touches below.
  - **1** (default): green-tinted darks and a green glow; the Mistletoe stand as hero colour (the `CONFIG` default, not per level); a 1 px "rib wave" hairline (a sine with seven humps, `--rib-wave`) as the section divider; a leaf-vein texture (Home) and a topographic one (About) at 3.5 percent opacity (`.u-texture`, generated by `tools/make_textures.py`); at most 24 electric-green "spores" of 2 to 3 px drifting up on Home only (off under reduced motion); the organic easings.
  - **2** level 1 plus a thin vine on one edge of About and Suggestions, leaf glyphs in the eyebrows, and filled wave dividers (the `.wave` SVGs in the markup).
- **Stage.** `.underlay`: a dark gradient (neutral at level 0, green-tinted at 1 and 2), `.u-deep` (the deeper chapters), `.u-grid`, `.u-texture`, optional media (below), and `.u-glow`, the radial glow under the stand that main.js sets to the stand colour (very light stands glow white, near-black ones a cool blue-white so they read).
- **Motion.** Tokens `--ease-enter`, `--ease-sway`, `--ease-settle`, `--spring` (mirrored in JS). Copy rises in line by line and settles with a soft spring. Nothing linear, nothing snappy (except deliberate spins and sweeps).
- **3D lighting (a dark studio).** Warm-white key (2.1) from the upper left, a green-tinted rim `#cfffe2` (2.4) from behind right, a cool rim `#bfd6ff` (1.5) from behind left, a low hemisphere fill, the room environment at 0.5, NeutralToneMapping at exposure **0.77** (measured: the lit Mistletoe median lightness is 0.51 against the true 0.46; higher looked pale lime, and blows out Arctic White). The pool of light under the stand is an additive disc (`poolFor`) that follows the colour wipe; near-black stands get a glossier coat and more reflection (`styledFor`). Product renders keep their own neutral studio lights on purpose.
- **Headings.** Exactly one `h1` per page. Where the design wants the h2 look, use `<h1 class="t">`. Colors has a visually hidden h1 (`.sr`); on mobile Customize hides its card h1 the same way.
- **Optional atmosphere media** (`src/media.js`, `assets/media/`, `docs/higgsfield-brief.md`): leaf-veins and contours stills (6 percent, behind Home and About), a hero video (wide screens only, muted, looped, playsinline, preload none, after ready and idle, poster instead on phones, reduced motion and Save-Data, paused on other pages and hidden tabs), an og-plate for the social image. `build.mjs` lists only the files that exist in `window.__MEDIA__`; the site looks finished with none of them. `node tools/media_test.cjs` checks the empty and the populated case. Never generate the product, a phone, a screen, text, a logo or a person.
- **No WebGL.** `.fallback` shows a flat picture; `main.js` sets its `data-ch` so CSS keeps it clear of the copy.
- **Brand files.** See `docs/branding.md`. `npm run make:og` regenerates the social image (with `og-plate.webp` as the backdrop when present) and the icons.
- **Skills used while building this look** (installed locally in `.claude/skills/`, git-ignored; from github.com/freshtechbro/claudedesignskills, read before use, no generators run): `threejs-webgl` (lighting, materials, environment and render review), `modern-web-design` and `web3d-integration-patterns` (visual direction, how the stage and the page layers fit), `gsap-scrolltrigger` (reference only). No GSAP, React Three Fiber or other heavy dependency was added; this project's own timeline engine and plain three.js stay. One skill rule does not apply: it suggests `PCFSoftShadowMap`, which is removed in this three.js version.

## MagSafe add-on (read `docs/magsafe.md` before touching it)

- A full MagSafe ring does not fit the 56 mm wide, 68.5 mm long ribbed face. The design is **five N52 magnets, 6 mm x 2 mm, one per rib on the lower arc of the phone's ring** (alternating polarity to start). A partial hold, not a full ring. Always say it holds and does not charge, thick cases weaken it, you must pick your phone's size, and MagSafe is Apple's trademark (no endorsement, no logos).
- **Three phone sizes** (`CONFIG.phoneSizes`, must match `tools/magsafe_params.json`): Small = iPhone mini, Medium = 6.1 inch, Large = Pro Max / Plus. Six print files `models/lean-<regular|cutout>-magsafe-<small|medium|large>.stl`; regenerate with `npm run prep:magsafe` (check with `tools/magsafe_check.py`); it also writes `build/magsafe.json`.
- **The ring height on each phone is an ASSUMPTION** (0.46 x phone height) and untested. Do not sell until "Physical tests needed" is done.
- Pocket design: flat pads fill the rib valleys to the crest plane, pockets (6.3 mm, 2.2 deep, 0.4 chamfer) are cut in from the front, 7.8 mm of plastic behind. 6 mm magnets because at 8 mm the wall was 0.16 mm.
- Site: `S.magsafe`, `S.phone`; switch and size picker in Customize and the order panel. `buildMagnets()` draws pads and magnets (0.45 mm proud, the web mesh keeps uncut ribs). With MagSafe on, the front logo moves to the larger free strip and shrinks (`magsafeFront()`). Orders: a bag line carries `magsafe` and `phone`; `src/order.js` gives the STL (`stlFile`) and the fulfilment ticket (`ticket`, `window.LEAN.tickets()`), unit-tested including that every file exists.

## Suggestions board (read `docs/suggestions.md`)

- Public board on `/suggestions`, moderation on `/admin/suggestions`. Every idea starts `pending` and is public only once approved.
- **Storage is a local JSON file (`data/suggestions.json`) because the owner chose a demo.** It needs the Node server (`npm start`); on a static host the board says it is unreachable and disables sending. Do not describe it as production storage. Storage sits behind one adapter method (`transact`), so a real database is a swap (see the doc).
- Spam control: honeypot, signed form token (3 s to 24 h), per-visitor rate limits on salted IP hashes, content rules (length, no links or emails, spam words, duplicates), moderation queue (cap 200). All in `server/suggestions.mjs`, unit-tested.
- Env vars: `ADMIN_TOKEN` (random and printed if unset), `SPAM_SALT`, `SUGGESTIONS_FILE`, `TRUST_PROXY`. User text goes into the page only with `textContent`, never `innerHTML`. The privacy page describes what is stored; keep it in step.
- Tools get an in-memory store and admin token `test-admin` from `withSite` (tools/launch.cjs), so tests never touch `data/`.

## Single-file demo (`npm run build:single`)

- `build-single.mjs` post-processes `dist/index.html` into `dist/lean-demo.html` (about 2.6 MB): JS and CSS inline, the two 3D models as base64 (`window.__MODELS__`), the product renders as data URLs (`window.__IMG__`), favicon inline. It is the same code; `window.__SINGLE__` switches two things:
  - **hash routing** (`HASHMODE` in `main.js`: `#/models`, `#/customize?color=sky#order`; hrefs are rewritten to `#/...` after mount),
  - **the ideas board runs in the browser** (`src/demo-board.js`, localStorage, five labelled sample ideas, admin token `demo`), sharing `server/rules.mjs` with the real server.
- The Google Fonts link is kept (online: Geist and Geist Mono; offline: fallback fonts). Nothing else is requested. Any new asset reference must be inlined in `build-single.mjs` or the build fails (it checks for leftover `/assets/` references).
- It is a demo build, not a deployment target: no real storage, no per-page URLs for sharing, not indexed (`noindex`).

## Colour changes (Colors story, studio, order)

- The stand never shows a blended colour. `setStandColor(hex)` starts a **radial wipe from the foot of the stand** (shader patch `patchWipe()` on the stand material and ground glow; soft edge `WIPE_SOFT`). Each colour holds for its beat; the change takes `WIPE_SECONDS`. The page glow (`--glow`) crossfades via `@property`.
- The decal ink follows the colour that is showing (`inkHex`, flips at the wipe midpoint): dark on light stands, white on Black. Instant in test mode and with reduced motion.

## Accessibility

- `tools/a11y.cjs` must pass: one h1, no skipped levels, landmarks, named controls and fields, skip link, a visible focus ring on every Tab stop, the mobile menu opens with Enter and closes with Escape. Lighthouse accessibility is 100 on every page.
- Toggle buttons use `aria-pressed`; do not give them `role="tab"` without a full tablist/tabpanel. A `div` with `aria-label` needs a role.
- Honour `prefers-reduced-motion`. A screen-reader session with real software (VoiceOver, NVDA) has not been done: only structure and names are checked.

## Gotchas learned the hard way

- npm's Playwright may want a newer Chromium than installed: set `CHROMIUM_PATH=/opt/pw-browsers/chromium`. All tools launch through `tools/launch.cjs`, which also blocks every non-local request.
- Software WebGL runs about 1 fps: close pages you are not using (a fourth live WebGL page makes the rest time out), never run two browsers at once, and wait for a fresh draw (`__perf.renders`) plus about 1.8 s before a screenshot or it comes back blank (`tools/contact.cjs` does this). Its FPS and Lighthouse performance scores are not real-device numbers.
- Studio on desktop grows with the card (`.chapter.studio { height: auto }`). **On a phone** the card is capped at 54svh (the stand keeps about 45 percent of the screen), has a visible keyboard-accessible handle (`#cz-handle`, `aria-expanded`) that collapses it to its price bar, scrolls its options inside `.cz-scroll` (with a bottom fade) and keeps the price and Continue BELOW that scroller so they never cover text. If the stand hides behind the card, adjust the `studio` entry of `portrait` in `src/pages.js`.
- `CanvasTexture` must be disposed and recreated when its canvas changes size (`Offset overflows texture dimensions`).
- Web meshes use `uint16` indices: a model must stay under 65,535 vertices (`prep_model.py` asserts).
- Do not set `renderer.shadowMap.type = PCFSoftShadowMap` (removed in this three.js).
- Pinned chapters use `position: sticky` inside tall sections: no `overflow: hidden` on their ancestors.
- Anchor links are handled in JS, not by the browser. There is no single-file artifact build: a routed site with an API cannot run in the Claude artifact viewer.
- Test tools write screenshots into the directory you pass (default `.`); root `i_*.png` files are git-ignored leftovers.
- Google Fonts are blocked in test runs; Geist and Geist Mono load fine in a real browser.

## Physical tests needed (before selling MagSafe)

Print `lean-<model>-magsafe-<size>.stl` and check: magnet pocket fit and printed wall thickness (6.3 mm pockets, 2.2 deep); polarity of the five magnets against a real MagSafe iPhone; holding strength with and without a thin case; whether the ring height (0.46 x phone height) lands on the phone's ring for each of the three sizes; that a cable still passes the slot on the cutout model; print tolerance of the 16 x 9 mm slot with real USB-C and Lightning plugs. Details: `docs/magsafe.md`.

## Working rules

- Prices, model names, colours live in `CONFIG`. Facts only the owner knows are visible `[EDIT: ...]` placeholders; do not invent them. Run `npm test` after touching `config.js`, `pricing.js` or any colour.
- Keep the page working without WebGL and without the API.
- After any visual change, run the screenshot tools and look at 1440x900 and 390x844. After any change to boot, routing or the board, run `npm run interact:nav`, `npm run interact:suggestions` and `node tools/a11y.cjs`.
