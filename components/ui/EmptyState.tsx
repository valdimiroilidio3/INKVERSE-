import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-4 border border-dashed border-white/12 px-6 py-10', className)}>
      {icon ? <div className="text-mist">{icon}</div> : null}
      <div className="max-w-md">
        <h3 className="font-serif text-2xl leading-tight text-paper">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-mist">{description}</p>
      </div>
      {action}
    </div>
  );
}
