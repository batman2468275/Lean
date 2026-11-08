"""Finish the product stills: combine each <id>.stand.png with its soft (blurred) <id>.shadow.png and write <id>.webp (1200 px wide) and <id>@640.webp.
   usage: finish_shots.py <workdir> <outdir> [--preview]      (--preview: one 600 px file per picture, no size budgets)
   Budgets (checked by tests/shots.test.mjs): 1200 px file <= 90 KB, 640 px file <= 30 KB. The encoder lowers quality, then alpha quality, until the file fits.
   The shadow pass is black with alpha; blurring it here gives the soft contact shadow, so the picture sits on light AND dark bands without a CSS shadow."""
import sys, glob, os
from PIL import Image, ImageFilter

work, out = sys.argv[1], sys.argv[2]
preview = "--preview" in sys.argv
BUDGET = {1200: 90 * 1024, 640: 30 * 1024}
SHADOW_BLUR_AT_2400 = 26      # px when the picture is 2400 wide; scales with the picture
SHADOW_OPACITY = 0.9          # the harness shadow is already 50 percent black


def compose(stand_path):
    name = stand_path[: -len(".stand.png")]
    stand = Image.open(stand_path).convert("RGBA")
    sh = name + ".shadow.png"
    if os.path.exists(sh):
        s = Image.open(sh).convert("RGBA")
        alpha = s.getchannel("A").filter(ImageFilter.GaussianBlur(SHADOW_BLUR_AT_2400 * s.width / 2400)).point(lambda v: int(v * SHADOW_OPACITY))
        shadow = Image.new("RGBA", s.size, (8, 12, 10, 0))
        shadow.putalpha(alpha)
        shadow.alpha_composite(stand)
        stand = shadow
    return os.path.basename(name), stand


def save_to_budget(im, path, budget):
    for q, aq in [(84, 92), (80, 88), (76, 84), (72, 80), (68, 76), (64, 70), (60, 64), (55, 56), (50, 48), (44, 40)]:
        im.save(path, "WEBP", quality=q, method=6, alpha_quality=aq)
        if os.path.getsize(path) <= budget:
            return q
    return None


for st in sorted(glob.glob(os.path.join(work, "*.stand.png"))):
    pid, im = compose(st)
    if preview:
        w = 600
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(out, pid + ".webp"), "WEBP", quality=80)
        continue
    for w in (1200, 640):
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        path = os.path.join(out, pid + ("" if w == 1200 else "@640") + ".webp")
        q = save_to_budget(r, path, BUDGET[w])
        kb = os.path.getsize(path) / 1024
        print(os.path.basename(path), "%dx%d" % r.size, "%.0f KB" % kb, "q%s" % q if q else "OVER BUDGET")
