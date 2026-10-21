import { describe, expect, it } from 'vitest';
import { computePlacement, formatPlacementSize, placementCorners } from '@/lib/placement';
import { getRegions, primarySlot } from '@/lib/regions';
import type { CharacterRegionSlot } from '@/lib/types';

const slot: CharacterRegionSlot = {
  uvBox: [0.2, 0.3, 0.6, 0.7],
  uvPerMeterX: 0.5,
  uvPerMeterY: 1.2,
  uvPerMeter: 0.85,
  boxMeters: [0.8, 0.33],
  areaM2: 0.1,
};

describe('computePlacement', () => {
  it('keeps a square design physically square on skin', () => {
    const placement = computePlacement({ slot, designSize: 0.2, scale: 1, offset: [0, 0], rotation: 0 });
    expect(placement.half[0] / slot.uvPerMeterX).toBeCloseTo(placement.half[1] / slot.uvPerMeterY, 6);
    expect(placement.sizeMeters).toBeCloseTo(0.2, 4);
  });

  it('centres the design when no offset is given', () => {
    const placement = computePlacement({ slot, designSize: 0.1, scale: 1, offset: [0, 0], rotation: 0 });
    expect(placement.center[0]).toBeCloseTo(0.4, 6);
    expect(placement.center[1]).toBeCloseTo(0.5, 6);
  });

  it('clamps an oversized design into the region box', () => {
    const placement = computePlacement({ slot, designSize: 4, scale: 1.8, offset: [0, 0], rotation: 0 });
    expect(placement.clamped).toBe(true);
    const [u0, v0, u1, v1] = slot.uvBox;
    expect(placement.center[0] - placement.half[0]).toBeGreaterThanOrEqual(u0 - 1e-6);
    expect(placement.center[0] + placement.half[0]).toBeLessThanOrEqual(u1 + 1e-6);
    expect(placement.center[1] - placement.half[1]).toBeGreaterThanOrEqual(v0 - 1e-6);
    expect(placement.center[1] + placement.half[1]).toBeLessThanOrEqual(v1 + 1e-6);
  });

  it('never leaves the box at maximum offset and rotation', () => {
    for (const rotation of [0, 45, 90, 135, -90]) {
      for (const offset of [[1, 1], [-1, -1], [1, -1], [0.5, 0.9]] as [number, number][]) {
        const placement = computePlacement({ slot, designSize: 0.18, scale: 1, offset, rotation });
        const corners = placementCorners(placement, rotation);
        const [u0, v0, u1, v1] = slot.uvBox;
        const eps = 1e-6;
        for (const [u, v] of corners) {
          expect(u).toBeGreaterThanOrEqual(u0 - eps);
          expect(u).toBeLessThanOrEqual(u1 + eps);
          expect(v).toBeGreaterThanOrEqual(v0 - eps);
          expect(v).toBeLessThanOrEqual(v1 + eps);
        }
      }
    }
  });

  it('works on every real region of both characters', () => {
    for (const character of ['male', 'female'] as const) {
      for (const region of getRegions(character)) {
        const primary = primarySlot(region);
        expect(primary, `${character}/${region.id}`).not.toBeNull();
        if (!primary) continue;
        const placement = computePlacement({
          slot: primary,
          designSize: 0.2,
          scale: 1,
          offset: [0.4, -0.3],
          rotation: 30,
        });
        expect(Number.isFinite(placement.center[0])).toBe(true);
        expect(Number.isFinite(placement.center[1])).toBe(true);
        expect(placement.sizeMeters).toBeGreaterThan(0);
        expect(placement.sizeMeters).toBeLessThanOrEqual(0.2 + 1e-9);
      }
    }
  });
});

describe('formatPlacementSize', () => {
  it('reports the physical size in centimetres', () => {
    expect(formatPlacementSize(0.24)).toBe('24 × 24 cm');
  });
});
