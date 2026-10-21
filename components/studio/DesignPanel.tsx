'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Heart, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { REGION_LABELS, getRegions } from '@/lib/regions';
import { TATTOO_LIBRARY, designsForRegion } from '@/lib/tattoos';
import { STYLE_LABELS, TATTOO_STYLES, type CharacterModel, type TattooStyle } from '@/lib/types';
import { useLibraryStore } from '@/store/library';

type Tab = 'library' | 'body';

export function DesignPanel({
  characterId,
  regionId,
  onAdd,
  onSelectRegion,
  appliedByRegion,
  className,
}: {
  characterId: CharacterModel['id'];
  regionId: string;
  onAdd: (designId: string) => void;
  onSelectRegion: (regionId: string) => void;
  appliedByRegion: Record<string, number>;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<TattooStyle | 'all'>('all');
  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const regions = useMemo(() => getRegions(characterId), [characterId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = TATTOO_LIBRARY.filter((design) => {
      if (style !== 'all' && design.style !== style) return false;
      if (!q) return true;
      return (
        design.name.toLowerCase().includes(q) ||
        design.style.includes(q) ||
        design.artist.toLowerCase().includes(q) ||
        design.tags.some((tag) => tag.includes(q))
      );
    });
    return [...pool].sort((a, b) => {
      const aRec = a.recommendedRegions.includes(regionId) ? 0 : 1;
      const bRec = b.recommendedRegions.includes(regionId) ? 0 : 1;
      if (aRec !== bRec) return aRec - bRec;
      return a.name.localeCompare(b.name);
    });
  }, [query, style, regionId]);

  const recommended = designsForRegion(regionId);

  return (
    <div className={cn('flex min-h-0 flex-col bg-ink-900', className)}>
      <div className="flex items-center gap-1 border-b border-white/8 px-4 pt-3">
        {(
          [
            { id: 'library' as const, label: 'Library' },
            { id: 'body' as const, label: 'Body zones' },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={cn(
              'relative pb-3 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors',
              tab === item.id ? 'text-paper' : 'text-mist hover:text-paper',
            )}
          >
            {item.label}
            {tab === item.id ? <span className="absolute inset-x-0 bottom-0 h-px bg-acid" /> : null}
          </button>
        ))}
      </div>

      {tab === 'library' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 border-b border-white/8 p-4">
            <label className="flex h-9 items-center gap-2 border border-white/12 bg-ink-850 px-3">
              <Search className="size-3.5 shrink-0 text-mist" strokeWidth={1.6} />
              <span className="sr-only">Search designs</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, artist, tag…"
                className="h-full w-full bg-transparent text-xs text-paper outline-none placeholder:text-mist/70"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              <StyleChip active={style === 'all'} onClick={() => setStyle('all')} label="All" />
              {TATTOO_STYLES.map((item) => (
                <StyleChip key={item} active={style === item} onClick={() => setStyle(item)} label={STYLE_LABELS[item]} />
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-mist">
              <Sparkles className="size-3 text-acid" strokeWidth={1.6} />
              {recommended.length} designs recommended for {REGION_LABELS[regionId] ?? 'this region'}.
            </p>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs leading-relaxed text-mist">
                Nothing matches “{query}”. Try a style name or clear the filters.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {filtered.map((design) => {
                  const isFav = favorites.includes(design.id);
                  const rec = design.recommendedRegions.includes(regionId);
                  return (
                    <li key={design.id} className="group/card relative">
                      <button
                        type="button"
                        onClick={() => onAdd(design.id)}
                        className="block w-full border border-white/8 bg-ink-800 text-left transition-colors duration-200 hover:border-white/25 focus-visible:border-acid"
                        title={`Apply ${design.name} to ${REGION_LABELS[regionId] ?? 'region'}`}
                      >
                        <span className="relative block aspect-square overflow-hidden">
                          <Image
                            src={design.imageUrl}
                            alt={design.name}
                            fill
                            sizes="180px"
                            className="object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
                          />
                          {rec ? (
                            <span className="absolute left-1.5 top-1.5 border border-acid/40 bg-ink-950/80 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-acid">
                              fits zone
                            </span>
                          ) : null}
                        </span>
                        <span className="block px-2 py-1.5">
                          <span className="block truncate text-[11px] text-paper">{design.name}</span>
                          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-mist">
                            {STYLE_LABELS[design.style]}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={isFav ? `Remove ${design.name} from favourites` : `Save ${design.name} to favourites`}
                        aria-pressed={isFav}
                        onClick={() => toggleFavorite(design.id)}
                        className={cn(
                          'absolute right-1 top-1 flex size-6 items-center justify-center bg-ink-950/70 text-mist transition-colors hover:text-acid',
                          isFav && 'text-acid',
                        )}
                      >
                        <Heart className="size-3" strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          <p className="px-1 pb-3 text-[11px] leading-relaxed text-mist">
            Every zone below is mapped on the real mesh. Selecting a zone highlights the skin surface and filters the
            library.
          </p>
          <ul className="space-y-1">
            {regions.map((region) => {
              const active = region.id === regionId;
              const count = appliedByRegion[region.id] ?? 0;
              const slot = region.slots[0];
              return (
                <li key={region.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 border px-2.5 py-2 text-left transition-colors duration-200',
                      active ? 'border-acid/50 bg-acid/5' : 'border-white/8 hover:border-white/20',
                    )}
                  >
                    <span>
                      <span className={cn('block text-xs', active ? 'text-paper' : 'text-paper-dim')}>{region.label}</span>
                      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-mist">
                        {region.group}
                        {slot ? ` · ${Math.round(slot.boxMeters[0] * 100)}×${Math.round(slot.boxMeters[1] * 100)} cm` : ''}
                      </span>
                    </span>
                    {count > 0 ? (
                      <span className="shrink-0 font-mono text-[9px] text-acid">{count.toString().padStart(2, '0')}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StyleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
        active ? 'border-paper bg-paper text-ink-950' : 'border-white/10 text-mist hover:border-white/25 hover:text-paper',
      )}
    >
      {label}
    </button>
  );
}
