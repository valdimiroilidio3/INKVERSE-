'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  hint?: string;
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  disabled,
  className,
  hint,
}: RangeControlProps) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('group/range', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-caps text-[10px] text-mist">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[11px] tabular-nums text-paper-dim">
          {format ? format(value) : value.toFixed(2)}
        </output>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-[10px] h-px bg-ink-500">
          <div className="h-px bg-acid/80" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={format ? format(value) : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full"
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-mist/80">{hint}</p> : null}
    </div>
  );
}
