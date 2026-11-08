# Higgsfield brief: optional atmosphere media

Four optional files that add mood behind the Home hero, About and the social image. **The site looks finished without any of them** (CSS gradients and a built-in line texture are the fallback), so this is a nice-to-have, not a blocker.

## Rules (read first)

- **Atmosphere only. Never generate the stand, a phone, a screen, text, a logo or a person.** An AI render would misrepresent the real printed product. The real 3D model (and the real renders in `assets/renders/`) already show it accurately.
- Dark, quiet, mostly empty. These sit behind a charcoal page at 6 percent opacity (stills) or 50 percent with a fade (video). A bright or busy image will not work.
- Colour: near-black with deep green undertones; accent is the site's electric green (`#35f07f`). No other hues.

## State of this brief

| | |
|---|---|
| Written | 8 Nov 2026 |
| Higgsfield connector in this session | read-only: it can list models, read a model's settings and show the credit balance, but **cannot generate or upload media**. So nothing has been generated yet |
| Plan and credits (checked through the connector, 8 Nov 2026) | Free plan, 10 credits |
| Model ids checked | `cinematic_studio_2_5` (Cinema Studio Image 2.5: resolution 1k / 2k / 4k, aspect ratios include 16:9 and 21:9) and `cinematic_studio_3_0` (Cinema Studio Video 3.0: 480p / 720p / 1080p / 4k, 4 to 15 s, `generate_audio` defaults to false, accepts a start and an end image) |
| Credit cost per generation | not exposed by the connector. Check it in the Higgsfield app before each run. |

With about 10 credits, **make the stills first** (they are cheaper) and only make the video if you like the stills. If credits are tight, use 720p for the video.

## The four files

Drop the finished files into `assets/media/` (exact names), run `npm run build`. A missing file is skipped silently.

### 1. `leaf-veins.webp` (still, 21:9, 2k)
Model: **Cinema Studio Image 2.5** (`cinematic_studio_2_5`), aspect 21:9, resolution 2k.

> Extreme macro of a single mistletoe leaf, backlit and translucent, the veins glowing soft green against a near-black background. Dark, minimal, high contrast, a lot of empty negative space on the right half. No text, no objects.

Shows: behind the Home hero at 6 percent opacity, nature level 1 and 2. Budget: under 250 KB as WebP.

### 2. `contours.webp` (still, 16:9, 2k)
Model: **Cinema Studio Image 2.5**, aspect 16:9, resolution 2k.

> Topographic contour lines, thin and glowing green on near-black, flat top-down view, very low contrast, subtle, lots of empty space. No labels, no text.

Shows: behind About at 6 percent opacity, nature level 1 and 2. Budget: under 250 KB.

### 3. `hero-plate.mp4` (video, 16:9, 6 to 8 s, 1080p or 720p, audio off)
Model: **Cinema Studio Video 3.0** (`cinematic_studio_3_0`), aspect 16:9, 6 to 8 seconds, resolution 1080p (720p if credits are tight), `generate_audio` off.

> Locked-off macro shot, slow drift to the right, of a dark glossy charcoal surface at night. A single thin edge of electric-green light grazes across it from the left, revealing a faint contour pattern. Out-of-focus dust motes drift upward through the beam. Extremely dark overall, near-black with deep green undertones, shallow depth of field, calm, premium product-launch mood. No objects, no text, no logos, no people, no phone.

Shows: behind the Home hero, **wide screens only** (see "How the site uses it"). Budget: under about 2.5 MB after the re-encode below. Optional: add `hero-plate-poster.webp` (the first frame, under 250 KB). It is what phones, reduced motion and Save-Data see instead of the video.

Tip: the model accepts a start image and an end image. Using the same still (for example `contours.webp`) as both gives a clip that already starts and ends alike, which makes the loop easier.

### 4. `og-plate.webp` (still, 16:9, 2k)
Model: **Cinema Studio Image 2.5**, aspect 16:9, resolution 2k.

> Dark charcoal studio backdrop with a soft pool of green light at the bottom centre, empty centre for product placement, smooth gradient, fine film grain. No objects, no text.

Shows: as the background of the social image (`node tools/make_og.cjs`), with the real product render and the wordmark composited on top. Not loaded by the website itself. Budget: under 250 KB.

## Preparing the files (ffmpeg commands, all tried on this project)

Stills to WebP, 2048 px wide (adjust `-quality` until each is under 250 KB):

```bash
ffmpeg -i leaf-veins.png -vf scale=2048:-2 -c:v libwebp -quality 70 -compression_level 6 assets/media/leaf-veins.webp
```

Video: re-encode to 1920 px wide H.264 without audio, with a seamless loop (the last second cross-fades into the first, so the loop point cannot be seen). This example is for an 8 second clip and returns a 7 second loop. Change the `trim` values if your clip is a different length:

```bash
ffmpeg -i generated.mp4 -filter_complex "[0:v]trim=1:7,setpts=PTS-STARTPTS[mid];[0:v]trim=7:8,setpts=PTS-STARTPTS[tail];[0:v]trim=0:1,setpts=PTS-STARTPTS[head];[tail][head]xfade=transition=fade:duration=1:offset=0[x];[mid][x]concat=n=2:v=1:a=0[c];[c]scale=1920:-2[v]" -map "[v]" -an -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart assets/media/hero-plate.mp4
```

If it is over 2.5 MB, raise `-crf` (32, 34) or scale to 1280. The poster is the first frame:

```bash
ffmpeg -i assets/media/hero-plate.mp4 -frames:v 1 -vf scale=1280:-2 -c:v libwebp -quality 70 assets/media/hero-plate-poster.webp
```

`npm run build` prints a warning when a file is over its budget.

## How the site uses the files (src/media.js, tools/media_test.cjs checks all of it)

- `build.mjs` lists the files that exist in `window.__MEDIA__`. A missing file is not requested at all (no 404, no placeholder).
- **Stills**: replace the built-in line textures (`tools/make_textures.py`) behind Home (veins) and About (contours), at 6 percent opacity, in the fixed layer below the canvas, only at `data-nature` 1 and 2.
- **Video**: created only after the page is ready and the browser is idle, so it is never part of the first paint or LCP. `muted`, `loop`, `playsinline`, `preload="none"`, no controls, hidden from screen readers. It plays only on Home, at nature level 1 and 2, on screens at least 900 px wide, with the tab visible. It is paused on every other page and when the tab is hidden.
- **No video** on a phone-width screen, with `prefers-reduced-motion`, or when the browser says Save-Data: the poster image is shown instead (or nothing, if there is no poster). The mp4 is never requested in those cases.
- The one-file demo (`npm run build:single`) inlines the stills and the poster but leaves the video out.

## Credit and licence log

Nothing generated yet. When you generate a file, add a row (model, date, prompt, settings, who made it). Before shipping, **check Higgsfield's current terms for your plan** (Free plans can carry restrictions on commercial use or watermarks) and note the result here.

| File | Model | Date | Prompt / settings | Credits | Terms checked |
|---|---|---|---|---|---|
| leaf-veins.webp | | | | | |
| contours.webp | | | | | |
| hero-plate.mp4 | | | | | |
| og-plate.webp | | | | | |
