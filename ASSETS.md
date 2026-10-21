# ASSETS.md — provenance and licences

Everything shipped in `public/` is either generated in this repository or derived from a
CC0 source. This file is the authoritative inventory; `/about#assets` mirrors it for
visitors.

## 1. Base human mesh

| Item | Detail |
| --- | --- |
| Source | `makehumancommunity/makehuman` — `base.obj` (13,380 vertices) |
| Licence | CC0 1.0 Universal (public domain dedication) |
| Obtained | `raw.githubusercontent.com` → mirrored through the GitHub API |
| Changes | Vertex morphs for the two builds, normalisation to 1.86 m, tangent generation, GLB export |

Attribution is given in the README and on the about page even though CC0 does not
require it.

**No other third-party mesh, texture, HDRI or artwork is included.** The `Environment` in
the 3D scenes is built from procedural `Lightformer` planes inside the bundle — there is
no external HDRI download.

## 2. Generated in this repository

All of the following were produced by the scripts in `tools/assets/` from the base mesh
and the vector sources. They are original to this project.

| Output | Script | Notes |
| --- | --- | --- |
| `public/models/inkverse-{male,female}.glb` | `export_glb.py` | 619–634 KB, 14,517 verts / 26,756 tris each, `Body` + `Eyes` nodes |
| `public/models/region-ids-{male,female}.png` | `bake_regions.py` | 1024², 1-based region index in R (0 = unassigned) |
| `public/models/face-regions-{male,female}.bin` | `bake_regions.py` | Per-face region table used by the picker |
| `public/models/regions.json` + `data/regions.json` | `bake_regions.py`, `region_metrics.py` | UV boxes, metres-per-UV-unit, box metres, area, face counts |
| `public/textures/skin-{male,female}.webp` | `bake_textures.py` | 2048² PBR albedo: tonal variation, flush, brows, lash line, stubble, scalp, sideburns, AO |
| `public/textures/skin-normal.webp` | `bake_textures.py` | 2048² tangent-space normal map (shared) |
| `public/textures/skin-roughness.webp` | `bake_textures.py` | 512² detail roughness, tiled 7×7 in the shader |
| `public/textures/skin-ao.webp` | `bake_textures.py` | 2048² baked vertex occlusion |
| `public/textures/cloth-{male,female}.webp` | `bake_textures.py` | 1024² clothing mask painted in UV space from world position |
| `public/tattoos/*.png` | `tattoos_src.py` → `rasterize.mjs` | 28 original designs, 1024² transparent PNG |
| `public/tattoos/thumbs/*.webp` | `tattoos_src.py` | 640² WebP q88 gallery cards |
| `public/tattoos/masks/*.png` | `bake_regions.py` | 1024² per-region highlight masks (male + female) |
| `public/editorial/*.webp` | `render_editorial.py` | Offline numpy rasteriser that mirrors the runtime placement maths |
| `public/brand/favicon.svg` | hand-authored | Two-bar INKVERSE mark |

### Design inventory (28)

`crane-tsuru`, `hannya-vigil`, `kiku-wave`, `dragon-serpent`, `rose-noir`,
`eye-of-storm`, `skull-memento`, `orchid-line`, `lunar-moth`, `heart-anatomy`,
`monolith`, `ivy-rite`, `serpent-coil`, `polynesian-spear`, `norse-knot`, `sacred-grid`,
`orbit-delta`, `swallow-courage`, `anchor-tide`, `ink-flow`, `erosion`, `memento-mori`,
`vincit-amor`, `sun-moon`, `dot-arc`, `peony-veil`, `compass-rose`, `lotus-black`.

Vector sources live in `assets/tattoos-src/`. Ink `#0b0b0b`, paper knockout
`#f7f3ea`. **The designs are original but are not licensed for reproduction as real
tattoos** — the licence line is stored with each design and shown on its detail page.

## 3. Typefaces

| Font | Licence |
| --- | --- |
| Geist Sans / Geist Mono (Vercel) | SIL Open Font License 1.1 |
| Instrument Serif (Google Fonts) | SIL Open Font License 1.1 |

## 4. Icons

`lucide-react` — ISC licence.

## 5. What is *not* used

No stock photography, no AI-generated photography presented as real, no unlicensed
HDRIs, no downloaded character models, no traced tattoo artwork from third parties.

## Rebuilding

```bash
npm run assets:models      # morph + export GLB (needs tools/assets/*.py, numpy, Pillow)
npm run assets:textures    # ~2 min: albedo / normal / roughness / AO / clothing mask
npm run assets:regions     # ~4 min: segmentation + per-island metrics
npm run assets:tattoos     # vector source → 1024 PNG + 640 WebP cards
npm run assets:editorial   # ~45 s: the eight editorial WebP renders
```

Python dependencies: `numpy`, `Pillow`. The rasteriser runs on Node with `sharp`.
The generated binaries are committed so the application can be built without Python.
