import { z } from 'zod';
import { TATTOO_STYLES } from './types';

export const MAX_TATTOOS = 8;
export const MAX_COMPOSITION_NAME = 48;

export const characterIdSchema = z.enum(['male', 'female']);

export const tattooStyleSchema = z.enum(TATTOO_STYLES);

export const appliedTattooSchema = z.object({
  id: z.string().min(1).max(64),
  designId: z.string().min(1).max(64),
  characterId: characterIdSchema,
  bodyRegion: z.string().min(1).max(32),
  offset: z.tuple([z.number().min(-1.6).max(1.6), z.number().min(-1.6).max(1.6)]),
  rotation: z.number().min(-180).max(180),
  scale: z.number().min(0.25).max(1.8),
  opacity: z.number().min(0).max(1),
  mirrored: z.boolean(),
});

export const compositionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(MAX_COMPOSITION_NAME),
  characterId: characterIdSchema,
  appliedTattoos: z.array(appliedTattooSchema).max(MAX_TATTOOS),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Payload encoded into share URLs (?c=…). Short keys keep the link compact. */
export const sharePayloadSchema = z.object({
  v: z.literal(1),
  n: z.string().min(1).max(MAX_COMPOSITION_NAME),
  ch: characterIdSchema,
  t: z
    .array(
      z.tuple([
        z.string().min(1).max(64), // designId
        z.string().min(1).max(32), // region
        z.number().min(-1.6).max(1.6), // offset x
        z.number().min(-1.6).max(1.6), // offset y
        z.number().min(-180).max(180), // rotation
        z.number().min(0.25).max(1.8), // scale
        z.number().min(0).max(1), // opacity
        z.union([z.literal(0), z.literal(1)]), // mirrored
      ]),
    )
    .max(MAX_TATTOOS),
});

export type SharePayload = z.infer<typeof sharePayloadSchema>;

export const savedCompositionsSchema = z.object({
  version: z.literal(1),
  items: z.array(compositionSchema).max(60),
});

export const favoriteIdsSchema = z.array(z.string().min(1).max(64)).max(200);
