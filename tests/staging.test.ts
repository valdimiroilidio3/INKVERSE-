import { describe, expect, it } from 'vitest';
import { getCharacter } from '@/lib/characters';
import { getDesign, TATTOO_LIBRARY } from '@/lib/tattoos';
import { MAX_TATTOOS } from '@/lib/schemas';
import { isFrontFacing, planStaging, regionView, stagingMessage } from '@/lib/staging';

const character = getCharacter('male');

function planFor(designId: string, tattoos: { id: string; designId: string; bodyRegion: string }[] = []) {
  const design = getDesign(designId);
  if (!design) throw new Error(`missing design ${designId}`);
  return planStaging({
    design,
    supportedRegions: character.supportedRegions,
    tattoos,
    maxTattoos: MAX_TATTOOS,
    characterId: 'male',
  });
}

describe('try in 3D staging', () => {
  it('places a back design and switches to the back camera', () => {
    // Tsuru is authored for the upper back first: applying it and staying on the
    // front view looked like the button did nothing.
    const design = getDesign('crane-tsuru')!;
    expect(design.recommendedRegions[0]).toBe('upper-back');

    const plan = planFor('crane-tsuru');
    expect(plan.status).toBe('placed');
    expect(plan.regionId).toBe('upper-back');
    expect(plan.view).toBe('back');
  });

  it('honours the authoring preference and moves the camera to reveal it', () => {
    // Lunar Moth recommends the chest, which the front camera already shows.
    const plan = planFor('lunar-moth');
    expect(plan.status).toBe('placed');
    expect(plan.regionId).toBe('chest');
    expect(plan.view).toBe('front');
  });

  it('uses the first recommended zone, not a convenient one', () => {
    // Tsuru is authored for the back first; it also lists an arm. The arm would be
    // visible without moving the camera, but placing it there would be a lie.
    const design = getDesign('crane-tsuru')!;
    const plan = planFor('crane-tsuru');
    expect(plan.regionId).toBe(design.recommendedRegions[0]);
    expect(plan.view).toBe('back');
  });

  it('keeps the front camera for every zone it can show', () => {
    for (const region of character.supportedRegions) {
      if (isFrontFacing(region)) expect(regionView(region)).toBe('front');
      else expect(regionView(region)).toBe('back');
    }
    for (const plan of TATTOO_LIBRARY.map((d) => planFor(d.id))) {
      if (plan.regionId) expect(plan.view).toBe(regionView(plan.regionId));
    }
  });

  it('selects an existing layer instead of stacking a duplicate', () => {
    const existing = { id: 'layer-1', designId: 'lunar-moth', bodyRegion: 'chest' };
    const plan = planFor('lunar-moth', [existing]);
    expect(plan.status).toBe('already-applied');
    expect(plan.existingId).toBe('layer-1');
    expect(plan.regionId).toBe('chest');
    expect(plan.view).toBe('front');
  });

  it('refuses honestly when the layer budget is full', () => {
    const full = Array.from({ length: MAX_TATTOOS }, (_, i) => ({
      id: `layer-${i}`,
      designId: 'rose-noir',
      bodyRegion: 'forearm-l',
    }));
    const plan = planFor('lunar-moth', full);
    expect(plan.status).toBe('full');
    expect(plan.regionId).toBeNull();
    expect(stagingMessage(plan, getDesign('lunar-moth')!, 'Chest')).toMatch(/eight layers/i);
  });

  it('never returns a zone the character does not support', () => {
    for (const design of TATTOO_LIBRARY) {
      const plan = planFor(design.id);
      if (plan.regionId) {
        expect(character.supportedRegions).toContain(plan.regionId);
        expect(design.recommendedRegions).toContain(plan.regionId);
      }
    }
  });

  it('writes a sentence that names the design and the zone', () => {
    const design = getDesign('crane-tsuru')!;
    const plan = planFor('crane-tsuru');
    const message = stagingMessage(plan, design, 'Upper back');
    expect(message).toContain(design.name);
    expect(message).toContain('Upper back');
  });
});
