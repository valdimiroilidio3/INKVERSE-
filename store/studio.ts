'use client';

import { create } from 'zustand';
import { z } from 'zod';
import { getCharacter } from '@/lib/characters';
import { getDesign } from '@/lib/tattoos';
import { getRegion, primarySlot } from '@/lib/regions';
import { computePlacement } from '@/lib/placement';
import { MAX_TATTOOS, appliedTattooSchema, characterIdSchema } from '@/lib/schemas';
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage';
import type { AppliedTattoo, CharacterModel, StudioView } from '@/lib/types';

export const DEFAULT_COMPOSITION_NAME = 'Untitled composition';

interface Snapshot {
  characterId: CharacterModel['id'];
  regionId: string;
  tattoos: AppliedTattoo[];
  name: string;
  selectedId: string | null;
}

export interface StudioState {
  characterId: CharacterModel['id'];
  regionId: string;
  tattoos: AppliedTattoo[];
  selectedId: string | null;
  view: StudioView;
  compare: boolean;
  spotlight: boolean;
  name: string;
  hydrated: boolean;

  past: Snapshot[];
  future: Snapshot[];
  lastCommit: { key: string; at: number } | null;

  hydrate: () => void;
  setCharacter: (id: CharacterModel['id']) => void;
  setRegion: (id: string) => void;
  setView: (view: StudioView) => void;
  setCompare: (value: boolean) => void;
  setSpotlight: (value: boolean) => void;
  setName: (name: string) => void;

  addTattoo: (designId: string, regionOverride?: string) => AppliedTattoo | null;
  updateTattoo: (id: string, patch: Partial<Omit<AppliedTattoo, 'id'>>, options?: { commit?: boolean }) => void;
  removeTattoo: (id: string) => void;
  duplicateTattoo: (id: string) => void;
  selectTattoo: (id: string | null) => void;
  clearAll: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  loadComposition: (input: { name: string; characterId: CharacterModel['id']; tattoos: AppliedTattoo[] }) => void;
  snapshot: () => Snapshot;
}

const persistedSchema = z.object({
  characterId: characterIdSchema.default('male'),
  regionId: z.string().min(1).max(32).default('forearm-l'),
  name: z.string().min(1).max(48).default(DEFAULT_COMPOSITION_NAME),
  tattoos: z.array(appliedTattooSchema).max(MAX_TATTOOS).default([]),
});

const OFFSET_LADDER: [number, number][] = [
  [0, 0],
  [0.55, 0.4],
  [-0.55, -0.4],
  [0.55, -0.4],
  [-0.55, 0.4],
  [0, 0.6],
  [0, -0.6],
  [0.7, 0],
];

let uid = 0;
function nextId(): string {
  uid += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `t${Date.now().toString(36)}${uid.toString(36)}${rand}`;
}

const HISTORY_LIMIT = 40;
const COALESCE_MS = 700;

function snapshotOf(state: StudioState): Snapshot {
  return {
    characterId: state.characterId,
    regionId: state.regionId,
    tattoos: state.tattoos,
    name: state.name,
    selectedId: state.selectedId,
  };
}

export const useStudioStore = create<StudioState>()((set, get) => {
  /** Push history; repeated edits of the same key within the window collapse. */
  function pushHistory(key: string) {
    const state = get();
    const now = Date.now();
    const coalesce =
      state.lastCommit !== null && state.lastCommit.key === key && now - state.lastCommit.at < COALESCE_MS;
    if (coalesce) {
      set({ lastCommit: { key, at: now } });
      return;
    }
    const past = [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT);
    set({ past, future: [], lastCommit: { key, at: now } });
  }

  function commit(key: string) {
    const state = get();
    const past = [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT);
    set({ past, future: [], lastCommit: { key, at: Date.now() } });
  }

  function persist(state: StudioState) {
    writeStorage(STORAGE_KEYS.studio, {
      characterId: state.characterId,
      regionId: state.regionId,
      name: state.name,
      tattoos: state.tattoos,
    });
  }

  return {
    characterId: 'male',
    regionId: 'forearm-l',
    tattoos: [],
    selectedId: null,
    view: 'front',
    compare: false,
    spotlight: true,
    name: DEFAULT_COMPOSITION_NAME,
    hydrated: false,
    past: [],
    future: [],
    lastCommit: null,

    hydrate: () => {
      if (get().hydrated) return;
      const data = readStorage(STORAGE_KEYS.studio, persistedSchema, {
        characterId: 'male',
        regionId: 'forearm-l',
        name: DEFAULT_COMPOSITION_NAME,
        tattoos: [],
      });
      const character = getCharacter(data.characterId);
      const region = getRegion(character.id, data.regionId) ?? getRegion(character.id, 'forearm-l');
      set({
        hydrated: true,
        characterId: character.id,
        regionId: region?.id ?? 'forearm-l',
        name: data.name,
        tattoos: data.tattoos.filter((t) => Boolean(getDesign(t.designId))).map((t) => ({ ...t, characterId: character.id })),
        selectedId: null,
      });
    },

    setCharacter: (id) => {
      const character = getCharacter(id);
      set((state) => ({
        characterId: character.id,
        tattoos: state.tattoos.map((t) => ({ ...t, characterId: character.id })),
        selectedId: null,
        compare: false,
      }));
      persist(get());
    },

    setRegion: (id) => {
      const region = getRegion(get().characterId, id);
      if (!region) return;
      set({ regionId: region.id });
      persist(get());
    },

    setView: (view) => set({ view }),
    setCompare: (compare) => set({ compare }),
    setSpotlight: (spotlight) => set({ spotlight }),
    setName: (name) => {
      const clean = name.slice(0, 48);
      set({ name: clean.length ? clean : DEFAULT_COMPOSITION_NAME });
      persist(get());
    },

    addTattoo: (designId, regionOverride) => {
      const state = get();
      const design = getDesign(designId);
      if (!design) return null;
      if (state.tattoos.length >= MAX_TATTOOS) return null;
      const regionId = regionOverride ?? state.regionId;
      const region = getRegion(state.characterId, regionId);
      const slot = primarySlot(region);
      if (!region || !slot) return null;

      const siblings = state.tattoos.filter((t) => t.bodyRegion === regionId).length;
      const offset = OFFSET_LADDER[siblings % OFFSET_LADDER.length]!;
      const tattoo: AppliedTattoo = {
        id: nextId(),
        designId: design.id,
        characterId: state.characterId,
        bodyRegion: region.id,
        offset: [offset[0], offset[1]],
        rotation: 0,
        scale: 1,
        opacity: 0.94,
        mirrored: false,
      };
      // Fit check: if the design is wider than the region at 1.0, shrink it.
      const placement = computePlacement({
        slot,
        designSize: design.defaultSize,
        scale: 1,
        offset: tattoo.offset,
        rotation: 0,
      });
      if (placement.clamped) {
        tattoo.scale = Math.max(0.3, Math.round((placement.sizeMeters / design.defaultSize) * 100) / 100);
      }
      commit('add');
      set((s) => ({
        tattoos: [...s.tattoos, tattoo],
        selectedId: tattoo.id,
        regionId: region.id,
        compare: false,
      }));
      persist(get());
      return tattoo;
    },

    updateTattoo: (id, patch, options) => {
      const state = get();
      const current = state.tattoos.find((t) => t.id === id);
      if (!current) return;
      if (options?.commit !== false) pushHistory(`update:${id}`);
      const next: AppliedTattoo = { ...current, ...patch };
      if (patch.designId && !getDesign(patch.designId)) return;
      // keep values inside the schema bounds
      next.offset = [clamp(next.offset[0], -1.6, 1.6), clamp(next.offset[1], -1.6, 1.6)];
      next.rotation = clamp(next.rotation, -180, 180);
      next.scale = clamp(next.scale, 0.25, 1.8);
      next.opacity = clamp(next.opacity, 0, 1);
      set((s) => ({
        tattoos: s.tattoos.map((t) => (t.id === id ? next : t)),
        compare: false,
      }));
      persist(get());
    },

    removeTattoo: (id) => {
      if (!get().tattoos.some((t) => t.id === id)) return;
      commit('remove');
      set((s) => ({
        tattoos: s.tattoos.filter((t) => t.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
      persist(get());
    },

    duplicateTattoo: (id) => {
      const state = get();
      const source = state.tattoos.find((t) => t.id === id);
      if (!source || state.tattoos.length >= MAX_TATTOOS) return;
      const copy: AppliedTattoo = {
        ...source,
        id: nextId(),
        offset: [clamp(source.offset[0] + 0.25, -1.6, 1.6), clamp(source.offset[1] + 0.25, -1.6, 1.6)],
      };
      commit('duplicate');
      set((s) => ({ tattoos: [...s.tattoos, copy], selectedId: copy.id }));
      persist(get());
    },

    selectTattoo: (id) => {
      const tattoo = id ? get().tattoos.find((t) => t.id === id) : null;
      set({
        selectedId: id,
        regionId: tattoo?.bodyRegion ?? get().regionId,
      });
    },

    clearAll: () => {
      if (get().tattoos.length === 0) return;
      commit('clear');
      set({ tattoos: [], selectedId: null });
      persist(get());
    },

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return;
      set({
        past: state.past.slice(0, -1),
        future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT),
        characterId: previous.characterId,
        regionId: previous.regionId,
        tattoos: previous.tattoos,
        name: previous.name,
        selectedId: previous.selectedId,
        lastCommit: null,
      });
      persist(get());
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        future: state.future.slice(1),
        past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
        characterId: next.characterId,
        regionId: next.regionId,
        tattoos: next.tattoos,
        name: next.name,
        selectedId: next.selectedId,
        lastCommit: null,
      });
      persist(get());
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    loadComposition: ({ name, characterId, tattoos }) => {
      const character = getCharacter(characterId);
      const valid = tattoos
        .filter((t) => getDesign(t.designId) && getRegion(character.id, t.bodyRegion))
        .slice(0, MAX_TATTOOS)
        .map((t) => ({ ...t, characterId: character.id }));
      commit('load');
      set({
        characterId: character.id,
        tattoos: valid,
        selectedId: valid[0]?.id ?? null,
        regionId: valid[0]?.bodyRegion ?? get().regionId,
        name: name.slice(0, 48) || DEFAULT_COMPOSITION_NAME,
        compare: false,
      });
      persist(get());
    },

    snapshot: () => snapshotOf(get()),
  };
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Selector: tattoos of the current character that still resolve to a real design. */
export function selectValidTattoos(state: StudioState): AppliedTattoo[] {
  return state.tattoos.filter((t) => Boolean(getDesign(t.designId)));
}

export function selectSelectedTattoo(state: StudioState): AppliedTattoo | null {
  return state.tattoos.find((t) => t.id === state.selectedId) ?? null;
}
