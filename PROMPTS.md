# Prompts for Claude Code

How to use this:

1. Unzip the project, open a terminal in the `lean-phone-stand` folder and run `claude`.
2. Paste the prompts below **one at a time, in order**. Look at the result in the browser before moving on.
3. Ask Claude Code to commit after each one (`git init` first if you have not).

Claude Code reads `CLAUDE.md` automatically. It describes the brand, the two models and their prices, the file layout and the gotchas, so the prompts can stay short.

The current site is a single long scroll. Prompts 1 to 3 are the changes you asked for: separate pages, more precise animation, and the Regular and With cutout models. Prompt 5 is the "what should we make next" comment page.

---

## 0. Get it running

```
Read CLAUDE.md, then install and build the project (npm install, npm run build) and open dist/index.html. Tell me in five lines how the page works and confirm the two models (Regular $5.99, With cutout $7.99) both show up in the Customize section. Don't change anything yet.
```

Done when: it builds with no errors and Claude Code can explain the scroll timeline in its own words.

---

## 1. Separate pages instead of one scroll-down

```
Turn the site from one long scroll into separate pages. Keep the 3D stand, the look and the copy.

Pages, each with its own URL, title and meta description:
  /            Home: short and punchy. Big cursive Lean wordmark (src/logo.json, the "n" is the stand profile), the stand, one line, two buttons (Buy, Models). Links into the other pages.
  /models      Regular vs With cutout (details in prompt 3, for now a placeholder that shows both prices)
  /design      Ribs, lean angle, footprint
  /charging    The cable cutout story
  /colors      The six colors plus custom
  /customize   The studio: model, color, logo or text, front or back
  /specs       Measurements and the profile drawing
  /about       Why Lean exists (the Lean story)
  /buy         Price, options, quantity, bag
  /next        "What should we make next?" (placeholder for now, built in prompt 5)

Requirements:
- Each page is its own short scroll story (one to three screens of scrolling), not a section of a giant page.
- ONE persistent 3D canvas. Navigating between pages must not reload or rebuild the WebGL scene: the stand glides from its pose on the old page to its pose on the new page. Use Vite with a small History API router, or another approach you can justify. Back/forward and deep links must work. Add a hosting fallback so every route serves the app.
- Shared state (model, color, logo mode, text, placement, quantity, bag count) lives in one store that survives navigation (sessionStorage) and can be set from the URL, for example /buy?model=cutout&color=orange.
- Shared nav and footer. The current page is highlighted. Mobile menu works. Prices come only from CONFIG.
- Keep prefers-reduced-motion and the no-WebGL fallback working.
- Keep the Lean wordmark (cursive "Lea" plus the "n" that is the stand profile, from src/logo.json) and do not put a company or "by" line anywhere near it. Do not add image upload.

Finish by running the screenshot tools for every page at 1440x900 and 390x844, look at them, and fix what is off. Summarise what you changed and anything you decided on my behalf.
```

Done when: every URL loads directly, the stand moves between pages without a reload flash, and the back button works.

---

## 2. Better, more precise animation

```
Rebuild the animation system so the motion is precise and every beat is deliberate. Today the keyframes (KF_DEF) are rough. Do this for every page.

System:
- Give each page its own timeline module made of named beats, for example { name: 'slot-xray', from: 0.18, to: 0.32, ... }. Camera, stand rotation, phone, cable, callouts and text all hang off the same beats so copy and model are locked together to the exact scroll position. Use GSAP ScrollTrigger with scrub, or a small custom system if you can show it is better.
- A small set of named easings used consistently: one for entrances, one for camera moves, one linear for continuous spins. Camera moves follow splines, not straight lerps.
- A debug mode: ?debug shows page, progress, current beat and FPS; ?p=0.42 freezes the page at that progress so screenshots are exact.

Sequences to build (replace the current ones):
- Home: the wordmark writes itself left to right (the letters in logo.json are filled outlines, so reveal them with an animated mask or clip wipe that follows the writing direction; the "n" is a stroked path, so draw it with stroke-dashoffset), the "n" is drawn last and glows green, then the stand rises and settles into a 3/4 view, then turns slowly as you scroll.
- Design: the seven ribs light up one at a time in sync with the copy; the dimension lines draw with leaders and the numbers count up; the lean angle arc sweeps from the table to 67 degrees.
- Charging (With cutout model only): x-ray view with the slot glowing, then the phone slides down onto the stand, then the plug travels along a path from below and seats in the phone as the cable pushes through the slot, and the screen's charge percentage rises in sync with scroll.
- Colors: replace the plain color blend with a wipe that radiates from the base of the stand, with the glow disc following.
- Flip: the stand lifts, flips over its centre and lands showing the back, where the logo decal sits.
- Models: the base of the Regular model gets cut live, a clip plane sweeps across and the slot appears, then the cable passes through.

Quality:
- 60 fps on a mid-range phone: cap pixel ratio at 2, no allocations inside the frame loop, stop rendering when the canvas is off screen, test with 4x CPU throttle and report the numbers.
- No jitter or snapping at the beat boundaries, no popping geometry. Fix any model swap pop.
- Reduced motion: no scrub, keep static poses with short fades.

Verify: for every page capture screenshots at ten progress values with ?p= on desktop and mobile, look at all of them, and fix anything that overlaps text, clips the stand or looks mistimed. Keep a contact sheet (tools/sheet.py) of each page in /docs/animation-check/.
```

Done when: you can scrub any page slowly and every text change lines up with a visible model change.

---

## 3. Offer both models: Regular and With cutout

```
Make the two models a first-class part of the site. Regular is $5.99 (no cutout). With cutout is $7.99 (16 x 9 mm slot in the base so a charging cable passes through). Prices live in CONFIG only.

Build the /models page:
- Both models shown as real 3D (use geos.plain and geos.cutout), side by side on desktop and swipeable on mobile. Each has its name, price, one line of what it is for, and a Choose button that goes to /buy?model=plain or /buy?model=cutout.
- A comparison table: what is the same (size, ribs, lean angle, colors, logo) and what differs (the slot, price, charging while standing).
- The animated cut from prompt 2: scrolling makes the slot appear on the Regular model.
- Use the product images in assets/renders/ (see CLAUDE.md, Product images) for the cards and the comparison, including the detail view that shows the slot next to the solid base. Serve them as files, not inline.
- A short "Which one?" section: Regular for shelves, desks and kitchens where you charge elsewhere; With cutout for charging while it stands.

Across the rest of the site:
- Audit the copy. Every claim about charging through the base must say it applies to the With cutout model. The Home and Design pages show the model neutrally.
- The Customize and Buy pages must show the right 3D model for the selected option, with no pop when switching (crossfade or a short wipe), and the order summary must name the model.
- The spec list shows the cutout dimensions only for that model.

Do not offer an image upload. Logo options stay: the Lean logo, the customer's own text, or none, all free.
```

Done when: switching models anywhere updates the 3D view, the price and the order summary together.

---

## 4. Customize, bag and checkout

```
Make buying real.

1. Bag: replace the toast with a slide-in bag drawer showing each line (model, color, logo text, placement, size, quantity, line price), editable quantity, remove, subtotal. It persists across pages and reloads.
2. Checkout: ask me which provider I want (Stripe Checkout, Shopify, or something else) before you build it. Use environment variables for keys, test mode only, never commit secrets. Include model, color and logo text as line-item metadata.
3. Fulfilment: every order needs a ticket the printer can act on: model (plain or cutout) and the matching file (models/lean-regular.stl or models/lean-cutout.stl), color, logo text and placement, quantity. Generate it as JSON plus a readable email to me when an order is paid.
4. Validate the logo text (max 20 characters, trim, strip anything unprintable) and show the printed result in the 3D preview before purchase.

Keep prices from CONFIG. Add tests for the bag maths: quantities, both model prices, totals.
```

Done when: a test-mode order goes through and produces the fulfilment ticket.

---

## 5. "What should we make next?" comment page

```
Build the /next page: a public ideas board where visitors tell us what Lean should make next. It should feel like the rest of the site (dark, calm, same type).

Page:
- Headline "What should we make next?" and one sentence of copy.
- A short poll at the top with 3 to 4 candidate products as cards (use clearly marked placeholders such as "Lean for tablets", "Desk cable clip", "Two-phone dock" that I can edit in one config file), one vote per visitor.
- An idea form: idea text (required, 280 characters max with a live counter), name or handle (optional), email (optional, never shown publicly, only to tell them if we build it). A category chip: New color, Accessory, New product, Other.
- The list of ideas under it: newest or top, an upvote button per idea (one per visitor per idea), relative time ("2 days ago"), a "We're looking at this" badge that only I can set.
- Empty state with three seeded examples, each labelled "Example", which disappear once there are real ideas.

Back end:
- Ask me which storage to use (Supabase is my default suggestion because it is free to start). Create the schema/migration, Row Level Security or server checks, and a simple server function for posting and voting.
- Spam control: honeypot field, a rate limit per IP and per device, a link filter, a profanity filter, and a "report" button.
- A private /admin/next page behind a password from an environment variable: hide, delete or mark ideas, export CSV, see poll results.
- Accessible: labelled fields, keyboard friendly, visible focus, announcements for errors and success.
- No third-party trackers.

Add /next to the nav and footer, and a small "Tell us what to make next" link on the Buy page after checkout. Test the form on desktop and mobile with screenshots, and show me the schema and the environment variables I need to set.
```

Done when: an idea posted on the page shows up, can be upvoted, and can be hidden from the admin page.

If you only wanted a private notes page for yourself rather than a public board, tell Claude Code "make /next a private page for my own notes instead" and drop the admin and spam parts.

---

## 6. Polish and launch

```
Get the site ready to launch.
- Performance: Lighthouse on the Home, Models and Buy pages on mobile; bring the 3D page under a 3 second load on a mid-range phone (compress the models if needed, lazy-load the scene after first paint, add a poster image).
- Accessibility: keyboard navigation, focus order, contrast, alt text, reduced motion.
- SEO and sharing: titles, descriptions, Open Graph and Twitter images (1200x630, made from the renders in assets/renders/ with the wordmark from assets/logo/), favicon from the "n" (the stand profile) cut out of the wordmark, plus the SVGs in assets/logo/, sitemap. Also export a ready set of product images for ads and marketplaces: each model in each of the six colors, on white and on transparent, in assets/exports/.
- Add privacy, shipping and returns pages (placeholders I can edit).
- Deploy to Vercel (or Cloudflare Pages if you prefer) and tell me exactly what to click to connect my domain.
Give me a launch checklist at the end with anything you could not do yourself.
```
