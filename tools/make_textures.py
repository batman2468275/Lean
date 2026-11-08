#!/usr/bin/env python3
"""Generates the two faint line textures used behind the Home hero and About (nature level 1 and 2):
     veins    a mistletoe-leaf vein network (a midrib with curved side veins and fine cross veins)
     contours topographic contour lines
   Both are plain SVG line art (stroke only, no fill) drawn in white; the CSS tints them with opacity (6 percent or less).
   Usage:  python3 tools/make_textures.py            prints the two data URIs and their sizes
           python3 tools/make_textures.py --css FILE  replaces /*TEX:veins*/ ... /*TEX:end*/ and the contours marker in FILE (src/style.css)
   Deterministic (seeded), so rebuilding gives the same files. The Higgsfield stills (docs/higgsfield-brief.md) can replace or add to them. """
import math, random, re, sys, urllib.parse

W, H = 1200, 800


def veins():
    rnd = random.Random(7)
    out = []
    # midrib: a gentle S curve from the lower left to the upper right
    def mid(t):  # t in 0..1
        x = 60 + t * (W - 140)
        y = H * 0.78 - t * H * 0.62 + math.sin(t * 3.1) * 46
        return x, y
    pts = [mid(i / 60) for i in range(61)]
    out.append('M' + 'L'.join(f'{x:.0f} {y:.0f}' for x, y in pts))
    for k in range(1, 13):
        t = k / 13.5
        x, y = mid(t)
        x2, y2 = mid(t + 0.01)
        ang = math.atan2(y2 - y, x2 - x)
        for side in (-1, 1):
            a = ang + side * (0.95 - 0.35 * t)       # veins sweep forward as they go
            ln = (260 - 150 * t) * (0.85 + rnd.random() * 0.3)
            cx = x + math.cos(a - side * 0.5) * ln * 0.55
            cy = y + math.sin(a - side * 0.5) * ln * 0.55
            ex = x + math.cos(a) * ln
            ey = y + math.sin(a) * ln
            out.append(f'M{x:.0f} {y:.0f}Q{cx:.0f} {cy:.0f} {ex:.0f} {ey:.0f}')
            # two or three fine cross veins off each side vein
            for j in (0.4, 0.75):
                bx = x + (ex - x) * j + (cx - x) * 0.0
                by = y + (ey - y) * j
                for s2 in (-1, 1):
                    a2 = a + s2 * 1.05
                    l2 = ln * 0.22
                    out.append(f'M{bx:.0f} {by:.0f}L{bx + math.cos(a2) * l2:.0f} {by + math.sin(a2) * l2:.0f}')
    return out


def contours():
    rnd = random.Random(11)
    out = []
    centres = [(300, 340, 1.0), (900, 500, 0.8)]
    for cx, cy, sc in centres:
        ph = [rnd.random() * 6.28 for _ in range(4)]
        for r0 in range(36, 330, 34):
            r0 *= sc
            pts = []
            for i in range(0, 37):
                a = i / 36 * 2 * math.pi
                r = r0 * (1 + 0.11 * math.sin(2 * a + ph[0]) + 0.07 * math.sin(3 * a + ph[1]) + 0.04 * math.sin(5 * a + ph[2])) + 6 * math.sin(a * 7 + ph[3])
                pts.append((cx + r * math.cos(a) * 1.25, cy + r * math.sin(a) * 0.82))
            out.append('M' + 'L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + 'Z')
    return out


def svg(paths, sw):
    body = ''.join(f'<path d="{d}"/>' for d in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<g fill="none" stroke="#fff" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>')


def uri(s):
    s = s.replace('"', "'").replace('%', '%25').replace('<', '%3C').replace('>', '%3E').replace('#', '%23')   # the least escaping a data URI needs
    return 'url("data:image/svg+xml,' + s + '")'


if __name__ == '__main__':
    v, c = uri(svg(veins(), 1.4)), uri(svg(contours(), 1.2))
    if '--css' in sys.argv:
        f = sys.argv[sys.argv.index('--css') + 1]
        s = open(f).read()
        s = re.sub(r'(--tex-veins:\s*)url\(".*?"\)(;)', lambda m: m.group(1) + v + m.group(2), s, flags=re.S)
        s = re.sub(r'(--tex-contours:\s*)url\(".*?"\)(;)', lambda m: m.group(1) + c + m.group(2), s, flags=re.S)
        open(f, 'w').write(s)
        print('veins', len(v), 'bytes; contours', len(c), 'bytes ->', f)
    else:
        print('veins', len(v), 'bytes;', 'contours', len(c), 'bytes')
