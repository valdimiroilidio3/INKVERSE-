#!/usr/bin/env python3
"""Build the two INKVERSE character meshes from the CC0 MakeHuman base mesh.

Input  : tools/assets/base.obj   (CC0, makehumancommunity/makehuman)
Output : tools/assets/{male,female}.npz
         keys: pos/nrm/uv/tris (body), e1_*, e2_* (eyes), g_* (garment)

The morph is applied in metres (see lib_mesh.make_morph), then the whole figure is
normalised to exactly 1.86 m with the soles on y = 0, which is the height the GLB
exporter and the joint anchors assume.

Run: npm run assets:models
"""
from __future__ import annotations

import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib_mesh import build_stream, load_obj, make_morph  # noqa: E402

HEIGHT = 1.86


def normalise(streams, height=HEIGHT):
    """Scale every stream about the ground plane so the figure is exactly `height` tall."""
    body = streams[""]
    y_min = float(body["pos"][:, 1].min())
    y_max = float(body["pos"][:, 1].max())
    scale = height / max(1e-6, y_max - y_min)
    out = {}
    for key, stream in streams.items():
        pos = stream["pos"].copy()
        pos[:, 0] *= scale
        pos[:, 1] = (pos[:, 1] - y_min) * scale
        pos[:, 2] *= scale
        out[key] = {**stream, "pos": pos.astype(np.float32)}
    return out, scale, y_min


def main():
    verts, uvs, faces = load_obj()
    print(f"base mesh: {len(verts)} verts, groups {sorted(faces)}")

    for kind in ("male", "female"):
        morph = make_morph(kind)
        streams = {
            "": build_stream(faces["body"], verts, uvs, morph),
            "e1_": build_stream(faces["helper-l-eye"], verts, uvs, morph),
            "e2_": build_stream(faces["helper-r-eye"], verts, uvs, morph),
            "g_": build_stream(faces["helper-tights"], verts, uvs, morph),
        }
        streams, scale, y_min = normalise(streams)

        body = streams[""]
        payload = {
            "pos": body["pos"],
            "nrm": body["nrm"].astype(np.float32),
            "uv": body["uv"].astype(np.float32),
            "tris": body["tris"].astype(np.int32),
        }
        for key in ("e1_", "e2_", "g_"):
            s = streams[key]
            payload[f"{key}pos"] = s["pos"]
            payload[f"{key}nrm"] = s["nrm"].astype(np.float32)
            payload[f"{key}uv"] = s["uv"].astype(np.float32)
            payload[f"{key}tris"] = s["tris"].astype(np.int32)

        np.savez_compressed(os.path.join(HERE, f"{kind}.npz"), **payload)

        h = float(body["pos"][:, 1].max() - body["pos"][:, 1].min())
        print(
            f"[{kind}] {len(body['pos'])} verts / {len(body['tris'])} tris  "
            f"height {h:.4f} m  scale {scale:.4f}  y_min {y_min:.4f}"
        )


if __name__ == "__main__":
    main()
