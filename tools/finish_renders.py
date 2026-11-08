"""Combine each <name>.stand.png with its soft (blurred) <name>.shadow.png, crop/resize to 1200px, write <name>.webp.
   Shadow pass is rendered as black-with-alpha; blurring it here gives a soft contact shadow."""
import sys, glob, os
from PIL import Image, ImageFilter, ImageChops
out = sys.argv[1]
SHADOW_BLUR = 26      # px at 2400
SHADOW_OPACITY = 0.9  # the harness shadow is already 50 percent black
for st in sorted(glob.glob(os.path.join(out, "*.stand.png"))):
    name = st[:-len(".stand.png")]
    sh = name + ".shadow.png"
    stand = Image.open(st).convert("RGBA")
    if os.path.exists(sh):
        s = Image.open(sh).convert("RGBA")
        alpha = s.getchannel("A").filter(ImageFilter.GaussianBlur(SHADOW_BLUR)).point(lambda v: int(v * SHADOW_OPACITY))
        shadow = Image.new("RGBA", s.size, (8, 12, 10, 0)); shadow.putalpha(alpha)
        shadow.alpha_composite(stand); stand = shadow
    im = stand.resize((1200, 1200), Image.LANCZOS)
    w = name + ".webp"
    im.save(w, "WEBP", quality=84, method=6, alpha_quality=92)
    print(os.path.basename(w), os.path.getsize(w) // 1024, "KB")
