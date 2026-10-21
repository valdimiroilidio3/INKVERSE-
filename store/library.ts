'use client';

import { create } from 'zustand';
import { z } from 'zod';
import { compositionSchema, favoriteIdsSchema, savedCompositionsSchema } from '@/lib/schemas';
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage';
import { getDesign } from '@/lib/tattoos';
import type { AppliedTattoo, CharacterModel, TattooComposition } from '@/lib/types';

interface LibraryState {
  favorites: string[];
  compositions: TattooComposition[];
  hydrated: boolean;
  hydrate: () => void;
  toggleFavorite: (designId: string) => void;
  isFavorite: (designId: string) => boolean;
  saveComposition: (input: {
    name: string;
    characterId: CharacterModel['id'];
    tattoos: AppliedTattoo[];
  }) => { ok: true; composition: TattooComposition } | { ok: false; reason: 'empty' | 'quota' | 'invalid' };
  deleteComposition: (id: string) => void;
  renameComposition: (id: string, name: string) => void;
}

const compositionsSchema = savedCompositionsSchema;

function nowIso() {
  return new Date().toISOString();
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  favorites: [],
  compositions: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const favorites = readStorage(STORAGE_KEYS.favorites, favoriteIdsSchema, []).filter((id) => Boolean(getDesign(id)));
    const saved = readStorage(STORAGE_KEYS.compositions, compositionsSchema, { version: 1, items: [] });
    const compositions = saved.items.filter((c) => c.appliedTattoos.every((t) => Boolean(getDesign(t.designId))));
    set({ hydrated: true, favorites, compositions });
  },

  toggleFavorite: (designId) => {
    if (!getDesign(designId)) return;
    const favorites = get().favorites.includes(designId)
      ? get().favorites.filter((id) => id !== designId)
      : [...get().favorites, designId];
    set({ favorites });
    writeStorage(STORAGE_KEYS.favorites, favorites);
  },

  isFavorite: (designId) => get().favorites.includes(designId),

  saveComposition: ({ name, characterId, tattoos }) => {
    if (!tattoos || tattoos.length === 0) return { ok: false, reason: 'empty' };
    const timestamp = nowIso();
    const candidate: TattooComposition = {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim().slice(0, 48) || 'Untitled composition',
      characterId,
      appliedTattoos: tattoos.map((t) => ({ ...t, characterId })),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const parsed = compositionSchema.safeParse(candidate);
    if (!parsed.success) return { ok: false, reason: 'invalid' };
    const items = [parsed.data, ...get().compositions].slice(0, 60);
    const write = writeStorage(STORAGE_KEYS.compositions, { version: 1, items });
    if (!write.ok) return { ok: false, reason: write.reason === 'quota' ? 'quota' : 'invalid' };
    set({ compositions: items });
    return { ok: true, composition: parsed.data };
  },

  deleteComposition: (id) => {
    const items = get().compositions.filter((c) => c.id !== id);
    set({ compositions: items });
    writeStorage(STORAGE_KEYS.compositions, { version: 1, items });
  },

  renameComposition: (id, name) => {
    const clean = name.trim().slice(0, 48);
    if (!clean) return;
    const items = get().compositions.map((c) =>
      c.id === id ? { ...c, name: clean, updatedAt: nowIso() } : c,
    );
    set({ compositions: items });
    writeStorage(STORAGE_KEYS.compositions, { version: 1, items });
  },
}));

export const favoritesSchema = favoriteIdsSchema;
export const savedSchema = z.object({ version: z.literal(1), items: z.array(compositionSchema) });
