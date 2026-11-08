# Lean: the phone stand

A 3D-printed phone stand with seven ribs and a 67 degree lean, and its website: a real 3D model of the stand animates as you scroll, with a studio to pick the model, colour, MagSafe option and logo.

**The look:** dark and precise (charcoal, electric green, big bold Geist, mono spec-sheet labels, hairlines, a glossy stand on a dark stage), with a little nature as seasoning. How much nature is one switch: `?nature=0` pure tech, `?nature=1` (default) a little, `?nature=2` more. Details in [CLAUDE.md](CLAUDE.md) ("Theme").

**Try it with no setup:** open `index.html` (double-click it). It is the entire site in one file. It is a demo: the shop has no checkout, and the ideas board keeps its data in your browser.

**Live demo on GitHub:** in the repository go to *Settings > Pages*, choose *Deploy from a branch*, branch `main`, folder `/ (root)`. The site appears at `https://<your-user>.github.io/<repo>/`.

## Run the real site

```
npm install
npm run build        # -> dist/
npm start            # http://127.0.0.1:4173 (also serves the ideas board API)
npm test             # unit tests
npm run build:single # rebuild the one-file demo (index.html)
```

Needs Node 20 or newer. Project notes for developers (architecture, prices and colours in `src/config.js`, animation system, MagSafe, ideas board, accessibility, test tools) are in [CLAUDE.md](CLAUDE.md) and `docs/`.

## Status

- Prices, models and colours live in `src/config.js`. There is no checkout yet.
- The ideas board stores data in a local JSON file (demo). Use a real database before launch: `docs/suggestions.md`.
- MagSafe magnets and ring height are untested on real phones and printers: `docs/magsafe.md`.
- Placeholders written as `[EDIT: ...]` are for the owner to fill in (About, Shipping and returns, Privacy).
- Optional generated atmosphere media (stills, a hero video, a social-image plate) can be dropped into `assets/media/`; see `docs/higgsfield-brief.md`. The site is finished without them.

Made by Astrofield Corporation. The wordmark font Sacramento is licensed under the SIL Open Font License (`tools/logo/OFL-Sacramento.txt`).
