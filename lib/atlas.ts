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
      const a = px[i + 3]! / 255;
      if (a <= 0) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = 255;
        continue;
      }
      const lum = (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / 255;
      // dark ink -> high density, paper -> ~0
      const density = Math.max(0, Math.min(1, (1 - lum) * a));
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
    const a = px[i + 3]! / 255;
    const lum = (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / 255;
    const density = Math.max(0, Math.min(1, (1 - lum) * a));
    px[i] = 20;
    px[i + 1] = 22;
    px[i + 2] = 26;
    px[i + 3] = Math.round(density * 235);
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}
