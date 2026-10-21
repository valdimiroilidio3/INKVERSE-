#!/usr/bin/env python3
"""Bake INKVERSE procedural skin maps from the real character topology.

Produces
  public/textures/skin-male.webp      albedo + baked AO (2048²)
  public/textures/skin-female.webp    albedo + baked AO (2048²)
  public/textures/skin-normal.webp    tileable pore/detail normal map (1024²)
  public/textures/skin-roughness.webp tileable roughness variation (512²)
  public/textures/skin-ao.webp        ambient occlusion only, for extra shading

All skin detail is generated procedurally (numpy) from the mesh positions,
normals and joint anchors. No third-party texture is used.

Run: npm run assets:textures
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "textures")
SIZE = 2048
os.makedirs(OUT, exist_ok=True)

rng = np.random.default_rng(7)


# ----------------------------------------------------------------- noise utils
def _hash3(ix, iy, iz, seed=0):
    n = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1442695040).astype(np.int64)
    n = (n ^ (n >> 13)) * 1274126177
    n = n ^ (n >> 16)
    return (n & 0xFFFFFF).astype(np.float64) / float(0xFFFFFF)


def _smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(p, freq=1.0, seed=0, period=None):
    q = p * freq
    i = np.floor(q).astype(np.int64)
    f = q - i
    if period:
        i = np.mod(i, period)
        ip = np.mod(i + 1, period)
    else:
        ip = i + 1
    c = {}
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                xi = ip[..., 0] if dx else i[..., 0]
                yi = ip[..., 1] if dy else i[..., 1]
                zi = ip[..., 2] if dz else i[..., 2]
                c[(dx, dy, dz)] = _hash3(xi, yi, zi, seed)
    fx, fy, fz = _smooth(f[..., 0]), _smooth(f[..., 1]), _smooth(f[..., 2])
    x00 = c[(0, 0, 0)] * (1 - fx) + c[(1, 0, 0)] * fx
    x10 = c[(0, 1, 0)] * (1 - fx) + c[(1, 1, 0)] * fx
    x01 = c[(0, 0, 1)] * (1 - fx) + c[(1, 0, 1)] * fx
    x11 = c[(0, 1, 1)] * (1 - fx) + c[(1, 1, 1)] * fx
    y0 = x00 * (1 - fy) + x10 * fy
    y1 = x01 * (1 - fy) + x11 * fy
    return y0 * (1 - fz) + y1 * fz


def fbm(p, freq=1.0, octaves=4, gain=0.5, lacunarity=2.0, seed=0):
    total = 0.0
    amp = 1.0
    norm = 0.0
    f = freq
    for o in range(octaves):
        total = total + amp * value_noise(p, f, seed + o * 17)
        norm += amp
        amp *= gain
        f *= lacunarity
    return total / norm


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-12), 0, 1)
    return t * t * (3 - 2 * t)


def gauss(x, mu, sigma):
    return np.exp(-0.5 * ((x - mu) / sigma) ** 2)


# --------------------------------------------------------------- mesh loading
def load_mesh(kind):
    d = np.load(os.path.join(HERE, f"{kind}.npz"))
    return {
        "pos": d["pos"].astype(np.float64),
        "nrm": d["nrm"].astype(np.float64),
        "uv": d["uv"].astype(np.float64),
        "tris": d["tris"].astype(np.int64),
    }


def vertex_ao(pos, nrm, radius=0.11, strength=1.15):
    """Point-cloud ambient occlusion (crease darkening) — fast and stable."""
    cell = radius
    keys = np.floor(pos / cell).astype(np.int64)
    table = {}
    for idx, k in enumerate(map(tuple, keys)):
        table.setdefault(k, []).append(idx)
    ao = np.ones(len(pos))
    for idx in range(len(pos)):
        kx, ky, kz = keys[idx]
        neigh = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    neigh.extend(table.get((kx + dx, ky + dy, kz + dz), ()))
        if not neigh:
            continue
        j = np.array(neigh, dtype=np.int64)
        j = j[j != idx]
        if len(j) == 0:
            continue
        d = pos[j] - pos[idx]
        dist = np.linalg.norm(d, axis=1) + 1e-6
        keep = dist < radius
        if not keep.any():
            continue
        d = d[keep] / dist[keep][:, None]
        dist = dist[keep]
        facing = np.clip(d @ nrm[idx], 0, 1)
        falloff = (1 - dist / radius) ** 2
        occ = float(np.sum(facing * falloff))
        ao[idx] = 1.0 - np.clip(occ * strength / (1 + len(j) * 0.02), 0, 0.85)
    # smooth over neighbours
    for _ in range(2):
        acc = ao.copy()
        cnt = np.ones(len(pos))
        for idx in range(len(pos)):
            kx, ky, kz = keys[idx]
            neigh = []
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for dz in (-1, 0, 1):
                        neigh.extend(table.get((kx + dx, ky + dy, kz + dz), ()))
            if neigh:
                acc[idx] = ao[idx] * 0.55 + float(np.mean(ao[np.array(neigh)])) * 0.45
        ao = acc
    return np.clip(ao, 0.08, 1.0)


def uv_rasterize(pos, nrm, uv, tris, size=SIZE):
    """Rasterise the mesh into its UV atlas, returning per-texel attributes."""
    img_pos = np.zeros((size, size, 3), dtype=np.float32)
    img_nrm = np.zeros((size, size, 3), dtype=np.float32)
    mask = np.zeros((size, size), dtype=bool)
    ntri = len(tris)
    for t in range(ntri):
        a, b, c = tris[t]
        u0, v0 = uv[a]
        u1, v1 = uv[b]
        u2, v2 = uv[c]
        x0, y0 = u0 * (size - 1), (1 - v0) * (size - 1)
        x1, y1 = u1 * (size - 1), (1 - v1) * (size - 1)
        x2, y2 = u2 * (size - 1), (1 - v2) * (size - 1)
        minx = int(max(0, math.floor(min(x0, x1, x2))))
        maxx = int(min(size - 1, math.ceil(max(x0, x1, x2))))
        miny = int(max(0, math.floor(min(y0, y1, y2))))
        maxy = int(min(size - 1, math.ceil(max(y0, y1, y2))))
        if maxx < minx or maxy < miny:
            continue
        X, Y = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(det) < 1e-12:
            continue
        w0 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / det
        w1 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / det
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.001) & (w1 >= -0.001) & (w2 >= -0.001)
        if not inside.any():
            continue
        sub_mask = mask[miny:maxy + 1, minx:maxx + 1]
        write = inside & ~sub_mask
        if not write.any():
            continue
        ww0, ww1, ww2 = w0[write][:, None], w1[write][:, None], w2[write][:, None]
        p = ww0 * pos[a] + ww1 * pos[b] + ww2 * pos[c]
        n = ww0 * nrm[a] + ww1 * nrm[b] + ww2 * nrm[c]
        img_pos[miny:maxy + 1, minx:maxx + 1][write] = p
        img_nrm[miny:maxy + 1, minx:maxx + 1][write] = n
        sub_mask[write] = True
    # dilate attributes a few pixels to kill UV seams
    for _ in range(6):
        hole = ~mask
        if not hole.any():
            break
        for arr in (img_pos, img_nrm):
            acc = np.zeros_like(arr)
            cnt = np.zeros((size, size), dtype=np.float32)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    sh = np.roll(np.roll(arr, dy, axis=0), dx, axis=1)
                    shm = np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
                    acc += sh * shm[..., None]
                    cnt += shm.astype(np.float32)
            valid = hole & (cnt > 0)
            arr[valid] = acc[valid] / cnt[valid][:, None]
        new_mask = mask.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                new_mask |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
        mask = new_mask
    return img_pos, img_nrm, mask


def to_webp(arr, path, quality=92):
    a = np.clip(arr, 0, 1)
    if a.max() <= 1.0001:
        a = a * 255.0
    Image.fromarray(a.astype(np.uint8)).save(path, "WEBP", quality=quality, method=6)
    print(f"wrote {path} {os.path.getsize(path)/1024:.0f} KB")


# --------------------------------------------------------------- skin albedo
PALETTES = {
    "male": {
        "base": np.array([0.700, 0.505, 0.400]),
        "shadow_tint": np.array([0.95, 0.80, 0.80]),
        "warm": np.array([0.72, 0.42, 0.33]),
        "hair": np.array([0.055, 0.045, 0.040]),
        "stubble": 0.42,
        "lip": np.array([0.46, 0.24, 0.22]),
    },
    "female": {
        "base": np.array([0.760, 0.560, 0.465]),
        "shadow_tint": np.array([0.96, 0.82, 0.84]),
        "warm": np.array([0.76, 0.48, 0.40]),
        "hair": np.array([0.045, 0.038, 0.036]),
        "stubble": 0.0,
        "lip": np.array([0.52, 0.26, 0.25]),
    },
}


def bake_clothing_mask(img_pos, mask):
    """Neutral brief painted in UV space from world position — clean edges, no extra geometry."""
    x, y, z = img_pos[..., 0], img_pos[..., 1], img_pos[..., 2]
    top = 1.104
    front = z > -0.01
    bottom_front = 1.005 - 0.105 * np.exp(-((x / 0.135) ** 2))
    bottom_back = 0.985 - 0.055 * np.exp(-((x / 0.135) ** 2))
    bottom = np.where(front, bottom_front, bottom_back)
    inside = (y >= bottom) & (y <= top) & (np.abs(x) <= 0.235) & mask
    m = inside.astype(np.float32)
    # soften the edge slightly (1px) so the shader cut never aliases
    k = np.array([0.25, 0.5, 0.25], dtype=np.float32)
    for axis in (0, 1):
        m = np.apply_along_axis(lambda row: np.convolve(row, k, mode="same"), axis, m)
    return np.clip(m, 0, 1)


def bake_albedo(kind, mesh, ao_vertex, img_pos, img_nrm, mask, joints):
    pal = PALETTES[kind]
    p = img_pos
    n = img_nrm
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    base = np.broadcast_to(pal["base"], p.shape).copy()

    # large-scale tonal variation
    n1 = fbm(p * 6.0, 1.0, 4, seed=3)
    n2 = fbm(p * 26.0, 1.0, 3, seed=11)
    n3 = fbm(p * 90.0, 1.0, 2, seed=23)
    base *= (0.93 + 0.14 * n1)[..., None]
    base += (0.012 * (n2 - 0.5))[..., None]

    # blood flush: face, ears, hands, feet, knees, elbows, chest
    def near(name, rx, ry, rz, amp):
        j = np.array(joints[name])
        d = (((x - j[0]) / rx) ** 2 + ((y - j[1]) / ry) ** 2 + ((z - j[2]) / rz) ** 2)
        return amp * np.exp(-d * 1.6)

    flush = np.zeros_like(x)
    for side in ("l", "r"):
        flush += near(f"wrist_{side}", 0.075, 0.09, 0.075, 0.16)
        flush += near(f"elbow_{side}", 0.055, 0.06, 0.06, 0.10)
        flush += near(f"knee_{side}", 0.075, 0.075, 0.07, 0.10)
        flush += near(f"ankle_{side}", 0.06, 0.05, 0.06, 0.10)
    flush += near("head", 0.10, 0.09, 0.09, 0.12)
    flush += near("neck", 0.05, 0.05, 0.05, 0.06)
    flush += near("spine1", 0.16, 0.14, 0.10, 0.05)
    cheek = gauss(x, 0.043, 0.019) * gauss(y, 1.712, 0.020) * smoothstep(0.10, 0.125, z)
    cheek += gauss(x, -0.043, 0.019) * gauss(y, 1.712, 0.020) * smoothstep(0.10, 0.125, z)
    flush += cheek * 0.5
    flush = np.clip(flush, 0, 0.6)
    base = base * (1 - flush[..., None] * 0.55) + pal["warm"] * (flush[..., None] * 0.55)

    # subsurface-ish mottling (fine red/green veins)
    veins = fbm(p * np.array([70.0, 24.0, 40.0]), 1.0, 3, seed=41)
    base += ((veins - 0.5) * 0.035)[..., None] * np.array([1.0, 0.35, 0.30])

    # ---- lips
    mouth = np.array(joints["mouth"]) if "mouth" in joints else np.array([0, 1.655, 0.075])
    lipd = (((x) / 0.022) ** 2 + ((y - mouth[1]) / 0.011) ** 2 + ((z - mouth[2] - 0.012) / 0.03) ** 2)
    lips = np.exp(-lipd * 1.4) * smoothstep(0.0, 0.02, z - (mouth[2] - 0.02))
    base = base * (1 - lips[..., None] * 0.8) + pal["lip"] * (lips[..., None] * 0.8)

    # ---- brows (arc above the eyes)
    brow = np.zeros_like(x)
    for sgn in (1, -1):
        bd = (((x - sgn * 0.037) / 0.026) ** 2 + ((y - 1.7455 - 0.004 * np.cos((x - sgn * 0.037) * 55)) / 0.0062) ** 2 +
              ((z - 0.128) / 0.05) ** 2)
        brow += np.exp(-bd * 1.2)
    brow = np.clip(brow * (0.62 + 0.6 * n3), 0, 1) * smoothstep(0.095, 0.118, z)
    brow *= smoothstep(1.7265, 1.7335, y) * (1 - smoothstep(1.7495, 1.7565, y))
    brow *= (0.9 if kind == "female" else 1.0)
    base = base * (1 - brow[..., None] * 0.92) + pal["hair"] * (brow[..., None] * 0.92)

    # ---- eyeshadow / sockets
    socket = np.zeros_like(x)
    for sgn in (1, -1):
        sd = (((x - sgn * 0.036) / 0.026) ** 2 + ((y - 1.728) / 0.016) ** 2 + ((z - 0.12) / 0.04) ** 2)
        socket += np.exp(-sd * 1.3)
    base *= (1 - np.clip(socket, 0, 0.7)[..., None] * 0.22)

    # ---- eyelash line
    lash = np.zeros_like(x)
    for sgn in (1, -1):
        ld = (((x - sgn * 0.036) / 0.0255) ** 2 + ((y - 1.7365) / 0.0042) ** 2 + ((z - 0.132) / 0.03) ** 2)
        lash += np.exp(-ld * 1.2)
    lash = np.clip(lash, 0, 1)
    base = base * (1 - lash[..., None] * 0.85) + pal["hair"] * (lash[..., None] * 0.85)

    # ---- scalp hair
    # hairline: high across the forehead, dropping behind the ears
    frontness = smoothstep(-0.02, 0.12, z)
    hairline_y = 1.792 - 0.030 * (1 - frontness) + 0.008 * gauss(x, 0, 0.05)
    scalp_mask = smoothstep(hairline_y - 0.006, hairline_y + 0.02, y)
    scalp_mask *= smoothstep(1.60, 1.66, y)
    strands = fbm(p * np.array([90.0, 220.0, 70.0]), 1.0, 3, seed=71)
    if kind == "male":
        hair = pal["hair"]
        scalp_col = hair * (0.75 + 0.9 * strands[..., None])
        scalp_strength = 0.78 * scalp_mask
        # shaved fade: subtle at the base, denser on top
        scalp_strength *= 0.45 + 0.55 * smoothstep(1.745, 1.83, y)
        scalp_strength *= 0.72 + 0.4 * strands
    else:
        hair = pal["hair"]
        scalp_col = hair * (0.55 + 0.7 * strands[..., None])
        scalp_strength = 0.97 * scalp_mask
    base = base * (1 - scalp_strength[..., None]) + scalp_col * scalp_strength[..., None]

    # ---- sideburns
    if kind == "male":
        sb = gauss(np.abs(x), 0.077, 0.012) * smoothstep(1.64, 1.70, y) * (1 - smoothstep(1.755, 1.775, y))
        sb *= smoothstep(-0.01, 0.03, z) * (1 - smoothstep(0.06, 0.09, z))
        sb = np.clip(sb * 0.55, 0, 0.5)
        base = base * (1 - sb[..., None]) + pal["hair"] * sb[..., None]

    # ---- stubble (male) / clean (female)
    if pal["stubble"] > 0:
        beard = smoothstep(1.585, 1.615, y) * (1 - smoothstep(1.700, 1.726, y))
        beard *= smoothstep(-0.02, 0.05, z)
        beard *= 1 - smoothstep(0.055, 0.085, np.abs(x))
        # keep the lips clear
        beard *= 1 - np.clip(lips * 1.6, 0, 1)
        # jaw + moustache, denser at the chin
        density = 0.82 + 0.18 * fbm(p * 160.0, 1.0, 2, seed=91)
        stubble = np.clip(beard * density * pal["stubble"], 0, 0.42)
        base = base * (1 - stubble[..., None]) + pal["hair"] * (stubble[..., None] * 1.15)

    # ---- ambient occlusion
    ao_img = np.ones((SIZE, SIZE), dtype=np.float32)
    # per-vertex ao was rasterised separately: approximate by multi-scale noise in creases
    cavity = np.clip(0.62 + 0.38 * fbm(p * 30.0, 1.0, 3, seed=101), 0, 1)
    ao = ao_img * (0.55 + 0.45 * cavity)
    base *= (0.82 + 0.18 * ao)[..., None]

    # fine skin grain / pores
    grain = fbm(p * 420.0, 1.0, 2, seed=131)
    base *= (0.965 + 0.07 * grain)[..., None]

    # keep the texture neutral where it is not masked (bleed area)
    base[~mask] = np.array([0.35, 0.26, 0.22])
    return base


def bake_vertex_ao_texture(mesh, ao, size=SIZE):
    tri_img = np.zeros((size, size), dtype=np.float32)
    mask = np.zeros((size, size), dtype=bool)
    pos, uv, tris = mesh["pos"], mesh["uv"], mesh["tris"]
    for t in range(len(tris)):
        a, b, c = tris[t]
        x0, y0 = uv[a][0] * (size - 1), (1 - uv[a][1]) * (size - 1)
        x1, y1 = uv[b][0] * (size - 1), (1 - uv[b][1]) * (size - 1)
        x2, y2 = uv[c][0] * (size - 1), (1 - uv[c][1]) * (size - 1)
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
        inside = (w0 >= -0.001) & (w1 >= -0.001) & (w2 >= -0.001)
        sub = mask[miny:maxy + 1, minx:maxx + 1]
        write = inside & ~sub
        if not write.any():
            continue
        tri_img[miny:maxy + 1, minx:maxx + 1][write] = w0[write] * ao[a] + w1[write] * ao[b] + w2[write] * ao[c]
        sub[write] = True
    # dilate
    for _ in range(8):
        hole = ~mask
        if not hole.any():
            break
        acc = np.zeros_like(tri_img); cnt = np.zeros((size, size), dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                sh = np.roll(np.roll(tri_img, dy, 0), dx, 1)
                shm = np.roll(np.roll(mask, dy, 0), dx, 1)
                acc += sh * shm
                cnt += shm
        valid = hole & (cnt > 0)
        tri_img[valid] = acc[valid] / cnt[valid]
        new_mask = mask.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                new_mask |= np.roll(np.roll(mask, dy, 0), dx, 1)
        mask = new_mask
    tri_img[~mask] = 1.0
    return tri_img


def tileable_normal(size=1024):
    # periodic multi-octave noise -> height -> normal map
    coords = np.stack(np.meshgrid(np.linspace(0, 1, size, endpoint=False),
                                  np.linspace(0, 1, size, endpoint=False),
                                  indexing="ij"), -1)
    height = np.zeros((size, size))
    amps = 0.0
    for period, amp, seed in ((96, 0.5, 5), (48, 0.26, 9), (24, 0.14, 13), (192, 0.1, 17)):
        pts = np.stack([coords[..., 0], coords[..., 1], np.full((size, size), 0.5)], -1)
        height += amp * value_noise(pts * period, 1.0, seed, period=period)
        amps += amp
    height /= amps
    # pores: dark dots
    pores = value_noise(np.stack([coords[..., 0], coords[..., 1], np.full((size, size), 0.5)], -1) * 300, 1.0, 33, period=300)
    height -= np.clip((pores - 0.72) * 1.6, 0, 1) * 0.35
    gy, gx = np.gradient(height * 26.0)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return (n * 0.5 + 0.5)


def tileable_roughness(size=512):
    coords = np.stack(np.meshgrid(np.linspace(0, 1, size, endpoint=False),
                                  np.linspace(0, 1, size, endpoint=False), indexing="ij"), -1)
    pts = np.stack([coords[..., 0], coords[..., 1], np.full((size, size), 0.4)], -1)
    n = value_noise(pts * 60, 1.0, 3, period=60) * 0.55 + value_noise(pts * 180, 1.0, 7, period=180) * 0.25 + 0.2
    return np.clip(0.52 + (n - 0.5) * 0.35, 0, 1)


def main():
    import json
    rig = json.load(open(os.path.join(HERE, "rig.json")))
    for kind in ("male", "female"):
        mesh = load_mesh(kind)
        print(f"[{kind}] mesh {mesh['pos'].shape} computing AO…")
        ao = vertex_ao(mesh["pos"], mesh["nrm"])
        np.save(os.path.join(HERE, f"ao_{kind}.npy"), ao)
        print(f"[{kind}] ao range {ao.min():.2f}..{ao.max():.2f}")
        print(f"[{kind}] rasterising UV atlas…")
        img_pos, img_nrm, mask = uv_rasterize(mesh["pos"], mesh["nrm"], mesh["uv"], mesh["tris"])
        joints = rig[kind]["joints"]
        print(f"[{kind}] composing albedo…")
        albedo = bake_albedo(kind, mesh, ao, img_pos, img_nrm, mask, joints)
        ao_tex = bake_vertex_ao_texture(mesh, ao)
        # multiply baked AO into albedo (kept subtle: lighting adds the rest)
        albedo *= (0.76 + 0.24 * ao_tex)[..., None]
        clothing = bake_clothing_mask(img_pos, mask)
        np.save(os.path.join(HERE, f"cloth_{kind}.npy"), clothing)
        to_webp(np.repeat(clothing[..., None], 3, -1), os.path.join(OUT, f"cloth-{kind}.webp"), 88)
        to_webp(albedo, os.path.join(OUT, f"skin-{kind}.webp"), 90)
        if kind == "male":
            ao_preview = np.repeat(ao_tex[..., None], 3, -1)
            to_webp(ao_preview, os.path.join(OUT, "skin-ao.webp"), 88)
    print("normal map…")
    to_webp(tileable_normal(1024), os.path.join(OUT, "skin-normal.webp"), 90)
    print("roughness…")
    rough = tileable_roughness(512)
    to_webp(np.repeat(rough[..., None], 3, -1), os.path.join(OUT, "skin-roughness.webp"), 90)


if __name__ == "__main__":
    main()
