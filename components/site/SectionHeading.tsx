import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  action,
  className,
  align = 'left',
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        <div className="flex items-center gap-3">
          {index ? <span className="font-mono text-[11px] tracking-[0.2em] text-acid">{index}</span> : null}
          {eyebrow ? <span className="label-caps text-[10px] text-mist">{eyebrow}</span> : null}
        </div>
        <h2 className="mt-4 text-balance font-sans text-editorial font-medium text-paper">{title}</h2>
        {description ? <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
