"""Visual check of a generated MagSafe print file: height map of the slope face + cross-section through the centre pocket.
usage: python3 tools/magsafe_check.py models/lean-regular-magsafe-medium.stl docs/magsafe-geometry-check.png"""
import sys, json, numpy as np, trimesh
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
meta = json.load(open("build/meta.json")); mj = json.load(open("build/magsafe.json"))
up = np.array(meta["slope"]["up"]); nrm = np.array(meta["slope"]["normal"]); corner = np.array(meta["corner"]); X = np.array([1.0, 0, 0])
src, out = sys.argv[1], sys.argv[2]
size = src.split("-")[-1][:-4]
m = trimesh.load(src); b = m.bounds; cx, cy, cz = (b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2
m = trimesh.Trimesh(np.stack([m.vertices[:, 0] - cx, m.vertices[:, 2] - cz, -(m.vertices[:, 1] - cy)], 1), m.faces, process=False)
xs = np.arange(-30, 30.01, 0.2); ss = np.arange(0, 75.01, 0.2); gx, gs = np.meshgrid(xs, ss)
o = (corner + gx[..., None] * X + gs[..., None] * up + 60 * nrm).reshape(-1, 3)
h, idx, _ = m.ray.intersects_location(o, np.broadcast_to(-nrm, o.shape), multiple_hits=False)
H = np.full(len(o), np.nan); H[idx] = (h - corner) @ nrm; H = H.reshape(gx.shape)
fig, ax = plt.subplots(1, 2, figsize=(13, 8), gridspec_kw={"width_ratios": [1, 1.1]})
im = ax[0].imshow(H, extent=[xs[0], xs[-1], ss[0], ss[-1]], origin="lower", cmap="viridis", vmin=-3, vmax=0.5, aspect="equal")
plt.colorbar(im, ax=ax[0], label="surface height above the corner plane (mm)", shrink=.7)
for p in mj["sizes"][size]["magnets"]: ax[0].plot(p["x"], p["s"], "r+")
ax[0].set_title("%s: face height map (pads flat at the crest plane, pockets dark)" % src.split("/")[-1], fontsize=9); ax[0].set_xlabel("x (mm)"); ax[0].set_ylabel("s up the slope (mm)")
# section through the centre magnet (x = 0), in (s, n) coordinates
p0 = [p for p in mj["sizes"][size]["magnets"] if p["x"] == 0][0]
sec = m.section(plane_origin=[0, 0, 0], plane_normal=[1, 0, 0])
for e in sec.entities:
    pts = sec.vertices[e.points]; s = (pts - corner) @ up; n = (pts - corner) @ nrm
    ax[1].plot(s, n, "k", lw=1)
ax[1].set_xlim(p0["s"] - 14, p0["s"] + 14); ax[1].set_ylim(-14, 3); ax[1].set_aspect("equal"); ax[1].axhline(mj["crest_plane_mm"], color="g", ls="--", lw=.8)
ax[1].set_title("section x=0 through the centre pocket (green = crest plane the phone touches)", fontsize=9); ax[1].set_xlabel("s up the slope (mm)"); ax[1].set_ylabel("height (mm)")
plt.tight_layout(); plt.savefig(out, dpi=105); print("wrote", out)
