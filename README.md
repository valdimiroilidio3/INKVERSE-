# INKVERSE®

A 3D tattoo studio for the web: explore original tattoo artwork and preview it on a real
human mesh. Built as a portfolio-grade product, not a toy — every claim on screen is
backed by something in this repository.

```
Next.js 15 (App Router) · React 19 · TypeScript · three.js / R3F · Tailwind v4 · Zustand · Zod · Vitest
```

---

## What is actually here

| Surface | Route | What it does |
| --- | --- | --- |
| Home | `/` | Editorial hero with a live 3D character, concept, featured work, character cards, style index |
| Gallery | `/explore` | 28 designs, live search, style/zone filters, favourites, sort, incremental load, linkable URLs |
| Design detail | `/tattoos/[slug]` | 28 statically generated pages with zone, size, tags, licensing and a 3D preview |
| 3D studio | `/studio` | Orbit/zoom the body, 17 clickable zones, up to 8 layers, full transform controls, undo/redo, compare, PNG export, share links |
| Saved | `/saved` | Locally persisted compositions and favourites, rename/delete/reopen |
| About | `/about` | How it is built, complete asset licences (`#assets`) and honest limitations (`#limitations`) |

The application is a **placement and scale tool**. It is not a medical device, not a
tattoo artist, and not a photo-real render of a healed tattoo. See `/about#limitations`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + unit tests + shader syntax check
npm run build        # production build
```

The app is fully static: nothing needs a server at runtime, no API keys, no database,
no account system.

## Architecture

```
app/                     routes, metadata, sitemap/robots, global styles
components/
  three/                 R3F scene, character, skin material, asset loading
  studio/                studio workspace, canvas shell, design + composition panels
  gallery/               cards, explorer, favourites
  site/                  header, footer, marquee, section headings, clock
  ui/                    buttons, tags, range control, segmented, modal, toast, states
lib/                     domain: types, schemas, characters, regions, tattoos,
                         placement, atlas, storage, share, format, cn
store/                   zustand stores (studio editing state, local library)
tools/assets/            the Python asset pipeline (see ASSETS.md)
tools/checks/            shader syntax check
tests/                   vitest suites
```

### The interesting part: ink placement

1. **Region segmentation.** The mesh is segmented into 17 body regions at build time by
   nearest-bone assignment, then baked into a per-texel region-ID texture.
2. **Measured scale.** For each UV island the pipeline measures metres-per-UV-unit from
   the face Jacobian (median), so a design can be sized in **centimetres**.
3. **Placement.** `lib/placement.ts` converts a requested physical size into UV
   half-extents per axis, compensating for UV stretch so a square plate stays square on
   skin, then clamps the result inside the region box (also for rotation).
4. **Ink atlas.** Up to eight designs are rasterised at runtime into a 2048² density
   atlas (16 tiles). Density is derived from artwork luminance and alpha, so
   paper-coloured negative space stays skin.
5. **Skin shader.** A `MeshPhysicalMaterial` is patched via `onBeforeCompile` to sample the
   atlas in tattoo-local space, gated by the region-ID texture, and tint the albedo
   beneath the specular layer. A mirrored layer reflects the artwork rather than rotating
   it.

The same maths drives `tools/assets/render_editorial.py`, which renders the offline
editorial images with numpy — so the marketing imagery and the live viewport agree.

## Honest scope

- Two characters, one build each (athletic male / athletic female, 1.86 m).
- No body-type, skin-tone or age variants.
- Square plates follow curvature but do not wrap a full limb circumference.
- Hands, feet and face are excluded from the tattooable zones.
- Saved work lives in `localStorage`; there is no account or sync.
- Share links are self-contained and capped at 1600 characters.

## Licences

See [`ASSETS.md`](./ASSETS.md) and `/about#assets`. The base human mesh is CC0
(MakeHuman); all tattoo artwork, skin textures, morphs and editorial renders were
authored for this project.
