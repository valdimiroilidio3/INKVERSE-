# Art direction

Short, enforceable rules for INKVERSE. Everything here is either in the theme or checked by a
test; if a screen disagrees with this file, the screen is wrong.

## 1. Surfaces and palette

The interface is a printed editorial object, not a dashboard.

| token | value | use |
|---|---|---|
| `ink-950` | `#050505` | page ground |
| `ink-900` / `ink-850` | `#080808` / `#0c0c0c` | section ground, sticky bars |
| `ink-800` / `ink-750` / `ink-700` | `#111111` … `#191919` | raised panels, inputs |
| `ink-600` … `ink-400` | `#232323` … `#3a3a3a` | 1 px hairlines, disabled strokes |
| `paper` / `paper-dim` | `#f5f5f2` / `#d8d8d2` | text, artwork |
| `mist` / `mist-strong` | `#929292` / `#b4b4b0` | secondary text, metadata |
| `acid` | `#d6ff52` | **state and action only**: focus, selection, live value |
| `clay`, `blood` | `#c9a58f`, `#b8452f` | skin reference, destructive/error |

Rules:

* no decorative gradients, no drop shadows on cards, no glassmorphism. Depth comes from value
  steps (`ink-950` → `ink-800`) and 1 px hairlines at `ink-600`.
* lime is not a brand sprinkle. If everything is lime, selection and focus stop reading. One
  lime element per region of the screen, and the 3D ink layer never uses it.
* numerals and measurements are mono; headlines are the display/editorial serif; interface
  labels are uppercase mono with `0.18em` tracking at 11 px.
* the 3D canvas is the only place with a lit gradient. It is a photograph of a body, so it keeps
  a vignette and a contact shadow; it never gets a card border drawn on top of the model.

## 2. Ink on skin

`lib/atlas.ts` turns artwork into density. The catalogue is two-tone silkscreen art: near-black
ink (`#0b0b0b`) plus **paper knockouts**.

`density = a · (1 − (1 − PAPER_TONE_INK) · luminance)`, with `PAPER_TONE_INK = 0.40`.

* transparent → 0 (bare skin);
* `#0b0b0b` → 0.97 (solid black);
* paper → 0.40 (a light wash, not a hole).

Why not simply `1 − luminance`: it is correct on paper and wrong on skin. Five of the 28 designs
(`lunar-moth`, `heart-anatomy`, `rose-noir`, `dragon-serpent`, `orchid-line`) are mostly white
shapes, so their 3D render fell to ~15 % strength and they read as ghosts while the gallery card
looked strong. Pinning paper to 0.40 keeps polarity, relative contrast and the alpha silhouette
untouched and makes every design legible at catalogue size.

**Honest limitation.** A 40 % wash is a tonal compromise, not a transcription: it turns paper
knockouts into healed shading, which is visibly flatter than a stencil. The real fix is art
direction — any design whose *form* depends on knockouts needs stencil line work before it is
offered as blackwork, so the drawing survives as ink rather than as absence of ink. The gallery
artwork is deliberately unaffected so the catalogue shows exactly what the artwork is.

## 3. Editorial imagery

`tools/assets/render_editorial.py` renders `public/editorial/*.webp` from the shipped meshes with
the same slot maths, the same cm scaling and the same UV rotation as the browser. It is a
software rasteriser, so it is not a screenshot of the app and does not pretend to be.

* every composition is chosen so the piece fits its zone at the size shown;
* `placement()` prints a line whenever a size is clamped (`21.0 cm clamped to 20.9 cm`), so a
  silent resize can never travel into marketing imagery;
* the garment is part of the model: a piece under the waistband is masked, not composited over
  it, which is why the studio back view no longer shows one.

## 4. Motion

* `prefers-reduced-motion: reduce` stops the hero orbit (`components/three/HeroViewer.tsx`),
  the reveal animations (`components/site/Reveal.tsx`) and CSS transitions (`app/globals.css`).
* micro-interactions exist to explain cause and effect: the layer row flashes when it is
  reordered, the size slider updates the measurement immediately, the canvas cursor changes at
  a draggable object. Nothing moves for decoration.
* the studio never animates the camera while a drag is in progress; an interrupted gesture must
  not leave the view somewhere the user did not ask for.
