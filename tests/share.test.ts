import { describe, expect, it } from 'vitest';
import { decodeComposition, encodeComposition, buildShareUrl } from '@/lib/share';
import type { AppliedTattoo } from '@/lib/types';

const tattoos: AppliedTattoo[] = [
  {
    id: 'a',
    designId: 'rose-noir',
    characterId: 'male',
    bodyRegion: 'forearm-l',
    offset: [0.25, -0.5],
    rotation: 32,
    scale: 1.1,
    opacity: 0.9,
    mirrored: true,
  },
  {
    id: 'b',
    designId: 'lunar-moth',
    characterId: 'male',
    bodyRegion: 'chest',
    offset: [0, 0.2],
    rotation: 0,
    scale: 0.8,
    opacity: 1,
    mirrored: false,
  },
];

describe('share links', () => {
  it('round-trips a composition', () => {
    const encoded = encodeComposition({ name: 'Nocturne', characterId: 'male', tattoos });
    const decoded = decodeComposition(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe('Nocturne');
    expect(decoded?.characterId).toBe('male');
    expect(decoded?.tattoos).toHaveLength(2);
    expect(decoded?.tattoos[0]).toMatchObject({
      designId: 'rose-noir',
      bodyRegion: 'forearm-l',
      rotation: 32,
      mirrored: true,
    });
  });

  it('rejects malformed payloads instead of throwing', () => {
    expect(decodeComposition('')).toBeNull();
    expect(decodeComposition('not-base64')).toBeNull();
    expect(decodeComposition(btoa('{"v":2,"n":"x","ch":"male","t":[]}'))).toBeNull();
    expect(decodeComposition(btoa('{"v":1,"n":"x","ch":"alien","t":[]}'))).toBeNull();
  });

  it('rejects links beyond the supported length', () => {
    expect(decodeComposition('a'.repeat(1800))).toBeNull();
  });

  it('builds an absolute url', () => {
    expect(buildShareUrl('https://inkverse.studio/', 'abc')).toBe('https://inkverse.studio/studio?c=abc');
  });
});
