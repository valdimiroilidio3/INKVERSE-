'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A very small scroll-reveal: one IntersectionObserver, CSS transitions only.
 * Content is visible by default when JS is unavailable or motion is reduced.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className,
  y = 18,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out-expo)] will-change-[opacity,transform]', className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translate3d(0,0,0)' : `translate3d(0,${y}px,0)`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}
