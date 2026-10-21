import type { AppliedTattoo, CharacterRegionSlot, Placement } from './types';

export interface PlacementRequest {
  slot: CharacterRegionSlot;
  designSize: number;
  scale: number;
  offset: [number, number];
  rotation: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Turns a design + region slot into a UV placement.
 *
 * The design is authored as a square plate. `uvPerMeterX/Y` (UV units per
 * metre, measured from the actual mesh Jacobian during the asset build) let us
 * keep that square physically square on the skin — no matter how the UV island
 * is stretched. The result is clamped so the piece never leaves its region box.
 */
export function computePlacement({
  slot,
  designSize,
  scale,
  offset,
  rotation,
}: PlacementRequest): Placement {
  const [u0, v0, u1, v1] = slot.uvBox;
  const boxW = Math.max(1e-5, u1 - u0);
  const boxH = Math.max(1e-5, v1 - v0);

  const requested = Math.max(0.02, designSize * clamp(scale, 0.1, 3));
  // physical half-extents converted into UV, per axis
  let hx = 0.5 * requested * slot.uvPerMeterX;
  let hy = 0.5 * requested * slot.uvPerMeterY;

  const theta = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));

  // rotated AABB in UV
  const extentX = hx * cos + hy * sin;
  const extentY = hx * sin + hy * cos;

  const maxX = (boxW * 0.98) / 2;
  const maxY = (boxH * 0.98) / 2;
  let shrink = 1;
  if (extentX > maxX) shrink = Math.min(shrink, maxX / extentX);
  if (extentY > maxY) shrink = Math.min(shrink, maxY / extentY);
  const clamped = shrink < 0.999;
  if (clamped) {
    hx *= shrink;
    hy *= shrink;
  }

  const ex = hx * cos + hy * sin;
  const ey = hx * sin + hy * cos;
  const slackX = Math.max(0, boxW / 2 - ex);
  const slackY = Math.max(0, boxH / 2 - ey);
  const ox = clamp(offset[0], -1, 1);
  const oy = clamp(offset[1], -1, 1);

  const center: [number, number] = [
    clamp(u0 + boxW / 2 + ox * slackX, u0 + ex, u1 - ex),
    clamp(v0 + boxH / 2 + oy * slackY, v0 + ey, v1 - ey),
  ];

  return {
    center,
    half: [hx, hy],
    sizeMeters: (2 * hx) / slot.uvPerMeterX,
    clamped,
  };
}

/** The four UV corners of the placed square, for selection outlines in the UI. */
export function placementCorners(placement: Placement, rotation: number): [number, number][] {
  const theta = (rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const [cx, cy] = placement.center;
  const [hx, hy] = placement.half;
  const corners: [number, number][] = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ];
  return corners.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos] as [number, number]);
}

export interface ShaderTransform {
  center: [number, number];
  half: [number, number];
  rotation: number;
  opacity: number;
  regionIndex: number;
  tile: number;
  mirrored: boolean;
}

export function shaderTransform(
  tattoo: AppliedTattoo,
  slot: CharacterRegionSlot,
  designSize: number,
  regionIndex: number,
  tile: number,
): ShaderTransform {
  const placement = computePlacement({
    slot,
    designSize,
    scale: tattoo.scale,
    offset: tattoo.offset,
    rotation: tattoo.rotation,
  });
  return {
    center: placement.center,
    half: placement.half,
    rotation: (tattoo.rotation * Math.PI) / 180,
    opacity: tattoo.opacity,
    regionIndex,
    tile,
    mirrored: tattoo.mirrored,
  };
}

/** Human readable physical size, e.g. "24 × 24 cm". */
export function formatPlacementSize(sizeMeters: number): string {
  const cm = Math.round(sizeMeters * 100);
  return `${cm} × ${cm} cm`;
}
