#!/usr/bin/env python3
"""Augment public/models/regions.json with real-world UV scale (UV units per metre).

Run after bake_regions.py:  python3 tools/assets/region_metrics.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
REGIONS_PATH = os.path.join(ROOT, "public", "models", "regions.json")
DATA_PATH = os.path.join(ROOT, "data", "regions.json")
sys.path.insert(0, HERE)
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


def main():
    payload = json.load(open(REGIONS_PATH))
    for kind in ("male", "female"):
        d = np.load(os.path.join(HERE, f"{kind}.npz"))
        pos, uv, tris = d["pos"], d["uv"], d["tris"]
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
                slot["uvPerMeterX"] = round(ku, 5)
                slot["uvPerMeterY"] = round(kv, 5)
                slot["uvPerMeter"] = round(0.5 * (ku + kv), 5)
                slot["areaM2"] = round(float(area3[faces].sum()), 5)
                b = slot["uvBox"]
                slot["boxMeters"] = [
                    round((b[2] - b[0]) / max(ku, 1e-6), 4),
                    round((b[3] - b[1]) / max(kv, 1e-6), 4),
                ]
                print(f"  [{kind}] {name:12s} k=({ku:5.2f},{kv:5.2f})  box={slot['boxMeters']} m  area={slot['areaM2']} m2")
            # drop slot entries we could not map
            meta[name]["slots"] = [s for s in meta[name]["slots"] if "uvPerMeter" in s]

    json.dump(payload, open(REGIONS_PATH, "w"), indent=1)
    # the app imports the copy in data/ so the bundle never reaches into public/
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    json.dump(payload, open(DATA_PATH, "w"), indent=1)
    print("updated", REGIONS_PATH, "and", DATA_PATH)


if __name__ == "__main__":
    main()
