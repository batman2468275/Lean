import sys, trimesh, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
m = trimesh.load(sys.argv[1], force='mesh')
body = sorted(m.split(only_watertight=False), key=lambda b:-len(b.faces))[0]
fig, axs = plt.subplots(1,3, figsize=(18,7))
for ax,x in zip(axs,[25.0, 29.0, -2.0]):
    sec = body.section(plane_origin=[x,0,0], plane_normal=[1,0,0])
    if sec is None: print("no section at", x); continue
    for ent in sec.discrete:
        ax.plot(ent[:,1], ent[:,2], 'k-', lw=1)
    ax.set_aspect('equal'); ax.grid(True, alpha=.3); ax.set_title(f"section x={x}")
plt.savefig(sys.argv[2], dpi=80)
# print key numbers at x=29 (between ribs?) — outline extremes
sec = body.section(plane_origin=[25,0,0], plane_normal=[1,0,0])
for ent in sec.discrete:
    print("loop pts", len(ent), "y range", ent[:,1].min().round(1), ent[:,1].max().round(1), "z range", ent[:,2].min().round(1), ent[:,2].max().round(1))
# rib structure: z-max by x
xs = np.linspace(-3,53,57)
tops=[]
for x in xs:
    s = body.section(plane_origin=[x,0,0], plane_normal=[1,0,0])
    tops.append(max(e[:,2].max() for e in s.discrete) if s is not None else np.nan)
print("top z by x:", np.round(tops,1).tolist())
