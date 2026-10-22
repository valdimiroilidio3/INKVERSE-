import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { inkDensityFromPixel, PAPER_TONE_INK } from '@/lib/atlas';
import { TATTOO_LIBRARY } from '@/lib/tattoos';

/**
 * Guards the rule that turns artwork into ink density.
 *
 * It exists because of a real regression: a straight `1 − luminance` reading of the
 * catalogue's paper knockouts rendered five designs (lunar-moth, heart-anatomy,
 * rose-noir, dragon-serpent, orchid-line) at ~15 % strength, i.e. practically
 * invisible on skin, while the gallery card looked fine. Both the WebGL atlas
 * (`lib/atlas.ts`) and the offline editorial renderer
 * (`tools/assets/render_editorial.py`) implement this rule, so it is pinned here.
 */

const TATTOOS = path.join(process.cwd(), 'public', 'tattoos');

async function footprintStats(file: string) {
  const { data, info } = await sharp(path.join(TATTOOS, `${file}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const densities: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const d = inkDensityFromPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]! / 255);
    if (data[i + 3]! / 255 > 0.5) densities.push(d);
  }
  const mean = densities.reduce((a, b) => a + b, 0) / densities.length;
  const sorted = [...densities].sort((a, b) => a - b);
  return { mean, p10: sorted[Math.floor(sorted.length * 0.1)]!, count: densities.length, width: info.width };
}

describe('ink density rule', () => {
  it('leaves transparent pixels as skin', () => {
    expect(inkDensityFromPixel(11, 11, 11, 0)).toBe(0);
    expect(inkDensityFromPixel(255, 255, 255, 0)).toBe(0);
  });

  it('keeps catalogue black fully black', () => {
    // #0b0b0b is the pinned ink colour of the vector sources
    expect(inkDensityFromPixel(11, 11, 11, 1)).toBeGreaterThan(0.96);
  });

  it('maps paper knockouts to a light wash rather than bare skin', () => {
    const paper = inkDensityFromPixel(255, 255, 255, 1);
    expect(paper).toBeCloseTo(PAPER_TONE_INK, 6);
    expect(paper).toBeGreaterThan(0.3);
    expect(paper).toBeLessThan(0.5);
  });

  it('keeps relative contrast: darker artwork is always more ink', () => {
    const tones = [0, 64, 128, 192, 255];
    const densities = tones.map((t) => inkDensityFromPixel(t, t, t, 1));
    for (let i = 1; i < densities.length; i += 1) {
      expect(densities[i]!).toBeLessThan(densities[i - 1]!);
    }
  });

  it('does not let a transparent margin carry colour', () => {
    // same artwork, different hidden RGB under a 25 % alpha edge -> same density
    expect(inkDensityFromPixel(11, 11, 11, 0.25)).toBeCloseTo(inkDensityFromPixel(90, 200, 30, 0.25), 1);
  });

  it('renders every catalogue design as visible ink', async () => {
    const weak: string[] = [];
    for (const design of TATTOO_LIBRARY) {
      const stats = await footprintStats(design.id);
      expect(stats.width).toBe(1024);
      if (stats.mean < 0.45) weak.push(`${design.id} (${stats.mean.toFixed(2)})`);
    }
    expect(weak).toEqual([]);
  });

  it('renders the five knockout-dominated designs as readable, not as ghosts', async () => {
    for (const id of ['lunar-moth', 'heart-anatomy', 'rose-noir', 'dragon-serpent', 'orchid-line']) {
      const stats = await footprintStats(id);
      expect(stats.mean, id).toBeGreaterThanOrEqual(0.45);
    }
  });

  it('has a matching density rule in the offline renderer', () => {
    const py = fs.readFileSync(path.join(process.cwd(), 'tools/assets/render_editorial.py'), 'utf8');
    expect(py).toContain('PAPER_TONE_INK');
    // the python module parses the TS constant, so the numbers cannot drift silently
    expect(py).toContain('lib", "atlas.ts"');
  });
});
