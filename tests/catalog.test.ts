import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CHARACTERS, getCharacter } from '@/lib/characters';
import { TATTOO_LIBRARY, FEATURED_DESIGNS, ARTISTS, STYLE_COUNTS, getDesign } from '@/lib/tattoos';
import { getRegions } from '@/lib/regions';
import { TATTOO_STYLES } from '@/lib/types';
import { MAX_TATTOOS } from '@/lib/schemas';

const ROOT = process.cwd();
const exists = (publicPath: string) => fs.existsSync(path.join(ROOT, 'public', publicPath.replace(/^\//, '')));

describe('tattoo catalogue', () => {
  it('has a unique id and slug for every design', () => {
    const ids = new Set(TATTOO_LIBRARY.map((design) => design.id));
    const slugs = new Set(TATTOO_LIBRARY.map((design) => design.slug));
    expect(ids.size).toBe(TATTOO_LIBRARY.length);
    expect(slugs.size).toBe(TATTOO_LIBRARY.length);
  });

  it('uses every declared style and keeps counts accurate', () => {
    for (const style of TATTOO_STYLES) {
      const declared = STYLE_COUNTS[style] ?? 0;
      const actual = TATTOO_LIBRARY.filter((design) => design.style === style).length;
      expect(actual, style).toBe(declared);
      expect(actual, style).toBeGreaterThan(0);
    }
    expect(Object.values(STYLE_COUNTS).reduce((sum, n) => sum + n, 0)).toBe(TATTOO_LIBRARY.length);
  });

  it('recommends only real body zones', () => {
    const regions = new Set(getRegions('male').map((region) => region.id));
    for (const design of TATTOO_LIBRARY) {
      expect(design.recommendedRegions.length).toBeGreaterThan(0);
      for (const region of design.recommendedRegions) {
        expect(regions.has(region), `${design.id} -> ${region}`).toBe(true);
      }
    }
  });

  it('ships a rendered webp card for every design', () => {
    for (const design of TATTOO_LIBRARY) {
      expect(exists(design.imageUrl), design.imageUrl).toBe(true);
    }
  });

  it('references known artists and featured designs', () => {
    const artists = new Set(ARTISTS);
    for (const design of TATTOO_LIBRARY) {
      expect(artists.has(design.artist), design.artist).toBe(true);
    }
    for (const design of FEATURED_DESIGNS) {
      expect(getDesign(design.id)).toBeDefined();
    }
    expect(FEATURED_DESIGNS.length).toBeGreaterThanOrEqual(6);
  });

  it('keeps default sizes inside the editor range', () => {
    for (const design of TATTOO_LIBRARY) {
      expect(design.defaultSize).toBeGreaterThanOrEqual(0.02);
      expect(design.defaultSize).toBeLessThanOrEqual(0.4);
    }
  });

  it('exposes no more than eight layers', () => {
    expect(MAX_TATTOOS).toBe(8);
  });
});

describe('characters and assets', () => {
  it('has both studio characters', () => {
    expect(CHARACTERS.map((c) => c.id).sort()).toEqual(['female', 'male']);
  });

  it('ships every asset a character references', () => {
    const shared = [
      '/textures/skin-normal.webp',
      '/textures/skin-roughness.webp',
      '/editorial/hero-atlas.webp',
      '/editorial/hero-iris.webp',
      '/editorial/studio-chest.webp',
      '/brand/favicon.svg',
    ];
    for (const asset of shared) {
      expect(exists(asset), asset).toBe(true);
    }
    for (const id of ['male', 'female'] as const) {
      const character = getCharacter(id);
      for (const asset of [character.modelUrl, character.regionIdsUrl, character.thumbnailUrl]) {
        expect(exists(asset), asset).toBe(true);
      }
      expect(exists(`/textures/skin-${id}.webp`), id).toBe(true);
      expect(exists(`/textures/cloth-${id}.webp`), id).toBe(true);
    }
  });

  it('defines 17 mapped regions per character', () => {
    for (const id of ['male', 'female'] as const) {
      expect(getRegions(id)).toHaveLength(17);
    }
  });
});
