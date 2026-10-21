import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex min-h-[80dvh] items-center pt-[var(--header-h)]">
      <div className="page-max page-x w-full">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid">404</p>
        <h1 className="mt-6 max-w-2xl font-sans text-display font-medium text-paper">
          This page left
          <br />
          the studio.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-mist">
          The link is broken or the design was removed. The gallery and the 3D studio are still open.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/explore" variant="primary">
            Explore designs
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back home
          </ButtonLink>
        </div>
        <p className="mt-12 text-xs text-mist">
          Looking for something specific?{' '}
          <Link href="/explore" className="text-paper underline underline-offset-4">
            Search the library
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
