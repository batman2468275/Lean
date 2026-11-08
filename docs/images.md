# Product pictures

Every picture of the stand on the site is a **render of the real print files**, made with this repo's own pipeline. There are no AI-made pictures and no stock photos, and none of the pictures shows a person, a hand or a customer.

## What exists

| | Where |
|---|---|
| The list (one entry per picture: id, file, width, height, alt, model, colour, view) | `src/shots.js` |
| What each new picture shows (camera, stands, colours, phone, magnets) | `tools/shot_specs.js` |
| The scene they are drawn in | `tools/shots_harness.js` (uses `src/props.js`, the same magnet, phone, plug and cable geometry as the live 3D scene, driven by `build/magsafe.json`) |
| The renderer | `tools/render_shots.cjs` (`npm run render:shots`) |
| Compositing, soft shadow, WebP, size budgets | `tools/finish_shots.py` |
| A contact sheet of all of them (deep and light bands alternate) | `docs/shots-contact-sheet.png` (`tools/shots_sheet.py`) |
| The pictures | `assets/renders/<id>.webp` (1200 px wide) and `<id>@640.webp` |

There are 39 new pictures (Regular and With cutout from every side, with a phone in portrait and in landscape, the cable through the slot, the underside, the five magnets, the three MagSafe sizes, both models in all five colours, three group shots and three logo examples) plus the 12 studio images the Customize gallery already used (`<model>-front|side|detail[-black]`).

## Colours are true colours

The old studio images are white renders that the page tints. The new ones are rendered in the real colour, under neutral white light with no coloured rim lights. `tools/shot_gains.json` holds one albedo gain per colour, found by `npm run render:shots -- --calibrate`, which renders the stand and minimises the Lab difference between the lit face and the `CONFIG` hex. `npm run render:shots -- --check` prints the table and writes `docs/colour-accuracy.json`. (The lit face is the median of the opaque pixels between the 50th and 90th luma percentile of the three-quarter picture.)

The two least exact are Black (the lit face of glossy black plastic reads lighter than its paint, about dE 11) and Signal Orange (the tone mapper desaturates a colour that is already at full red, about dE 13). The other three are within dE 3. The Colors page says on screen that colours are close, not exact.

## Re-rendering

```
npm run prep:model && npm run prep:magsafe      # only if the STL or the magnet design changed
npm run render:shots                            # everything (about 3 minutes on software WebGL)
npm run render:shots -- --only plain-lip,cutout-lip
npm run render:shots -- --preview /some/dir     # quick 600 px previews, writes nothing into the project
```

To add a picture: add a spec in `tools/shot_specs.js`, render it, add its entry in `src/shots.js`, then use it in a page with `%%SHOT:<id>%%`. `tests/shots.test.mjs` checks that every manifest file exists, that every file in `assets/renders/` is in the manifest, that alt text is real, and the size budgets (1200 px file at most 90 KB, 640 px file at most 30 KB, all new pictures together at most 4 MB).

## In a page

`%%SHOT:<id>[:eager][:nocap][:sm|:md|:lg|:wide]%%` becomes a `<figure class="pic">` with a `srcset` (640 and 1200), `width` and `height`, and the alt text from the manifest. Pictures below the first screen are only requested when they are about to scroll into view (300 px margin), so a page's first-screen weight does not grow. Captions that depend on `CONFIG` (colour and phone-size names) are built in `buildShotGrids()` in `src/main.js`. A picture that fails to load is removed, never shown as a broken icon.

Each render carries a small "Render" caption.

## Dropping in real photos

Put a photo at `assets/photos/<id>.webp` (use an id from `src/shots.js`). The build copies it to `dist/assets/photos/`, the page uses it instead of the render and drops the "Render" caption. Photos can be any size (the page reserves the space from the manifest, so keep the same shape), should be WebP, and should stay small (about 150 KB). A photo whose name matches no id is ignored with a warning. Photos are never generated: they must be real photos of the real product.

## The single-file demo

`npm run build:single` does **not** inline the new pictures: ~2.7 MB of them would double the file. It inlines only one three-quarter picture per model (640 px) for the comparison panel. Every other picture token becomes nothing, and its gallery section is left out, so there are no broken-image icons. The root `index.html` stays under 4 MB.
