import { Fragment } from 'react';
import { cn } from '@/lib/cn';

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          <span className="whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.24em]">{item}</span>
          <span aria-hidden className="text-acid">
            ✳
          </span>
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className={cn('relative overflow-hidden border-y border-white/8 py-3 text-mist', className)} aria-hidden>
      <div className="marquee-track flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
