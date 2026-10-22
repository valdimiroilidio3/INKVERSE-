# 3D studio — audit and corrections

_A measured review of the INKVERSE viewport, the defects that were found, and the rules now enforced by code._

---

## 1. What the 3D layer is

| Layer | Choice |
| --- | --- |
| Renderer | React Three Fiber 9 (`<Canvas>`) over three.js 0.186 |
| Geometry | One CC0 MakeHuman-derived body, 14,517 vertices / 26,756 triangles, 1.86 m, feet on `y = 0`, no skeleton |
| Surface | Custom `MeshPhysicalMaterial` + `onBeforeCompile` injection: tattoo density, zone highlight, brief mask, fabric weave |
| Textures | Baked in Python from the mesh itself — 2K albedo, 1K normal/roughness, 1K region-id map, 2K clothing mask |
| Ink | Runtime canvas atlas, 4 × 4 tiles of 512 px, `uInkTf / uInkRot / uInkMirror` per layer, mirrored per design |
| Picking | Per-triangle region ids (`face-regions-*.bin`, one byte per triangle) resolved to the 17 zones |
| Studio | Orbit camera, four fixed views, contact shadows, three-point lighting + a baked Lightformer environment |

Scene construction before this work: every camera, light and floor value was a literal inside
`components/three/StudioScene.tsx`, unrelated to the body it was framing. Nothing checked that those
numbers agreed with each other.

---

## 2. Defects found, with measurements

### D1 — The front view cropped the feet (severity: high)

`STUDIO_VIEWS.front = [0, 1.14, 3.05]`, `fov = 30`.
Visible height at that distance is `2 · 3.05 · tan(15°) = **1.634 m**`, for a **1.86 m** body.
The frame covered `y ∈ [0.1, 1.73]`: the soles and the crown were outside it.

**Root cause:** the preset was typed as a round number, never derived from body height or FOV.

### D2 — The front view was lit from behind (severity: high)

Key spot at `[-2.6, 3.4, -2.2]` and acid point at `[0, 1.4, -2.4]` while the camera sat at `z = +3.05`.
Both "modelling" lights were **on the far side of the body**, so the face and chest were lit by ambient
and the rim did all the work.

### D3 — The facing direction was recorded backwards (severity: critical)

Project notes said the characters face `−Z`. Measurement on the exported mesh says otherwise:

| Landmark | Z |
| --- | --- |
| eyes | +0.115 … +0.146 |
| toes | +0.212 |
| glutes / shoulder blades | −0.117 … −0.14 |

The characters face **+Z**. The morph that shapes chests and glutes had encoded the old assumption, so
the female bust was being pushed into her back and the glutes forward. That is a *geometry* bug, not a
camera bug: no lighting change could have fixed it.

### D4 — The camera could orbit under the floor (severity: medium)

`maxPolarAngle = π − 0.5` (151°). At 3.96 m from a 0.93 m target that puts the camera at
`y = 0.93 + 3.96 · cos(151°) ≈ **−2.53 m**` — below a floor disc whose radius is 8 m, i.e. looking up
through the stage.

### D5 — Loading finished before the character existed (severity: high)

`onReady` fired from `<Canvas onCreated>` — the moment the WebGL context existed. The GLB is loaded
through Suspense, so the overlay ("Loading character & skin maps") disappeared while the scene was
still empty, and the PNG export could capture that empty frame.

### D6 — Contact shadows were baked on an empty scene (severity: medium)

`<ContactShadows frames={1}>` renders exactly one depth pass. It ran on the first frame, before the
suspended mesh mounted, so the figure floated with no ground contact.

### D7 — Export had no background (severity: low)

The viewport canvas is transparent (`alpha: true`) over a CSS gradient, so `toDataURL` produced a
cut-out PNG instead of a framed still.

### D8 — Dragging the body also picked a region (severity: medium)

R3F synthesises `click` on `pointerup`, so every orbit drag ended by selecting whatever triangle was
under the cursor — the zone label and the zone highlight jumped after each rotation.

### D9 — Zoom buttons died at the limits (severity: low)

`zoom()` returned early when the new distance was out of range, so at min/max zoom the buttons did
nothing — a dead control.

### D10 — Character swap flashed an empty stage (severity: low)

Only the male GLB was preloaded, and Suspense unmounts the previous body while the next one parses.

### D11 — The female figure read as male (severity: high, for body realism)

Silhouette measurements before: shoulders `±0.333 m` vs hips `±0.204 m`, bust apex `z = 0.205 m` —
the same numbers as the male. The morph existed but its deltas were too small to survive the render.

### D12 — The brief had holes and a step (severity: medium)

Two separate faults: a 3-D ellipsoid test left notches where the hip crease crossed its boundary, and
a hard front/back switch created a 14 mm step in the leg opening at each side.

### D13 — Nothing validated any of it (severity: high, process)

There was no test that could fail if the camera went behind the body, the floor ran out, or the
framing cropped the feet.

---

## 3. Corrections

### Spatial contract — `lib/scene.ts`

```
CHARACTER_FORWARD       [0, 0, 1]
CHARACTER_HEIGHT_M      1.86
STUDIO_FOV              30
STUDIO_TARGET           [0, 0.93, 0]
framingDistance()       1.86 · 1.14 / (2 · tan 15°) = 3.96 m
STUDIO_DISTANCE         3.96 m
STUDIO_MIN/MAX          1.70 / 5.35 m
STUDIO_VIEWS            front [0, 1.05, +3.96] · back [0, 1.05, −3.96]
                        left  [+3.96, 1.05, 0] · right [−3.96, 1.05, 0]
KEY_LIGHT_POSITION      [−2.4, 3.9, +2.9]     (camera side)
STUDIO_MAX_POLAR        acos((0.35 − 0.93) / 5.35) = 96.2°
FLOOR_RADIUS            8 m
```

Every view is now at the same distance from the target, every light is placed relative to the facing
direction, and the orbit limit is derived from the floor rather than chosen by eye.

### Geometry — `tools/assets/lib_mesh.py`

- Front/back masks keyed to the true `+Z` face (`smoothstep(−0.02, 0.06, z)`).
- Pecs, bust, sternum and glutes now displace in the anatomically correct direction.
- Female shaping strengthened: shoulders −5.5 %, waist −7.5 %, hips +8 %, bust lobe +6.2 cm,
  glutes +4 cm. Result: shoulders `±0.327` vs hips `±0.213` and a bust apex of `z = 0.250` —
  visibly different from the male (`±0.333` / `±0.204` / `0.205`).

### Garment — `tools/assets/bake_textures.py`, `tools/assets/bake_cloth.py`

The brief is a wide elliptical cross-section (rx 0.245, rz 0.42) cut by a curved leg opening, with
a smooth front/back blend (`blend = clamp((z + 0.06) / 0.12)`) and a 3 × 3 morphological closing that
removes seam spikes. `bake_cloth.py` re-bakes only the mask, so tuning it takes seconds.

### Viewport — `components/three/StudioScene.tsx`

- Everything reads from the contract; no literals.
- Orbit clamps to `STUDIO_MIN/MAX` distance and `STUDIO_MIN/MAX_POLAR`.
- `readyFor` tracks *which* body is mounted — cached GLBs resolve synchronously, so a boolean reset
  would race the load.
- `onReady` (overlay + capture) fires only after the mesh exists.
- Contact shadows mount only when the body is on stage.
- `gl.debug.onShaderError` inspects the failed program: if the failure comes from the ink injection it
  flags `degraded` and the body re-renders with plain PBR skin instead of going black.
- Rim lights rotated to `−Z`, key light to `+Z`, all multiplied by the facing sign.

### Model — `components/three/CharacterModel.tsx`

- Pointer-down origin + 6 px threshold before a region pick.
- Cursor restored on unmount.
- Material disposal on replace, effects re-keyed on the material instance.
- Both GLBs and the shared maps preloaded.

### Surface — `components/three/skin-material.ts`

- Every sampler is bound to a 1 × 1 placeholder from construction, so no `undefined` sampler can reach
  the driver while textures load.
- `injectInk: false` produces a plain PBR material for the degraded path.
- `dispose()` releases the material and its placeholders.

### Honest states — `components/studio/StudioCanvas.tsx`

Capability probe before mounting the canvas, progress-aware loading copy, a 15 s "still loading" escape
hatch with the asset name, a degraded banner ("Ink preview unavailable — skin only"), and a reload
action for a lost context.

### Export — `components/studio/StudioWorkspace.tsx`

The canvas is composited over `#0b0b0c` before `toDataURL`, so downloads are framed stills.

---

## 4. Validation

`lib/scene-audit.ts` turns the contract into checks with severities; `tools/checks/scene-audit.ts` runs
them from the CLI and exits non-zero on any error:

```
npx tsx tools/checks/scene-audit.ts
```

| Check | Severity |
| --- | --- |
| `framing.body-fits` — full body inside the frustum | error |
| `framing.distance-limits` — preset inside the orbit range | error |
| `orientation.front/back-camera` — camera on the right side | error |
| `orientation.left/right-camera` — true profile | warn |
| `orientation.forward-level` — forward vector horizontal | warn |
| `lighting.key-behind-camera-subject` | error |
| `lighting.key-flat`, `lighting.key-height` | warn |
| `floor.radius`, `floor.reach` | warn |
| `orbit.below-floor` — camera can pass under the stage | error |
| `orbit.max-polar` — orbit stops above the horizon | warn |
| `target.height`, `body.unit-scale`, `body.ground-contact` | warn / error |
| `texture.*` — maps over 2048 px or > 96 MB decoded | warn |

`tests/scene.test.ts` (12 cases) locks the contract *and* proves the audit catches the old defects:
the shipped 3.05 m framing fails `framing.body-fits`, a camera at `−Z` fails `orientation.front-camera`,
feet at `y = 0.08` fail `body.ground-contact`, an 18.6 m body fails `body.unit-scale`.

**Executed here:** `tsc --noEmit` clean · `vitest run` 44/44 · GLSL injection parse + 4 ordering
assertions · `next build` 38/38 static pages · every route and every 3D asset returns 200 · GLB
attribute/bounds audit (both characters: `POSITION`, `NORMAL`, `TEXCOORD_0`; 26,756 triangles;
26,756 bytes of face-region data) · editorial renders regenerated and inspected.

**Not executed here:** there is no browser or GPU in this sandbox, so the live WebGL frame was **not**
observed. Nothing in this document claims otherwise. The shader-failure path, the WebGL capability
probe and the degraded banner exist precisely because that frame could not be verified from here.

---

## 5. "Try in 3D studio" — what was broken

The studio is only working if the button on a design page lands the artwork on the
body, visibly, on the zone the page promised. Four separate faults broke that chain.

### T1 — No tattoo was ever drawn (critical)

`inkDensityAt()` computed `atlasUv = (tileOrigin.x + q.x·0.25, 1 − tileOrigin.y − 0.25 + q.y·0.25)`.
The atlas is a `CanvasTexture` with `flipY = false`, so v runs top-down with canvas
rows and tile 0 occupies rows 0–511. The shipped formula sampled **rows 1536–2048**
— the empty half of the texture. Every design rendered as bare skin.

*Fix:* `atlasUv = (tileOrigin.x + q.x·0.25, tileOrigin.y + (1 − q.y)·0.25)`, mirrored by
`atlasUvFor()` in `lib/atlas.ts` and guarded by `tests/ink.test.ts` plus an
end-to-end probe that renders the shader path on a real atlas.

### T2 — Designs landed on the wrong part of the body (critical)

Placement centred artwork on the **bounding box centre** of the region's UV box.
Because UV islands of different body parts share that box, the centre often fell
outside the zone: `upper-back` centred on the chest, `lower-back` on the abdomen,
`hand-*` in the gap between islands. The shader's region gate then discarded every
fragment, so the layer existed and nothing was painted.

*Fix:* every slot now carries `anchor` — the interior point measured from the
shipped id map — and placement is centred there.

### T3 — The upper back was labelled as chest (critical)

`classify()` ended with an orientation-blind fallback: *anything unassigned above
y = 1.27 becomes chest*, and the head bone reached down to the shoulder blades.
Measurements on the back of the torso: **24 % head, 56 % upper back** before the fix;
**1 % head, 79 % upper back** after. This also decided which zone a click selected.

*Fix:* the fallback respects `z` (front vs back) and the head bone is clamped to the
shoulder line. One-pixel UV seams are filled before the id map is written, which
removes the speckle the shader used to punch into thin lines.

### T4 — A piece bigger than the skin available (high)

A 34 cm design needs 0.116 m² of skin; the upper back offers 0.087 m². The overrun
was clipped by the region gate, leaving a fragment that read as scattered dots.

*Fix:* placement is sized to the largest square inscribed in the zone's own slice of
the id map, and centred on it. `tests/region-placement.test.ts` asserts that at least
90 % of every default-size placement lands on its zone — measured, not assumed.

### T5 — Opening the studio could do nothing visible (high)

`/studio?design=…` applied the design to `recommendedRegions[0]` and left the camera
on the front view. A back piece (Tsuru → `upper-back`) was applied behind the body.
Repeating the click stacked duplicate layers until the eight-layer budget ran out.

*Fix:* `lib/staging.ts` applies the design to its first recommended zone — the
placement its artist intended — and switches the camera to reveal it. Moving the
camera is free and honest; substituting a different zone would not be. A design
already on the body is selected instead of duplicated, and a full layer budget is
reported instead of silently failing.

### Verified

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vitest run` | **62/62** (8 files: ink atlas, region placement, staging, scene, store, share, placement, catalogue) |
| GLSL injection parse + ordering | 5/5 |
| `anchor-probe` — every slot anchor on its own id | 46/46 |
| `scene-audit` | 0 errors, 0 warnings |
| `next build` | 38/38 static pages |

**Not verified:** the live WebGL frame. This sandbox has no GPU or browser, so the
shader path is proven by rendering the same maths on the same atlas pixels, not by
looking at the canvas. The back zones remain limited to roughly an 11 cm piece — that
is the atlas layout in the source asset, not a placement bug, and is listed below.

## 5a. The structural fix for back coverage — a dedicated ink UV set

The back could never hold a big piece because of the *shape of the chart*, not the maths.
Measured on the male body, `upper-back` was one UV island whose bounding box is 1.25 × 0.90 m
while it carries 0.087 m² of skin — 8 % fill, a snake threaded through the atlas. A square
piece must fit entirely inside the zone (the region gate clips everything else), so the zone
allowed an 11.3 cm square no matter how placement rounded it.

`tools/assets/ink_uv.py` now builds a second UV set (glTF `TEXCOORD_1`, attribute `inkUv`):

* the four torso zones are re-cast as **one chart each**: the script fits the ellipse of the
  torso ring at the zone's mid height, integrates its perimeter, and maps `u` to true arc length
  in metres with `v` = height. `upper-back` stops being a snake and becomes a filled rectangle;
* the head gets the same unroll plus a sinusoidal taper. It was the single worst user of the
  atlas — 5 islands inside a 0.98 × 0.92 m box for 0.22 m² of skin (22 % fill) — and because
  every zone shares one atlas scale, that waste cost ~8 % of texel density on the whole body.
  A closed lat-long chart also has to shrink `u` towards the poles or the crown smears;
* every other zone keeps its authored islands — they are locally isometric — but the islands
  are shelf-packed into a compact cell instead of being left wherever the skin unwrap put them;
* all cells are packed into one atlas at a uniform density (0.45 UV/m male, 0.43 female) with
  12 mm gutters, so a square on the skin is a square in UV;
* **the layout is chosen by measurement**: islands, fixed-ellipse, per-band ellipse and tapered
  ellipse are each rasterised and scored by the largest square that fits, and a candidate within
  2 % of the best is preferred when its cell is smaller. The male chest therefore keeps its
  authored island (a 0.64 × 0.42 m cell) while the upper back switches to the unroll;
* zone boundaries run through triangles, so those vertices are **duplicated per zone** at
  export (`vertexCount` 14 517 → 15 281). Without the split the shader would interpolate
  between two different cells and paint a streak across the boundary. Normals and TEXCOORD_0
  are copied unchanged, so skin shading and the cloth maps are untouched.

`TEXCOORD_0` is unchanged, so the skin albedo/normal/roughness and the garment keep sampling
exactly where they did. `components/three/skin-material.ts` reads `inkUv` for the ink layer,
the region id gate and the highlight mask, and `vSkinUv` for the garment.

### Measured result — largest square piece per zone (cm)

Numbers are what the probe measures on the shipped mesh, not what the maths wishes for: the
piece is placed, the faces inside its square are collected, and their skin area is summed.

| zone | male | female | was (7f43fa0) m / f |
|---|---|---|---|
| head | 22.0 | 21.0 | 25.1 / 24.5 |
| chest | 21.5 | 20.7 | 17.9 / 21.1 |
| abdomen | 20.2 | 19.8 | 19.6 / 19.7 |
| upper-back | **21.1** | **20.2** | 19.9 / 18.7 |
| lower-back | 15.9 | 14.0 | 16.2 / 15.9 |
| shoulder | 13.0–13.5 | 15.9–16.1 | 13.0 / 13.2 |
| arm | 23.1 | 20.1 | 21.5 / 21.6 |
| forearm | 20.4 | 19.3 | 19.9 / 20.0 |
| hand | 8.5 | 8.5 | 7.7 / 7.8 |
| thigh | 39.1 | 39.7 | 39.6 / 38.8 |
| leg | 28.7 | 28.7 | 28.0 / 28.2 |

The back limit was never the chart. With the snake removed, `upper-back` is a 0.32 × 0.38 m
rectangle **filled to 72 %** and still only fits a 20.9 cm square, because the zone's own
silhouette is a barrel: it narrows at the waist and is cut by the shoulders at the top. That is
anatomy, and no unwrap changes it. A piece bigger than ~21 cm needs a different *region model* —
one `back` region spanning upper and lower back, which is also how a back piece is actually
composed. That is a saved-composition change (region ids `4` and `5` merge) and needs a
migration, so it is **not** shipped here; the current limit is honest and visible in the studio,
where the size control announces the clamp before the user commits.

The lower-back regression (16.2 → 16.0) is the garment: the usable square now sits where the
waistband masks ink, and `region_metrics.py` scores the *paintable* square.

### Three measurement defects found on the way

1. **The reported size was not the drawn size.** `uvPerMeter` was the median over the whole
   zone, but a piece sits at one spot. On the chest the local Jacobian is 26 % denser than the
   zone median, so a piece advertised as 20.8 cm covered 16.5 cm of skin, and on the hands the
   error was 40 %. `region_metrics.py` now measures density **exactly the way the probe does**:
   it takes the faces whose three corners are inside the usable square and reports
   `sqrt(Σ areaUv / Σ area3)`. The probe then reads 1.00× on all 18 zones of both bodies, so the
   centimetre on the label is the centimetre on the skin.
2. **One missing texel collapsed the answer.** The largest-inscribed-square DP is exact, so a
   single empty texel on the corner of the best square dropped the reported piece by 20 %.
   Single-texel pinholes are closed before measuring, which is also physically right: a 2 mm
   speck in the gate is invisible on skin.
3. **One UV per vertex smeared faces across the atlas.** Ink UV used to be keyed by
   (vertex, zone). A vertex on a seam belongs to two islands, so one of the two faces got the
   other island's coordinate and was drawn as a streak — 385 head faces spanned up to 98× the
   median edge, which is what painted a dark wedge on the sternum of the editorial render.
   uv1 is now built **per face corner** and `expand()` splits on (vertex, zone, chart, uv), so
   the invariant "uv1 is continuous inside every face" holds by construction; `ink_uv.py`
   rejects any candidate chart whose solid faces exceed 8× the median edge.
4. **A per-height ellipse table shears the chart.** Following the body band by band looks more
   accurate and is worse for artwork: the same angle maps to a different `u` at every height, so
   the upper back came out as a wedge whose inscribed square was 40 % smaller than its bounding
   box. One reference ellipse keeps `u` a pure function of angle; the residual scale drift is
   reported per zone as `scaleP05P95` instead of being hidden. The per-band variant is still
   built as a candidate and the measurement decides.

### Verified without a GPU

The sandbox has no WebGL context, so nothing here claims a visual check. What is executed:

* `tools/checks/ink-uv-probe.mjs` reads the shipped GLB: `TEXCOORD_1` present and complete,
  no vertex shared between two zone charts, no two charts overlapping in the atlas;
* `tools/checks/ink-placement-probe.ts` runs the real placement maths against the real mesh on
  **both bodies** (`npm run check` runs it twice, `male` then `female`): every zone places its
  biggest piece inside its own usable square, and the mesh's own Jacobian inside that piece
  matches the size `regions.json` promises to within 1 %;
* `tools/checks/check_shader.mjs` now also asserts the shader samples ink through `inkUv` and
  keeps the garment on the skin UV set.

### Compatibility

`appliedTattoos` store `bodyRegion` + `offset` + `rotation` + `scale`, never UV coordinates,
so saved compositions, share links and `localStorage` keep loading: the placement is recomputed
from the regenerated `regions.json`. The visible change is that a piece which used to be
silently shrunk by the old 11 cm ceiling now renders at its authored size. That is a bug fix,
not a format change — no schema version bump was needed.

### What is new in the pipeline

* `tools/assets/ink_uv.py` — builds `uv1` + `ink-uv.json` (measured distortion per zone), and
  refuses to run twice on an already-expanded mesh.
* `tools/assets/export_glb.py` — writes `TEXCOORD_1`.
* `tools/assets/bake_regions.py`, `region_metrics.py` — bake and measure in the ink UV space.
* `tools/checks/ink-uv-probe.mjs` — reads the shipped GLB and fails if `TEXCOORD_1` is
  missing (a stale GLB after `build_meshes.py`), if any vertex is shared between two zone
  charts, or if two charts overlap in the atlas.
* `npm run assets:models` = `build_meshes.py && ink_uv.py && export_glb.py`.

## 6. Remaining limitations

1. Both characters share one base mesh and one UV layout; differentiation is morph-based, not sculpted.
2. No skeleton or facial rig — the A-pose and the neutral face are fixed.
3. The brief is a mask, not simulated cloth: no folds, no shadowing beyond the shader's weave.
4. Shadow map is 1024 px and baked contact shadows do not follow the body while it orbits.
5. Textures are WebP; no KTX2/BC7, so mobile pays full decode cost.
6. Tattoos are projected through region UV boxes; they do not wrap around silhouette edges.
7. Ink has its own UV set (see §5a). The remaining size limits are anatomical, not layout
   artefacts: the upper back allows a 20.9 cm square, bounded by how the zone narrows towards
   the waist, and the chest 21.5 cm, bounded by the clavicle. A piece cannot cross a zone
   boundary, because the region gate discards ink outside the zone — so a back piece larger
   than the upper-back zone needs the `back` region merge described in §5a, not a better unwrap.
8. The id raster that gates ink is 1024² over a 2.23 m atlas — 2.2 mm per texel. A piece
   that runs exactly into a zone border can gain or lose ~2 mm there.
9. Chart seams (the branch cut of each torso unroll) are one triangle wide and sit on the
   spine. Artwork that crosses the spine shows a 2–3 mm gap along that line.

## 7. Highest-value next steps

1. A real split "compare" view rather than hiding ink — the studio still only toggles a layer.
2. Per-character height and proportion (Iris at ~1.72 m) so the studio's framing rule has to become
   per-character — the contract already supports it.
3. A geodesic (surface-following) ink chart for sleeves and full wraps: the current chart is a
   developable strip, so a piece that wraps more than half the limb compresses near the seam.
4. KTX2 + Draco for the GLBs to cut first paint on mobile.
