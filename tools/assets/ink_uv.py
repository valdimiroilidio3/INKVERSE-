#!/usr/bin/env python3
"""Build the dedicated **ink UV set** (glTF TEXCOORD_1) for the studio bodies.

Why this exists
---------------
The shipped unwrap comes from the MakeHuman base mesh and is tuned for the skin
textures, not for tattoos. Measured on the male body it is locally isometric and
uniform (0.4 UV/m on almost every zone), so artwork is not distorted — but the
torso zones are *snaken* across the atlas: the whole `upper-back` is one UV island
whose bounding box is 1.25 × 0.90 m while it only carries 0.087 m² of skin (8 %
fill). A piece can only be as large as the biggest square that fits entirely
inside a zone (the region gate clips everything else), so a snake-shaped island
capped back pieces at about 11 cm.

No amount of placement maths fixes a chart with the wrong shape. This script
builds a second UV set whose only job is ink:

  * torso zones (chest, abdomen, upper/lower back) are re-cast as one chart each
    that unrolls the *real* cross-section: for every height band we fit the ellipse
    of the torso ring and integrate its perimeter, so u is true arc length in
    metres and v is height. The back stops being a snake and becomes a rectangle;
  * every other zone keeps its authored islands — they are already well shaped —
    but the islands are shelf-packed into a compact cell instead of being left
    wherever the skin unwrap put them;
  * all cells are packed into a 0..1 atlas at one uniform density, with gutters, so
    a square on the skin is a square in UV;
  * TEXCOORD_0 is untouched, so skin albedo/normal/roughness sampling is unchanged.

The composition format stores `bodyRegion` + `offset` + `rotation` + `scale`, never
UV coordinates, so saved work keeps loading: placements are recomputed from the
`regions.json` this pipeline regenerates for the new space.

Output
------
  tools/assets/{male,female}.npz  gains `uv1` (N,2 float32)
  tools/assets/ink-uv.json        scale, per-zone rects, measured distortion

Run: python3 tools/assets/ink_uv.py
"""
from __future__ import annotations

import collections
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from bake_regions import IDS, ID_INDEX, classify  # noqa: E402

OUT = os.path.join(HERE, "ink-uv.json")

# Dead space between charts. At the ~800 px/m of the shipped 2048² id map that is
# ~10 px, enough that bilinear sampling or a mip level cannot bleed across charts.
GUTTER_M = 0.012

TORSO_ZONES = ("chest", "abdomen", "upper-back", "lower-back")
ELLIPSE_SAMPLES = 720


def face_scales(pos, uv, tris):
    """Per-face UV units per metre along u and v (the mesh Jacobian)."""
    a = pos[tris[:, 0]]
    b = pos[tris[:, 1]]
    c = pos[tris[:, 2]]
    du1 = uv[tris[:, 1], 0] - uv[tris[:, 0], 0]
    dv1 = uv[tris[:, 1], 1] - uv[tris[:, 0], 1]
    du2 = uv[tris[:, 2], 0] - uv[tris[:, 0], 0]
    dv2 = uv[tris[:, 2], 1] - uv[tris[:, 0], 1]
    det = du1 * dv2 - du2 * dv1
    ok = np.abs(det) > 1e-12
    inv = np.zeros_like(det)
    inv[ok] = 1.0 / det[ok]
    Tu = (dv2[:, None] * (b - a) - dv1[:, None] * (c - a)) * inv[:, None]
    Tv = (-du2[:, None] * (b - a) + du1[:, None] * (c - a)) * inv[:, None]
    lu = np.linalg.norm(Tu, axis=1)
    lv = np.linalg.norm(Tv, axis=1)
    ku = np.where(lu > 1e-8, 1.0 / np.maximum(lu, 1e-8), np.nan)
    kv = np.where(lv > 1e-8, 1.0 / np.maximum(lv, 1e-8), np.nan)
    return ku, kv, ok, det


# ----------------------------------------------------------------- torso unroll
def torso_chart(points, ring, seam):
    """Unroll a torso zone onto a plane with its true arc length.

    The cross-section is an ellipse, not a circle: at chest height the body is
    ~0.44 m wide but only ~0.21 m deep, so a circular chart would compress the
    flanks by 2×. For each height band we fit the ellipse of the torso ring, then
    integrate its perimeter to get metres of skin per angle. `seam` is the elliptic
    angle of the branch cut; putting it opposite the zone keeps the cut outside the
    artwork, so no triangle is ever split across the chart.

    Returns (u, v) in metres plus the semi-axes at the zone's mid height.
    """
    xs, ys, zs = ring[:, 0], ring[:, 1], ring[:, 2]
    y0, y1 = float(points[:, 1].min()), float(points[:, 1].max())
    nband = 14
    edges = np.linspace(y0, y1, nband + 1)
    tables = []
    for b in range(nband):
        lo, hi = edges[b], edges[b + 1]
        sel = (ys >= lo - 0.02) & (ys <= hi + 0.02)
        if sel.sum() < 8:
            sel = (ys >= lo - 0.06) & (ys <= hi + 0.06)
        if sel.sum() < 4:
            tables.append(tables[-1] if tables else None)
            continue
        x0 = 0.5 * (xs[sel].min() + xs[sel].max())
        z0 = 0.5 * (zs[sel].min() + zs[sel].max())
        a = max(1e-3, 0.5 * (xs[sel].max() - xs[sel].min()))
        c = max(1e-3, 0.5 * (zs[sel].max() - zs[sel].min()))
        phi = seam + np.arange(ELLIPSE_SAMPLES + 1) * (2 * np.pi / ELLIPSE_SAMPLES)
        ds = np.sqrt((a * np.sin(phi)) ** 2 + (c * np.cos(phi)) ** 2) * (2 * np.pi / ELLIPSE_SAMPLES)
        arc = np.concatenate([[0.0], np.cumsum(ds[:-1])])
        tables.append((x0, z0, a, c, arc))

    u = np.empty(len(points))
    for i, (x, y, z) in enumerate(points):
        b = int(np.clip(np.searchsorted(edges, y) - 1, 0, len(tables) - 1))
        tab = tables[b]
        if tab is None:
            raise SystemExit("torso_chart: no ring data for a height band")
        x0, z0, a, c, arc = tab
        theta = math.atan2((z - z0) / c, (x - x0) / a)
        frac = ((theta - seam) % (2 * np.pi)) / (2 * np.pi)
        u[i] = float(np.interp(frac * ELLIPSE_SAMPLES, np.arange(ELLIPSE_SAMPLES + 1), arc))
    mid = tables[len(tables) // 2]
    return u, points[:, 1].copy(), (mid[2], mid[3])


# ----------------------------------------------------------------- island split
def split_islands(tris, fsel, vsel, uv0):
    """Group a zone's faces into UV islands (connected in UV, not just in 3D)."""
    verts = np.unique(tris[fsel])
    parent = {int(v): int(v) for v in verts}

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
    for v in verts:
        k = (round(float(uv0[v, 0]), 5), round(float(uv0[v, 1]), 5))
        if k in weld:
            union(weld[k], int(v))
        else:
            weld[k] = int(v)
    for f in tris[fsel]:
        union(int(f[0]), int(f[1]))
        union(int(f[1]), int(f[2]))

    groups = collections.defaultdict(list)
    for fi in np.where(fsel)[0]:
        groups[find(int(tris[fi][0]))].append(fi)
    return list(groups.values())


def shelf_pack(rects, width):
    """Shelf-pack {key: (w,h)}; returns placements and the used width/height."""
    order = sorted(rects.items(), key=lambda kv: (-kv[1][1], -kv[1][0]))
    placed, x, y, shelf_h = {}, 0.0, 0.0, 0.0
    for key, (w, h) in order:
        if x + w > width and x > 0:
            x = 0.0
            y += shelf_h + GUTTER_M
            shelf_h = 0.0
        placed[key] = (x, y)
        x += w + GUTTER_M
        shelf_h = max(shelf_h, h)
    used_w = max((p[0] + rects[k][0] for k, p in placed.items()), default=0.0)
    return placed, used_w, y + shelf_h


def pack_square(rects, spread=1.0, steps=40):
    total = sum(w * h for w, h in rects.values())
    best = None
    for k in np.linspace(0.75, 1.7, steps):
        placed, uw, uh = shelf_pack(rects, math.sqrt(total) * spread * float(k))
        score = max(uw, uh) / max(min(uw, uh), 1e-9)
        if best is None or score < best[0]:
            best = (score, placed, uw, uh)
    return best[1], best[2], best[3], total



def rasterize(uv_corners, dx):
    """Binary mask of a chart's footprint, at `dx` metres per pixel."""
    lo = uv_corners.reshape(-1, 2).min(axis=0)
    hi = uv_corners.reshape(-1, 2).max(axis=0)
    w = max(1, int(math.ceil((hi[0] - lo[0]) / dx)) + 2)
    h = max(1, int(math.ceil((hi[1] - lo[1]) / dx)) + 2)
    mask = np.zeros((h, w), dtype=bool)
    pts = (uv_corners - lo) / dx + 1.0
    for tri in pts:
        xs, ys = tri[:, 0], tri[:, 1]
        x0, x1 = max(0, int(np.floor(xs.min()))), min(w - 1, int(np.ceil(xs.max())))
        y0, y1 = max(0, int(np.floor(ys.min()))), min(h - 1, int(np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        det = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(det) < 1e-12:
            continue
        w0 = ((ys[1] - ys[2]) * (X - xs[2]) + (xs[2] - xs[1]) * (Y - ys[2])) / det
        w1 = ((ys[2] - ys[0]) * (X - xs[2]) + (xs[0] - xs[2]) * (Y - ys[2])) / det
        inside = (w0 >= -0.002) & (w1 >= -0.002) & (1 - w0 - w1 >= -0.002)
        mask[y0:y1 + 1, x0:x1 + 1] |= inside
    return mask


def largest_square(mask):
    """Side of the largest square fully inside `mask`, in pixels (classic DP)."""
    for _ in range(2):  # ignore single-texel pinholes, same rule as region_metrics
        pad = np.pad(mask.astype(np.int8), 1, mode="constant")
        count = (pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
                 + pad[:-2, :-2] + pad[:-2, 2:] + pad[2:, :-2] + pad[2:, 2:])
        mask = mask | (count >= 5)
    h, w = mask.shape
    dp = np.zeros((h, w), dtype=np.int32)
    best = 0
    for y in range(h):
        row = mask[y]
        prev = dp[y - 1] if y else None
        cur = dp[y]
        for x in range(w):
            if not row[x]:
                continue
            if x == 0 or y == 0:
                cur[x] = 1
            else:
                cur[x] = min(prev[x], cur[x - 1], prev[x - 1]) + 1
            if cur[x] > best:
                best = cur[x]
    return best


def usable_square(uv_corners, metres_span, res=180):
    """Largest square piece that fits, in metres, for a candidate chart."""
    dx = max(metres_span) / res
    return largest_square(rasterize(uv_corners, dx)) * dx

# ----------------------------------------------------------------- zone charts
def island_layout(tris, fsel, verts, uv0, ku0, kv0, ok0):
    """Authored islands, moved into metres and shelf-packed inside one cell."""
    use = fsel & ok0
    k = float(np.median(np.sqrt(ku0[use] * kv0[use]))) if use.any() else 1.0
    islands = split_islands(tris, fsel, verts, uv0)
    island_uv, boxes = {}, {}
    for i, faces in enumerate(islands):
        vt = np.unique(tris[faces])
        sub = (uv0[vt] - uv0[vt].min(axis=0)) / max(k, 1e-6)
        island_uv[i] = (vt, sub)
        boxes[i] = (float(sub[:, 0].max()), float(sub[:, 1].max()))
    placed = pack_square(boxes, spread=1.05, steps=24)[0]
    mapping = {}
    for i, (vt, sub) in island_uv.items():
        ox, oy = placed[i]
        for j, vv in enumerate(vt):
            mapping[int(vv)] = (float(sub[j, 0] + ox), float(sub[j, 1] + oy))
    return mapping, len(islands), k


def build_charts(kind, pos, uv0, tris, vlab):
    """Choose a chart layout per zone by measuring the piece each one allows.

    Two candidates are built for every zone — the authored islands, and (for the
    torso) an ellipse unroll that replaces the snake-shaped island with a
    rectangle — and the one whose largest inscribed square is bigger is kept. The
    decision is measured, not assumed: on the male chest the authored island wins
    (20.6 cm vs 17.6 cm), on the upper back the unroll wins by 1.8×.
    """
    ku0, kv0, ok0, _ = face_scales(pos, uv0, tris)
    majority = np.stack([vlab[tris[:, 0]], vlab[tris[:, 1]], vlab[tris[:, 2]]])
    face_zone = np.zeros(len(tris), dtype=np.int64)
    for f in range(len(tris)):
        vals = majority[:, f]
        face_zone[f] = np.bincount(vals[vals > 0]).argmax() if (vals > 0).any() else 0

    torso_vsel = np.isin(vlab, [ID_INDEX[z] for z in TORSO_ZONES])
    ring = pos[torso_vsel]

    a3 = pos[tris[:, 0]]
    b3 = pos[tris[:, 1]]
    c3 = pos[tris[:, 2]]
    area3 = 0.5 * np.linalg.norm(np.cross(b3 - a3, c3 - a3), axis=1)

    vmap, stats = {}, {}
    for name in IDS:
        idx = ID_INDEX[name]
        fsel = face_zone == idx
        if not fsel.any():
            continue
        verts = np.unique(tris[fsel])
        P = pos[verts]
        candidates = []

        mapping, n_isl, k = island_layout(tris, fsel, verts, uv0, ku0, kv0, ok0)
        candidates.append((mapping, f"packed islands x{n_isl} @ {k:.2f} uv/m", n_isl))


        if name in TORSO_ZONES:
            # the elliptic parameter has 0 at the body's left side and 90° at the
            # front, so a front zone is cut at 270° (the spine) and a back zone at 90°
            seam = 1.5 * math.pi if name in ("chest", "abdomen") else 0.5 * math.pi
            u, v, axes = torso_chart(P, ring, seam)
            mapping = {int(x): (float(uu), float(vv)) for x, uu, vv in zip(verts, u, v)}
            candidates.append((mapping, f"ellipse unroll {axes[0]:.2f}x{axes[1]:.2f} m", 1))

        scored = []
        for mapping, label, islands in candidates:
            corners = np.array([[mapping[int(vv)] for vv in tris[f]] for f in np.where(fsel)[0]])
            corners -= corners.reshape(-1, 2).min(axis=0)
            span = corners.reshape(-1, 2).max(axis=0)
            scored.append((usable_square(corners, span), label, islands, mapping, float(span[0]), float(span[1])))

        # Keep the layout that allows the biggest piece, but let a candidate whose
        # cell is much smaller win if it is within 2 % of that size: a zone that
        # wastes a 1.6 m cell for the same usable square would starve the atlas
        # (the skin unwrap leaves the hands in huge, mostly-empty boxes).
        scored.sort(key=lambda r: -r[0])
        best_sq = scored[0][0]
        near = [c for c in scored if c[0] >= best_sq * 0.98]
        near.sort(key=lambda c: c[4] * c[5])
        best, label, islands, mapping, w, h = near[0]
        vmap[name] = mapping
        stats[name] = {
            "kind": label,
            "islands": islands,
            "squareM": round(float(best), 3),
            "options": {lbl: round(float(sc), 3) for sc, lbl, *_ in scored},
        }

    return face_zone, vmap, stats


def corner_uv1(tris, face_zone, vmap):
    """uv1 per corner, from the chart of the zone the *face* belongs to."""
    uv1 = np.zeros((len(tris), 3, 2), dtype=np.float64)
    for zone, mapping in vmap.items():
        idx = ID_INDEX[zone]
        fsel = np.where(face_zone == idx)[0]
        for f in fsel:
            for c in range(3):
                uv1[f, c] = mapping[int(tris[f, c])]
    return uv1


def expand(tris, face_zone, uv1c, pos, nrm, uv0, vlab):
    """Split vertices at zone boundaries so uv1 is continuous inside every face."""
    key_to_new, new_index, order = {}, np.zeros((len(tris), 3), dtype=np.int32), []
    for f in range(len(tris)):
        z = int(face_zone[f])
        for c in range(3):
            v = int(tris[f, c])
            key = (v, z)
            j = key_to_new.get(key)
            if j is None:
                j = len(order)
                key_to_new[key] = j
                order.append((v, z, uv1c[f, c]))
            new_index[f, c] = j
    pos2 = np.array([pos[v] for v, _, _ in order], dtype=np.float32)
    nrm2 = np.array([nrm[v] for v, _, _ in order], dtype=np.float32)
    uv02 = np.array([uv0[v] for v, _, _ in order], dtype=np.float32)
    uv12 = np.array([uv for _, _, uv in order], dtype=np.float64)
    lab2 = np.array([z for _, z, _ in order], dtype=np.int16)
    return pos2, nrm2, uv02, uv12, new_index.astype(np.int32), lab2


def main():
    summary = {}
    for kind in ("male", "female"):
        path = os.path.join(HERE, f"{kind}.npz")
        d = np.load(path)
        if "zone" in d.files:
            raise SystemExit(
                f"{path} already carries an ink UV set. Rebuild the source mesh first:\n"
                "  python3 tools/assets/build_meshes.py && python3 tools/assets/ink_uv.py"
            )
        pos = d["pos"].astype(np.float64)
        uv0 = d["uv"].astype(np.float64)
        nrm = d["nrm"].astype(np.float64)
        tris = d["tris"].astype(np.int32)
        vlab = classify(pos, kind)

        face_zone, vmap, stats = build_charts(kind, pos, uv0, tris, vlab)
        uv1c = corner_uv1(tris, face_zone, vmap)

        # chart rectangles over every corner that uses them, so no corner overhangs
        rects_m = {}
        for name in vmap:
            fsel = face_zone == ID_INDEX[name]
            pts = uv1c[fsel].reshape(-1, 2)
            lo = pts.min(axis=0)
            hi = pts.max(axis=0)
            uv1c[fsel] -= lo  # shift the zone's chart to its own origin
            rects_m[name] = (float(hi[0] - lo[0]), float(hi[1] - lo[1]))

        placed, used_w, used_h, chart_area = pack_square(rects_m)
        scale = 1.0 / max(used_w, used_h)  # UV per metre

        for name, (ox, oy) in placed.items():
            fsel = face_zone == ID_INDEX[name]
            uv1c[fsel] += np.array([ox, oy])
        uv1c *= scale

        pos2, nrm2, uv02, uv12, tris2, lab2 = expand(tris, face_zone, uv1c, pos, nrm, uv0, vlab)

        # ---- measure what was produced, not what was intended
        ku, kv, ok, _ = face_scales(pos2.astype(np.float64), uv12, tris2)
        ku0, kv0, ok0, _ = face_scales(pos.astype(np.float64), uv0, tris)
        maj2 = np.stack([lab2[tris2[:, 0]], lab2[tris2[:, 1]], lab2[tris2[:, 2]]])
        maj0 = np.stack([vlab[tris[:, 0]], vlab[tris[:, 1]], vlab[tris[:, 2]]])
        report, rects = {}, {}
        for name in vmap:
            idx = ID_INDEX[name]
            sel, sel0 = (maj2 == idx).sum(axis=0) >= 2, (maj0 == idx).sum(axis=0) >= 2
            use, use0 = sel & ok, sel0 & ok0
            uvp = uv12[tris2[use]]
            rpt = {
                "uvPerMetre": round(float(np.median(np.sqrt(ku[use] * kv[use]))), 2),
                "uvPerMetreWas": round(float(np.median(np.sqrt(ku0[use0] * kv0[use0]))), 2),
            }
            s = np.sqrt(ku[use] * kv[use])
            aniso = kv[use] / np.maximum(ku[use], 1e-9)
            s0 = np.sqrt(ku0[use0] * kv0[use0])
            rpt["scaleP05P95"] = [round(float(np.nanpercentile(s / np.median(s), 5)), 2),
                                  round(float(np.nanpercentile(s / np.median(s), 95)), 2)]
            rpt["scaleP05P95Was"] = [round(float(np.nanpercentile(s0 / np.median(s0), 5)), 2),
                                     round(float(np.nanpercentile(s0 / np.median(s0), 95)), 2)]
            rpt["anisoP05P95"] = [round(float(np.nanpercentile(aniso, 5)), 2),
                                  round(float(np.nanpercentile(aniso, 95)), 2)]
            report[name] = rpt
            ox, oy = placed[name]
            rects[name] = {
                "x": round(ox * scale, 6), "y": round(oy * scale, 6),
                "w": round(rects_m[name][0] * scale, 6), "h": round(rects_m[name][1] * scale, 6),
                "metres": [round(rects_m[name][0], 4), round(rects_m[name][1], 4)],
                "kind": stats[name]["kind"], "islands": stats[name]["islands"],
            }

        payload = {k: d[k] for k in d.files if k not in ("pos", "nrm", "uv", "tris", "uv1", "zone")}
        payload.update(pos=pos2, nrm=nrm2, uv=uv02, uv1=uv12.astype(np.float32),
                       tris=tris2, zone=lab2)
        np.savez_compressed(path, **payload)

        summary[kind] = {
            "metresPerUv": round(1.0 / scale, 5),
            "atlasFill": round(chart_area * scale * scale, 4),
            "vertices": [int(len(pos)), int(len(pos2))],
            "rects": rects,
            "measured": report,
        }
        print(f"\n[{kind}] {len(vmap)} zones · atlas {used_w * scale:.3f}×{used_h * scale:.3f} UV "
              f"· 1 UV = {1 / scale:.2f} m · fill {chart_area * scale * scale * 100:.0f} % "
              f"· verts {len(pos)} → {len(pos2)}")
        for name, r in report.items():
            print(f"  {name:12s} {r['uvPerMetre']:5.2f} uv/m (was {r['uvPerMetreWas']:4.2f})"
                  f"  scale {r['scaleP05P95'][0]:.2f}–{r['scaleP05P95'][1]:.2f}"
                  f"  aniso {r['anisoP05P95'][0]:.2f}–{r['anisoP05P95'][1]:.2f}"
                  f"  cell {rects[name]['metres'][0]:.2f}×{rects[name]['metres'][1]:.2f} m")

    with open(OUT, "w") as fh:
        json.dump(summary, fh, indent=1)
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
