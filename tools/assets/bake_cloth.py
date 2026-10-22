#!/usr/bin/env python3
"""Rebake only the clothing mask (fast path).

The mask lives in UV space and is painted from world position, so it does not
depend on the skin bake. Useful while tuning the garment silhouette.

Run: python3 tools/assets/bake_cloth.py
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from bake_textures import OUT, bake_clothing_mask, load_mesh, to_webp, uv_rasterize  # noqa: E402


def main():
    for kind in ("male", "female"):
        mesh = load_mesh(kind)
        img_pos, _img_nrm, mask = uv_rasterize(mesh["pos"], mesh["nrm"], mesh["uv"], mesh["tris"])
        cloth = bake_clothing_mask(img_pos, mask)
        np.save(os.path.join(HERE, f"cloth_{kind}.npy"), cloth)
        to_webp(np.repeat(cloth[..., None], 3, -1), os.path.join(OUT, f"cloth-{kind}.webp"), 88)
        print(f"wrote cloth-{kind}.webp  coverage {float(cloth.mean()) * 100:.1f}%")


if __name__ == "__main__":
    main()
