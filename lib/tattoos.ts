import type { TattooDesign, TattooStyle } from './types';

interface Seed {
  id: string;
  name: string;
  style: TattooStyle;
  artist: string;
  regions: string[];
  size: number;
  year: number;
  description: string;
  tags: string[];
  featured?: boolean;
}

const LICENSE =
  'Original artwork created for INKVERSE®. Licensed for this demo experience; not cleared for commercial tattoo reproduction.';

/**
 * Artists are fictional residents of the INKVERSE studio — see ASSETS.md.
 * Every design below is original vector artwork authored for this project.
 */
const SEEDS: Seed[] = [
  {
    id: 'crane-tsuru',
    name: 'Tsuru, Ascending',
    style: 'japanese',
    artist: 'Mara Voss',
    regions: ['upper-back', 'arm-l', 'arm-r', 'thigh-l'],
    size: 0.3,
    year: 2025,
    description:
      'An origami crane folded from pure negative space. Built on a single circular frame so it reads as a seal from a distance and as folded planes up close.',
    tags: ['irezumi', 'crane', 'negative space', 'seal'],
    featured: true,
  },
  {
    id: 'hannya-vigil',
    name: 'Hannya Vigil',
    style: 'japanese',
    artist: 'Ilya Ren',
    regions: ['upper-back', 'arm-r', 'thigh-r'],
    size: 0.26,
    year: 2024,
    description:
      'The hannya mask carved down to its essential planes — horns, brow and fangs held in a heavy black silhouette. A protective piece for the shoulder blades.',
    tags: ['hannya', 'mask', 'irezumi', 'protection'],
    featured: true,
  },
  {
    id: 'kiku-wave',
    name: 'Kiku Wave',
    style: 'japanese',
    artist: 'Sofia Aoki',
    regions: ['upper-back', 'thigh-l', 'chest'],
    size: 0.3,
    year: 2025,
    description:
      'A chrysanthemum opening above an ornamental wave. Two radii, two rhythms: the flower holds still while the water travels.',
    tags: ['chrysanthemum', 'wave', 'botanical'],
  },
  {
    id: 'dragon-serpent',
    name: 'Dragon Eye',
    style: 'japanese',
    artist: 'Ilya Ren',
    regions: ['upper-back', 'chest', 'thigh-r'],
    size: 0.32,
    year: 2023,
    description:
      'A macro study of a dragon’s eye, ringed by scales and smoke. The slit pupil is the only empty white in the composition.',
    tags: ['dragon', 'eye', 'scales', 'macro'],
    featured: true,
  },
  {
    id: 'rose-noir',
    name: 'Rose Noir',
    style: 'realism',
    artist: 'Mara Voss',
    regions: ['forearm-l', 'forearm-r', 'shoulder-l', 'thigh-l'],
    size: 0.2,
    year: 2024,
    description:
      'Line-work rose with tonal hatching and a calyx that trails into the stem. Designed to wrap with the forearm rather than sit flat on it.',
    tags: ['rose', 'botanical', 'hatching', 'wrap'],
    featured: true,
  },
  {
    id: 'eye-of-storm',
    name: 'Eye of Storm',
    style: 'blackwork',
    artist: 'Noor Haddad',
    regions: ['upper-back', 'forearm-r', 'chest'],
    size: 0.22,
    year: 2025,
    description:
      'An all-seeing eye inside a calibrated ray field. Every third ray is broken so the halo breathes instead of vibrating.',
    tags: ['eye', 'rays', 'dotwork', 'sacred'],
    featured: true,
  },
  {
    id: 'skull-memento',
    name: 'Skull, Memento',
    style: 'realism',
    artist: 'Davi Kosta',
    regions: ['forearm-l', 'thigh-r', 'upper-back'],
    size: 0.17,
    year: 2023,
    description:
      'A skull that leans on dotwork instead of gradients. The cranium stays open paper so the skin itself becomes the light.',
    tags: ['skull', 'memento', 'dotwork'],
  },
  {
    id: 'orchid-line',
    name: 'Orchid Line',
    style: 'fine-line',
    artist: 'Sofia Aoki',
    regions: ['forearm-r', 'thigh-l', 'hand-l', 'leg-l'],
    size: 0.16,
    year: 2025,
    description:
      'Single-weight orchid drawn in one continuous gesture. Fine enough for a forearm, structured enough to survive a calf.',
    tags: ['orchid', 'single needle', 'botanical'],
    featured: true,
  },
  {
    id: 'lunar-moth',
    name: 'Lunar Moth',
    style: 'fine-line',
    artist: 'Sofia Aoki',
    regions: ['chest', 'upper-back', 'forearm-l'],
    size: 0.24,
    year: 2024,
    description:
      'A moth held against a dotted moon, wings open in perfect symmetry. The eye spots are solid black to anchor the sternum piece.',
    tags: ['moth', 'moon', 'symmetry', 'wings'],
    featured: true,
  },
  {
    id: 'heart-anatomy',
    name: 'Heart, Anatomical',
    style: 'fine-line',
    artist: 'Davi Kosta',
    regions: ['chest', 'forearm-r'],
    size: 0.18,
    year: 2024,
    description:
      'An anatomical heart with hatched chambers and clean vessels. Drawn to sit slightly left of centre on the chest — where it belongs.',
    tags: ['heart', 'anatomy', 'hatching'],
  },
  {
    id: 'monolith',
    name: 'Monolith',
    style: 'blackwork',
    artist: 'Noor Haddad',
    regions: ['upper-back', 'thigh-l'],
    size: 0.3,
    year: 2025,
    description:
      'Three stacked mask forms in solid black, interrupted by a single circular aperture. Brutalist geometry for a large surface.',
    tags: ['brutalist', 'geometry', 'aperture'],
  },
  {
    id: 'ivy-rite',
    name: 'Ivy Rite',
    style: 'blackwork',
    artist: 'Juno Reyes',
    regions: ['arm-l', 'forearm-l', 'thigh-r'],
    size: 0.22,
    year: 2023,
    description:
      'A single ivy vine spiralling through the composition. Veins are cut back to the skin so the leaves keep their weight.',
    tags: ['ivy', 'vine', 'botanical', 'spiral'],
  },
  {
    id: 'serpent-coil',
    name: 'Serpent & Dagger',
    style: 'traditional',
    artist: 'Davi Kosta',
    regions: ['forearm-l', 'thigh-l', 'arm-r'],
    size: 0.2,
    year: 2022,
    description:
      'Old-school snake coiled around a dagger, drawn with the bold outline and flat black of a flash sheet.',
    tags: ['snake', 'dagger', 'flash', 'classic'],
  },
  {
    id: 'polynesian-spear',
    name: 'Spearhead',
    style: 'tribal',
    artist: 'Juno Reyes',
    regions: ['upper-back', 'arm-r', 'leg-l'],
    size: 0.28,
    year: 2024,
    description:
      'A symmetrical spearhead built from Polynesian chevrons and hooks. Meant to read as one unbroken silhouette from across a room.',
    tags: ['polynesian', 'chevron', 'symmetry'],
  },
  {
    id: 'norse-knot',
    name: 'Norse Knot',
    style: 'tribal',
    artist: 'Juno Reyes',
    regions: ['chest', 'forearm-l', 'shoulder-r'],
    size: 0.2,
    year: 2023,
    description:
      'A triquetra interlace with over-under breaks drawn in double line. The gaps are what make the knot legible.',
    tags: ['norse', 'knot', 'interlace'],
  },
  {
    id: 'sacred-grid',
    name: 'Sacred Grid',
    style: 'geometric',
    artist: 'Noor Haddad',
    regions: ['upper-back', 'chest'],
    size: 0.3,
    year: 2025,
    description:
      'A mandala on a strict sixteen-fold grid — arches, petals and a solid core. Every ring is a measured interval, nothing is hand-waved.',
    tags: ['mandala', 'grid', 'sixteen-fold', 'sacred'],
    featured: true,
  },
  {
    id: 'orbit-delta',
    name: 'Orbit Delta',
    style: 'geometric',
    artist: 'Noor Haddad',
    regions: ['forearm-r', 'chest', 'leg-r'],
    size: 0.18,
    year: 2024,
    description:
      'A delta inside an orbit, mapped with a protractor. Satellites are placed on the intersections, not in between.',
    tags: ['delta', 'orbit', 'protractor'],
  },
  {
    id: 'swallow-courage',
    name: 'Swallow, Courage',
    style: 'traditional',
    artist: 'Mara Voss',
    regions: ['chest', 'forearm-l'],
    size: 0.2,
    year: 2022,
    description:
      'A swallow carrying a banner. Traditional bones — flat black, red accent, one heavy outline — rebuilt with a cleaner wing.',
    tags: ['swallow', 'banner', 'red', 'classic'],
  },
  {
    id: 'anchor-tide',
    name: 'Anchor & Tide',
    style: 'traditional',
    artist: 'Davi Kosta',
    regions: ['forearm-r', 'shoulder-l'],
    size: 0.18,
    year: 2022,
    description:
      'Anchor, rope and flukes drawn as a single silhouette. Rope crossings are kept open so the piece survives a small placement.',
    tags: ['anchor', 'rope', 'nautical'],
  },
  {
    id: 'ink-flow',
    name: 'Ink Flow',
    style: 'abstract',
    artist: 'Juno Reyes',
    regions: ['upper-back', 'thigh-l'],
    size: 0.34,
    year: 2025,
    description:
      'A sumi-e gesture frozen mid-motion, with splatter and flow lines. Built large, for a surface that can carry the silence around it.',
    tags: ['sumi', 'gesture', 'splatter', 'abstract'],
  },
  {
    id: 'erosion',
    name: 'Erosion',
    style: 'abstract',
    artist: 'Juno Reyes',
    regions: ['upper-back', 'arm-l'],
    size: 0.26,
    year: 2024,
    description:
      'Topographic contour lines drifting into concentric rings. A study of how a surface gives way over time.',
    tags: ['topography', 'contour', 'rings'],
  },
  {
    id: 'memento-mori',
    name: 'Memento Mori',
    style: 'lettering',
    artist: 'Mara Voss',
    regions: ['chest', 'forearm-l', 'abdomen'],
    size: 0.2,
    year: 2023,
    description:
      'Serif capitals with a fine rule and a dotted arc. Typeset, not drawn — the spacing is the design.',
    tags: ['lettering', 'serif', 'memento'],
  },
  {
    id: 'vincit-amor',
    name: 'Vincit Amor',
    style: 'lettering',
    artist: 'Mara Voss',
    regions: ['chest', 'abdomen', 'forearm-r'],
    size: 0.18,
    year: 2024,
    description:
      'Two lines held inside a thin double rule. The rule frames the phrase and keeps the placement honest.',
    tags: ['lettering', 'rule', 'classic'],
  },
  {
    id: 'sun-moon',
    name: 'Sun / Moon',
    style: 'minimal',
    artist: 'Sofia Aoki',
    regions: ['forearm-l', 'hand-r', 'leg-r'],
    size: 0.12,
    year: 2025,
    description:
      'A sun disc beside a crescent, drawn with one weight. Small enough for a wrist, graphic enough for a calf.',
    tags: ['sun', 'moon', 'minimal', 'duo'],
  },
  {
    id: 'dot-arc',
    name: 'Still Here',
    style: 'minimal',
    artist: 'Sofia Aoki',
    regions: ['forearm-r', 'chest', 'abdomen'],
    size: 0.14,
    year: 2025,
    description:
      'A dotted arc rising over a horizon line, with a quiet line of type. A small piece that holds a whole sentence.',
    tags: ['dotwork', 'arc', 'lettering', 'minimal'],
  },
  {
    id: 'peony-veil',
    name: 'Peony Veil',
    style: 'japanese',
    artist: 'Sofia Aoki',
    regions: ['thigh-l', 'upper-back'],
    size: 0.26,
    year: 2024,
    description:
      'A peony built in alternating black and open paper petals, with leaves that fold out of the frame.',
    tags: ['peony', 'botanical', 'irezumi'],
  },
  {
    id: 'compass-rose',
    name: 'Compass Rose',
    style: 'geometric',
    artist: 'Ilya Ren',
    regions: ['forearm-l', 'chest', 'shoulder-r'],
    size: 0.18,
    year: 2023,
    description:
      'An eight-point compass on a tick ring. Solid points, open ring — a navigation instrument drawn as a tattoo.',
    tags: ['compass', 'navigation', 'ticks'],
  },
  {
    id: 'lotus-black',
    name: 'Lotus, Black',
    style: 'blackwork',
    artist: 'Noor Haddad',
    regions: ['chest', 'upper-back', 'thigh-r'],
    size: 0.24,
    year: 2024,
    description:
      'A lotus in five weights of black, opening above a water band. Every petal is separated by a cut of skin.',
    tags: ['lotus', 'botanical', 'symmetry'],
  },
];

export const TATTOO_LIBRARY: TattooDesign[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  slug: seed.id,
  style: seed.style,
  imageUrl: `/tattoos/thumbs/${seed.id}.webp`,
  inkUrl: `/tattoos/${seed.id}.png`,
  recommendedRegions: seed.regions,
  artist: seed.artist,
  description: seed.description,
  tags: seed.tags,
  licensing: LICENSE,
  defaultSize: seed.size,
  featured: seed.featured ?? false,
  year: seed.year,
}));

const BY_ID = new Map(TATTOO_LIBRARY.map((d) => [d.id, d]));
const BY_SLUG = new Map(TATTOO_LIBRARY.map((d) => [d.slug, d]));

export function getDesign(id: string | undefined | null): TattooDesign | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function getDesignBySlug(slug: string): TattooDesign | undefined {
  return BY_SLUG.get(slug);
}

export function designsByStyle(style: string): TattooDesign[] {
  return TATTOO_LIBRARY.filter((d) => d.style === style);
}

export function designsForRegion(regionId: string): TattooDesign[] {
  return TATTOO_LIBRARY.filter((d) => d.recommendedRegions.includes(regionId));
}

export const FEATURED_DESIGNS = TATTOO_LIBRARY.filter((d) => d.featured);

export const ARTISTS = Array.from(new Set(TATTOO_LIBRARY.map((d) => d.artist))).sort();

export const STYLE_COUNTS = TATTOO_LIBRARY.reduce<Record<string, number>>((acc, d) => {
  acc[d.style] = (acc[d.style] ?? 0) + 1;
  return acc;
}, {});
