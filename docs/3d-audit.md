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

*Fix:* `lib/staging.ts` chooses the zone and the camera together — the first
recommended zone the opening view can show, otherwise the first usable zone with the
camera that reveals it. A design already on the body is selected instead of duplicated.
When the layer budget is full the studio says so instead of silently failing.

### Verified

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vitest run` | **54/54** (7 files, incl. 5 new ink-atlas tests and 5 placement tests) |
| GLSL injection parse + ordering | 5/5 |
| `anchor-probe` — every slot anchor on its own id | 46/46 |
| `scene-audit` | 0 errors, 0 warnings |
| `next build` | 38/38 static pages |

**Not verified:** the live WebGL frame. This sandbox has no GPU or browser, so the
shader path is proven by rendering the same maths on the same atlas pixels, not by
looking at the canvas. The back zones remain limited to roughly an 11 cm piece — that
is the atlas layout in the source asset, not a placement bug, and is listed below.

## 6. Remaining limitations

1. Both characters share one base mesh and one UV layout; differentiation is morph-based, not sculpted.
2. No skeleton or facial rig — the A-pose and the neutral face are fixed.
3. The brief is a mask, not simulated cloth: no folds, no shadowing beyond the shader's weave.
4. Shadow map is 1024 px and baked contact shadows do not follow the body while it orbits.
5. Textures are WebP; no KTX2/BC7, so mobile pays full decode cost.
6. Tattoos are projected through region UV boxes; they do not wrap around silhouette edges.
7. The back zones occupy a narrow strip of the shared UV atlas, capping a back piece at
   ~11 cm. Fixing it means re-unwrapping the mesh, which changes every stored placement —
   the same trade-off as raising the tattoo atlas to 4K (tiles grow 512 → 1024 px).

## 7. Highest-value next steps

1. Per-character height and proportion (Iris at ~1.72 m) so the studio's framing rule has to become
   per-character — the contract already supports it.
2. A real split "compare" view rather than hiding ink.
3. KTX2 + Draco for the GLBs to cut first paint on mobile.
4. Surface-following tattoo projection (geodesic rather than box UV) for sleeves and wraps.
