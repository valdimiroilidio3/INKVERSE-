/**
 * Runtime ink atlas.
 *
 * Every applied tattoo is rasterised into one of 16 tiles of a 2048² texture.
 * Tile contents are *density* maps: R = ink density (0 = skin, 1 = solid ink).
 * Density is derived from the design's luminance so that the paper-coloured
 * negative space of the artwork stays as skin — which is how blackwork works.
 */
export const ATLAS_SIZE = 2048;
export const ATLAS_GRID = 4;
export const ATLAS_TILE = ATLAS_SIZE / ATLAS_GRID;
export const ATLAS_TILES = ATLAS_GRID * ATLAS_GRID;

/**
 * UV of the atlas for a point inside a design, and the contract the shader obeys.
 *
 * The atlas is a CanvasTexture drawn with canvas coordinates (row 0 = top) and
 * uploaded with `flipY = false`, so in texture space v=0 is the first canvas row.
 * Tile `t` is drawn at column `t % 4`, row `floor(t / 4)`, therefore:
 *
 *   u = (t % 4) / 4 + qx / 4
 *   v = floor(t / 4) / 4 + (1 − qy) / 4        (qy = 1 is the top of the artwork)
 *
 * `q` runs 0…1 across the placed square, q.y upwards. The skin shader repeats
 * this expression inline (`inkDensityAt`); `tests/ink.test.ts` guards both.
 */
export function atlasUvFor(tile: number, qx: number, qy: number): [number, number] {
  const col = tile % ATLAS_GRID;
  const row = Math.floor(tile / ATLAS_GRID);
  return [(col + qx) / ATLAS_GRID, (row + (1 - qy)) / ATLAS_GRID];
}


/**
 * Ink density of one artwork pixel.
 *
 * The catalogue is a two-tone silkscreen style drawn over the page surface: the
 * drawings use near-black ink (`#0b0b0b`) *and* paper knockouts — white shapes that
 * are meant to read as bare paper. On a dark surface that composition is the design;
 * transcribed straight onto skin with `density = 1 − luminance` the knockouts become
 * bare skin, which is anatomically right but erases 5 of the 28 motifs (mean opaque
 * luminance 0.61–0.78: `lunar-moth`, `heart-anatomy`, `rose-noir`, `dragon-serpent`,
 * `orchid-line` all but disappeared in the 3D render).
 *
 * So the knockout is mapped to a light ink wash instead of nothing: the tonal
 * structure of the artwork survives (relative contrast is untouched, polarity is
 * untouched, nothing is drawn outside the alpha silhouette) while every motif stays
 * legible at catalogue sizes. Pure black stays pure black, transparent stays skin.
 *
 * The real fix is art direction, not shading: designs whose form depends on paper
 * knockouts need stencil line work before they are offered as blackwork. Tracked in
 * `docs/art-direction.md`; the gallery artwork is deliberately left untouched so what
 * the catalogue shows is exactly what the artwork is.
 */
export const PAPER_TONE_INK = 0.4;

export function inkDensityFromPixel(r: number, g: number, b: number, a: number): number {
  if (a <= 0) return 0;
  // Composite the artwork onto its own paper tone before measuring luminance:
  // reading raw channels lets a transparent margin carry colour, which turns clean
  // line work into speckle once it is sampled at skin scale.
  const cr = r * a + 255 * (1 - a);
  const cg = g * a + 255 * (1 - a);
  const cb = b * a + 255 * (1 - a);
  const lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
  return Math.max(0, Math.min(1, a * (1 - (1 - PAPER_TONE_INK) * lum)));
}

const cache = new Map<string, HTMLImageElement>();

export function loadInkImage(url: string): Promise<HTMLImageElement> {
  const existing = cache.get(url);
  if (existing) {
    if (existing.complete) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    img.addEventListener('load', () => {
      cache.set(url, img);
      resolve(img);
    });
    img.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
  });
}

export interface AtlasEntry {
  url: string;
  tile: number;
}

export interface AtlasResult {
  canvas: HTMLCanvasElement;
  /** urls that failed to load, so the UI can be honest about it */
  failed: string[];
}

/**
 * Builds the atlas for the given entries. Existing rendering is preserved for
 * tiles that did not change, so moving a slider never re-rasterises artwork.
 */
export function buildInkAtlas(
  entries: AtlasEntry[],
  target?: HTMLCanvasElement,
  previous?: { canvas: HTMLCanvasElement; signature: string[] },
): { canvas: HTMLCanvasElement; signature: string[] } {
  const canvas = target ?? document.createElement('canvas');
  if (canvas.width !== ATLAS_SIZE) {
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');

  const signature = entries.map((e) => `${e.tile}:${e.url}`);
  const same = previous && previous.signature.length === signature.length && previous.signature.every((s, i) => s === signature[i]);
  if (same && previous) {
    return { canvas: previous.canvas, signature };
  }

  for (const entry of entries) {
    const img = cache.get(entry.url);
    if (!img || !img.complete) continue;
    const tx = (entry.tile % ATLAS_GRID) * ATLAS_TILE;
    const ty = Math.floor(entry.tile / ATLAS_GRID) * ATLAS_TILE;
    ctx.save();
    ctx.clearRect(tx, ty, ATLAS_TILE, ATLAS_TILE);
    // artwork first, at tile resolution
    const tmp = document.createElement('canvas');
    tmp.width = ATLAS_TILE;
    tmp.height = ATLAS_TILE;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!tctx) continue;
    tctx.clearRect(0, 0, ATLAS_TILE, ATLAS_TILE);
    tctx.drawImage(img, 0, 0, ATLAS_TILE, ATLAS_TILE);
    const data = tctx.getImageData(0, 0, ATLAS_TILE, ATLAS_TILE);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const density = inkDensityFromPixel(px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]! / 255);
      const v = Math.round(density * 255);
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
    tctx.putImageData(data, 0, 0);
    ctx.drawImage(tmp, tx, ty);
    ctx.restore();
  }
  return { canvas, signature };
}

/** Render the atlas for a single design (used by the gallery preview thumbnails). */
export async function designDensityUrl(url: string, size = 512): Promise<string> {
  const img = await loadInkImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const density = inkDensityFromPixel(px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]! / 255);
    px[i] = 20;
    px[i + 1] = 22;
    px[i + 2] = 26;
    px[i + 3] = Math.round(density * 235);
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}
