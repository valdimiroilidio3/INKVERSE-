#!/usr/bin/env python3
"""Bake INKVERSE body-region definitions.

For each character we segment the real topology into anatomical regions
(head & neck, chest, abdomen, upper/lower back, shoulders, arms, forearms,
hands, thighs, lower legs), then export:

  public/models/regions.json        region metadata (UV box, physical extent)
  public/models/face-regions.bin    one byte per triangle -> region index
  public/tattoos/masks/<id>.png     per-region alpha mask in UV space
  tools/assets/region-preview-*.png offline validation renders

Run: npm run assets:regions
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_MODELS = os.path.join(ROOT, "public", "models")
OUT_MASKS = os.path.join(ROOT, "public", "tattoos", "masks")
MASK_SIZE = 1024
os.makedirs(OUT_MODELS, exist_ok=True)
os.makedirs(OUT_MASKS, exist_ok=True)

RIG = json.load(open(os.path.join(HERE, "rig.json")))

# region catalogue: id, label, group, side
REGIONS = [
    ("head", "Head & neck", "Head & neck", "center"),
    ("chest", "Chest", "Chest", "center"),
    ("abdomen", "Abdomen", "Abdomen", "center"),
    ("upper-back", "Upper back", "Upper back", "center"),
    ("lower-back", "Lower back", "Lower back", "center"),
    ("shoulder-l", "Left shoulder", "Shoulders", "left"),
    ("shoulder-r", "Right shoulder", "Shoulders", "right"),
    ("arm-l", "Left upper arm", "Upper arms", "left"),
    ("arm-r", "Right upper arm", "Upper arms", "right"),
    ("forearm-l", "Left forearm", "Forearms", "left"),
    ("forearm-r", "Right forearm", "Forearms", "right"),
    ("hand-l", "Left hand", "Hands", "left"),
    ("hand-r", "Right hand", "Hands", "right"),
    ("thigh-l", "Left thigh", "Thighs", "left"),
    ("thigh-r", "Right thigh", "Thighs", "right"),
    ("leg-l", "Left calf", "Lower legs", "left"),
    ("leg-r", "Right calf", "Lower legs", "right"),
]
IDS = [r[0] for r in REGIONS]
ID_INDEX = {r: i + 1 for i, r in enumerate(IDS)}  # 0 = unassigned


def seg_dist(p, a, b):
    a = np.asarray(a, float); b = np.asarray(b, float)
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab + 1e-12), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1), t


def fill_id_seams(reg, passes=3):
    """Close the 1-px seams between UV triangles.

    Neighbouring triangles are rasterised independently, so their shared edge can
    fall between two texel centres and stay unassigned. The shader treats id 0 as
    "no zone" and drops the ink there, which showed up as speckled artwork.
    Each pass lets an unassigned texel adopt the majority id of its neighbours.
    """
    reg = reg.copy()
    for _ in range(passes):
        zero = reg == 0
        if not zero.any():
            return reg
        pad = np.pad(reg, 1, mode="edge")
        neighbours = np.stack([
            pad[0:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, 0:-2], pad[1:-1, 2:],
            pad[0:-2, 0:-2], pad[0:-2, 2:], pad[2:, 0:-2], pad[2:, 2:],
        ])
        best = np.zeros_like(reg)
        best_count = np.zeros(reg.shape, dtype=np.int16)
        for k in range(neighbours.shape[0]):
            value = neighbours[k]
            count = (neighbours == value).sum(axis=0).astype(np.int16)
            take = (value > 0) & (count > best_count)
            best[take] = value[take]
            best_count[take] = count[take]
        reg = np.where(zero & (best > 0), best, reg)
    return reg


def classify(pos, kind):
    """Nearest-bone classification -> anatomical region index per vertex."""
    j = {k: np.array(v) for k, v in RIG[kind]["joints"].items()}
    # toe tips approximated from the ankle + forward offset
    toes = {}
    for side in ("l", "r"):
        a = j[f"ankle_{side}"]
        toes[side] = np.array([a[0] * 1.03, 0.02, a[2] + 0.17])

    bones = [
        ("head", j["neck"] + np.array([0, -0.02, 0]), j["head_top"]),
        ("torso", j["spine4"], j["spine1"]),
    ]
    # The head bone starts just under the neck joint, so shoulder-blade vertices were
    # closer to it than to the spine and got labelled "head".
    head_floor = float(j["neck"][1]) - 0.02
    for side in ("l", "r"):
        bones += [
            (f"arm-{side}", j[f"shoulder_{side}"], j[f"elbow_{side}"]),
            (f"forearm-{side}", j[f"elbow_{side}"], j[f"wrist_{side}"]),
            (f"hand-{side}", j[f"wrist_{side}"], j[f"hand_{side}"]),
            (f"thigh-{side}", j[f"hip_{side}"], j[f"knee_{side}"]),
            (f"leg-{side}", j[f"knee_{side}"], j[f"ankle_{side}"]),
            (None, j[f"ankle_{side}"], toes[side]),
        ]

    dist = np.full((len(pos), len(bones)), 1e9)
    for i, (_, a, b) in enumerate(bones):
        d, _ = seg_dist(pos, a, b)
        dist[:, i] = d
    # bias the torso slightly so the shoulders do not steal chest vertices
    for i, (name, _, _) in enumerate(bones):
        if name == "torso":
            dist[:, i] *= 0.92
    nearest = dist.argmin(axis=1)

    lab = np.zeros(len(pos), dtype=np.int16)
    for i, (name, _, _) in enumerate(bones):
        if name is None or name not in ID_INDEX:
            continue
        take = nearest == i
        if name == "head":
            take &= pos[:, 1] >= head_floor
        lab[take] = ID_INDEX[name]

    x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
    # torso -> chest / abdomen / upper-back / lower-back
    torso = np.zeros(len(pos), dtype=bool)
    for i, (name, _, _) in enumerate(bones):
        if name == "torso":
            torso |= nearest == i
    front = torso & (z > 0.0)
    back = torso & (z <= 0.0)
    lab[torso] = 0
    lab[front & (y > 1.27)] = ID_INDEX["chest"]
    lab[front & (y <= 1.27)] = ID_INDEX["abdomen"]
    lab[back & (y > 1.20)] = ID_INDEX["upper-back"]
    lab[back & (y <= 1.20)] = ID_INDEX["lower-back"]

    # shoulder caps: near the shoulder joint, above the arm, pushed outwards
    for side, sgn in (("l", 1), ("r", -1)):
        sh = j[f"shoulder_{side}"]
        d = np.linalg.norm(pos - sh, axis=1)
        cap = (d < 0.088) & (np.sign(x) == sgn) & (y > sh[1] - 0.035)
        lab[cap] = ID_INDEX[f"shoulder-{side}"]

    # The pelvic triangle sits on the front midline between the hip joints; the nearest-bone
    # rule hands it to the thighs, which lets a thigh placement bleed onto the groin.
    # Leave it explicitly unassigned (region 0) so no ink is ever drawn there.
    groin = (
        (np.abs(x) < 0.082)
        & (y > 0.865)
        & (y < 1.065)
        & (z < 0.035)
        & (np.abs(z) < 0.16)
    )
    lab[groin] = 0

    # neck belongs to the head region
    neck = (y > 1.585) & (y < 1.70) & (np.abs(x) < 0.12)
    lab[neck] = ID_INDEX["head"]

    # Anything still unassigned falls back to the nearest torso zone — but it must
    # pick a zone on the correct side of the body. Ignoring z here filed the whole
    # back under "chest", which is why the upper back had almost no paintable area.
    rest = lab == 0
    lab[rest & (y > 1.27) & (z > 0.0)] = ID_INDEX["chest"]
    lab[rest & (y > 1.27) & (z <= 0.0)] = ID_INDEX["upper-back"]
    lab[rest & (y <= 1.27) & (y > 1.0) & (z > 0.0) & ~groin] = ID_INDEX["abdomen"]
    lab[rest & (y <= 1.27) & (y > 1.0) & (z <= 0.0) & ~groin] = ID_INDEX["lower-back"]
    return lab


def rasterize_regions(pos, uv, tris, vlab):
    size = MASK_SIZE
    out = np.zeros((size, size), dtype=np.uint8)
    for t in tris:
        a, b, c = t
        ua, va = uv[a]; ub, vb = uv[b]; uc, vc = uv[c]
        x0, y0 = ua * (size - 1), (1 - va) * (size - 1)
        x1, y1 = ub * (size - 1), (1 - vb) * (size - 1)
        x2, y2 = uc * (size - 1), (1 - vc) * (size - 1)
        minx = int(max(0, math.floor(min(x0, x1, x2)))); maxx = int(min(size - 1, math.ceil(max(x0, x1, x2))))
        miny = int(max(0, math.floor(min(y0, y1, y2)))); maxy = int(min(size - 1, math.ceil(max(y0, y1, y2))))
        if maxx < minx or maxy < miny:
            continue
        X, Y = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(det) < 1e-12:
            continue
        w0 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / det
        w1 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / det
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.002) & (w1 >= -0.002) & (w2 >= -0.002)
        if not inside.any():
            continue
        # majority vote of the three vertex labels
        votes = np.stack([np.full(inside.shape, vlab[a]), np.full(inside.shape, vlab[b]), np.full(inside.shape, vlab[c])])
        counts = np.zeros((len(IDS) + 2,) + inside.shape, dtype=np.uint8)
        for k in range(3):
            np.add.at(counts, (votes[k].astype(np.int64),), 1)
        winner = counts.argmax(axis=0).astype(np.uint8)
        out[miny:maxy + 1, minx:maxx + 1][inside] = winner[inside]
    return out


def grow(mask, steps=2):
    m = mask.copy()
    for _ in range(steps):
        n = m.copy()
        n[1:, :] |= m[:-1, :]
        n[:-1, :] |= m[1:, :]
        n[:, 1:] |= m[:, :-1]
        n[:, :-1] |= m[:, 1:]
        m = n
    return m


def main():
    all_meta = {}
    for kind in ("male", "female"):
        d = np.load(os.path.join(HERE, f"{kind}.npz"))
        pos, uv, tris = d["pos"], d["uv"], d["tris"]
        vlab = classify(pos, kind)
        reg = rasterize_regions(pos, uv, tris, vlab)
        print(f"[{kind}] labelled verts: {(vlab>0).mean()*100:.1f}%  texels: {(reg>0).mean()*100:.1f}%")

        # UV islands (connected components in UV space)
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
        island = np.array([find(i) for i in range(len(pos))])
        face_region = np.zeros(len(tris), dtype=np.int16)
        for i, t in enumerate(tris):
            vals = [vlab[t[0]], vlab[t[1]], vlab[t[2]]]
            face_region[i] = max(set(vals), key=vals.count)

        # per-region masks + metadata (placement box = largest UV island of the region)
        meta = {}
        for name in IDS:
            idx = ID_INDEX[name]
            m = reg == idx
            if not m.any():
                print("  !! empty region", name)
                continue
            ys, xs = np.where(m)
            u0, u1 = xs.min() / (MASK_SIZE - 1), xs.max() / (MASK_SIZE - 1)
            v1, v0 = 1 - ys.min() / (MASK_SIZE - 1), 1 - ys.max() / (MASK_SIZE - 1)
            verts = pos[vlab == idx]
            mins, maxs = verts.min(axis=0), verts.max(axis=0)

            fsel = np.where(face_region == idx)[0]
            slots = []
            if len(fsel):
                isl_ids = {}
                for fi in fsel:
                    isl_ids.setdefault(island[tris[fi][0]], []).append(fi)
                for isl, faces in sorted(isl_ids.items(), key=lambda kv: -len(kv[1])):
                    if len(faces) < 40:
                        continue
                    vt = np.unique(tris[faces])
                    su = uv[vt]
                    su0, su1 = float(su[:, 0].min()), float(su[:, 0].max())
                    sv0, sv1 = float(su[:, 1].min()), float(su[:, 1].max())
                    sp = pos[vt]
                    pmins, pmaxs = sp.min(axis=0), sp.max(axis=0)
                    slots.append({
                        "uvBox": [round(su0, 5), round(sv0, 5), round(su1, 5), round(sv1, 5)],
                        "physical": [round(float(pmaxs[0] - pmins[0]), 4), round(float(pmaxs[1] - pmins[1]), 4), round(float(pmaxs[2] - pmins[2]), 4)],
                        "faces": int(len(faces)),
                    })
            meta[name] = {
                "uvBox": [round(max(0.0, u0 - 0.002), 5), round(max(0.0, v0 - 0.004), 5), round(min(1.0, u1 + 0.002), 5), round(min(1.0, v1 + 0.004), 5)],
                "uvPixels": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                "physical": [round(float(maxs[0] - mins[0]), 4), round(float(maxs[1] - mins[1]), 4), round(float(maxs[2] - mins[2]), 4)],
                "vertices": int((vlab == idx).sum()),
                "slots": slots,
            }
            # smooth mask, keep it crisp but slightly feathered for ink edges
            img = (grow(m, 1) * 255).astype(np.uint8)
            out = Image.new("L", (MASK_SIZE, MASK_SIZE), 0)
            out.paste(Image.fromarray(img), (0, 0))
            fname = name if kind == "male" else f"{name}-{kind}"
            out.save(os.path.join(OUT_MASKS, f"{fname}.png"), optimize=True)
        all_meta[kind] = meta

        # region id texture (R = region index) for the 3D masking + highlight
        reg = fill_id_seams(reg)
        rgba = np.zeros((MASK_SIZE, MASK_SIZE, 3), dtype=np.uint8)
        rgba[..., 0] = reg
        rgba[..., 1] = np.where(reg > 0, 255, 0)
        Image.fromarray(rgba, "RGB").save(os.path.join(OUT_MODELS, f"region-ids-{kind}.png"), optimize=True)

        # face -> region byte array (majority of vertices)
        flab = np.zeros(len(tris), dtype=np.uint8)
        for i, t in enumerate(tris):
            vals = [vlab[t[0]], vlab[t[1]], vlab[t[2]]]
            flab[i] = max(set(vals), key=vals.count)
        with open(os.path.join(OUT_MODELS, f"face-regions-{kind}.bin"), "wb") as fh:
            fh.write(flab.tobytes())

        # validation render: colour the mesh by region
        from render_regions import render_regions
        render_regions(d, vlab, IDS, f"/tmp/{kind}-regions-front.png", rot=180)
        render_regions(d, vlab, IDS, f"/tmp/{kind}-regions-back.png", rot=0)
        render_regions(d, vlab, IDS, f"/tmp/{kind}-regions-side.png", rot=90)

    payload = {
        "maskSize": MASK_SIZE,
        "regions": [
            {"id": r[0], "label": r[1], "group": r[2], "side": r[3], "index": ID_INDEX[r[0]]}
            for r in REGIONS
        ],
        "characters": all_meta,
    }
    with open(os.path.join(OUT_MODELS, "regions.json"), "w") as fh:
        json.dump(payload, fh, indent=1)
    print("regions.json written")
    for name in IDS:
        if name in all_meta["male"]:
            m = all_meta["male"][name]
            primary = m["slots"][0] if m["slots"] else None
            print(f"  {name:12s} box={m['uvBox']} primary={(primary or {}).get('uvBox')} phys={(primary or {}).get('physical')} slots={len(m['slots'])}")


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main()
