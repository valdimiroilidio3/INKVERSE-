#!/usr/bin/env python3
"""Export the two INKVERSE studio characters to glTF-binary (GLB).

Input  : tools/assets/{male,female}.npz  (produced from the CC0 MakeHuman base mesh,
         see ASSETS.md and lib_mesh.py)
Output : public/models/inkverse-{male,female}.glb
         tools/assets/rig.json  (joint anchors in metres, used by the app)

Run: npm run assets:models
"""
from __future__ import annotations

import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "models")
RIG_PATH = os.path.join(HERE, "rig.json")

COMPONENT_FLOAT = 5126
COMPONENT_USHORT = 5123
TARGET_ARRAY_BUFFER = 34962
TARGET_ELEMENT_ARRAY_BUFFER = 34963


class GlbBuilder:
    def __init__(self):
        self.bin = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.meshes = []
        self.materials = []
        self.nodes = []

    def _align(self, n=4):
        while len(self.bin) % n:
            self.bin.append(0)

    def add_view(self, data: bytes, target=None):
        self._align()
        offset = len(self.bin)
        self.bin.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_accessor(self, array: np.ndarray, comp_type, type_str, target, min_max=False, normalized=False):
        view = self.add_view(array.tobytes(), target)
        acc = {
            "bufferView": view,
            "componentType": comp_type,
            "count": int(array.shape[0]),
            "type": type_str,
        }
        if normalized:
            acc["normalized"] = True
        if min_max:
            acc["min"] = [float(v) for v in np.array(array, dtype=np.float64).min(axis=0)]
            acc["max"] = [float(v) for v in np.array(array, dtype=np.float64).max(axis=0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_mesh(self, name, pos, nrm, uv, tris, material, extras=None, uv1=None):
        pos = np.ascontiguousarray(pos, dtype=np.float32)
        nrm = np.ascontiguousarray(nrm, dtype=np.float32)
        uv = np.ascontiguousarray(uv, dtype=np.float32)
        tris = np.ascontiguousarray(tris, dtype=np.uint16)
        attributes = {
            "POSITION": self.add_accessor(pos, COMPONENT_FLOAT, "VEC3", TARGET_ARRAY_BUFFER, min_max=True),
            "NORMAL": self.add_accessor(nrm, COMPONENT_FLOAT, "VEC3", TARGET_ARRAY_BUFFER),
            "TEXCOORD_0": self.add_accessor(uv, COMPONENT_FLOAT, "VEC2", TARGET_ARRAY_BUFFER),
        }
        if uv1 is not None:
            # TEXCOORD_1 is the ink UV set: per-zone charts packed into one atlas,
            # built by tools/assets/ink_uv.py. The skin textures keep using TEXCOORD_0.
            attributes["TEXCOORD_1"] = self.add_accessor(
                np.ascontiguousarray(uv1, dtype=np.float32), COMPONENT_FLOAT, "VEC2", TARGET_ARRAY_BUFFER
            )
        indices = self.add_accessor(tris.reshape(-1), COMPONENT_USHORT, "SCALAR", TARGET_ELEMENT_ARRAY_BUFFER)
        prim = {"attributes": attributes, "indices": indices, "material": material, "mode": 4}
        mesh = {"name": name, "primitives": [prim]}
        if extras:
            mesh["extras"] = extras
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def add_node(self, name, mesh, extras=None):
        node = {"name": name, "mesh": mesh}
        if extras:
            node["extras"] = extras
        self.nodes.append(node)
        return len(self.nodes) - 1

    def write(self, path):
        gltf = {
            "asset": {
                "version": "2.0",
                "generator": "INKVERSE asset pipeline",
                "copyright": "Base anatomy: MakeHuman CC0 (makehumancommunity/makehuman)",
            },
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.bin)
        while len(bin_bytes) % 4:
            bin_bytes += b"\x00"
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
            fh.write(json_bytes)
            fh.write(struct.pack("<II", len(bin_bytes), 0x004E4942))
            fh.write(bin_bytes)
        return total


def merge_eyes(data):
    pos = np.concatenate([data["e1_pos"], data["e2_pos"]], axis=0)
    nrm = np.concatenate([data["e1_nrm"], data["e2_nrm"]], axis=0)
    uv = np.concatenate([data["e1_uv"], data["e2_uv"]], axis=0)
    t1 = data["e1_tris"].astype(np.int64)
    t2 = data["e2_tris"].astype(np.int64) + len(data["e1_pos"])
    tris = np.concatenate([t1, t2], axis=0)
    return pos, nrm, uv, tris


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rig = {}
    for kind in ("male", "female"):
        data = np.load(os.path.join(HERE, f"{kind}.npz"))
        builder = GlbBuilder()

        builder.materials = [
            {
                "name": "Skin",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.72, 0.55, 0.45, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.62,
                },
                "doubleSided": False,
            },
            {
                "name": "Eye",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.42, 0.32, 0.26, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.18,
                },
                "doubleSided": False,
            },
        ]

        body_mesh = builder.add_mesh(
            "Body",
            data["pos"],
            data["nrm"],
            data["uv"],
            data["tris"],
            material=0,
            extras={"characterId": kind, "vertexCount": int(len(data["pos"]))},
            uv1=data["uv1"] if "uv1" in data else None,
        )
        eyes = merge_eyes(data)
        eye_mesh = builder.add_mesh("Eyes", *eyes, material=1, extras={"characterId": kind})

        builder.add_node("Body", body_mesh, extras={"role": "body", "characterId": kind})
        builder.add_node("Eyes", eye_mesh, extras={"role": "eyes", "characterId": kind})

        out = os.path.join(OUT_DIR, f"inkverse-{kind}.glb")
        size = builder.write(out)
        print(f"wrote {out}  {size/1024:.0f} KB  ({len(data['pos'])} verts, {len(data['tris'])} tris)")

        rig[kind] = {
            "height": 1.86,
            "eyeCenters": [
                np.round(data["e1_pos"].mean(axis=0), 4).tolist(),
                np.round(data["e2_pos"].mean(axis=0), 4).tolist(),
            ],
            "eyeRadius": float(np.round((data["e1_pos"].max(axis=0) - data["e1_pos"].min(axis=0)).max() / 2, 4)),
        }

    # joints transformed with the same morph + height normalisation as the mesh
    sys.path.insert(0, HERE)
    from lib_mesh import JOINTS_BASE, to_meters, make_morph

    for kind in ("male", "female"):
        data = np.load(os.path.join(HERE, f"{kind}.npz"))
        height = data["pos"][:, 1].max() - data["pos"][:, 1].min()
        scale = 1.86 / height
        morph = make_morph(kind)
        names = list(JOINTS_BASE.keys())
        pts = np.array([JOINTS_BASE[n] for n in names], dtype=np.float64)
        morphed = morph(pts)
        rig[kind]["joints"] = {
            n: [round(float(p[0]), 4), round(float(p[1] * scale), 4), round(float(p[2]), 4)]
            for n, p in zip(names, morphed)
        }
    with open(RIG_PATH, "w") as fh:
        json.dump(rig, fh, indent=2)
    print("rig written")


if __name__ == "__main__":
    main()
