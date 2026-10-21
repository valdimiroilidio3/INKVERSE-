import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-mono text-[11px] uppercase tracking-[0.16em] transition-[background-color,color,border-color,transform] duration-300 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-40';

const variants: Record<Variant, string> = {
  primary:
    'bg-acid text-ink-950 hover:bg-[#e2ff7e] active:translate-y-px border border-acid',
  secondary:
    'bg-paper text-ink-950 hover:bg-white active:translate-y-px border border-paper',
  outline:
    'border border-white/20 text-paper hover:border-white/45 hover:bg-white/5 active:translate-y-px',
  ghost: 'text-mist-strong hover:text-paper hover:bg-white/5',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[10px]',
  md: 'h-11 px-5',
  lg: 'h-12 px-7',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  children,
  icon,
  trailing,
  ...props
}: CommonProps & ComponentPropsWithoutRef<'button'>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {icon}
      {children}
      {trailing}
    </button>
  );
}

export function ButtonLink({
  variant = 'outline',
  size = 'md',
  className,
  children,
  icon,
  trailing,
  href,
  ...props
}: CommonProps & { href: string } & Omit<ComponentPropsWithoutRef<typeof Link>, 'href'>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {icon}
      {children}
      {trailing}
    </Link>
  );
}

export function IconButton({
  className,
  label,
  children,
  active = false,
  ...props
}: { label: string; active?: boolean; children: ReactNode; className?: string } & ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={props['aria-pressed'] ?? active}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-sm border border-white/10 text-mist transition-colors duration-200 hover:border-white/30 hover:text-paper disabled:opacity-35',
        active && 'border-acid/60 text-acid',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
