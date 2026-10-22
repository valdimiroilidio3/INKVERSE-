#!/usr/bin/env python3
"""Render the editorial imagery from the real 3D assets.

This doubles as an offline validation of the tattoo placement maths used by the
WebGL shader: identical slot boxes, identical physical scaling, identical UV
rotation — rendered with a software rasteriser.

Output: public/editorial/*.webp
Run: npm run assets:editorial
"""
from __future__ import annotations

import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "editorial")
os.makedirs(OUT, exist_ok=True)

REGIONS = json.load(open(os.path.join(ROOT, "public", "models", "regions.json")))
RT = {"male": Image.open, "female": Image.open}


REGION_INDEX = {r["id"]: r["index"] for r in REGIONS["regions"]}


def load_slot(kind, region):
    slots = REGIONS["characters"][kind][region]["slots"]
    best = max(slots, key=lambda s: s.get("areaM2", 0))
    return best, REGION_INDEX[region]


def placement(slot, size_m, offset=(0.0, 0.0), rot=0.0, label=""):
    u0, v0, u1, v1 = slot["uvBox"]
    bw, bh = u1 - u0, v1 - v0
    kx, ky = slot["uvPerMeterX"], slot["uvPerMeterY"]
    hx, hy = 0.5 * size_m * kx, 0.5 * size_m * ky
    th = math.radians(rot)
    c, s = abs(math.cos(th)), abs(math.sin(th))
    ex, ey = hx * c + hy * s, hx * s + hy * c
    shrink = 1.0
    if ex > bw * 0.49:
        shrink = min(shrink, bw * 0.49 / ex)
    if ey > bh * 0.49:
        shrink = min(shrink, bh * 0.49 / ey)
    # mirror the inscribed-square cap in lib/placement.ts
    sq = slot.get("square")
    if sq:
        half_side = sq[2]
    else:
        a = slot.get("anchor", (u0 + bw / 2, v0 + bh / 2))
        half_side = min(a[0] - u0, u1 - a[0], a[1] - v0, v1 - a[1])
    fit = min(half_side / max(hx, 1e-6), half_side / max(hy, 1e-6))
    if fit < 1:
        shrink = min(shrink, fit)
        hx, hy = hx * fit, hy * fit
    if shrink < 0.995:
        print(f"  ! {label or slot.get('region', '?')}: {size_m * 100:.1f} cm clamped to {size_m * shrink * 100:.1f} cm (zone capacity)")
    hx, hy = hx * shrink, hy * shrink
    ex, ey = hx * c + hy * s, hx * s + hy * c
    # mirror lib/placement.ts: centre on the island interior, not the box centre
    sq = slot.get("square")
    bx, by = (sq[0], sq[1]) if sq else slot.get("anchor", (u0 + bw / 2, v0 + bh / 2))
    # artwork intentionally overruns the zone; the app clips it with the region map
    cx = bx + offset[0] * max(0.0, bw / 2 - ex)
    cy = by + offset[1] * max(0.0, bh / 2 - ey)
    return (cx, cy, hx, hy)


def _paper_tone():
    """Read PAPER_TONE_INK from lib/atlas.ts so the offline render cannot drift
    from what the browser paints. Raises if the constant is renamed."""
    src = open(os.path.join(ROOT, "lib", "atlas.ts")).read()
    m = re.search(r"PAPER_TONE_INK\s*=\s*([0-9.]+)", src)
    if not m:
        raise SystemExit("PAPER_TONE_INK missing from lib/atlas.ts")
    return float(m.group(1))


PAPER_TONE_INK = _paper_tone()


def load_density(path):
    img = Image.open(path).convert("RGBA")
    a = np.asarray(img).astype(np.float32) / 255.0
    alpha = a[..., 3:4]
    # composite the artwork onto its own paper tone, then invert: paper reads as a
    # light ink wash, ink reads as ink (mirrors inkDensityFromPixel in lib/atlas.ts)
    rgb = a[..., :3] * alpha + (1.0 - alpha)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    return np.clip(alpha[..., 0] * (1.0 - (1.0 - PAPER_TONE_INK) * lum), 0, 1)


def sample(img, u, v):
    h, w = img.shape[:2]
    x = np.clip((u * (w - 1)), 0, w - 1).astype(np.int32)
    y = np.clip(((1 - v) * (h - 1)), 0, h - 1).astype(np.int32)
    return img[y, x]


def render(kind, tattoos, W=1200, H=1560, rot=180, elev=0, span=2.02, cy=0.95,
           bg_top="#141416", bg_bot="#08080a", fov_shift=0.0):
    d = np.load(os.path.join(HERE, f"{kind}.npz"))
    pos, nrm, uv, tris = d["pos"], d["nrm"], d["uv"], d["tris"]
    # Two UV sets, exactly like the shader: skin and cloth sample TEXCOORD_0, ink
    # samples TEXCOORD_1 (the per-zone chart atlas built by ink_uv.py).
    uv_ink = d["uv1"] if "uv1" in d.files else uv
    skin = np.asarray(Image.open(os.path.join(ROOT, "public", "textures", f"skin-{kind}.webp")).convert("RGB")).astype(np.float32) / 255
    cloth_path = os.path.join(ROOT, "public", "textures", f"cloth-{kind}.webp")
    cloth = np.asarray(Image.open(cloth_path).convert("L")).astype(np.float32) / 255 if os.path.exists(cloth_path) else None
    r = math.radians(rot)
    e = math.radians(elev)
    x = pos[:, 0] * math.cos(r) + pos[:, 2] * math.sin(r)
    z = -pos[:, 0] * math.sin(r) + pos[:, 2] * math.cos(r)
    y = pos[:, 1] * math.cos(e) - z * math.sin(e)
    z2 = pos[:, 1] * math.sin(e) + z * math.cos(e)
    scale = min(W, H) / span
    sx = x * scale + W / 2
    sy = H / 2 - (y - cy) * scale

    nx = nrm[:, 0] * math.cos(r) + nrm[:, 2] * math.sin(r)
    nz = -nrm[:, 0] * math.sin(r) + nrm[:, 2] * math.cos(r)
    ny = nrm[:, 1] * math.cos(e) - nz * math.sin(e)
    nz2 = nrm[:, 1] * math.sin(e) + nz * math.cos(e)
    N = np.stack([nx, ny, nz2], 1)
    N = N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-9)

    lights = [np.array([0.55, 0.62, 0.78]), np.array([-0.75, 0.22, 0.50]), np.array([0.10, 0.30, -1.0]), np.array([0.0, -0.2, 0.6])]
    lights = [l / np.linalg.norm(l) for l in lights]
    intensities = [1.0, 0.40, 0.26, 0.08]

    # preload tattoo data
    inks = []
    for t in tattoos:
        slot, rid = load_slot(kind, t["region"])
        cx, cyy, hx, hy = placement(slot, t["size"], t.get("offset", (0, 0)), t.get("rot", 0), label=t["id"])
        density = load_density(os.path.join(ROOT, "public", "tattoos", f"{t['id']}.png"))
        inks.append({"cx": cx, "cy": cyy, "hx": hx, "hy": hy, "rot": t.get("rot", 0), "op": t.get("opacity", 0.94), "density": density})

    # background gradient
    top = np.array([int(bg_top[1:3], 16), int(bg_top[3:5], 16), int(bg_top[5:7], 16)], np.float32) / 255
    bot = np.array([int(bg_bot[1:3], 16), int(bg_bot[3:5], 16), int(bg_bot[5:7], 16)], np.float32) / 255
    ramp = np.linspace(0, 1, H)[:, None, None]
    img = top[None, None, :] * (1 - ramp) + bot[None, None, :] * ramp
    img = np.repeat(img, W, axis=1)
    # subtle horizon glow behind the figure
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.exp(-(((xx - W * 0.5) / (W * 0.55)) ** 2 + ((yy - H * 0.42) / (H * 0.5)) ** 2)) * 0.10
    img = img + glow[..., None] * np.array([0.9, 0.85, 0.72])

    zb = np.full((H, W), 1e9)

    # ---- briefs (rendered after the body, garment mesh cropped to the hip band)
    gpos, gnrm, gtris = d["g_pos"], d["g_nrm"], d["g_tris"]
    gx = gpos[:, 0] * math.cos(r) + gpos[:, 2] * math.sin(r)
    gz = -gpos[:, 0] * math.sin(r) + gpos[:, 2] * math.cos(r)
    gy = gpos[:, 1] * math.cos(e) - gz * math.sin(e)
    gz2 = gpos[:, 1] * math.sin(e) + gz * math.cos(e)
    gsx = gx * scale + W / 2
    gsy = H / 2 - (gy - cy) * scale
    gnx = gnrm[:, 0] * math.cos(r) + gnrm[:, 2] * math.sin(r)
    gnz = -gnrm[:, 0] * math.sin(r) + gnrm[:, 2] * math.cos(r)
    gN = np.stack([gnx, gnrm[:, 1] * math.cos(e) - gnz * math.sin(e), gnrm[:, 1] * math.sin(e) + gnz * math.cos(e)], 1)
    gN /= np.linalg.norm(gN, axis=1, keepdims=True) + 1e-9
    gshade = np.full(len(gN), 0.16)
    for i, L in enumerate(lights):
        gshade += np.clip(gN @ L, 0, 1) * intensities[i]
    brief_col = np.array([0.055, 0.058, 0.062], np.float32)

    def draw_briefs():
        for t in range(len(gtris)):
            a, b, c = gtris[t]
            cy_w = (gpos[a, 1] + gpos[b, 1] + gpos[c, 1]) / 3
            if cy_w < 0.955 or cy_w > 1.17:
                continue
            x0, y0 = gsx[a], gsy[a]; x1, y1 = gsx[b], gsy[b]; x2, y2 = gsx[c], gsy[c]
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
            wy = w0 * gpos[a, 1] + w1 * gpos[b, 1] + w2 * gpos[c, 1]
            m = m & (wy >= 0.963) & (wy <= 1.152)
            if not m.any():
                continue
            zz = w0 * gz2[a] + w1 * gz2[b] + w2 * gz2[c]
            sub = zb[miny:maxy + 1, minx:maxx + 1]
            upd = m & (zz < sub + 0.004)
            if not upd.any():
                continue
            sh = w0[upd] * gshade[a] + w1[upd] * gshade[b] + w2[upd] * gshade[c]
            col = brief_col[None, :] * (0.30 + sh[:, None] * 1.05)
            col += (1 - np.abs(w0[upd] * gN[a, 2] + w1[upd] * gN[b, 2] + w2[upd] * gN[c, 2]))[:, None] ** 4 * 0.10
            img[miny:maxy + 1, minx:maxx + 1][upd] = np.clip(col, 0, 1)
            sub[upd] = zz[upd]

    for t in range(len(tris)):
        a, b, c = tris[t]
        x0, y0 = sx[a], sy[a]
        x1, y1 = sx[b], sy[b]
        x2, y2 = sx[c], sy[c]
        minx = int(max(0, math.floor(min(x0, x1, x2))))
        maxx = int(min(W - 1, math.ceil(max(x0, x1, x2))))
        miny = int(max(0, math.floor(min(y0, y1, y2))))
        maxy = int(min(H - 1, math.ceil(max(y0, y1, y2))))
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
        zz = w0 * z2[a] + w1 * z2[b] + w2 * z2[c]
        sub = zb[miny:maxy + 1, minx:maxx + 1]
        upd = m & (zz < sub)
        if not upd.any():
            continue
        u0_, u1_, u2_ = w0[upd], w1[upd], w2[upd]
        uvs = u0_[:, None] * uv[a] + u1_[:, None] * uv[b] + u2_[:, None] * uv[c]
        if uv_ink is uv:
            uvs_ink = uvs
        else:
            uvs_ink = u0_[:, None] * uv_ink[a] + u1_[:, None] * uv_ink[b] + u2_[:, None] * uv_ink[c]
        n = u0_[:, None] * N[a] + u1_[:, None] * N[b] + u2_[:, None] * N[c]
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
        base = sample(skin, uvs[:, 0], uvs[:, 1])
        if cloth is not None:
            cw = sample(cloth, uvs[:, 0], uvs[:, 1])
            cw = np.clip((cw - 0.35) * 2.2, 0, 1)
            if cw.max() > 0.01:
                weave = 0.94 + 0.06 * np.sin(uvs[:, 0] * 1400.0) * np.sin(uvs[:, 1] * 1400.0)
                fabric = np.array([0.052, 0.054, 0.058], np.float32)[None, :] * weave[:, None]
                base = base * (1 - cw[:, None]) + fabric * cw[:, None]

        # ---- tattoo composite (mirror of the WebGL shader)
        for ink in inks:
            th = math.radians(ink["rot"])
            cc, ss = math.cos(th), math.sin(th)
            px = uvs_ink[:, 0] - ink["cx"]
            py = uvs_ink[:, 1] - ink["cy"]
            qx = (cc * px + ss * py) / (2 * ink["hx"]) + 0.5
            qy = (-ss * px + cc * py) / (2 * ink["hy"]) + 0.5
            inside = (qx >= 0) & (qx <= 1) & (qy >= 0) & (qy <= 1)
            if not inside.any():
                continue
            dens = np.zeros(len(qx), np.float32)
            d0 = sample(ink["density"], qx[inside], qy[inside])
            dens[inside] = np.power(d0, 0.55) * ink["op"]
            if dens.max() <= 0.002:
                continue
            ink_col = np.array([0.063, 0.102, 0.141], np.float32)
            base = base * (1 - dens[:, None]) + (base * 0.06 + ink_col * 0.94) * dens[:, None]

        shade = np.full(len(n), 0.14)
        spec = np.zeros(len(n))
        for i, L in enumerate(lights):
            ndl = np.clip(n @ L, 0, 1)
            shade += ndl * intensities[i]
            Hh = L + np.array([0, 0.22, 0.95])
            Hh /= np.linalg.norm(Hh)
            spec += np.clip(n @ Hh, 0, 1) ** (18 + 40 * (1 - float(np.mean(base)))) * (0.24 if i == 0 else 0.08)
        rim = (1 - np.abs(n[:, 2])) ** 2.2
        out = base * (0.22 + shade[:, None] * 0.86)
        out += spec[:, None] * np.array([1.0, 0.96, 0.92]) * 0.16
        out += rim[:, None] * np.array([0.26, 0.32, 0.44]) * 0.36
        out += np.clip(n @ lights[0], 0, 1)[:, None] * base * 0.10
        img[miny:maxy + 1, minx:maxx + 1][upd] = np.clip(out, 0, 1)
        sub[upd] = zz[upd]


    # ---- eyes
    for key in ("e1", "e2"):
        epos = d[f"{key}_pos"]; enrm = d[f"{key}_nrm"]; etris = d[f"{key}_tris"]
        ex = epos[:, 0] * math.cos(r) + epos[:, 2] * math.sin(r)
        ez = -epos[:, 0] * math.sin(r) + epos[:, 2] * math.cos(r)
        ey = epos[:, 1] * math.cos(e) - ez * math.sin(e)
        ez2 = epos[:, 1] * math.sin(e) + ez * math.cos(e)
        esx = ex * scale + W / 2
        esy = H / 2 - (ey - cy) * scale
        for t in range(len(etris)):
            a, b, c = etris[t]
            x0, y0 = esx[a], esy[a]; x1, y1 = esx[b], esy[b]; x2, y2 = esx[c], esy[c]
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
            zz = w0 * ez2[a] + w1 * ez2[b] + w2 * ez2[c]
            sub = zb[miny:maxy + 1, minx:maxx + 1]
            upd = m & (zz <= sub + 0.002)
            if not upd.any():
                continue
            img[miny:maxy + 1, minx:maxx + 1][upd] = np.array([0.10, 0.075, 0.06])
            sub[upd] = zz[upd]

    # filmic-ish curve: lift shadows a touch, roll off highlights
    img = np.clip(img, 0, 1)
    a, b, c, d, e_ = 2.51, 0.03, 2.43, 0.59, 0.14
    img = np.clip((img * (a * img + b)) / (img * (c * img + d) + e_), 0, 1)
    # vignette + grain
    vig = np.clip(1.25 - 1.1 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) * 0.5, 0.25, 1.0)
    img *= vig[..., None]
    rng = np.random.default_rng(3)
    img += (rng.normal(0, 0.012, img.shape[:2]))[..., None]
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def save(im, name, quality=86, blur_bg=False):
    path = os.path.join(OUT, f"{name}.webp")
    im.save(path, "WEBP", quality=quality, method=6)
    print(f"wrote {name}.webp {im.size} {os.path.getsize(path)/1024:.0f} KB")


HERO_ATLAS = [
    {"id": "lunar-moth", "region": "chest", "size": 0.26, "offset": (0, 0.05)},
    {"id": "rose-noir", "region": "forearm-l", "size": 0.19, "offset": (0, 0.05), "rot": 8},
    {"id": "norse-knot", "region": "shoulder-r", "size": 0.12, "offset": (0, 0)},
    {"id": "dot-arc", "region": "abdomen", "size": 0.13, "offset": (0.55, -0.15)},
]
HERO_IRIS = [
    {"id": "orchid-line", "region": "forearm-r", "size": 0.18, "offset": (0, 0.1), "rot": -10},
    {"id": "peony-veil", "region": "thigh-l", "size": 0.2, "offset": (-0.16, -0.66)},
    {"id": "sun-moon", "region": "shoulder-l", "size": 0.1, "offset": (0, 0)},
    {"id": "sacred-grid", "region": "upper-back", "size": 0.3, "offset": (0, 0)},
]
STUDIO_BACK = [
    # sizes are the zone capacities for the male body (regions.json), not the catalogue
    # defaults: the editorial render must show what the studio can actually place
    {"id": "kiku-wave", "region": "upper-back", "size": 0.19, "offset": (0, 0.06)},
    {"id": "ink-flow", "region": "lower-back", "size": 0.15, "offset": (0, 0.02)},
    {"id": "hannya-vigil", "region": "arm-l", "size": 0.17, "offset": (0, 0.05)},
]


def main():
    which = sys.argv[1:] or ["all"]
    if "all" in which or "hero" in which:
        save(render("male", HERO_ATLAS, W=1240, H=1620, rot=163, elev=2, span=1.94, cy=0.96), "hero-atlas", 88)
        save(render("female", HERO_IRIS, W=1240, H=1620, rot=196, elev=2, span=1.94, cy=0.96), "hero-iris", 88)
        save(render("male", HERO_ATLAS, W=760, H=1000, rot=180, span=1.9, cy=0.95), "character-atlas", 86)
        save(render("female", HERO_IRIS, W=760, H=1000, rot=180, span=1.9, cy=0.95), "character-iris", 86)
    if "all" in which or "studio" in which:
        save(render("male", STUDIO_BACK, W=1100, H=1400, rot=8, elev=1, span=1.82, cy=0.98), "studio-back", 86)
        save(render("male", HERO_ATLAS, W=1100, H=1400, rot=186, elev=1, span=1.5, cy=1.28), "studio-chest", 86)
    if "all" in which or "detail" in which:
        save(render("male", HERO_ATLAS, W=820, H=820, rot=190, elev=0, span=0.72, cy=1.30), "detail-chest", 88)
        save(render("male", HERO_ATLAS, W=820, H=820, rot=150, elev=0, span=0.62, cy=1.20), "detail-arm", 88)


if __name__ == "__main__":
    main()
