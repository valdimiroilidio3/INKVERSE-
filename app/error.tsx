'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // surfaced in the browser console only; there is no server to report to
    console.error('[inkverse] route error', error);
  }, [error]);

  return (
    <main className="flex min-h-[80dvh] items-center pt-[var(--header-h)]">
      <div className="page-max page-x w-full">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blood">Something broke</p>
        <h1 className="mt-6 max-w-2xl font-sans text-[clamp(2rem,6vw,4rem)] font-medium leading-[0.94] tracking-[-0.03em] text-paper">
          This surface did not
          <br />
          <span className="font-serif italic text-paper-dim">hold the ink.</span>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-mist">
          A client-side error interrupted this view. Nothing you saved was lost — compositions live in this browser.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center border border-acid bg-acid px-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-950"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center border border-white/20 px-5 font-mono text-[11px] uppercase tracking-[0.16em] text-paper"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
