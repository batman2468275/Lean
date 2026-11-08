"""MagSafe feasibility: where does an iPhone's magnet ring land on the Lean slope face?
Reads build/model_plain.bin + build/meta.json (three.js frame: Y up, lip toward +Z), ray-casts a height map of the ribbed slope and
overlays the ring for a sweep of ring-centre heights. Writes docs/magsafe-feasibility.png and prints the numbers used in docs/magsafe-feasibility.md.
usage: python3 tools/magsafe_fit.py
"""
import json, numpy as np, trimesh
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Wedge

meta = json.load(open("build/meta.json"))
raw = open("build/model_plain.bin", "rb").read()
nV, nF = np.frombuffer(raw[:8], "<u4")
V = np.frombuffer(raw[8:8 + nV * 12], "<f4").reshape(-1, 3).astype(float)
F = np.frombuffer(raw[8 + nV * 12:8 + nV * 12 + nF * 6], "<u2").reshape(-1, 3).astype(int)
mesh = trimesh.Trimesh(V, F, process=False)

up = np.array(meta["slope"]["up"]); up /= np.linalg.norm(up)           # up the slope
nrm = np.array(meta["slope"]["normal"]); nrm /= np.linalg.norm(nrm)    # out of the slope face (toward the phone)
corner = np.array(meta["corner"])                                      # trough corner (where lip meets slope), x = 0
X = np.array([1.0, 0, 0])

# ---- height map n(x, s): distance of the outermost surface from the slope plane, s = distance up the slope from the corner ----
xs = np.arange(-30, 30.01, 0.5); ss = np.arange(-12, 90.01, 0.5)
gx, gs = np.meshgrid(xs, ss)
far = 80.0
origins = corner + gx[..., None] * X + gs[..., None] * up + far * nrm
dirs = np.broadcast_to(-nrm, origins.shape)
o = origins.reshape(-1, 3); d = dirs.reshape(-1, 3)
locs, ray_idx, _ = mesh.ray.intersects_location(o, d, multiple_hits=True)
H = np.full(len(o), np.nan)
n_hit = (locs - corner) @ nrm
for i, nv in zip(ray_idx, n_hit):          # keep the outermost hit (first hit from outside)
    if np.isnan(H[i]) or nv > H[i]: H[i] = nv
H = H.reshape(gx.shape)

# ---- the face the phone's back touches: the rib crests ----
mid = (np.abs(gs - 25) < 0.3)              # a row on the slope, to read rib pitch and depth
row = H[np.abs(ss - 25) < 0.26][0]
crest = np.nanmax(H[(ss > 8) & (ss < 45)])
print("rib crest height above corner plane: %.2f mm" % crest)
# per-column crest/valley between s=10..45
col_max = np.nanmax(H[(ss > 10) & (ss < 45)], axis=0); col_min = np.nanmin(np.where(H[(ss > 10) & (ss < 45)] > crest - 6, H[(ss > 10) & (ss < 45)], np.nan), axis=0)
print("rib depth (crest minus valley) at s=25: %.2f mm" % (np.nanmax(row) - np.nanmin(row[np.abs(xs) < 24])))
# peaks of the crest profile = rib centres
from scipy.signal import find_peaks
pk, _ = find_peaks(row[np.isfinite(row)], prominence=0.3)
xr = xs[np.isfinite(row)][pk]; print("rib crest x positions (mm):", np.round(xr, 1), " pitch ~ %.2f mm" % np.mean(np.diff(xr)) if len(xr) > 1 else "")

# ---- extents of the flat-ish face (crest plane within 1.0 mm of the max) ----
face = np.nan_to_num(H, nan=-99) > crest - 1.0
rows = np.where(face.any(1))[0]
s_lo, s_hi = ss[rows[0]], ss[rows[-1]]
# width of the face at a few heights (outermost crest-level points)
for s in (10, 20, 30, 40, 50):
    r = face[np.abs(ss - s) < 0.26][0]
    xx = xs[r]; print("s=%2d mm: crest-level width x %.1f..%.1f (%.1f mm)" % (s, xx.min(), xx.max(), xx.max() - xx.min()))
# slope length: last s where the crest level is still within 1.0 mm of the plane (straight part), and where the surface ends
col = np.nanmax(np.where(np.isfinite(H), H, -99), axis=1)
straight_top = ss[np.where(col > crest - 1.0)[0][-1]]
surface_top = ss[np.where(col > crest - 12.0)[0][-1]]
print("straight slope face: s = %.1f .. %.1f mm from the corner (length %.1f mm); surface continues round the top to ~%.1f mm" % (0, straight_top, straight_top, surface_top))
out = {"crest": crest, "face_top_s": straight_top, "surface_top_s": surface_top}

# ---- phone + ring ----
PHONE_W, PHONE_H = 71.6, 147.6      # iPhone 15
OD, ID = 54.1, 46.0                 # ring outer (Apple guideline, via secondary sources) and inner (aftermarket ring spec); MagSafe magnets sit in this annulus
R_o, R_i = OD / 2, ID / 2
EDGE_S = 0.5                        # phone bottom edge, mm up the slope (main.js uses 0.5; the brief says about 5)
centres = [55, 60, 65, 70, 75]      # ring centre above the phone's bottom edge (brief: 60..75, varies by model)
half_w = 28.0

def coverage(cs, edge_s):
    """fraction of the magnet annulus (and of its lower half) that lies on the straight, full-width face"""
    th = np.linspace(0, 2 * np.pi, 720, endpoint=False)
    res = {}
    for name, r in (("outer", R_o), ("mid", (R_o + R_i) / 2), ("inner", R_i)):
        px = r * np.cos(th); ps = cs + edge_s + r * np.sin(th)
        on = (ps >= 0) & (ps <= straight_top) & (np.abs(px) <= half_w - 2.0)   # 2 mm kept clear of the rounded side ribs
        res[name] = on.mean()
    return res, th

print("\nring OD %.1f / ID %.1f, phone bottom edge at s=%.1f mm, slope face s=0..%.1f mm, width 56 mm (usable +/-%.0f)" % (OD, ID, EDGE_S, straight_top, half_w - 2))
for cs in centres:
    r, th = coverage(cs, EDGE_S)
    top = cs + EDGE_S + R_o
    print("centre %2d mm above phone bottom -> ring spans s=%.1f..%.1f mm | magnet band on the face: outer %3.0f%%  mid %3.0f%%  inner %3.0f%% | overhang past top of straight face: %.1f mm" % (cs, cs + EDGE_S - R_o, top, r['outer'] * 100, r['mid'] * 100, r['inner'] * 100, max(0, top - straight_top)))
need_full = (R_o * 2)
print("a full ring needs %.1f mm of length and %.1f mm of width; the face is %.1f mm long and 56 mm wide at best" % (need_full, need_full, straight_top))
c_max_fit = straight_top - R_o - EDGE_S
print("the full ring would only fit if its centre were <= %.1f mm above the phone's bottom edge (brief: 60..75)" % c_max_fit)

# ---- figure ----
fig, axes = plt.subplots(1, 2, figsize=(13, 7.5), gridspec_kw={"width_ratios": [1, 1]})
for ax, cs in zip(axes, (60, 70)):
    ax.imshow(np.where(np.isfinite(H), H, np.nan), extent=[xs[0], xs[-1], ss[0], ss[-1]], origin="lower", cmap="Greens", vmin=crest - 4, vmax=crest, aspect="equal")
    ax.axhline(0, color="k", lw=.8); ax.text(-29, 0.8, "trough corner (lip) s=0", fontsize=8)
    ax.axhline(straight_top, color="r", lw=1, ls="--"); ax.text(-29, straight_top + 0.8, "end of straight face (arch starts)", fontsize=8, color="r")
    ax.axvline(-28, color="gray", lw=.6); ax.axvline(28, color="gray", lw=.6)
    ax.add_patch(plt.Rectangle((-PHONE_W / 2, EDGE_S), PHONE_W, PHONE_H, fill=False, ec="navy", lw=1, ls=":"))
    ax.add_patch(Circle((0, cs + EDGE_S), R_o, fill=False, ec="crimson", lw=2)); ax.add_patch(Circle((0, cs + EDGE_S), R_i, fill=False, ec="crimson", lw=2))
    ax.plot(0, cs + EDGE_S, "+", color="crimson")
    th = np.linspace(0, 2 * np.pi, 400); r = (R_o + R_i) / 2
    px = r * np.cos(th); ps = cs + EDGE_S + r * np.sin(th)
    on = (ps >= 0) & (ps <= straight_top) & (np.abs(px) <= half_w - 2)
    ax.plot(np.where(on, px, np.nan), np.where(on, ps, np.nan), color="gold", lw=4, label="magnet band that lands on the face")
    ax.set_xlim(-40, 40); ax.set_ylim(-14, 100); ax.set_title("iPhone 15, ring centre %d mm above its bottom edge" % cs); ax.set_xlabel("x across the stand (mm)"); ax.set_ylabel("s up the slope (mm)")
    ax.legend(loc="lower right", fontsize=8)
plt.tight_layout(); plt.savefig("docs/magsafe-feasibility.png", dpi=110)
json.dump(out, open("/tmp/magsafe_fit.json", "w"))
