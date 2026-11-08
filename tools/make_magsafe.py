"""Make the MagSafe print files: for each phone size (small / medium / large) and each model (regular / cutout), add five magnet pockets on
flush pads on the slope face, on the lower arc of where that phone's MagSafe ring sits.   usage: python3 tools/make_magsafe.py
Inputs : models/lean-regular.stl, models/lean-cutout.stl, build/meta.json, tools/magsafe_params.json
Outputs: models/lean-<regular|cutout>-magsafe-<small|medium|large>.stl  (print files, same frame as the plain STLs)
         build/magsafe.json  (positions in the web (three.js) frame, read by the site; also the checks that were run)
Why pads: the slope is ribbed (crest to valley 2.2 mm), the phone only touches the crests. A flat pocket under a rib would break through the valleys, and sinking
the magnet below the valleys would put it 3+ mm from the phone. So each magnet gets a flat pad that fills the valleys up to the crest plane, and the pocket is cut
into the pad from the front, leaving a thick plastic floor behind it (the slope plate is ~10 mm thick).
"""
import json, sys, numpy as np, trimesh
from scipy.signal import find_peaks

P = json.load(open("tools/magsafe_params.json")); meta = json.load(open("build/meta.json"))
MG, PK, PD, RG = P["magnet"], P["pocket"], P["pad"], P["ring"]
up = np.array(meta["slope"]["up"]); up /= np.linalg.norm(up)
nrm = np.array(meta["slope"]["normal"]); nrm /= np.linalg.norm(nrm)
corner = np.array(meta["corner"]); X = np.array([1.0, 0, 0])

def load(path):
    """STL frame (x width, y depth with the lip at -y, z up) -> web frame (Y up, lip toward +Z, centred). Returns mesh and the transform constants."""
    m = trimesh.load(path); b = m.bounds
    cx, cy, cz = (b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2
    V = np.stack([m.vertices[:, 0] - cx, m.vertices[:, 2] - cz, -(m.vertices[:, 1] - cy)], 1)
    return trimesh.Trimesh(V, m.faces.copy(), process=False), (cx, cy, cz)   # (x, y, z) -> (x, z, -y) is a rotation, so the winding stays outward
def to_stl(m, c):
    cx, cy, cz = c
    V = np.stack([m.vertices[:, 0] + cx, -m.vertices[:, 2] + cy, m.vertices[:, 1] + cz], 1)
    return trimesh.Trimesh(V, m.faces.copy(), process=False)

plain, tc = load("models/lean-regular.stl")
assert abs(plain.bounds[0][1] - meta["floor_y"]) < 0.05, "frame mismatch with meta.json"
assert plain.is_watertight and plain.volume > 0

# ---------- measure the ribs and the plate on the real mesh ----------
def cast(mesh, pts, direction):
    """height (along the slope normal, from the corner plane) of the outermost surface under each point, NaN where the ray misses"""
    out = np.full(len(pts), np.nan)
    hits, idx, _ = mesh.ray.intersects_location(pts, np.broadcast_to(direction, pts.shape), multiple_hits=False)
    if len(idx): out[idx] = (hits - corner) @ nrm
    return out
S_ROW = 40.0
xs = np.arange(-30, 30.001, 0.05)
row_pts = corner + xs[:, None] * X + S_ROW * up + 60 * nrm
row = cast(plain, row_pts, -nrm)
crest = np.nanmax(row)
pk, _ = find_peaks(np.nan_to_num(row, nan=-9), prominence=0.5)
crest_x = []
for i in pk:                                  # refine each crest with a parabola through the top
    w = slice(max(i - 6, 0), i + 7); c2 = np.polyfit(xs[w], row[w], 2); crest_x.append(-c2[1] / (2 * c2[0]))
crest_x = np.array(crest_x)
valley = np.nanmin(row[(xs > -22) & (xs < 22)])
print("crest plane %.3f mm above the corner plane | rib crests at x = %s | valley %.2f mm below the crest" % (crest, np.round(crest_x, 2), crest - valley))
# straight face end
s_lin = np.arange(40, 90, 0.25)
colmax = cast(plain, corner + s_lin[:, None] * up + 60 * nrm, -nrm)          # along the centre rib crest (x = 0)
face_top = float(s_lin[np.where(np.nan_to_num(colmax, nan=-9) > crest - 1.0)[0][-1]])
print("straight slope face ends %.2f mm up the slope" % face_top)
mag_x = [float(round(x, 2)) for x in sorted(crest_x[np.abs(crest_x) < 17])]   # the five central ribs: x = -16.67 ... +16.67
assert len(mag_x) == MG["count"], mag_x

# ---------- helpers ----------
def revolve(profile, at, axis):
    """solid of revolution; profile = [(radius, along-axis), ...] closed; placed with its origin at `at` and its axis along `axis`"""
    s = trimesh.creation.revolve(np.array(profile), sections=96)
    R = trimesh.geometry.align_vectors([0, 0, 1], axis); T = np.eye(4); T[:3, :3] = R[:3, :3]; T[:3, 3] = at
    s.apply_transform(T); return s
def union(a, b): return trimesh.boolean.union([a, b], engine="manifold")
def diff(a, b): return trimesh.boolean.difference([a, b], engine="manifold")

rp = MG["diameter"] / 2 + PK["clearance_radial"]                 # pocket radius
top = PD["above_crest"]                                          # pad top, along the normal, relative to the crest plane
pad_prof = [(0, top - PD["depth"]), (PD["radius_bottom"], top - PD["depth"]), (PD["radius_top"], top), (0, top)]
cham = PK["chamfer"]
pocket_prof = [(0, top - PK["depth"]), (rp, top - PK["depth"]), (rp, top - cham), (rp + cham, top), (rp + cham, top + 1.5), (0, top + 1.5)]

def plan(size):
    S = P["sizes"][size]
    c = S.get("ring_centre_mm") or round(S["ring_centre_ratio"] * S["height"], 1)
    pts = []
    for x in mag_x:
        s = c + P["phone_edge_s"] - np.sqrt(RG["radius"] ** 2 - x ** 2)       # lower arc of the ring: s up the slope for this x
        pts.append({"x": x, "s": round(float(s), 2), "centre": (corner + nrm * crest + x * X + s * up).round(3).tolist()})
    return c, pts

def add_magsafe(base, pts):
    m = base
    for p in pts:
        at = np.array(p["centre"]) - nrm * 0.0          # on the crest plane (origin of the profile is the crest plane)
        m = union(m, revolve(pad_prof, at, nrm))
    for p in pts:
        m = diff(m, revolve(pocket_prof, np.array(p["centre"]), nrm))
    return m

report = {"crest_plane_mm": round(float(crest), 3), "rib_x": [round(float(x), 2) for x in crest_x], "valley_depth_mm": round(float(crest - valley), 2),
          "face_top_s": face_top, "magnet": MG, "pocket": {**PK, "radius": rp, "diameter": 2 * rp}, "pad": PD, "ring": RG, "phone_edge_s": P["phone_edge_s"],
          "normal": nrm.round(5).tolist(), "up": up.round(5).tolist(), "sizes": {}}
base_models = {"regular": (plain, tc)}
cut, tc2 = load("models/lean-cutout.stl"); base_models["cutout"] = (cut, tc2)
pocket_vol = np.pi * (MG["diameter"] / 2 + PK["clearance_radial"]) ** 2 * PK["depth"]

for size in P["sizes"]:
    c, pts = plan(size)
    # fit checks: every pad (bottom radius) inside the straight face, clear of the lip and the cable slot, inside the face width
    for p in pts:
        s, x = p["s"], p["x"]
        assert s - PD["radius_bottom"] > 5.0, (size, "pad too close to the lip/slot", p)
        assert s + PD["radius_bottom"] < face_top - 0.5, (size, "pad runs off the top of the straight face", p)
        assert abs(x) + PD["radius_bottom"] < 27.0, (size, "pad too close to the side", p)
    # walls between neighbouring pockets must be printable (>= 1.5 mm) and magnets must not touch
    cs = np.array([q["centre"] for q in pts]); dmin = min(np.linalg.norm(cs[i] - cs[j]) for i in range(len(cs)) for j in range(i))
    assert dmin - 2 * rp >= 1.5, (size, "pocket walls too thin", round(dmin - 2 * rp, 2))
    entry_wall = round(dmin - 2 * rp, 2)
    # plate behind each pocket: distance from the pocket floor to the underside, measured by casting from behind
    floors = []
    for p in pts:
        ctr = np.array(p["centre"]); o = (ctr + nrm * (top - PK["depth"]))[None, :]
        hit = plain.ray.intersects_location(o, -nrm[None, :], multiple_hits=False)[0]
        floors.append(float(np.linalg.norm(hit[0] - o[0])) if len(hit) else None)
    assert all(f and f > 3.0 for f in floors), (size, "plastic floor too thin", floors)
    entry = {"label": P["sizes"][size]["label"], "phones": P["sizes"][size]["phones"], "ring_centre_mm": c, "assumed": "ring_centre_mm" not in P["sizes"][size],
             "min_wall_between_pockets_mm": entry_wall, "magnets": pts, "floor_thickness_mm": [round(f, 1) for f in floors]}
    # free zones on the face for the logo decal (s ranges), clear of the pads by 2 mm
    lo_top = min(p["s"] for p in pts) - PD["radius_bottom"] - 2.0
    hi_bot = max(p["s"] for p in pts) + PD["radius_bottom"] + 2.0
    entry["logo_zones"] = {"low": [6.0, round(lo_top, 1)], "high": [round(hi_bot, 1), round(face_top - 2.0, 1)]}
    for key, (base, tcf) in base_models.items():
        m = add_magsafe(base, pts)
        assert m.is_watertight, (size, key, "not watertight")
        dv = m.volume - base.volume
        # volume sanity: pads add material, pockets remove 5 x pocket volume
        out = to_stl(m, tcf); name = f"models/lean-{key}-magsafe-{size}.stl"; out.export(name)
        entry.setdefault("files", {})[key] = name.split("/")[-1]
        print("%-6s %-7s centre %.1f mm: %d faces, watertight, volume %+0.0f mm3 vs plain (pockets %.0f mm3 each), floors %s mm -> %s" % (size, key, c, len(m.faces), dv, pocket_vol, entry["floor_thickness_mm"], name))
    report["sizes"][size] = entry
json.dump(report, open("build/magsafe.json", "w"), indent=1)
print("wrote build/magsafe.json")
