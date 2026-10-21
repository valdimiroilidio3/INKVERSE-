/**
 * INKVERSE® domain types.
 * Everything that crosses a boundary (storage, URLs, network) is validated by
 * the zod schemas in `lib/schemas.ts` before it is trusted.
 */

export const TATTOO_STYLES = [
  'blackwork',
  'japanese',
  'fine-line',
  'realism',
  'tribal',
  'geometric',
  'traditional',
  'abstract',
  'lettering',
  'minimal',
] as const;

export type TattooStyle = (typeof TATTOO_STYLES)[number];

export const STYLE_LABELS: Record<TattooStyle, string> = {
  blackwork: 'Blackwork',
  japanese: 'Japanese',
  'fine-line': 'Fine Line',
  realism: 'Realism',
  tribal: 'Tribal',
  geometric: 'Geometric',
  traditional: 'Traditional',
  abstract: 'Abstract',
  lettering: 'Lettering',
  minimal: 'Minimal',
};

export type RegionGroup =
  | 'Head & neck'
  | 'Chest'
  | 'Abdomen'
  | 'Upper back'
  | 'Lower back'
  | 'Shoulders'
  | 'Upper arms'
  | 'Forearms'
  | 'Hands'
  | 'Thighs'
  | 'Lower legs';

export interface TattooDesign {
  id: string;
  name: string;
  slug: string;
  style: TattooStyle;
  /** Gallery card (dark, editorial) 640² webp */
  imageUrl: string;
  /** Ink plate in UV space: black ink on transparency, 1024² png */
  inkUrl: string;
  recommendedRegions: string[];
  artist: string;
  description: string;
  tags: string[];
  licensing: string;
  /** Physical size in metres for a 1.0 scale placement */
  defaultSize: number;
  /** Optional design-level ink tint override */
  inkTint?: string;
  featured?: boolean;
  year: number;
}

export interface CharacterRegionSlot {
  uvBox: [number, number, number, number];
  uvPerMeterX: number;
  uvPerMeterY: number;
  uvPerMeter: number;
  boxMeters: [number, number];
  areaM2: number;
}

export interface CharacterRegion {
  id: string;
  label: string;
  group: RegionGroup;
  side: 'left' | 'right' | 'center';
  index: number;
  slots: CharacterRegionSlot[];
}

export interface CharacterModel {
  id: 'male' | 'female';
  name: string;
  tagline: string;
  modelUrl: string;
  regionIdsUrl: string;
  faceRegionsUrl: string;
  thumbnailUrl: string;
  heightM: number;
  supportedRegions: string[];
  meta: {
    build: string;
    skin: string;
    source: string;
    license: string;
  };
}

export interface AppliedTattoo {
  id: string;
  designId: string;
  characterId: CharacterModel['id'];
  bodyRegion: string;
  /** Normalised offset inside the region slot, -1..1 */
  offset: [number, number];
  /** Clockwise rotation in degrees */
  rotation: number;
  /** Multiplier over the design default size */
  scale: number;
  /** 0..1 ink density */
  opacity: number;
  mirrored: boolean;
}

export interface TattooComposition {
  id: string;
  name: string;
  characterId: CharacterModel['id'];
  appliedTattoos: AppliedTattoo[];
  createdAt: string;
  updatedAt: string;
}

export type StudioView = 'front' | 'back' | 'left' | 'right';

export interface Placement {
  /** UV centre of the tattoo square */
  center: [number, number];
  /** UV half-extents before rotation (physically square) */
  half: [number, number];
  /** Final size in metres after clamping */
  sizeMeters: number;
  /** Whether the request was clamped by the region box */
  clamped: boolean;
}
