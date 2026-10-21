'use client';

import { cn } from '@/lib/cn';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ options, value, onChange, label, className, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex border border-white/12 p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.12em] transition-colors duration-200',
              size === 'sm' ? 'h-7 px-2 text-[9px]' : 'h-8 px-3 text-[10px]',
              active ? 'bg-paper text-ink-950' : 'text-mist hover:text-paper',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
