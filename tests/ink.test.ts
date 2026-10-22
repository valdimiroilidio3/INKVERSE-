import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ATLAS_GRID, ATLAS_TILES, atlasUvFor } from '@/lib/atlas';

const SHADER = fs.readFileSync(path.join(process.cwd(), 'components/three/skin-material.ts'), 'utf8');

describe('ink atlas coordinates', () => {
  it('keeps every tile inside its own quarter of the texture', () => {
    const step = 1 / ATLAS_GRID;
    for (let tile = 0; tile < ATLAS_TILES; tile += 1) {
      const col = tile % ATLAS_GRID;
      const row = Math.floor(tile / ATLAS_GRID);
      for (const [qx, qy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [0.5, 0.5],
      ]) {
        const [u, v] = atlasUvFor(tile, qx!, qy!);
        expect(u).toBeGreaterThanOrEqual(col * step);
        expect(u).toBeLessThanOrEqual((col + 1) * step);
        expect(v).toBeGreaterThanOrEqual(row * step);
        expect(v).toBeLessThanOrEqual((row + 1) * step);
      }
    }
  });

  it('maps the artwork upright: q.y = 1 is the first canvas row of the tile', () => {
    // tile 0 occupies canvas rows 0..511; the top of the art must be row 0.
    const [uTop, vTop] = atlasUvFor(0, 0.5, 1);
    const [, vBottom] = atlasUvFor(0, 0.5, 0);
    expect(uTop).toBeCloseTo(0.125, 6);
    expect(vTop).toBeCloseTo(0, 6);
    expect(vBottom).toBeCloseTo(0.25, 6);
  });

  it('does not mirror the tile grid: tile 4 is one row down, not one row up', () => {
    const [, v0] = atlasUvFor(0, 0.5, 0.5);
    const [, v4] = atlasUvFor(4, 0.5, 0.5);
    expect(v4).toBeGreaterThan(v0);
    expect(v4 - v0).toBeCloseTo(0.25, 6);
  });
});

describe('skin shader matches the atlas contract', () => {
  it('uses the flipY = false mapping', () => {
    // The literal expression the GPU evaluates; guarded separately by
    // tools/checks/ink-probe.mjs, which renders the path.
    expect(SHADER).toContain('tileOrigin.y + (1.0 - q.y) * 0.25');
    expect(SHADER).not.toContain('1.0 - tileOrigin.y - 0.25 + q.y * 0.25');
  });

  it('declares the tile grid the atlas is built with', () => {
    expect(SHADER).toContain('mod(tile, 4.0)');
    expect(SHADER).toContain('floor(tile / 4.0)');
    expect(ATLAS_GRID).toBe(4);
  });
});
