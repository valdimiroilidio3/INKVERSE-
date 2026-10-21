"""Offline validation render: colour the character by body region."""
import math
import numpy as np
from PIL import Image

PALETTE = [
    (140, 140, 140), (214, 255, 82), (82, 196, 255), (255, 138, 82), (196, 120, 255),
    (255, 214, 82), (120, 255, 190), (255, 120, 170), (120, 160, 255), (200, 255, 120),
    (255, 170, 120), (150, 255, 230), (230, 150, 255), (255, 255, 130), (130, 220, 255),
    (255, 150, 150), (170, 255, 170), (170, 170, 255),
]


def render_regions(d, vlab, ids, path, rot=180, W=560, H=860):
    pos, nrm, tris = d['pos'], d['nrm'], d['tris']
    r = math.radians(rot)
    x = pos[:, 0] * math.cos(r) + pos[:, 2] * math.sin(r)
    z = -pos[:, 0] * math.sin(r) + pos[:, 2] * math.cos(r)
    y = pos[:, 1]
    scale = min(W, H) / 2.05
    sx = x * scale + W / 2
    sy = H / 2 - (y - 0.95) * scale
    nx = nrm[:, 0] * math.cos(r) + nrm[:, 2] * math.sin(r)
    nz = -nrm[:, 0] * math.sin(r) + nrm[:, 2] * math.cos(r)
    N = np.stack([nx, nrm[:, 1], nz], 1)
    L = np.array([0.5, 0.6, 0.75]); L /= np.linalg.norm(L)
    shade = np.clip(N @ L, 0, 1) * 0.8 + 0.25
    img = np.zeros((H, W, 3), np.float32)
    img[:, :] = 0.05
    zb = np.full((H, W), 1e9)
    cols = np.array([PALETTE[i % len(PALETTE)] for i in range(len(ids) + 1)]) / 255.0
    vcol = cols[vlab]
    for t in tris:
        a, b, c = t
        x0, y0 = sx[a], sy[a]; x1, y1 = sx[b], sy[b]; x2, y2 = sx[c], sy[c]
        minx = int(max(0, math.floor(min(x0, x1, x2)))); maxx = int(min(W - 1, math.ceil(max(x0, x1, x2))))
        miny = int(max(0, math.floor(min(y0, y1, y2)))); maxy = int(min(H - 1, math.ceil(max(y0, y1, y2))))
        if maxx < minx or maxy < miny:
            continue
        X, Y = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(det) < 1e-12:
            continue
        w0 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / det
        w1 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / det
        w2 = 1 - w0 - w1
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not m.any():
            continue
        zz = w0 * z[a] + w1 * z[b] + w2 * z[c]
        sub = zb[miny:maxy + 1, minx:maxx + 1]
        upd = m & (zz < sub)
        if not upd.any():
            continue
        col = w0[upd, None] * vcol[a] + w1[upd, None] * vcol[b] + w2[upd, None] * vcol[c]
        sh = w0[upd] * shade[a] + w1[upd] * shade[b] + w2[upd] * shade[c]
        img[miny:maxy + 1, minx:maxx + 1][upd] = np.clip(col * sh[:, None], 0, 1)
        sub[upd] = zz[upd]
    Image.fromarray((img * 255).astype(np.uint8)).save(path)
