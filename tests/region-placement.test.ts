import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getRegions, primarySlot, REGION_ORDER } from '@/lib/regions';
import { computePlacement } from '@/lib/placement';
import { getDesign, TATTOO_LIBRARY } from '@/lib/tattoos';

const ROOT = process.cwd();
const MAPS = { male: null as null | { px: Buffer; size: number }, female: null as null | { px: Buffer; size: number } };

async function idMap(character: 'male' | 'female') {
  if (MAPS[character]) return MAPS[character]!;
  const file = path.join(ROOT, 'public', 'models', `region-ids-${character}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  MAPS[character] = { px: data, size: info.width };
  return MAPS[character]!;
}

/** Sample the region-id map the way the shader does (texture flipY = true). */
function idAt(map: { px: Buffer; size: number }, u: number, v: number) {
  const x = Math.min(map.size - 1, Math.max(0, Math.round(u * (map.size - 1))));
  const y = Math.min(map.size - 1, Math.max(0, Math.round((1 - v) * (map.size - 1))));
  return map.px[(y * map.size + x) * 4];
}

describe('ink lands on its own body zone', () => {
  for (const character of ['male', 'female'] as const) {
    it(`${character}: every region anchors inside its own id`, async () => {
      const map = await idMap(character);
      const regions = getRegions(character);
      expect(regions.length).toBe(REGION_ORDER.length);
      for (const region of regions) {
        for (const slot of region.slots) {
          const anchor = slot.anchor;
          expect(anchor, `${region.id} has no anchor`).toBeTruthy();
          expect(idAt(map, anchor![0], anchor![1]), `${region.id} anchor`).toBe(region.index);
        }
      }
    });

    it(`${character}: a default-size design paints at its placement centre`, async () => {
      const map = await idMap(character);
      const regions = getRegions(character);
      let checked = 0;
      for (const design of TATTOO_LIBRARY) {
        for (const regionId of design.recommendedRegions) {
          const region = regions.find((r) => r.id === regionId);
          const slot = primarySlot(region);
          if (!region || !slot) continue;
          const placement = computePlacement({
            slot,
            designSize: design.defaultSize,
            scale: 1,
            offset: [0, 0],
            rotation: 0,
          });
          // The centre must belong to the zone — that is the condition the shader
          // gate checks per fragment, and a centre on another island means the
          // whole piece is discarded and nothing is painted.
          const [cx, cy] = placement.center;
          expect(idAt(map, cx, cy), `${design.id} centre on ${regionId}`).toBe(region.index);

          // Placement is sized to the largest square that fits inside the zone, so
          // the region gate should have almost nothing left to clip. Anything below
          // this means the artwork is being cut apart on the body.
          const [hx, hy] = placement.half;
          let onZone = 0;
          let total = 0;
          const N = 24;
          for (let i = 0; i < N; i += 1) {
            for (let j = 0; j < N; j += 1) {
              const u = cx - hx + ((i + 0.5) / N) * 2 * hx;
              const v = cy - hy + ((j + 0.5) / N) * 2 * hy;
              total += 1;
              if (idAt(map, u, v) === region.index) onZone += 1;
            }
          }
          expect(
            onZone / total,
            `${design.id} on ${regionId}: only ${Math.round((onZone / total) * 100)}% of the piece lands on the zone`,
          ).toBeGreaterThan(0.9);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(TATTOO_LIBRARY.length);
    });
  }

  it('never places a design outside its own region box', () => {
    for (const character of ['male', 'female'] as const) {
      for (const region of getRegions(character)) {
        for (const slot of region.slots) {
          const placement = computePlacement({
            slot,
            designSize: 0.3,
            scale: 1,
            offset: [0, 0],
            rotation: 0,
          });
          const [u0, v0, u1, v1] = slot.uvBox;
          expect(placement.center[0]).toBeGreaterThanOrEqual(u0);
          expect(placement.center[0]).toBeLessThanOrEqual(u1);
          expect(placement.center[1]).toBeGreaterThanOrEqual(v0);
          expect(placement.center[1]).toBeLessThanOrEqual(v1);
        }
      }
    }
  });
});
