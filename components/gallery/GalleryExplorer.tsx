'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownUp, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TattooCard } from './TattooCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { REGION_LABELS } from '@/lib/regions';
import { TATTOO_LIBRARY } from '@/lib/tattoos';
import { STYLE_LABELS, TATTOO_STYLES, type TattooStyle } from '@/lib/types';
import { useLibraryStore } from '@/store/library';

type SortKey = 'curated' | 'name' | 'newest' | 'artist';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'curated', label: 'Curated' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
  { value: 'artist', label: 'Artist' },
];

const PAGE_SIZE = 9;

export function GalleryExplorer() {
  const params = useSearchParams();
  const router = useRouter();
  const initialStyle = params.get('style');
  const initialQuery = params.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [style, setStyle] = useState<TattooStyle | 'all'>(
    TATTOO_STYLES.includes(initialStyle as TattooStyle) ? (initialStyle as TattooStyle) : 'all',
  );
  const [region, setRegion] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('curated');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const favourites = useLibraryStore((s) => s.favorites);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // keep the URL in sync so a filtered view is linkable
  useEffect(() => {
    const next = new URLSearchParams();
    if (style !== 'all') next.set('style', style);
    if (deferredQuery.trim()) next.set('q', deferredQuery.trim());
    const asString = next.toString();
    const target = asString ? `/explore?${asString}` : '/explore';
    router.replace(target, { scroll: false });
  }, [style, deferredQuery, router]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [deferredQuery, style, region, sort, favouritesOnly]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const result = TATTOO_LIBRARY.filter((design) => {
      if (style !== 'all' && design.style !== style) return false;
      if (region !== 'all' && !design.recommendedRegions.includes(region)) return false;
      if (favouritesOnly && !favourites.includes(design.id)) return false;
      if (!q) return true;
      return (
        design.name.toLowerCase().includes(q) ||
        design.artist.toLowerCase().includes(q) ||
        STYLE_LABELS[design.style].toLowerCase().includes(q) ||
        design.tags.some((tag) => tag.includes(q)) ||
        design.recommendedRegions.some((r) => (REGION_LABELS[r] ?? '').toLowerCase().includes(q))
      );
    });
    const sorted = [...result];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') sorted.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    if (sort === 'artist') sorted.sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));
    if (sort === 'curated') sorted.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
    return sorted;
  }, [deferredQuery, style, region, sort, favouritesOnly, favourites]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  const activeFilters = (style !== 'all' ? 1 : 0) + (region !== 'all' ? 1 : 0) + (favouritesOnly ? 1 : 0);

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-30 border-y border-white/8 bg-ink-900/92 backdrop-blur-xl">
        <div className="page-max page-x flex flex-wrap items-center gap-3 py-3">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2.5 border border-white/12 bg-ink-850 px-3 md:max-w-sm">
            <Search className="size-4 shrink-0 text-mist" strokeWidth={1.5} />
            <span className="sr-only">Search designs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, style, artist, body zone…"
              className="h-full w-full bg-transparent text-sm text-paper outline-none placeholder:text-mist/70"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-mist hover:text-paper">
                <X className="size-4" strokeWidth={1.6} />
              </button>
            ) : null}
          </label>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={cn(
              'inline-flex h-10 items-center gap-2 border px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors md:hidden',
              activeFilters > 0 ? 'border-acid/50 text-acid' : 'border-white/12 text-mist',
            )}
          >
            <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
            Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
          </button>

          <div className="hidden flex-wrap items-center gap-1 md:flex">
            <FilterChip active={style === 'all'} onClick={() => setStyle('all')}>
              All styles
            </FilterChip>
            {TATTOO_STYLES.map((item) => (
              <FilterChip key={item} active={style === item} onClick={() => setStyle(item)}>
                {STYLE_LABELS[item]}
              </FilterChip>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFavouritesOnly((v) => !v)}
              aria-pressed={favouritesOnly}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 border px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                favouritesOnly ? 'border-acid/60 text-acid' : 'border-white/12 text-mist hover:text-paper',
              )}
            >
              <Heart className="size-3.5" strokeWidth={1.6} fill={favouritesOnly ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">Saved</span> {favourites.length}
            </button>
            <label className="relative flex h-10 items-center gap-1.5 border border-white/12 px-2.5 text-mist">
              <ArrowDownUp className="size-3.5" strokeWidth={1.6} />
              <span className="sr-only">Sort designs</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-full bg-transparent pr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mist outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-850 text-paper">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {filtersOpen ? (
          <div className="border-t border-white/8 px-4 py-4 md:hidden">
            <p className="label-caps mb-2 text-[9px]">Style</p>
            <div className="flex flex-wrap gap-1">
              <FilterChip active={style === 'all'} onClick={() => setStyle('all')}>
                All
              </FilterChip>
              {TATTOO_STYLES.map((item) => (
                <FilterChip key={item} active={style === item} onClick={() => setStyle(item)}>
                  {STYLE_LABELS[item]}
                </FilterChip>
              ))}
            </div>
            <p className="label-caps mb-2 mt-4 text-[9px]">Body zone</p>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="h-10 w-full border border-white/12 bg-ink-850 px-2 text-sm text-paper"
            >
              <option value="all">Every zone</option>
              {Object.entries(REGION_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="page-max page-x hidden items-center justify-between gap-3 pb-2 md:flex">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">Zone</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="h-7 border border-white/10 bg-transparent px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist outline-none"
            >
              <option value="all" className="bg-ink-850 text-paper">
                Every zone
              </option>
              {Object.entries(REGION_LABELS).map(([id, label]) => (
                <option key={id} value={id} className="bg-ink-850 text-paper">
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p aria-live="polite" className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
            {filtered.length} of {TATTOO_LIBRARY.length} designs
          </p>
        </div>
      </div>

      <div className="page-max page-x py-10">
        {filtered.length === 0 ? (
          <EmptyState
            title="No designs match those filters"
            description={
              favouritesOnly
                ? 'You have not saved any designs that match yet. Open a design and tap the heart to keep it here.'
                : 'Try a broader search, a different style, or clear the body-zone filter.'
            }
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStyle('all');
                  setRegion('all');
                  setFavouritesOnly(false);
                }}
              >
                Clear all filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {filtered.slice(0, visible).map((design, index) => (
                <TattooCard key={design.id} design={design} index={index} priority={index < 4} />
              ))}
            </div>
            {visible < filtered.length ? (
              <div ref={sentinel} className="flex justify-center py-12">
                <Button variant="outline" onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length))}>
                  Load more · {filtered.length - visible} remaining
                </Button>
              </div>
            ) : (
              <p className="py-12 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                End of selection · {filtered.length} designs
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
        active ? 'border-paper bg-paper text-ink-950' : 'border-white/10 text-mist hover:border-white/25 hover:text-paper',
      )}
    >
      {children}
    </button>
  );
}
