import sys, trimesh, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
src, out = sys.argv[1], sys.argv[2]
m = trimesh.load(src, force='mesh')
body = sorted(m.split(only_watertight=False), key=lambda b:-len(b.faces))[0]
fig, ax = plt.subplots(1,2, figsize=(16,7))
for a,x in zip(ax,[25.0, 22.0]):
    sec = body.section(plane_origin=[x,0,0], plane_normal=[1,0,0])
    for e in sec.discrete:
        a.plot(e[:,1], e[:,2], 'k-', lw=1)
        sel = e[(e[:,1]<-30)&(e[:,2]<24)]
    a.set_xlim(-62,-20); a.set_ylim(-8,30); a.set_aspect('equal'); a.grid(True, alpha=.4); a.set_title(f"x={x}")
plt.savefig(out, dpi=70)
sec = body.section(plane_origin=[25,0,0], plane_normal=[1,0,0])
e = sec.discrete[0]
sel = e[(e[:,1]<-33)&(e[:,2]<22)&(e[:,2]>6)]
print(np.round(sel[::4],1).tolist())
