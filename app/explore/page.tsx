import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GalleryExplorer } from '@/components/gallery/GalleryExplorer';
import { LoadingState } from '@/components/ui/LoadingState';
import { TATTOO_LIBRARY, STYLE_COUNTS } from '@/lib/tattoos';
import { TATTOO_STYLES, STYLE_LABELS } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Explore the gallery',
  description:
    'Browse the INKVERSE tattoo library — blackwork, Japanese, fine line, realism, tribal and more. Original artwork, each piece mapped to the body zones it was drawn for.',
};

export default function ExplorePage() {
  return (
    <main className="pt-[var(--header-h)]">
      <header className="page-max page-x pb-8 pt-14 md:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-acid" />
              <span className="label-caps text-[10px]">The library</span>
            </div>
            <h1 className="mt-5 font-sans text-editorial font-medium text-paper">
              Explore the
              <br />
              <span className="font-serif italic text-paper-dim">collection.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-mist">
              {TATTOO_LIBRARY.length} original designs across {TATTOO_STYLES.length} disciplines. Every piece lists the
              body zones it was drawn for — and opens straight into the 3D studio.
            </p>
          </div>
          <dl className="flex gap-8 border-t border-white/10 pt-4">
            <div>
              <dt className="label-caps text-[9px]">Designs</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-paper">{TATTOO_LIBRARY.length.toString().padStart(2, '0')}</dd>
            </div>
            <div>
              <dt className="label-caps text-[9px]">Styles</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-paper">{TATTOO_STYLES.length.toString().padStart(2, '0')}</dd>
            </div>
            <div>
              <dt className="label-caps text-[9px]">Artists</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-paper">
                {new Set(TATTOO_LIBRARY.map((d) => d.artist)).size.toString().padStart(2, '0')}
              </dd>
            </div>
          </dl>
        </div>
        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
          {TATTOO_STYLES.map((style) => (
            <span key={style}>
              {STYLE_LABELS[style]} {STYLE_COUNTS[style] ?? 0}
            </span>
          ))}
        </p>
      </header>
      <Suspense
        fallback={
          <div className="page-max page-x py-20">
            <LoadingState label="Loading the library" />
          </div>
        }
      >
        <GalleryExplorer />
      </Suspense>
    </main>
  );
}
