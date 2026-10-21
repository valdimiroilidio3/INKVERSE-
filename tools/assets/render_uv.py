"""Offline preview renderer used to validate skins, lighting and tattoo projections."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _load(path):
    im = Image.open(path).convert('RGB')
    return np.asarray(im).astype(np.float32) / 255.0, im.size


def sample_tex(tex, uv):
    h, w = tex.shape[:2]
    x = np.clip((uv[:, 0] * (w - 1)), 0, w - 1).astype(np.int32)
    y = np.clip(((1 - uv[:, 1]) * (h - 1)), 0, h - 1).astype(np.int32)
    return tex[y, x]


def render_uv(items, W=700, H=980, rot=0, elev=0, span=2.05, cy=0.95, bg=(10, 10, 10), shadows=False):
    """Rasterises meshes with per-pixel UV texture sampling and three studio lights."""
    r = math.radians(rot); e = math.radians(elev)
    lights = [np.array([0.55, 0.62, 0.72]), np.array([-0.62, 0.22, 0.55]), np.array([0.05, 0.25, -1.0])]
    lights = [l / np.linalg.norm(l) for l in lights]
    scale = min(W, H) / span
    img = np.zeros((H, W, 3), np.float32); img[:, :] = np.array(bg) / 255.0
    zb = np.full((H, W), 1e9)

    for it in items:
        pos = it['pos']; nrm = it['nrm']; tris = it['tris']
        uv = it.get('uv'); tex = it.get('tex')
        col = np.array(it.get('color', (180, 140, 120)), np.float32) / 255.0
        rough = it.get('rough', 0.62); metal = it.get('metal', 0.0)
        x = pos[:, 0] * math.cos(r) + pos[:, 2] * math.sin(r)
        z = -pos[:, 0] * math.sin(r) + pos[:, 2] * math.cos(r)
        y = pos[:, 1] * math.cos(e) - z * math.sin(e)
        z2 = pos[:, 1] * math.sin(e) + z * math.cos(e)
        sx = x * scale + W / 2; sy = H / 2 - (y - cy) * scale
        nx = nrm[:, 0] * math.cos(r) + nrm[:, 2] * math.sin(r)
        nz = -nrm[:, 0] * math.sin(r) + nrm[:, 2] * math.cos(r)
        ny = nrm[:, 1] * math.cos(e) - nz * math.sin(e)
        nz2 = nrm[:, 1] * math.sin(e) + nz * math.cos(e)
        N = np.stack([nx, ny, nz2], 1)
        for tri in tris:
            a, b, c = tri
            x0, y0 = sx[a], sy[a]; x1, y1 = sx[b], sy[b]; x2, y2 = sx[c], sy[c]
            minx = int(max(0, math.floor(min(x0, x1, x2)))); maxx = int(min(W - 1, math.ceil(max(x0, x1, x2))))
            miny = int(max(0, math.floor(min(y0, y1, y2)))); maxy = int(min(H - 1, math.ceil(max(y0, y1, y2))))
            if maxx < minx or maxy < miny:
                continue
            X, Y = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
            d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(d) < 1e-12:
                continue
            w0 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / d
            w1 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / d
            w2 = 1 - w0 - w1
            m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not m.any():
                continue
            zz = w0 * z2[a] + w1 * z2[b] + w2 * z2[c]
            sub = zb[miny:maxy + 1, minx:maxx + 1]
            upd = m & (zz < sub)
            if not upd.any():
                continue
            u0, u1_, u2_ = w0[upd], w1[upd], w2[upd]
            n = u0[:, None] * N[a] + u1_[:, None] * N[b] + u2_[:, None] * N[c]
            n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
            if tex is not None:
                uvs = u0[:, None] * uv[a] + u1_[:, None] * uv[b] + u2_[:, None] * uv[c]
                base = sample_tex(tex, uvs)
            else:
                base = np.broadcast_to(col, (len(u0), 3))
            shade = np.zeros(len(n))
            spec_sum = np.zeros(len(n))
            for i, L in enumerate(lights):
                ndl = np.clip(n @ L, 0, 1)
                shade += ndl * (1.0 if i == 0 else (0.36 if i == 1 else 0.20))
                Hh = L + np.array([0, 0.3, 1.0]); Hh /= np.linalg.norm(Hh)
                spec_sum += np.clip(n @ Hh, 0, 1) ** (8 + 60 * (1 - rough)) * (1.0 if i == 0 else 0.3)
            rim = (1 - np.abs(n[:, 2])) ** 3
            out = base * (0.06 + shade[:, None] * 0.94)
            out += spec_sum[:, None] * (1 - metal) * (0.10 if rough > 0.5 else 0.25)
            out += rim[:, None] * np.array([0.10, 0.16, 0.26]) * 0.9
            img[miny:maxy + 1, minx:maxx + 1][upd] = np.clip(out, 0, 1)
            sub[upd] = zz[upd]
    return Image.fromarray((img * 255).astype(np.uint8))


if __name__ == '__main__':
    import sys
    kind = sys.argv[1] if len(sys.argv) > 1 else 'male'
    d = np.load(f'tools/assets/{kind}.npz')
    tex, _ = _load(f'public/textures/skin-{kind}.webp')
    items = [
        {'pos': d['pos'], 'nrm': d['nrm'], 'tris': d['tris'], 'uv': d['uv'], 'tex': tex, 'rough': 0.6},
        {'pos': d['e1_pos'], 'nrm': d['e1_nrm'], 'tris': d['e1_tris'], 'color': (40, 30, 26), 'rough': 0.25},
        {'pos': d['e2_pos'], 'nrm': d['e2_nrm'], 'tris': d['e2_tris'], 'color': (40, 30, 26), 'rough': 0.25},
    ]
    for view, rot in [('front', 180), ('back', 0), ('side', 90)]:
        render_uv(items, rot=rot).save(f'/tmp/{kind}-uv-{view}.png')
    render_uv(items, rot=180, span=1.0, cy=1.3).save(f'/tmp/{kind}-uv-torso.png')
    render_uv(items, rot=175, span=0.34, cy=1.68).save(f'/tmp/{kind}-uv-head.png')
    print('ok')
