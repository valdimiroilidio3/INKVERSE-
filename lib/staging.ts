/**
 * Staging rules for "Try in 3D studio".
 *
 * A design can be authored for several body zones, and the studio has four fixed
 * cameras. Sending a piece to a zone the current camera cannot see makes the
 * studio look broken — the layer exists, the ink is simply behind the body.
 * These rules pick the zone *and* the camera together, so what the visitor opens
 * is always the thing they clicked.
 */

import type { CharacterModel, StudioView, TattooDesign } from './types';

/** Zones that are only visible from the back camera. Everything else reads from the front. */
const BACK_ONLY = new Set(['upper-back', 'lower-back']);

/** The camera that shows a zone. */
export function regionView(regionId: string): StudioView {
  return BACK_ONLY.has(regionId) ? 'back' : 'front';
}

/** True when the zone is visible from the camera the studio opens on. */
export function isFrontFacing(regionId: string): boolean {
  return regionView(regionId) === 'front';
}

export type StagingStatus = 'placed' | 'already-applied' | 'full' | 'no-zone';

export interface StagingPlan {
  status: StagingStatus;
  /** Zone to apply to (or the existing zone when the design is already applied). */
  regionId: string | null;
  /** Camera to switch to so the result is visible. */
  view: StudioView;
  /** Existing layer id when the design is already on the body. */
  existingId?: string;
}

export interface StagingInput {
  design: TattooDesign;
  /** Zones that exist on the current character. */
  supportedRegions: readonly string[];
  /** Layers already applied, newest last. */
  tattoos: { id: string; designId: string; bodyRegion: string }[];
  maxTattoos: number;
  characterId: CharacterModel['id'];
}

/**
 * Decide what "Try in 3D" should do.
 *
 * 1. If the design is already on the body, point at it instead of stacking a twin.
 * 2. Otherwise use the design's first recommended zone — that is the placement its
 *    artist intended — and switch the camera to reveal it. Moving the camera is
 *    free and honest; substituting a different zone is neither.
 * 3. Refuse honestly when the body or the layer budget cannot take it.
 */
export function planStaging({ design, supportedRegions, tattoos, maxTattoos }: StagingInput): StagingPlan {
  const existing = tattoos.find((t) => t.designId === design.id);
  if (existing) {
    return {
      status: 'already-applied',
      regionId: existing.bodyRegion,
      view: regionView(existing.bodyRegion),
      existingId: existing.id,
    };
  }

  const usable = design.recommendedRegions.filter((region) => supportedRegions.includes(region));
  if (usable.length === 0) {
    return { status: 'no-zone', regionId: null, view: 'front' };
  }
  if (tattoos.length >= maxTattoos) {
    return { status: 'full', regionId: null, view: 'front' };
  }

  const regionId = usable[0]!;
  return { status: 'placed', regionId, view: regionView(regionId) };
}

/** User-facing sentence for a staging outcome. */
export function stagingMessage(plan: StagingPlan, design: TattooDesign, label: string): string {
  switch (plan.status) {
    case 'placed':
      return `${design.name} applied to ${label}.`;
    case 'already-applied':
      return `${design.name} is already on the ${label.toLowerCase()} — selected it instead of adding a second copy.`;
    case 'full':
      return `All eight layers are in use. Remove one to try ${design.name}.`;
    case 'no-zone':
      return `${design.name} has no zone mapped on this character yet.`;
  }
}
