# GPU safety (iPad and phone speckle)

John's iPad shows dense multicoloured speckle over the floor of the 3D scene (`/customize?color=sky`), and flicker ("phasing") on phones. **This cannot be reproduced here**: headless Chromium with software GL (SwiftShader) renders the floor cleanly at desktop, iPad and phone sizes. So the fix is defensive, and `npm run check:gl` only guards against regressions; it cannot prove the iPad is clean. The real test is on the device: see `docs/ipad-test.md`.

## What was ruled out
- **Invalid premultiplied alpha** (a colour channel above alpha): measured on the real drawing buffer at desktop, iPad and phone size, zero pixels. `check:gl` keeps it true.

## What was measured
On a crop of the lit floor (not the cast shadow), John's iPad screenshot has chroma noise 5.4 to 5.7 with 6 to 10 percent of pixels off-hue; a clean render has 0.35 and 0 percent; the clean dark background in the same screenshot has 0.6 and 0.3 percent. Metric (`tools/glcheck.cjs`): blur the crop with a box filter (radius 3), subtract it, `chroma_std = sqrt(mean(((R-G)^2 + (B-G)^2) / 2))` of the residual, and `hue_dev_pct` = share of pixels where `max(|R-G|, |B-G|) > 6` in the residual. Luma noise is ignored by design.

## Suspects in this pipeline
Transparent canvas composited over a CSS underlay and under `backdrop-filter` and `mask-image` layers; a 5.6 megapixel buffer with MSAA on an iPad in portrait; a 1400 x 1400 shadow-receiving floor with a 340-unit shadow frustum; three.js's per-pixel-noise PCF shadow sampling; three additive-blended materials; half-float PMREM environment targets; no device detection (iPadOS reports itself as a Mac); and `renderer.setSize` on every resize event, which fires when the iOS toolbar shows and hides and re-allocates (and clears) the canvas.

## The touch profile (`src/gpu.js`)
`GPU.profile` is `touch` when the user agent says iPhone, iPad, iPod or Android, **or** it says Macintosh with `maxTouchPoints > 1` (iPadOS), **or** `(pointer: coarse)` matches. `?gl=profile-touch` / `?gl=profile-desktop` force it. On touch:

| Default | Desktop | Touch | Flag that restores the old value |
|---|---|---|---|
| Canvas | transparent over the CSS stage | **opaque**; the scene draws the stage itself (a full-screen shader with the same gradients, the deep-chapter blend and the page glow, plus a static monochrome ordered dither) | `alpha` |
| Pixel ratio | min(dpr, 2) | min(dpr, 2, sqrt(3,000,000 / css area)) (an iPad in portrait renders at about 1.46x) | `dpr=<n>`, `maxpx=<n>` |
| MSAA | on | off when the pixel ratio is 1.5 or more | `aa` |
| Shadow map | 2048 | 1024, radius 3 | `shadow2048` |
| Floor plane | 380 (was 1400, on all devices) | 380 | `bigfloor` |
| Pool, slot glow, cut sheet | additive | normal alpha blending, retuned to look the same | `additive` |
| DOM over the canvas | `backdrop-filter`, ticked rail gradient, `will-change` | solid tinted backgrounds, a static masked tick image, no permanent `will-change`; the CSS underlay is hidden because the canvas draws it | `domfx` |
| Resize | every resize event | the buffer is sized from the large viewport height (`lvh`); a toolbar change only moves the camera's view window. A real change (width, rotation, 20 percent or more of height) still re-allocates | (`old`) |

Not changed by default: the PMREM environment (flag `noenv` skips it, to test it on the device). The wipe shader's varyings and uniforms are declared `highp` in the fragment stage.

## Flags
In the real query string, before any `#` (so they work in the single-file build too): `/Lean/?gl=noshadow,nodomfx#/customize?color=sky`.

- `old`: every touch default reverted (the exact pre-fix behaviour)
- restore one default: `alpha`, `aa`, `dpr=<n>`, `maxpx=<n>`, `shadow2048`, `bigfloor`, `additive`, `domfx`
- switch one feature off: `noshadow`, `noground`, `nocontact`, `noenv`, `nodomfx`
- `profile-touch`, `profile-desktop`

`?debug=gl` shows a panel with one button per flag (toggle and reload) and a copyable report: user agent, profile, `maxTouchPoints`, pointer type, devicePixelRatio, css size, drawing buffer size and megapixels, GPU renderer string, fragment highp precision, `MAX_TEXTURE_SIZE`, MSAA samples, context attributes, half-float and float colour-buffer extensions, shadow map size, active flags, three.js revision, and how many times the canvas was resized since load.

## Guards (`npm run check:gl`)
For desktop (1440 x 900), iPad (1024 x 1366 at 2x) and phone (390 x 844 at 3x) it checks: no invalid alpha; an opaque canvas on touch; the drawing buffer within 3 MP on touch; floor chroma noise at most 1.0 and off-hue at most 0.5 percent; no GL errors, shader compile errors or lost-context messages; and that scrolling a long page with the toolbar changing height does not re-allocate the canvas. It passes in software GL both before and after the fix for the noise (the bug is not visible here), which is exactly why it is only a regression guard.

## Rules
- **Never add per-channel or per-frame noise** to anything. A dither must be monochrome and static.
- **Never hide the floor with a CSS overlay** (grain, blur, a "noise cover-up"). Fix the cause.
- Keep the frame loop allocation-free and the canvas sized only on a real resize.
