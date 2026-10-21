import { sharePayloadSchema, type SharePayload } from './schemas';
import type { AppliedTattoo, CharacterModel, TattooComposition } from './types';

const MAX_LINK_LENGTH = 1600;

function toBase64Url(input: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(input)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    return decodeURIComponent(escape(atob(normalized)));
  }
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function encodeComposition(input: {
  name: string;
  characterId: CharacterModel['id'];
  tattoos: AppliedTattoo[];
}): string {
  const payload: SharePayload = {
    v: 1,
    n: input.name.slice(0, 48) || 'Untitled composition',
    ch: input.characterId,
    t: input.tattoos.slice(0, 8).map((t) => [
      t.designId,
      t.bodyRegion,
      round(t.offset[0]),
      round(t.offset[1]),
      round(t.rotation),
      round(t.scale),
      round(t.opacity),
      t.mirrored ? 1 : 0,
    ]),
  };
  return toBase64Url(JSON.stringify(payload));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface DecodedComposition {
  name: string;
  characterId: CharacterModel['id'];
  tattoos: AppliedTattoo[];
}

export function decodeComposition(encoded: string): DecodedComposition | null {
  if (!encoded || encoded.length > MAX_LINK_LENGTH) return null;
  try {
    const json = fromBase64Url(encoded);
    const parsed = sharePayloadSchema.safeParse(JSON.parse(json) as unknown);
    if (!parsed.success) return null;
    const payload = parsed.data;
    const tattoos: AppliedTattoo[] = payload.t.map((t, index) => ({
      id: `shared-${index}-${t[0]}`,
      designId: t[0],
      bodyRegion: t[1],
      characterId: payload.ch,
      offset: [t[2], t[3]],
      rotation: t[4],
      scale: t[5],
      opacity: t[6],
      mirrored: t[7] === 1,
    }));
    return { name: payload.n, characterId: payload.ch, tattoos };
  } catch {
    return null;
  }
}

export function compositionToSharePayload(composition: TattooComposition) {
  return {
    name: composition.name,
    characterId: composition.characterId,
    tattoos: composition.appliedTattoos,
  };
}

export function buildShareUrl(origin: string, encoded: string): string {
  return `${origin.replace(/\/$/, '')}/studio?c=${encoded}`;
}
