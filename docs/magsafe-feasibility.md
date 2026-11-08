# MagSafe feasibility check (Phase 2, Step A)

Question: can an iPhone's MagSafe magnet ring line up with magnets in the Lean slope face?
Reproduce: `python3 tools/magsafe_fit.py` (reads `build/model_plain.bin` + `build/meta.json`, writes `magsafe-feasibility.png`).

## What was measured on the real mesh

| Item | Value |
|---|---|
| Straight slope face | **68.5 mm long** (from the trough corner to where the top arch starts); the surface curves away over the next ~4.5 mm |
| Face width | **54 mm crest to crest** (56 mm overall including the rounded side ribs). About 52 mm is usable if magnets stay 2 mm clear of the rounded sides |
| Ribs | 7 crests at x = 0, ±8.3, ±16.5, ±25 mm (pitch 8.33 mm). **Crest to valley depth 2.24 mm** |
| Slope plate thickness | about 10 mm (from the profile in `meta.json`) |
| Phone seat | the phone's bottom edge sits at the trough corner (the 3D scene uses 0.5 mm up the slope; the brief says about 5 mm: this only shifts everything up the slope and makes the overhang below 4.5 mm worse) |
| Slope angle | 66.97 degrees |

## What is verified and what is not

- **Ring outer diameter 54.1 mm**: quoted from Apple's Accessory Design Guidelines by a forum post, not read by me (the PDF host was not reachable from this session). Aftermarket rings are listed at 54 to 56 mm outer and 46 mm inner. I used 54.1 / 46.0.
- **Where the ring sits on the phone (60 to 75 mm above the bottom edge): taken from the brief, NOT verified.** I could not find it in any source I could reach. Because it decides everything, I swept 55 to 75 mm. Please measure a real iPhone (see questions below).
- Apple's guidelines mention an accessory self-alignment budget of about 1.55 mm radial (secondary source), so a magnet pattern that is a few millimetres off the phone's ring loses much of its pull.

## Result 1: a full ring does not fit (confirmed)

A full ring is 54.1 mm across; the usable face is about 52 to 54 mm wide and 68.5 mm long.

| Ring centre above phone's bottom edge | Ring spans (mm up the slope) | Hangs past end of straight face | Magnet band that lands on the face |
|---|---|---|---|
| 55 mm | 28 to 83 | 14 mm | 48 to 69 percent |
| 60 mm | 34 to 88 | 19 mm | 42 to 61 percent |
| 65 mm | 39 to 93 | 24 mm | 41 to 54 percent |
| 70 mm | 44 to 98 | 29 mm | 41 to 47 percent |
| 75 mm | 49 to 103 | 34 mm | 40 to 41 percent |

A full ring would only fit if its centre were 41 mm or less above the phone's bottom edge. It is also exactly as wide as the face, so even its widest point has no margin and would sit on the rounded side ribs. See `magsafe-feasibility.png`.

## Result 2: what does fit

The **lower arc** of the ring lands on the face for every centre height in the range (the lower half sits between 30 and 60 mm up the slope). Best honest design:

- **5 round N52 neodymium magnets, about 8 mm diameter x 2 mm**, on a 25 mm radius arc (the middle of the ring), placed on the lower arc at **x = 0, ±8.3 and ±16.7 mm**. That is one magnet per rib crest, about ±42 degrees of the ring, all well inside the 52 mm usable width.
- Behind each rib crest, because the crest is the only part of the face that touches the phone. The pocket floor then sets the gap (0.6 to 1.0 mm). Rear-loaded pockets keep all seven ribs intact; front flush lands would cut the ribs. Decided in Step B.
- It holds and roughly centres the phone; it will not self-centre like a full MagSafe puck.
- The Lean logo decal currently sits at about 33 mm up the slope, exactly where the magnets go. In Step C it moves to the upper part of the face (about 50 to 62 mm) or to the back.

## Limits to be honest about

1. **One phone size.** If the ring sits roughly mid-back (which the brief's 60 to 75 mm range suggests, but I have not verified), its height scales with the phone: the 6.1 inch models (12, 13, 14, 15; about 146.7 to 147.6 mm tall) are within a millimetre of each other, while a mini is about 15 mm shorter and a Pro Max about 13 mm taller. A fixed arc would line up with one size class only. Design target proposed: iPhone 12 to 15 (6.1 inch).
2. **Cases.** Every millimetre of case weakens the pull a lot; MagSafe cases are fine, thick or non-MagSafe cases may not hold.
3. **Polarity.** The phone's magnet array alternates polarity. Plain discs facing the same way will attract the phone's shield plate but not as strongly as a matched array. Alternating polarity discs may improve it. Needs a test print and a phone in hand.
4. **Holding strength cannot be verified from code.** Nothing in this report is a measured pull force.
5. **Cost.** Five N52 discs plus assembly may be most of a $1.50 add-on. Get a magnet quote before committing.
6. Magnets are passive: they hold the phone, they do not charge it.

## Recommendation

Build the **5-magnet lower-arc** option, marketed as "MagSafe-compatible hold" for iPhone 12 to 15, only after one physical prototype has been printed and tested with a real phone. If the measured ring position or the single-size limit is unacceptable, drop the add-on rather than ship something that does not hold.

Sources: [Apple Accessory Design Guidelines (archived PDF)](https://webcf.waybackmachine.org/web/20211202174234/https://developer.apple.com/accessories/Accessory-Design-Guidelines.pdf) (not read directly), [MacRumors on the MagSafe design guidelines](https://www.macrumors.com/2020/11/02/apple-magsafe-design-guidelines-accessory-makers), [aftermarket ring sizes](https://medium.com/@duanh148/what-size-is-magsafe-magnet-7b14f5d6c450).
