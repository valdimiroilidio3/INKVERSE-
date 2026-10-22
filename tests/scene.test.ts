import { describe, expect, it } from 'vitest';
import {
  CHARACTER_FORWARD,
  CHARACTER_HEIGHT_M,
  FLOOR_RADIUS,
  STUDIO_DISTANCE,
  STUDIO_FOV,
  STUDIO_MAX_DISTANCE,
  STUDIO_MIN_DISTANCE,
  STUDIO_TARGET,
  STUDIO_VIEWS,
  framingAt,
  framingDistance,
} from '@/lib/scene';
import { auditStudioScene, auditTextureBudget, summarise, viewDistances } from '@/lib/scene-audit';
import type { StudioView } from '@/lib/types';

const VIEWS: StudioView[] = ['front', 'back', 'left', 'right'];

describe('studio scene contract', () => {
  it('passes the audit with no error-severity findings', () => {
    const summary = summarise(auditStudioScene());
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
  });

  it('derives the orbit distance from the body height, not a magic number', () => {
    const bare = framingDistance(CHARACTER_HEIGHT_M, STUDIO_FOV, 1);
    expect(bare).toBeCloseTo(1.86 / 2 / Math.tan((STUDIO_FOV * Math.PI) / 360), 3);
    expect(STUDIO_DISTANCE).toBeGreaterThan(bare);
    expect(STUDIO_DISTANCE).toBeCloseTo(framingDistance(CHARACTER_HEIGHT_M, STUDIO_FOV, 1.14), 2);
  });

  it('sees the whole body at the default framing on every view', () => {
    for (const view of VIEWS) {
      const framing = framingAt(STUDIO_DISTANCE, STUDIO_FOV, STUDIO_VIEWS[view][1]);
      expect(framing.ok, view).toBe(true);
      expect(framing.visibleBottom).toBeLessThanOrEqual(0);
      expect(framing.visibleTop).toBeGreaterThanOrEqual(CHARACTER_HEIGHT_M);
    }
  });

  it('puts every view preset at the same distance and inside the orbit limits', () => {
    const distances = viewDistances();
    for (const view of VIEWS) {
      expect(distances[view]).toBeCloseTo(STUDIO_DISTANCE, 2);
      expect(distances[view]).toBeGreaterThanOrEqual(STUDIO_MIN_DISTANCE);
      expect(distances[view]).toBeLessThanOrEqual(STUDIO_MAX_DISTANCE);
    }
  });

  it('keeps the front camera on the side the character faces', () => {
    const [x, y, z] = STUDIO_VIEWS.front;
    const facing = z * Math.sign(CHARACTER_FORWARD[2]);
    expect(facing).toBeGreaterThan(0);
    expect(x).toBe(0);
    expect(z).toBeCloseTo(STUDIO_DISTANCE, 2);
    expect(y).toBeGreaterThan(STUDIO_TARGET[1]);
  });

  it('gives the floor enough reach for the furthest orbit', () => {
    expect(FLOOR_RADIUS).toBeGreaterThan(STUDIO_MAX_DISTANCE * 0.5);
  });
});

describe('scene audit catches regressions', () => {
  // The values below are the ones shipped before the audit existed; each one is a
  // real defect that was visible in the studio.
  it('flags the old 3.05 m framing as cropping the body', () => {
    const summary = summarise(
      auditStudioScene({ view: 'front', camera: [0, 1.14, 3.05], distance: 3.05, targetY: 1.04 }),
    );
    expect(summary.errors).toBeGreaterThan(0);
    expect(summary.worst.join(' ')).toContain('crops');
  });

  it('flags a camera placed behind the character as a wrong front view', () => {
    const findings = auditStudioScene({ view: 'front', camera: [0, 1.05, -STUDIO_DISTANCE] });
    expect(findings.some((f) => f.id === 'orientation.front-camera')).toBe(true);
  });

  it('flags feet that hover above the floor plane', () => {
    const findings = auditStudioScene({ bodyBottom: 0.08, bodyTop: 1.94 });
    expect(findings.some((f) => f.id === 'body.ground-contact')).toBe(true);
  });

  it('flags a body that is not at human scale', () => {
    const findings = auditStudioScene({ bodyBottom: 0, bodyTop: 18.6, bodyHeight: 18.6 });
    expect(findings.some((f) => f.id === 'body.unit-scale' && f.severity === 'error')).toBe(true);
  });
});

describe('texture budget', () => {
  it('accepts the shipped map set', () => {
    const findings = auditTextureBudget([
      // measured from public/textures and lib/atlas.ts
      { name: 'skin', width: 2048, height: 2048 },
      { name: 'skin-normal', width: 1024, height: 1024 },
      { name: 'roughness', width: 512, height: 512 },
      { name: 'region-ids', width: 1024, height: 1024 },
      { name: 'cloth', width: 2048, height: 2048 },
      { name: 'ink-atlas', width: 2048, height: 2048 },
    ]);
    expect(findings.some((f) => f.severity === 'warn')).toBe(false);
  });

  it('warns about oversized maps', () => {
    const findings = auditTextureBudget([{ name: 'huge', width: 4096, height: 4096 }]);
    expect(findings.some((f) => f.id === 'texture.huge.size')).toBe(true);
  });
});
