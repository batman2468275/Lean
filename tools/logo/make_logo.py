"""Builds the Lean wordmark as vector paths.
   'L', 'e', 'a' come from Sacramento (SIL OFL, monoline script). The 'n' is NOT a font glyph: it is the real stand profile
   (arch, vertical rear leg with its foot, and the lip hook) drawn as a stroke of the same weight, so the last letter is the product.
   Output: src/logo.json  { viewBox, letters (filled path), n (stroked path), stroke, ... }  and a preview html.
   usage: python3 tools/logo/make_logo.py [slant_deg_for_n] [n_dx] [n_dy]
"""
import sys, json, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
font = TTFont(os.path.join(HERE, 'Sacramento-Regular.ttf')); gs = font.getGlyphSet(); cmap = font.getBestCmap()
NH = 75.21                      # height of the stand profile = x-height of the wordmark
STROKE = 10.0                   # tube thickness of the stand wall in profile units
slant_n = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
n_dx = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
n_dy = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0

bp = BoundsPen(gs); gs[cmap[ord('n')]].draw(bp); nb = bp.bounds
s = NH / (nb[3] - nb[1])        # font units -> logo units so the font's 'n' height equals the stand profile height
base_y = NH - 0.0 - (-nb[1]) * s * 0   # baseline sits at y = NH - overshoot
yb = NH + nb[1] * s            # y of the font baseline (y down), overshoot below it

def glyph_path(ch, x0):
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
    tp = TransformPen(pen, (s, 0, 0, -s, x0, yb))
    gs[cmap[ord(ch)]].draw(tp)
    return pen.getCommands(), font['hmtx'][cmap[ord(ch)]][0] * s

x = 0.0; parts = []
for ch in 'Lea':
    d, adv = glyph_path(ch, x); parts.append(d); x += adv
letters = ' '.join(parts)

# the stand profile as a centerline (profile units: x right, y down, 0..68 x 0..75): lip hook, base, trough, slope, arch, rear leg, foot
N_D = ("M7.2 55.2 C5.2 59.5 4.6 63 8 66.4 C10.5 69 17 69.8 22 69.5 C26.5 69.4 28.2 66 29.7 58.3 "
       "L50.3 10.1 C51.7 7.7 53.4 5 55.6 5 C57.2 5 58.12 7 58.12 10 L58.12 66 C58.12 68.9 59 69.8 62 69.8 L63.4 69.8")
meta = json.load(open(os.path.join(ROOT, 'build', 'meta.json')))
n_x = x + n_dx
import re
def shift(d, dx, dy, sk):
    # translate (and optionally shear about the baseline) every coordinate pair of an absolute path
    toks = re.findall(r'[A-Za-z]|-?\d+\.?\d*', d); out = []; i = 0; cmd = None
    while i < len(toks):
        t = toks[i]
        if t.isalpha(): cmd = t; out.append(t); i += 1; continue
        if cmd in 'ML' or cmd == 'C':
            xx, yy = float(toks[i]), float(toks[i + 1]); xx = xx + (NH - yy) * sk
            out.append(f"{xx + dx:.2f} {yy + dy:.2f}"); i += 2
        else: i += 1
    return ' '.join(out)
import math
n_path = shift(N_D, n_x, n_dy, math.tan(math.radians(slant_n)))

all_x = [n_x + 68.12 + 5]
xs = [float(v) for v in re.findall(r'-?\d+\.?\d*', letters)[0::2]]
minx = min(xs + [n_x]) - STROKE; maxx = max(all_x + xs) + 2
ys = [float(v) for v in re.findall(r'-?\d+\.?\d*', letters)[1::2]]
miny = min(ys) - 4; maxy = max(ys + [NH]) + 4
logo = {"viewBox": [round(minx, 2), round(miny, 2), round(maxx - minx, 2), round(maxy - miny, 2)],
        "letters": letters, "n": n_path, "stroke": STROKE, "xheight": NH, "baseline": round(yb, 2)}
json.dump(logo, open(os.path.join(ROOT, 'src', 'logo.json'), 'w'))
vb = ' '.join(map(str, logo['viewBox']))
html = f'''<body style="margin:0;background:#0d0f0e"><svg width="1400" height="{int(1400*logo['viewBox'][3]/logo['viewBox'][2])}" viewBox="{vb}">
<path d="{letters}" fill="#f1f3f0"/><path d="{n_path}" fill="none" stroke="#86b974" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg></body>'''
open(os.path.join(HERE, 'preview.html'), 'w').write(html)
print('viewBox', vb, 'letters end x', round(x, 1))
