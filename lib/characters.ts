import type { CharacterModel } from './types';

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
    modelUrl: '/models/inkverse-male.glb',
    regionIdsUrl: '/models/region-ids-male.png',
    faceRegionsUrl: '/models/face-regions-male.bin',
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
    modelUrl: '/models/inkverse-female.glb',
    regionIdsUrl: '/models/region-ids-female.png',
    faceRegionsUrl: '/models/face-regions-female.bin',
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
