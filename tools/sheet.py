import sys, glob
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1] + "/" + sys.argv[2] + "_*.png"))
lo, hi = int(sys.argv[4]), int(sys.argv[5])
files = files[lo:hi]
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 2
ims = [Image.open(f) for f in files]
w = 720 if cols == 2 else 480
th = [im.resize((w, int(im.height * w / im.width))) for im in ims]
rows = (len(th) + cols - 1) // cols
h = max(t.height for t in th)
sheet = Image.new("RGB", (cols * w, rows * h), "white")
for i, t in enumerate(th):
    sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    ImageDraw.Draw(sheet).text(((i % cols) * w + 8, (i // cols) * h + 8), files[i].split("/")[-1][:-4], fill=(255, 255, 0))
sheet.save(sys.argv[3])
print(len(files), "images ->", sys.argv[3])
