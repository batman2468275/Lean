"""Prep the phone-stand STL for the web.
 - keep main body, drop 2-triangle slivers
 - cut a stadium cable slot through the trough/lip, aligned with the phone's long axis
 - recentre into three.js axes (Y up, lip toward +Z) and export compact binary + meta.json
"""
import sys, json, numpy as np, trimesh

SRC = sys.argv[1]; OUT = sys.argv[2]   # usage: prep_model.py model.stl build [models_dir]
m = trimesh.load(SRC, force="mesh")
body = sorted(m.split(only_watertight=False), key=lambda b: -len(b.faces))[0]
body.merge_vertices()
assert body.is_watertight

# ---------- fit planes (STL coords: x width, y depth (lip at -y), z up) ----------
n = body.face_normals; c = body.triangles_center; a = body.area_faces
def fit(mask):
    P = c[mask]; w = a[mask]
    ctr = (P * w[:, None]).sum(0) / w.sum()
    u, s, vt = np.linalg.svd((P - ctr) * np.sqrt(w)[:, None], full_matrices=False)
    nn = vt[-1]
    return ctr, nn

# slope upper face: normal in YZ roughly (-0.9, 0.42) (toward -y, +z)
slope_mask = (n[:, 1] < -0.80) & (n[:, 2] > 0.25) & (n[:, 2] < 0.60) & (c[:, 2] > 18) & (c[:, 2] < 62) & (c[:, 1] < -8)
sc, sn = fit(slope_mask)
if sn[1] > 0: sn = -sn                       # make it point to -y (outward / toward user)
sn[0] = 0; sn /= np.linalg.norm(sn)
s_up = np.array([0, -sn[2], sn[1]]);          # up-slope direction (perp to sn within YZ)
if s_up[2] < 0: s_up = -s_up
print("slope normal", sn.round(3), "up-slope", s_up.round(3), "angle from horizontal", np.degrees(np.arctan2(s_up[2], s_up[1])).round(1))
print("slope centre", sc.round(2))

# lip top face is perpendicular to the slope (normal == up-slope direction)
d_slope = float(np.average(c[slope_mask] @ sn, weights=a[slope_mask]))
ln = s_up.copy()
lip_mask = (n @ ln > 0.985) & (c[:, 1] < -39) & (c[:, 1] > -48) & (c[:, 2] < 14)
d_lip = float(np.average(c[lip_mask] @ ln, weights=a[lip_mask]))
# corner = intersection of the two planes in the x=25 plane (y,z)
A = np.array([[sn[1], sn[2]], [ln[1], ln[2]]]); b = np.array([d_slope, d_lip])
cy, cz = np.linalg.solve(A, b)
corner = np.array([25.0, cy, cz])
lc = np.array([25.0, -43.0, (d_lip - ln[1]*-43.0)/ln[2]])
print("lip faces", int(lip_mask.sum()), "trough corner (STL)", corner.round(2))

# rear leg outer face (+y), plane y = const
rear_mask = (n[:, 1] > 0.97) & (c[:, 2] > 15) & (c[:, 2] < 58) & (c[:, 1] > 0)
ry = float(np.average(c[rear_mask, 1], weights=a[rear_mask]))
print("rear face y", round(ry, 2))

# ---------- cutter ----------
SLOT_W, SLOT_T, SLOT_UP, SLOT_DOWN = 16.0, 9.0, 2.0, 28.0   # width (x), thickness (perp to slope), reach up-slope / down-slope
r = SLOT_T / 2
cyl = trimesh.creation.cylinder(radius=r, height=SLOT_UP + SLOT_DOWN, sections=64)
c1 = cyl.copy(); c1.apply_translation([-(SLOT_W/2 - r), 0, 0])
c2 = cyl.copy(); c2.apply_translation([+(SLOT_W/2 - r), 0, 0])
box = trimesh.creation.box(extents=[SLOT_W - 2*r, SLOT_T, SLOT_UP + SLOT_DOWN])
cutter = trimesh.boolean.union([c1, c2, box], engine="manifold")
# local z -> up-slope s_up, local x -> X ; local y = z cross x
zl = s_up; xl = np.array([1.0, 0, 0]); yl = np.cross(zl, xl)
R = np.eye(4); R[:3, 0] = xl; R[:3, 1] = yl; R[:3, 2] = zl
cutter.apply_transform(R)
# centre: shifted out from the slope face by half thickness (minus 0.4 overlap), and along the slope so that it reaches SLOT_UP above the corner
centre = corner + sn * (SLOT_T/2 - 0.4) + s_up * ((SLOT_UP - SLOT_DOWN) / 2)
cutter.apply_translation(centre)
cut = trimesh.boolean.difference([body, cutter], engine="manifold")
cut.merge_vertices(); cut.remove_unreferenced_vertices()
print("cut watertight", cut.is_watertight, "faces", len(cut.faces), "vol cm3", round(cut.volume/1000, 2), "removed cm3", round((body.volume-cut.volume)/1000, 3))

# ---------- to three.js frame ----------
zmin = body.bounds[0][2]; cx = 25.0; cyy = (body.bounds[0][1] + body.bounds[1][1]) / 2; cz = (body.bounds[0][2] + body.bounds[1][2]) / 2
def T(p):  # STL (x,y,z) -> three (x, y_up, z_toward_viewer), centred on bbox centre
    p = np.asarray(p, float)
    return np.array([p[0] - cx, p[2] - cz, -(p[1] - cyy)])
def Tv(v):  # direction
    v = np.asarray(v, float); return np.array([v[0], v[2], -v[1]])
def write_bin(mesh, path):
    V = mesh.vertices
    V3 = np.stack([V[:, 0] - cx, V[:, 2] - cz, -(V[:, 1] - cyy)], 1).astype(np.float32)
    F = mesh.faces.astype(np.uint32)
    assert len(V3) < 65535
    with open(path, "wb") as f:
        f.write(np.array([len(V3), len(F)], dtype="<u4").tobytes())
        f.write(V3.astype("<f4").tobytes()); f.write(F.astype("<u2").tobytes())
    print(path, "verts", len(V3), "faces", len(F))

# Regular = the untouched body, With cutout = body minus the cable slot (same transform, so they swap in place)
plain = body.copy(); plain.merge_vertices(); plain.remove_unreferenced_vertices()
write_bin(plain, OUT + "/model_plain.bin")
write_bin(cut, OUT + "/model_cut.bin")
import os
MODELS = os.path.join(os.path.dirname(os.path.abspath(OUT)), "models") if len(sys.argv) < 4 else sys.argv[3]
os.makedirs(MODELS, exist_ok=True)
plain.export(MODELS + "/lean-regular.stl")
cut.export(MODELS + "/lean-cutout.stl")

phone_t = 7.8
meta = {
  "size_mm": (body.extents).round(2).tolist(),
  "half_height": float((body.bounds[1][2]-body.bounds[0][2])/2),
  "floor_y": float(zmin - cz),
  "slope": {"angle_deg": float(np.degrees(np.arctan2(s_up[2], s_up[1]))),
            "up": Tv(s_up).round(5).tolist(), "normal": Tv(sn).round(5).tolist(),
            "point": T(sc).round(3).tolist()},
  "lip": {"normal": Tv(ln).round(5).tolist(), "point": T(lc).round(3).tolist()},
  "corner": T(corner).round(3).tolist(),
  "rear": {"y_plane_z": float(-(ry - cyy)), "normal": [0, 0, -1], "mid_y": float(40 + (-3.91) - cz)},
  "slot": {"w": SLOT_W, "t": SLOT_T, "centre": T(centre).round(3).tolist()},
  "phone_t": phone_t,
}
# silhouette used by the page's drawings: keep the profile already stored by an earlier run
try:
    meta["profile"] = json.load(open(OUT + "/meta.profile-backup.json"))["profile"]
except Exception:
    print("WARNING: no stored profile; the page needs meta.profile {d,w,h,n}")
json.dump(meta, open(OUT + "/meta.json", "w"), indent=1)
print(json.dumps(meta, indent=1))
