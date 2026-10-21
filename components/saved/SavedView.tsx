'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock, Heart, Layers, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { getCharacter } from '@/lib/characters';
import { formatRelative } from '@/lib/format';
import { REGION_LABELS } from '@/lib/regions';
import { getDesign } from '@/lib/tattoos';
import type { TattooComposition } from '@/lib/types';
import { useLibraryStore } from '@/store/library';
import { useStudioStore } from '@/store/studio';

export function SavedView() {
  const toast = useToast();
  const router = useRouter();
  const hydrated = useLibraryStore((s) => s.hydrated);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const compositions = useLibraryStore((s) => s.compositions);
  const favorites = useLibraryStore((s) => s.favorites);
  const deleteComposition = useLibraryStore((s) => s.deleteComposition);
  const renameComposition = useLibraryStore((s) => s.renameComposition);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const loadComposition = useStudioStore((s) => s.loadComposition);
  const [tab, setTab] = useState<'compositions' | 'favorites'>('compositions');
  const [pendingDelete, setPendingDelete] = useState<TattooComposition | null>(null);
  const [renaming, setRenaming] = useState<TattooComposition | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const favouriteDesigns = useMemo(
    () => favorites.map((id) => getDesign(id)).filter((d): d is NonNullable<typeof d> => Boolean(d)),
    [favorites],
  );

  const reopen = (composition: TattooComposition) => {
    loadComposition({
      name: composition.name,
      characterId: composition.characterId,
      tattoos: composition.appliedTattoos,
    });
    toast.push(`Reopened “${composition.name}” in the studio.`, 'success');
    router.push('/studio');
  };

  return (
    <main className="pt-[var(--header-h)]">
      <header className="page-max page-x pb-8 pt-14 md:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-acid" />
              <span className="label-caps text-[10px]">Your studio</span>
            </div>
            <h1 className="mt-5 font-sans text-editorial font-medium text-paper">
              Saved
              <br />
              <span className="font-serif italic text-paper-dim">work.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-mist">
              Compositions and favourite designs live in this browser. No account, no cloud — and nothing leaves your
              device unless you share a link.
            </p>
          </div>
          <ButtonLink href="/studio" variant="primary" trailing={<ArrowUpRight className="size-3.5" strokeWidth={1.7} />}>
            Open studio
          </ButtonLink>
        </div>

        <div className="mt-10 flex items-center gap-1 border-b border-white/8">
          {(
            [
              { id: 'compositions' as const, label: `Compositions · ${compositions.length}` },
              { id: 'favorites' as const, label: `Favourites · ${favouriteDesigns.length}` },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={cn(
                'relative px-4 pb-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors',
                tab === item.id ? 'text-paper' : 'text-mist hover:text-paper',
              )}
            >
              {item.label}
              {tab === item.id ? <span className="absolute inset-x-0 bottom-0 h-px bg-acid" /> : null}
            </button>
          ))}
        </div>
      </header>

      <div className="page-max page-x pb-24">
        {!hydrated ? (
          <p className="py-16 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-mist">Reading local storage…</p>
        ) : tab === 'compositions' ? (
          compositions.length === 0 ? (
            <EmptyState
              title="No compositions saved yet"
              description="Build a look in the 3D studio, then press Save. Compositions reopen with the same character, zones and placements."
              icon={<Layers className="size-5" strokeWidth={1.4} />}
              action={<ButtonLink href="/studio" variant="primary">Start a composition</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {compositions.map((composition) => {
                const character = getCharacter(composition.characterId);
                const designs = composition.appliedTattoos
                  .map((t) => ({ tattoo: t, design: getDesign(t.designId) }))
                  .filter((entry) => Boolean(entry.design));
                return (
                  <li key={composition.id} className="group border border-white/8 bg-ink-850 transition-colors hover:border-white/20">
                    <div className="relative aspect-[4/3] overflow-hidden bg-ink-900">
                      <Image
                        src={character.thumbnailUrl}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="scale-[1.35] object-cover object-top opacity-70 transition-transform duration-[1200ms] group-hover:scale-[1.4]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                        <Tag tone="dark">{character.name}</Tag>
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
                          {composition.appliedTattoos.length} layers
                        </span>
                      </div>
                      <ul className="absolute inset-x-0 bottom-0 flex gap-1 overflow-x-auto p-3 no-scrollbar">
                        {designs.slice(0, 5).map(({ tattoo, design }) => (
                          <li key={tattoo.id} className="relative size-12 shrink-0 overflow-hidden border border-white/15">
                            {design ? <Image src={design.imageUrl} alt={design.name} fill sizes="48px" className="object-cover" /> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4">
                      <h2 className="font-serif text-2xl leading-tight text-paper">{composition.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-mist">
                        <Clock className="size-3" strokeWidth={1.6} /> Updated {formatRelative(composition.updatedAt)}
                      </p>
                      <p className="mt-2 line-clamp-1 text-[11px] text-mist/80">
                        {designs.map(({ tattoo }) => REGION_LABELS[tattoo.bodyRegion] ?? tattoo.bodyRegion).join(' · ')}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" variant="primary" onClick={() => reopen(composition)}>
                          Reopen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNameDraft(composition.name);
                            setRenaming(composition);
                          }}
                        >
                          Rename
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete ${composition.name}`}
                          onClick={() => setPendingDelete(composition)}
                          className="ml-auto flex size-8 items-center justify-center border border-white/10 text-mist transition-colors hover:border-blood/60 hover:text-blood"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.6} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : favouriteDesigns.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Tap the heart on any design in the gallery or detail page to keep it here. Favourites survive reloads on this device."
            icon={<Heart className="size-5" strokeWidth={1.4} />}
            action={<ButtonLink href="/explore" variant="primary">Browse the library</ButtonLink>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {favouriteDesigns.map((design) => (
              <li key={design.id} className="group relative border border-white/8 bg-ink-850">
                <Link href={`/tattoos/${design.slug}`} className="block">
                  <div className="relative aspect-square overflow-hidden">
                    <Image src={design.imageUrl} alt={design.name} fill sizes="25vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent opacity-80" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-serif text-xl leading-none text-paper">{design.name}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-mist">{design.artist}</p>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${design.name} from favourites`}
                  onClick={() => toggleFavorite(design.id)}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center border border-acid/50 bg-ink-950/70 text-acid backdrop-blur"
                >
                  <Heart className="size-3.5" strokeWidth={1.6} fill="currentColor" />
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-white/8 p-2">
                  <ButtonLink href={`/studio?design=${design.id}`} size="sm" variant="ghost">
                    Try on
                  </ButtonLink>
                  <ButtonLink href={`/tattoos/${design.slug}`} size="sm" variant="ghost" trailing={<ArrowUpRight className="size-3" />}>
                    Details
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Delete composition?" size="sm">
        <p className="text-sm leading-relaxed text-mist">
          “{pendingDelete?.name}” will be removed from this device. This cannot be undone — you can rebuild it in the
          studio.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (pendingDelete) {
                deleteComposition(pendingDelete.id);
                toast.push('Composition deleted.', 'info');
              }
              setPendingDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename composition" size="sm">
        <label className="block">
          <span className="label-caps mb-2 block text-[10px]">Name</span>
          <input
            data-autofocus
            value={nameDraft}
            maxLength={48}
            onChange={(event) => setNameDraft(event.target.value)}
            className="h-11 w-full border border-white/15 bg-ink-850 px-3 text-sm text-paper outline-none focus:border-acid/60"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (renaming && nameDraft.trim()) {
                renameComposition(renaming.id, nameDraft.trim());
                toast.push('Renamed.', 'success');
              }
              setRenaming(null);
            }}
          >
            Save name
          </Button>
        </div>
      </Modal>
    </main>
  );
}
