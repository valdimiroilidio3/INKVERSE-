import type { CharacterModel } from './types';
import { ASSET_VERSION } from './asset-version';

/**
 * Append the asset version to a public file.
 *
 * `public/` is served `Cache-Control: immutable, max-age=31536000`. Without this, a
 * regenerated GLB or region-id map is never re-fetched — and a new `regions.json`
 * against an old GLB puts every tattoo in the wrong place, which is exactly what
 * happened when the ink UV set was re-charted. `ASSET_VERSION` is generated from the
 * ink UV set by `tools/assets/region_metrics.py`.
 */
const v = (path: string) => `${path}?v=${ASSET_VERSION}`;

/**
 * Character catalogue. The GLB files are produced by `npm run assets:models`
 * from the CC0 MakeHuman base mesh (see ASSETS.md). Region metadata comes from
 * `data/regions.json`, which is baked by `npm run assets:regions`.
 */
export const CHARACTERS: CharacterModel[] = [
  {
    id: 'male',
    name: 'Atlas',
    tagline: 'Male · athletic build · 1.86 m',
    modelUrl: v('/models/inkverse-male.glb'),
    regionIdsUrl: v('/models/region-ids-male.png'),
    faceRegionsUrl: v('/models/face-regions-male.bin'),
    thumbnailUrl: '/editorial/character-atlas.webp',
    heightM: 1.86,
    supportedRegions: [
      'head',
      'chest',
      'abdomen',
      'upper-back',
      'lower-back',
      'shoulder-l',
      'shoulder-r',
      'arm-l',
      'arm-r',
      'forearm-l',
      'forearm-r',
      'hand-l',
      'hand-r',
      'thigh-l',
      'thigh-r',
      'leg-l',
      'leg-r',
    ],
    meta: {
      build: 'Athletic, neutral A-pose',
      skin: 'Procedural PBR albedo + AO (baked from topology)',
      source: 'MakeHuman CC0 base mesh, morphed for INKVERSE',
      license: 'CC0 1.0',
    },
  },
  {
    id: 'female',
    name: 'Iris',
    tagline: 'Female · athletic build · 1.86 m',
    modelUrl: v('/models/inkverse-female.glb'),
    regionIdsUrl: v('/models/region-ids-female.png'),
    faceRegionsUrl: v('/models/face-regions-female.bin'),
    thumbnailUrl: '/editorial/character-iris.webp',
    heightM: 1.86,
    supportedRegions: [
      'head',
      'chest',
      'abdomen',
      'upper-back',
      'lower-back',
      'shoulder-l',
      'shoulder-r',
      'arm-l',
      'arm-r',
      'forearm-l',
      'forearm-r',
      'hand-l',
      'hand-r',
      'thigh-l',
      'thigh-r',
      'leg-l',
      'leg-r',
    ],
    meta: {
      build: 'Athletic, neutral A-pose',
      skin: 'Procedural PBR albedo + AO (baked from topology)',
      source: 'MakeHuman CC0 base mesh, morphed for INKVERSE',
      license: 'CC0 1.0',
    },
  },
];

export const DEFAULT_CHARACTER_ID = 'male' satisfies CharacterModel['id'];

export function getCharacter(id: string | undefined | null): CharacterModel {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}
