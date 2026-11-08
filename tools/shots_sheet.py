"""Contact sheet of the product stills: every picture on a tile, tiles alternate between a deep band and a light band (so a bad shadow, a halo or a cropped edge shows up on both).
   usage: shots_sheet.py <dir with the .webp files> <out.png> [--cols 8] [--tile 300] [--match glob]
   Skips the @640 files. Used for the review (docs/shots-contact-sheet.png) and for framing previews."""
import sys, glob, os, fnmatch
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
def opt(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default
cols, tile, match = opt("--cols", 8), opt("--tile", 300), opt("--match", "*")
DEEP, LIGHT = (13, 15, 14), (241, 243, 240)      # the site's --charcoal and --paper
files = [f for f in sorted(glob.glob(os.path.join(src, "*.webp"))) if "@" not in os.path.basename(f) and fnmatch.fnmatch(os.path.basename(f), match)]
rows = (len(files) + cols - 1) // cols
label_h = 22
sheet = Image.new("RGB", (cols * tile, rows * (tile + label_h)), DEEP)
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
except Exception:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    r, c = divmod(i, cols)
    bg = DEEP if (r + c) % 2 == 0 else LIGHT
    x, y = c * tile, r * (tile + label_h)
    d.rectangle([x, y, x + tile - 1, y + tile + label_h - 1], fill=bg)
    im = Image.open(f).convert("RGBA")
    im.thumbnail((tile, tile), Image.LANCZOS)
    sheet.paste(im, (x + (tile - im.width) // 2, y + (tile - im.height) // 2), im)
    d.text((x + 6, y + tile + 4), os.path.basename(f)[:-5], fill=(150, 160, 155) if bg == DEEP else (60, 66, 62), font=font)
sheet.save(out)
print(len(files), "pictures ->", out, sheet.size)
