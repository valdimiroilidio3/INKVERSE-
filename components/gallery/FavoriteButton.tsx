'use client';

import { useEffect } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLibraryStore } from '@/store/library';

export function FavoriteButton({ designId, name, className }: { designId: string; name: string; className?: string }) {
  const hydrated = useLibraryStore((s) => s.hydrated);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const favorites = useLibraryStore((s) => s.favorites);
  const toggle = useLibraryStore((s) => s.toggleFavorite);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const active = favorites.includes(designId);

  return (
    <button
      type="button"
      onClick={() => toggle(designId)}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={cn(
        'inline-flex h-12 items-center gap-2 border px-5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors',
        active ? 'border-acid/60 text-acid' : 'border-white/20 text-paper hover:border-white/40',
        !hydrated && 'opacity-70',
        className,
      )}
    >
      <Heart className="size-4" strokeWidth={1.6} fill={active ? 'currentColor' : 'none'} />
      {active ? 'Saved' : 'Save design'}
    </button>
  );
}
