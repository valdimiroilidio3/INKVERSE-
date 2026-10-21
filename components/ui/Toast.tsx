'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      setItems((current) => current.slice(1));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [items]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex flex-col items-center gap-2 px-4" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-3 border px-4 py-3 text-sm shadow-[var(--shadow-lift)] backdrop-blur',
              item.tone === 'success' && 'border-acid/40 bg-ink-800/95 text-paper',
              item.tone === 'error' && 'border-blood/50 bg-ink-800/95 text-paper',
              item.tone === 'info' && 'border-white/15 bg-ink-800/95 text-paper-dim',
            )}
          >
            {item.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-acid" strokeWidth={1.6} /> : null}
            {item.tone === 'error' ? <TriangleAlert className="size-4 shrink-0 text-blood" strokeWidth={1.6} /> : null}
            {item.tone === 'info' ? <Info className="size-4 shrink-0 text-mist" strokeWidth={1.6} /> : null}
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
