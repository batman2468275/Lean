# Animation and look check

Ten pinned frames per page (`?p=` values 0.02, 0.12 ... 0.96 of each page's whole scroll), at 1440x900 (`desktop-*.png`) and 390x844 (`mobile-*.png`), in the dark tech theme at nature level 1,
plus `home-intro.png` (the Home intro at t = 0.15 ... 3.25 s). Regenerate with `tools/contact.cjs` (set `NATURE=0|1|2` to pick a level), `tools/intro.cjs` and `tools/sheet.py` (see CLAUDE.md).
Captured with software WebGL, so they show poses and layout, not smoothness. The real 60 fps check must be done on a phone.
`docs/look-review/` holds the sheets that were used to decide the look (nature levels side by side, the Black stand).
