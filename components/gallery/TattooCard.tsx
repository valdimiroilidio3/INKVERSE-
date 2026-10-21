'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { REGION_LABELS } from '@/lib/regions';
import { STYLE_LABELS, type TattooDesign } from '@/lib/types';
import { useLibraryStore } from '@/store/library';

export function TattooCard({
  design,
  index,
  priority = false,
  onTry,
  variant = 'grid',
}: {
  design: TattooDesign;
  index: number;
  priority?: boolean;
  onTry?: () => void;
  variant?: 'grid' | 'feature';
}) {
  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const isFav = favorites.includes(design.id);

  return (
    <article
      className={cn(
        'group relative isolate overflow-hidden border border-white/8 bg-ink-850 transition-colors duration-500 hover:border-white/20',
        variant === 'feature' && 'aspect-[4/5]',
      )}
    >
      <Link href={`/tattoos/${design.slug}`} className="block focus-visible:outline-offset-[-3px]">
        <div className={cn('relative overflow-hidden', variant === 'feature' ? 'aspect-[4/5]' : 'aspect-square')}>
          <Image
            src={design.imageUrl}
            alt={`${design.name} — ${STYLE_LABELS[design.style]} tattoo design`}
            fill
            sizes={variant === 'feature' ? '(max-width: 768px) 100vw, 40vw' : '(max-width: 640px) 50vw, 25vw'}
            priority={priority}
            className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.045]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-95" />
          <span className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.16em] text-mist">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="absolute right-3 top-2.5 rounded-sm border border-white/15 bg-ink-950/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-dim backdrop-blur-sm">
            {STYLE_LABELS[design.style]}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3
            className={cn(
              'font-serif leading-none text-paper',
              variant === 'feature' ? 'text-3xl' : 'text-2xl',
            )}
          >
            {design.name}
          </h3>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
            {design.artist} · {design.recommendedRegions.slice(0, 2).map((r) => REGION_LABELS[r] ?? r).join(' / ')}
          </p>
          <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="inline-flex items-center gap-1 border border-white/20 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper">
              View <ArrowUpRight className="size-3" strokeWidth={1.6} />
            </span>
            {onTry ? (
              <span className="inline-flex items-center gap-1 border border-acid/60 bg-acid/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-acid">
                <Sparkles className="size-3" strokeWidth={1.6} /> Try on
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <button
        type="button"
        aria-label={isFav ? `Remove ${design.name} from favourites` : `Save ${design.name} to favourites`}
        aria-pressed={isFav}
        onClick={() => toggleFavorite(design.id)}
        className={cn(
          'absolute bottom-3 right-3 z-10 flex size-8 items-center justify-center border border-white/15 bg-ink-950/70 backdrop-blur-sm transition-colors hover:border-acid/60',
          isFav ? 'text-acid' : 'text-mist hover:text-paper',
        )}
      >
        <Heart className="size-3.5" strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
      </button>

      {onTry ? (
        <button
          type="button"
          onClick={onTry}
          className="sr-only focus:not-sr-only focus:absolute focus:bottom-14 focus:left-4 focus:z-10 focus:bg-acid focus:px-2 focus:py-1 focus:font-mono focus:text-[10px] focus:uppercase focus:text-ink-950"
        >
          Try {design.name} in the 3D studio
        </button>
      ) : null}
    </article>
  );
}
