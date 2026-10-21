'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroViewer = dynamic(() => import('@/components/three/HeroViewer').then((m) => m.HeroViewer), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[url('/editorial/hero-atlas.webp')] bg-cover bg-center opacity-70" />,
});

export function HeroStage({ poster }: { poster: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const schedule = () => setMounted(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(schedule, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(schedule, 300);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75"
        style={{ backgroundImage: `url(${poster})` }}
        role="img"
        aria-label="3D character with original tattoo work"
      />
    );
  }

  return <HeroViewer poster={poster} />;
}
