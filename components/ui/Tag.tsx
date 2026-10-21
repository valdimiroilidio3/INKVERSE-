import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Tag({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'acid' | 'dark';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.14em]',
        tone === 'default' && 'border-white/15 text-mist-strong',
        tone === 'acid' && 'border-acid/50 text-acid',
        tone === 'dark' && 'border-white/10 bg-ink-800/80 text-mist',
        className,
      )}
    >
      {children}
    </span>
  );
}
