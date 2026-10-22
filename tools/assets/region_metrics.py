#!/usr/bin/env python3
"""Augment public/models/regions.json with real-world UV scale (UV units per metre).

Run after bake_regions.py:  python3 tools/assets/region_metrics.py
"""
import hashlib
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
REGIONS_PATH = os.path.join(ROOT, "public", "models", "regions.json")
DATA_PATH = os.path.join(ROOT, "data", "regions.json")
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from bake_regions import classify, IDS, ID_INDEX  # noqa: E402


def uv_islands(pos, uv, tris):
    parent = list(range(len(pos)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    weld = {}
    for i, t in enumerate(uv):
        k = (round(float(t[0]), 5), round(float(t[1]), 5))
        if k in weld:
            union(i, weld[k])
        else:
            weld[k] = i
    for t in tris:
        union(t[0], t[1]); union(t[1], t[2])
    return np.array([find(i) for i in range(len(pos))])


def rasterise_faces(uv, faces, size=512):
    """Binary mask of the UV footprint of `faces`, at `size`²."""
    m = np.zeros((size, size), dtype=bool)
    for f in faces:
        a, b, c = uv[f[0]], uv[f[1]], uv[f[2]]
        xs = np.array([a[0], b[0], c[0]]) * (size - 1)
        ys = (1.0 - np.array([a[1], b[1], c[1]])) * (size - 1)
        minx, maxx = int(np.floor(xs.min())), int(np.ceil(xs.max()))
        miny, maxy = int(np.floor(ys.min())), int(np.ceil(ys.max()))
        minx, miny = max(0, minx), max(0, miny)
        maxx, maxy = min(size - 1, maxx), min(size - 1, maxy)
        if maxx < minx or maxy < miny:
            continue
        X, Y = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        det = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(det) < 1e-12:
            continue
        w0 = ((ys[1] - ys[2]) * (X - xs[2]) + (xs[2] - xs[1]) * (Y - ys[2])) / det
        w1 = ((ys[2] - ys[0]) * (X - xs[2]) + (xs[0] - xs[2]) * (Y - ys[2])) / det
        w2 = 1 - w0 - w1
        m[miny:maxy + 1, minx:maxx + 1] |= (w0 >= -0.002) & (w1 >= -0.002) & (w2 >= -0.002)
    return m


def pole_of_inaccessibility(mask, size=512):
    """Centre of the largest inscribed disc: the safest spot for artwork.

    A plain bounding-box centre can fall in a hole between UV islands (the back and
    the chest boxes overlap in UV), which makes the shader's region gate discard the
    whole tattoo. The deepest interior point always belongs to the island.
    """
    if not mask.any():
        return None, 0.0

    INF = 1e9
    dist = np.where(mask, INF, 0.0)
    xo = np.array([[1.0, 0.0], [-1.0, 0.0], [0.0, 1.0], [0.0, -1.0],
                   [1.0, 1.0], [1.0, -1.0], [-1.0, 1.0], [-1.0, -1.0]])

    def shift(arr, dy, dx, fill):
        dy, dx = int(dy), int(dx)
        out = np.full_like(arr, fill)
        ys = slice(max(0, dy), arr.shape[0] + min(0, dy))
        xs = slice(max(0, dx), arr.shape[1] + min(0, dx))
        yd = slice(max(0, -dy), arr.shape[0] + min(0, -dy))
        xd = slice(max(0, -dx), arr.shape[1] + min(0, -dx))
        out[ys, xs] = arr[yd, xd]
        return out

    for _ in range(2 * size):
        prev = dist
        for dy, dx in xo:
            step = 1.4142 if (dy and dx) else 1.0
            dist = np.minimum(dist, shift(dist, dy, dx, INF) + step)
        dist = np.where(mask, dist, 0.0)
        if np.array_equal(prev, dist):
            break

    best = np.unravel_index(int(np.argmax(dist)), dist.shape)
    y, x = int(best[0]), int(best[1])
    radius = float(dist[best]) / (size - 1)
    return ((x + 0.5) / (size - 1), 1.0 - (y + 0.5) / (size - 1)), radius


def fill_pinholes(mask, min_neighbours=5, passes=2):
    """Close isolated single-texel holes before measuring usable area.

    A gap of one texel in a region raster is a sub-millimetre speck in the shader,
    but it can sit exactly on the corner of the largest square and make the DP
    report a 20 % smaller piece. Closing pinholes measures the surface, not the
    raster noise.
    """
    m = mask
    for _ in range(passes):
        pad = np.pad(m.astype(np.int8), 1, mode="constant")
        count = (
            pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
            + pad[:-2, :-2] + pad[:-2, 2:] + pad[2:, :-2] + pad[2:, 2:]
        )
        m = m | (count >= min_neighbours)
    return m


def largest_inscribed_square(mask):
    """Largest axis-aligned square fully inside `mask`.

    Returns (cx, cy, half) in UV, or None. Classic DP: dp[y][x] is the side of the
    biggest square whose bottom-right corner is (x, y). A square that is entirely
    inside the zone is the only way to place artwork without the shader's region
    gate chopping it — UV islands of other body parts overlap the same texture area.
    """
    mask = fill_pinholes(mask)
    h, w = mask.shape
    dp = np.zeros((h, w), dtype=np.int32)
    best, best_pos = 0, (0, 0)
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if not row[x]:
                continue
            if x == 0 or y == 0:
                dp[y, x] = 1
            else:
                dp[y, x] = min(dp[y - 1, x], dp[y, x - 1], dp[y - 1, x - 1]) + 1
            if dp[y, x] > best:
                best = dp[y, x]
                best_pos = (x, y)
    if best == 0:
        return None
    x, y = best_pos
    side = best
    cx = (x - side / 2 + 0.5) / (w - 1)
    cy = 1.0 - (y - side / 2 + 0.5) / (h - 1)
    return cx, cy, (side / 2) / (w - 1)


def fit_square_at(mask, u, v):
    """Half-side of the largest square centred on (u, v) that stays inside `mask`."""
    px = int(round(u * (mask.shape[1] - 1)))
    py = int(round((1 - v) * (mask.shape[0] - 1)))
    lo, hi = 2, max(2, min(mask.shape) // 2)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        y0, y1 = max(0, py - mid), min(mask.shape[0], py + mid + 1)
        x0, x1 = max(0, px - mid), min(mask.shape[1], px + mid + 1)
        win = mask[y0:y1, x0:x1]
        if win.shape == (2 * mid + 1, 2 * mid + 1) and win.all():
            lo = mid
        else:
            hi = mid - 1
    return (lo - 0.5) / (mask.shape[1] - 1) if lo >= 2 else None


def main():
    payload = json.load(open(REGIONS_PATH))
    for kind in ("male", "female"):
        d = np.load(os.path.join(HERE, f"{kind}.npz"))
        pos, tris = d["pos"], d["tris"]
        # Measure in the ink UV space when the asset pipeline provides it: that is the
        # space the shader samples, so every number here describes what ships.
        if "uv1" in d.files:
            uv = d["uv1"]
            vlab = d["zone"].astype(np.int16)
        else:
            uv = d["uv"]
            vlab = classify(pos, kind)
        island = uv_islands(pos, uv, tris)
        face_region = np.zeros(len(tris), dtype=np.int16)
        for i, t in enumerate(tris):
            vals = [vlab[t[0]], vlab[t[1]], vlab[t[2]]]
            face_region[i] = max(set(vals), key=vals.count)

        # 3D triangle areas
        a = pos[tris[:, 0]]; b = pos[tris[:, 1]]; c = pos[tris[:, 2]]
        area3 = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
        ua = uv[tris[:, 0]]; ub = uv[tris[:, 1]]; uc = uv[tris[:, 2]]

        # per-face local UV->metres basis:  P = du*Tu + dv*Tv
        du1 = ub[:, 0] - ua[:, 0]; dv1 = ub[:, 1] - ua[:, 1]
        du2 = uc[:, 0] - ua[:, 0]; dv2 = uc[:, 1] - ua[:, 1]
        P1 = b - a; P2 = c - a
        det = du1 * dv2 - du2 * dv1
        ok = np.abs(det) > 1e-10
        inv = np.zeros_like(det)
        inv[ok] = 1.0 / det[ok]
        Tu = (dv2[:, None] * P1 - dv1[:, None] * P2) * inv[:, None]
        Tv = (-du2[:, None] * P1 + du1[:, None] * P2) * inv[:, None]
        len_u = np.linalg.norm(Tu, axis=1)
        len_v = np.linalg.norm(Tv, axis=1)
        ku_face = np.where(len_u > 1e-8, 1.0 / len_u, np.nan)
        kv_face = np.where(len_v > 1e-8, 1.0 / len_v, np.nan)
        area_uv = 0.5 * np.abs(
            (ub[:, 0] - ua[:, 0]) * (uc[:, 1] - ua[:, 1]) - (uc[:, 0] - ua[:, 0]) * (ub[:, 1] - ua[:, 1])
        )

        # The id map that ships with the app is the authority: it is exactly what the
        # shader samples, so anchors derived from it are guaranteed paintable.
        id_img = Image.open(os.path.join(ROOT, "public", "models", f"region-ids-{kind}.png")).convert("RGB")
        id_png = np.asarray(id_img)[..., 0]
        ph, pw = id_png.shape

        def id_at(u, v):
            x = min(pw - 1, max(0, int(round(u * (pw - 1)))))
            y = min(ph - 1, max(0, int(round((1 - v) * (ph - 1)))))
            return int(id_png[y, x])

        # Low-resolution copy of the id map, same orientation as the texture. 512²
        # over a ~2.5 m atlas is 5 mm per cell: fine enough that the reported square
        # is not quantised in centimetres, coarse enough for the DP below.
        id_small = np.asarray(
            Image.open(os.path.join(ROOT, "public", "models", f"region-ids-{kind}.png"))
            .convert("L")
            .resize((512, 512), Image.NEAREST)
        ).astype(np.int16)

        meta = payload["characters"][kind]
        for name in IDS:
            if name not in meta:
                continue
            idx = ID_INDEX[name]
            fsel = np.where(face_region == idx)[0]
            if not len(fsel):
                continue
            groups = {}
            for fi in fsel:
                groups.setdefault(int(island[tris[fi][0]]), []).append(fi)
            ordered = sorted(groups.values(), key=lambda g: -len(g))
            for slot, faces in zip(meta[name]["slots"], ordered):
                faces = np.array(faces)
                good = area3[faces] > 1e-7
                if not good.any():
                    continue
                sel = faces[good]
                ku = float(np.nanmedian(ku_face[sel]))
                kv = float(np.nanmedian(kv_face[sel]))
                slot["uvPerMetreZone"] = round(0.5 * (ku + kv), 5)
                slot["uvPerMeterX"] = round(ku, 5)
                slot["uvPerMeterY"] = round(kv, 5)
                slot["uvPerMeter"] = round(0.5 * (ku + kv), 5)
                slot["areaM2"] = round(float(area3[faces].sum()), 5)
                b = slot["uvBox"]
                slot["boxMeters"] = [
                    round((b[2] - b[0]) / max(ku, 1e-6), 4),
                    round((b[3] - b[1]) / max(kv, 1e-6), 4),
                ]
                # Anchor inside the faces that carry this region's id. The UV island
                # alone is too coarse: the back's island also contains the chest and
                # head, so its "deepest point" can land on another body part.
                mask = rasterise_faces(uv, tris[faces])
                # Keep only the part of the island that carries this region's id.
                yy, xx = np.nonzero(mask)
                keep = np.zeros_like(mask)
                for py_, px_ in zip(yy, xx):
                    u = px_ / (mask.shape[1] - 1)
                    v = 1.0 - py_ / (mask.shape[0] - 1)
                    if id_at(u, v) == idx:
                        keep[py_, px_] = True
                if keep.any():
                    mask = keep
                anchor, radius = pole_of_inaccessibility(mask)
                square = largest_inscribed_square(mask)

                # The zone can be split across several UV islands (the upper back has a
                # wide patch and a narrow strip). Search the whole footprint as well and
                # keep whichever gives the bigger paintable square.
                footprint = id_small == idx
                wide = largest_inscribed_square(footprint)
                if wide is not None and (square is None or wide[2] > square[2]):
                    square = wide
                def local_density(sq, fallback=(ku, kv)):
                    """Density actually inside the square, measured the way the probe does.

                    The probe (tools/checks/ink-placement-probe.ts) rebuilds the placed
                    square from region-ids + the ink UV set, sums the surface area and
                    the UV area of the faces whose three corners are inside it, and
                    compares sqrt(areaUv/area3) with this number. Measuring anything
                    else -- the zone median, or a wider window -- made the advertised
                    centimetres disagree with the ink on screen by up to 24 %.
                    """
                    cu, cv, ch = sq
                    tri = tris[fsel]
                    corners = uv[tri]
                    inside = np.all(
                        (np.abs(corners[..., 0] - cu) <= ch) & (np.abs(corners[..., 1] - cv) <= ch), axis=1
                    )
                    if inside.sum() >= 3:
                        a3 = float(area3[fsel][inside].sum())
                        au = float(area_uv[fsel][inside].sum())
                        if a3 > 1e-9 and au > 1e-12:
                            k = math.sqrt(au / a3)
                            return (k, k)
                    return fallback

                if square is not None:
                    kx, ky = local_density(square)
                    best_cm = (2 * square[2]) / max(0.5 * (kx + ky), 1e-9)
                    # The DP maximises the *UV* side, but skin density varies across an
                    # island: a slightly smaller square in a sparser spot can cover more
                    # skin. Compare with a square centred on the deepest interior point
                    # and keep whichever is physically bigger.
                    if anchor is not None:
                        ah = fit_square_at(mask, anchor[0], anchor[1])
                        if ah:
                            ax, ay = local_density((anchor[0], anchor[1], ah))
                            cand = (2 * ah) / max(0.5 * (ax + ay), 1e-9)
                            if cand > best_cm * 1.02:
                                square = (anchor[0], anchor[1], ah)
                                kx, ky = ax, ay
                                best_cm = cand
                    ku, kv = kx, ky
                    slot["square"] = [
                        round(float(square[0]), 4),
                        round(float(square[1]), 4),
                        round(float(square[2]), 4),
                    ]
                    # Density at the piece's own location: the zone median overstated a
                    # "20 cm" chest piece that actually covered 16 cm of skin.
                    slot["uvPerMeterX"] = round(ku, 5)
                    slot["uvPerMeterY"] = round(kv, 5)
                    slot["uvPerMeter"] = round(0.5 * (ku + kv), 5)
                if anchor is not None:
                    slot["anchor"] = [round(float(anchor[0]), 4), round(float(anchor[1]), 4)]
                    slot["anchorRadius"] = round(float(radius), 4)
                print(
                    f"  [{kind}] {name:12s} k=({ku:5.2f},{kv:5.2f})  box={slot['boxMeters']} m  "
                    f"area={slot['areaM2']} m2  anchor={slot.get('anchor')} r={slot.get('anchorRadius')} "
                    f"square={slot.get('square')}"
                )
            # drop slot entries we could not map
            meta[name]["slots"] = [s for s in meta[name]["slots"] if "uvPerMeter" in s]

    # ---- asset version -------------------------------------------------------
    # public/ files are served `immutable, max-age=31536000`, so a regenerated GLB
    # would never reach a browser that already has the old one -- and a new
    # regions.json against an old GLB puts every piece in the wrong place. The
    # version below is a hash of everything the geometry depends on; the app appends
    # it to every model / mask / id URL, which turns a silent mismatch into a
    # guaranteed cache miss.
    h = hashlib.sha1()
    for kind in ("male", "female"):
        d = np.load(os.path.join(HERE, f"{kind}.npz"))
        h.update(np.ascontiguousarray(d["uv1"]).tobytes())
        h.update(np.ascontiguousarray(d["tris"]).tobytes())
        ids = os.path.join(ROOT, "public", "models", f"region-ids-{kind}.png")
        if os.path.exists(ids):
            h.update(open(ids, "rb").read())
    version = h.hexdigest()[:10]
    payload["assetVersion"] = version
    json.dump(payload, open(REGIONS_PATH, "w"), indent=1)
    # the app imports the copy in data/ so the bundle never reaches into public/
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    json.dump(payload, open(DATA_PATH, "w"), indent=1)

    ts = os.path.join(ROOT, "lib", "asset-version.ts")
    with open(ts, "w") as fh:
        fh.write(
            "/**\n"
            " * Generated by tools/assets/region_metrics.py -- do not edit.\n"
            " *\n"
            " * Hash of the ink UV set and the region id maps. Appended to every model and\n"
            " * mask URL so a regenerated asset can never be served from the immutable cache\n"
            " * while regions.json has already moved on.\n"
            " */\n"
            f"export const ASSET_VERSION = '{version}';\n"
        )
    print("updated", REGIONS_PATH, DATA_PATH, "and", ts, "->", version)


if __name__ == "__main__":
    main()
