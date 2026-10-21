import { beforeEach, describe, expect, it } from 'vitest';
import { useStudioStore } from '@/store/studio';
import { useLibraryStore } from '@/store/library';
import { MAX_TATTOOS } from '@/lib/schemas';
import { TATTOO_LIBRARY } from '@/lib/tattoos';
import { getRegion } from '@/lib/regions';

const reset = () =>
  useStudioStore.setState({
    characterId: 'male',
    regionId: 'chest',
    tattoos: [],
    selectedId: null,
    past: [],
    future: [],
    hydrated: false,
  });

beforeEach(reset);

describe('studio store', () => {
  it('placements a design in the requested zone', () => {
    const tattoo = useStudioStore.getState().addTattoo('rose-noir', 'forearm-l');
    expect(tattoo).not.toBeNull();
    expect(tattoo?.bodyRegion).toBe('forearm-l');
    expect(useStudioStore.getState().tattoos).toHaveLength(1);
    expect(useStudioStore.getState().selectedId).toBe(tattoo?.id);
  });

  it('refuses placements in zones that do not exist', () => {
    expect(useStudioStore.getState().addTattoo('rose-noir', 'nope')).toBeNull();
    expect(useStudioStore.getState().tattoos).toHaveLength(0);
  });

  it('refuses unknown designs', () => {
    expect(useStudioStore.getState().addTattoo('not-a-design', 'chest')).toBeNull();
  });

  it('caps layers at the schema maximum', () => {
    for (let i = 0; i < MAX_TATTOOS + 3; i += 1) {
      useStudioStore.getState().addTattoo(TATTOO_LIBRARY[i % TATTOO_LIBRARY.length]!.id, 'chest');
    }
    expect(useStudioStore.getState().tattoos).toHaveLength(MAX_TATTOOS);
  });

  it('undoes and redoes an edit', () => {
    const tattoo = useStudioStore.getState().addTattoo('lunar-moth', 'chest');
    useStudioStore.getState().updateTattoo(tattoo!.id, { scale: 1.4 }, { commit: true });
    expect(useStudioStore.getState().tattoos[0]?.scale).toBe(1.4);
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().tattoos[0]?.scale).not.toBe(1.4);
    useStudioStore.getState().redo();
    expect(useStudioStore.getState().tattoos[0]?.scale).toBe(1.4);
  });

  it('duplicates, mirrors and removes a layer', () => {
    const tattoo = useStudioStore.getState().addTattoo('kiku-wave', 'upper-back')!;
    useStudioStore.getState().duplicateTattoo(tattoo.id);
    expect(useStudioStore.getState().tattoos).toHaveLength(2);
    useStudioStore.getState().updateTattoo(tattoo.id, { mirrored: true });
    expect(useStudioStore.getState().tattoos.find((t) => t.id === tattoo.id)?.mirrored).toBe(true);
    useStudioStore.getState().removeTattoo(tattoo.id);
    expect(useStudioStore.getState().tattoos).toHaveLength(1);
  });

  it('moves a layer to another zone', () => {
    const tattoo = useStudioStore.getState().addTattoo('monolith', 'thigh-l')!;
    expect(getRegion('male', 'thigh-l')).toBeDefined();
    useStudioStore.getState().updateTattoo(tattoo.id, { bodyRegion: 'chest' });
    expect(useStudioStore.getState().tattoos[0]?.bodyRegion).toBe('chest');
  });

  it('loads a shared composition', () => {
    const tattoo = useStudioStore.getState().addTattoo('compass-rose', 'forearm-r')!;
    const payload = {
      name: 'Shared',
      characterId: 'male' as const,
      tattoos: useStudioStore.getState().tattoos,
    };
    useStudioStore.getState().clearAll();
    expect(useStudioStore.getState().tattoos).toHaveLength(0);
    useStudioStore.getState().loadComposition(payload);
    expect(useStudioStore.getState().tattoos).toHaveLength(1);
    expect(useStudioStore.getState().tattoos[0]?.designId).toBe(tattoo.designId);
  });

  it('carries the composition across bodies (shared UV atlas)', () => {
    useStudioStore.getState().addTattoo('rose-noir', 'chest');
    useStudioStore.getState().setCharacter('female');
    expect(useStudioStore.getState().characterId).toBe('female');
    expect(useStudioStore.getState().tattoos).toHaveLength(1);
    expect(useStudioStore.getState().tattoos[0]?.characterId).toBe('female');
  });
});

describe('library store persistence', () => {
  it('saves, renames and deletes a composition', () => {
    useLibraryStore.getState().hydrate();
    useLibraryStore.getState().saveComposition({
      name: 'Nightwork',
      characterId: 'male',
      tattoos: [
        {
          id: 'x',
          designId: 'rose-noir',
          characterId: 'male',
          bodyRegion: 'chest',
          offset: [0, 0],
          rotation: 0,
          scale: 1,
          opacity: 1,
          mirrored: false,
        },
      ],
    });
    const saved = useLibraryStore.getState().compositions;
    expect(saved.length).toBe(1);
    const id = saved[0]!.id;
    useLibraryStore.getState().renameComposition(id, 'Renamed');
    expect(useLibraryStore.getState().compositions[0]?.name).toBe('Renamed');
    useLibraryStore.getState().deleteComposition(id);
    expect(useLibraryStore.getState().compositions).toHaveLength(0);
  });

  it('toggles favourites without duplicates', () => {
    useLibraryStore.getState().hydrate();
    useLibraryStore.getState().toggleFavorite('rose-noir');
    useLibraryStore.getState().toggleFavorite('rose-noir');
    useLibraryStore.getState().toggleFavorite('rose-noir');
    expect(useLibraryStore.getState().favorites).toEqual(['rose-noir']);
  });

  it('ignores corrupt local storage', () => {
    window.localStorage.setItem('inkverse:library:v1', '{not json');
    useLibraryStore.setState({ hydrated: false, compositions: [], favorites: [] });
    useLibraryStore.getState().hydrate();
    expect(useLibraryStore.getState().compositions).toEqual([]);
    expect(useLibraryStore.getState().favorites).toEqual([]);
  });
});
