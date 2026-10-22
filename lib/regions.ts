import regionsData from '@/data/regions.json';
import type { CharacterModel, CharacterRegion, CharacterRegionSlot, RegionGroup } from './types';
import { ASSET_VERSION } from './asset-version';

interface RawSlot {
  uvBox: number[];
  physical: number[];
  faces: number;
  uvPerMeter?: number;
  uvPerMeterX?: number;
  uvPerMeterY?: number;
  boxMeters?: number[];
  areaM2?: number;
  anchor?: number[];
  anchorRadius?: number;
  square?: number[];
}

interface RawRegion {
  uvBox: number[];
  physical: number[];
  vertices: number;
  slots: RawSlot[];
}

interface RawRegions {
  maskSize: number;
  regions: { id: string; label: string; group: string; side: 'left' | 'right' | 'center'; index: number }[];
  characters: Record<string, Record<string, RawRegion>>;
}

const raw = regionsData as unknown as RawRegions;

export const MASK_SIZE = raw.maskSize;

const REGION_META = raw.regions;

export const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGION_META.map((r) => [r.id, r.label]),
);

export const REGION_ORDER: string[] = REGION_META.map((r) => r.id);

export const REGION_INDEX: Record<string, number> = Object.fromEntries(
  REGION_META.map((r) => [r.id, r.index]),
);

export const REGION_SIDE: Record<string, 'left' | 'right' | 'center'> = Object.fromEntries(
  REGION_META.map((r) => [r.id, r.side]),
);

export const REGION_GROUPS: RegionGroup[] = [
  'Head & neck',
  'Chest',
  'Abdomen',
  'Upper back',
  'Lower back',
  'Shoulders',
  'Upper arms',
  'Forearms',
  'Hands',
  'Thighs',
  'Lower legs',
];

function slotFrom(raw: RawSlot): CharacterRegionSlot | null {
  if (!raw.uvPerMeterX || !raw.uvPerMeterY || !raw.uvPerMeter) return null;
  const [u0, v0, u1, v1] = raw.uvBox as [number, number, number, number];
  return {
    uvBox: [u0, v0, u1, v1],
    uvPerMeterX: raw.uvPerMeterX,
    uvPerMeterY: raw.uvPerMeterY,
    uvPerMeter: raw.uvPerMeter,
    boxMeters: [raw.boxMeters?.[0] ?? (u1 - u0) / raw.uvPerMeterX, raw.boxMeters?.[1] ?? (v1 - v0) / raw.uvPerMeterY],
    areaM2: raw.areaM2 ?? 0,
    anchor: raw.anchor && raw.anchor.length >= 2 ? [raw.anchor[0]!, raw.anchor[1]!] : undefined,
    anchorRadius: raw.anchorRadius,
    square:
      raw.square && raw.square.length >= 3
        ? [raw.square[0]!, raw.square[1]!, raw.square[2]!]
        : undefined,
  };
}

export function getRegions(characterId: CharacterModel['id']): CharacterRegion[] {
  const char = raw.characters[characterId] ?? raw.characters.male ?? {};
  const out: CharacterRegion[] = [];
  for (const meta of REGION_META) {
    const data = char[meta.id];
    if (!data) continue;
    const slots = data.slots.map(slotFrom).filter((s): s is CharacterRegionSlot => s !== null);
    if (!slots.length) continue;
    out.push({
      id: meta.id,
      label: meta.label,
      group: meta.group as RegionGroup,
      side: meta.side,
      index: meta.index,
      slots,
    });
  }
  return out;
}

/** Pick the largest slot of a region (the one used for placement). */
export function primarySlot(region: CharacterRegion | undefined): CharacterRegionSlot | null {
  if (!region || region.slots.length === 0) return null;
  return [...region.slots].sort((a, b) => b.areaM2 - a.areaM2)[0] ?? null;
}

export function getRegion(
  characterId: CharacterModel['id'],
  regionId: string,
): CharacterRegion | undefined {
  return getRegions(characterId).find((r) => r.id === regionId);
}

/** Region mask path used for the 3D highlight. Male masks are the canonical set. */
export function regionMaskUrl(regionId: string, characterId: CharacterModel['id']): string {
  const path =
    characterId === 'male'
      ? `/tattoos/masks/${regionId}.png`
      : `/tattoos/masks/${regionId}-${characterId}.png`;
  // masks are baked in ink UV space, so they change with the UV set: never let the
  // immutable cache pair a stale mask with a fresh GLB
  return `${path}?v=${ASSET_VERSION}`;
}

/** Default region for the studio when nothing is selected. */
export const DEFAULT_REGION = 'forearm-l';
