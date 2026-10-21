'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ButtonLink } from '@/components/ui/Button';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/studio', label: '3D Studio' },
  { href: '/saved', label: 'Saved' },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const isStudio = pathname?.startsWith('/studio');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
          scrolled || open || isStudio
            ? 'border-b border-white/8 bg-ink-900/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="page-max page-x flex h-[var(--header-h)] items-center justify-between gap-6">
          <Link href="/" className="group flex items-baseline gap-1.5" aria-label="INKVERSE home">
            <span className="font-sans text-[15px] font-semibold uppercase tracking-[0.34em] text-paper">INKVERSE</span>
            <span className="translate-y-[-2px] font-serif text-[11px] text-acid">®</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-300',
                    active ? 'text-paper' : 'text-mist hover:text-paper',
                  )}
                >
                  {item.label}
                  {active ? <span className="absolute inset-x-3 -bottom-px h-px bg-acid" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink
              href="/studio"
              size="sm"
              variant="primary"
              className="hidden sm:inline-flex"
              trailing={<ArrowUpRight className="size-3.5" strokeWidth={1.8} />}
            >
              Enter studio
            </ButtonLink>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center border border-white/12 text-paper md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="fixed inset-0 z-40 bg-ink-900/97 pt-[var(--header-h)] backdrop-blur-xl md:hidden"
          >
            <nav aria-label="Mobile" className="page-x flex flex-col gap-1 pt-8">
              {NAV.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: reduce ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.05 * index, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={item.href}
                    className="flex items-center justify-between border-b border-white/8 py-5 font-serif text-4xl text-paper"
                  >
                    {item.label}
                    <ArrowUpRight className="size-6 text-mist" strokeWidth={1.2} />
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="page-x mt-10">
              <ButtonLink href="/studio" variant="primary" size="lg" className="w-full">
                Enter 3D studio
              </ButtonLink>
              <p className="mt-6 max-w-xs text-xs leading-relaxed text-mist">
                Virtual try-on is a visual simulation. It is not a guarantee of how a tattoo will look on skin.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
