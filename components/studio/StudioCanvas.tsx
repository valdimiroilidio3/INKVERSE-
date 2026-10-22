'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { Minus, Plus, RotateCcw, ScanLine } from 'lucide-react';
import { cn } from '@/lib/cn';
import { REGION_LABELS } from '@/lib/regions';
import { LoadingState } from '@/components/ui/LoadingState';
import type { SceneApi } from '@/components/three/StudioScene';
import type { AppliedTattoo, CharacterModel, StudioView } from '@/lib/types';

const StudioScene = dynamic(() => import('@/components/three/StudioScene').then((mod) => mod.StudioScene), {
  ssr: false,
});

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Cheap capability probe: R3F throws deep inside the renderer when no context can be
 * created, which leaves a black rectangle. Checking first gives an honest message.
 */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export interface StudioCanvasProps {
  characterId: CharacterModel['id'];
  tattoos: AppliedTattoo[];
  regionId: string;
  selectedTattooId: string | null;
  compare: boolean;
  spotlight: boolean;
  view: StudioView;
  onPickRegion: (id: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  className?: string;
}

export function StudioCanvas({
  characterId,
  tattoos,
  regionId,
  selectedTattooId,
  compare,
  spotlight,
  view,
  onPickRegion,
  onCanvasReady,
  className,
}: StudioCanvasProps) {
  const [ready, setReady] = useState(false);
  const [api, setApi] = useState<SceneApi | null>(null);
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [slow, setSlow] = useState(false);
  const { active, progress, item } = useProgress();

  useEffect(() => {
    setSupported(webglAvailable());
  }, []);

  // If nothing has rendered after 15 s, say so instead of showing a spinner forever.
  useEffect(() => {
    if (ready || failed || supported === false) return;
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, [ready, failed, supported]);

  const loading = !ready || (active && progress < 100);

  const handleReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      setReady(true);
      onCanvasReady?.(canvas);
    },
    [onCanvasReady],
  );

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden border border-white/8 bg-[radial-gradient(120%_90%_at_50%_18%,#1a1a1b_0%,#0b0b0c_52%,#060607_100%)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]" />

      {supported === false ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <ScanLine className="size-6 text-mist" strokeWidth={1.2} />
          <p className="max-w-xs text-sm leading-relaxed text-mist">
            This browser has WebGL disabled, so the 3D studio cannot start. The gallery and saved designs still work.
            Enable hardware acceleration or open the studio in a recent Chrome, Edge, Safari or Firefox.
          </p>
        </div>
      ) : failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <ScanLine className="size-6 text-mist" strokeWidth={1.2} />
          <p className="max-w-xs text-sm leading-relaxed text-mist">
            The 3D scene could not start — the character model or its maps failed to load, or the GPU context was
            lost. Reload to try again; the rest of the site keeps working.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 inline-flex h-9 items-center border border-white/20 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-paper hover:border-acid hover:text-acid"
          >
            Reload
          </button>
        </div>
      ) : (
        <SceneErrorBoundary
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <ScanLine className="size-6 text-mist" strokeWidth={1.2} />
              <p className="max-w-xs text-sm leading-relaxed text-mist">
                The 3D scene could not initialise. Reload the page, or open it on a device with WebGL 2 support.
              </p>
            </div>
          }
        >
          <StudioScene
            characterId={characterId}
            tattoos={tattoos}
            regionId={regionId}
            selectedTattooId={selectedTattooId}
            compare={compare}
            view={view}
            spotlight={spotlight}
            onPickRegion={onPickRegion}
            onApi={setApi}
            onReady={handleReady}
            onError={() => setFailed(true)}
            onDegraded={() => setDegraded(true)}
          />
        </SceneErrorBoundary>
      )}

      {supported !== false && loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-900/55">
          {slow ? (
            <div className="pointer-events-auto max-w-xs px-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">Still loading</p>
              <p className="mt-2 text-xs leading-relaxed text-mist/80">
                {item ? `Waiting on ${item.split('/').pop()}` : 'Waiting on the GPU'}
                {progress > 0 ? ` · ${Math.round(progress)}%` : ''}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex h-8 items-center border border-white/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper hover:border-acid hover:text-acid"
              >
                Reload
              </button>
            </div>
          ) : (
            <LoadingState label={item ? `Loading ${item.split('/').pop()}` : 'Loading character & skin maps'} />
          )}
        </div>
      ) : null}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-acid">
            {REGION_LABELS[regionId] ?? 'Body'}
          </span>
          <span className="text-[11px] leading-relaxed text-mist">
            Click the body to change region · drag to rotate
          </span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
            {tattoos.length.toString().padStart(2, '0')} layers
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => api?.zoom(0.85)}
          aria-label="Zoom in"
          className="flex size-9 items-center justify-center border border-white/12 bg-ink-900/70 text-paper backdrop-blur transition-colors hover:border-white/35"
        >
          <Plus className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => api?.zoom(1.18)}
          aria-label="Zoom out"
          className="flex size-9 items-center justify-center border border-white/12 bg-ink-900/70 text-paper backdrop-blur transition-colors hover:border-white/35"
        >
          <Minus className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => api?.reset()}
          aria-label="Reset camera"
          className="flex size-9 items-center justify-center border border-white/12 bg-ink-900/70 text-paper backdrop-blur transition-colors hover:border-white/35"
        >
          <RotateCcw className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[70%] flex-col gap-1 text-[10px] uppercase tracking-[0.16em] text-mist">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full transition-colors',
              degraded ? 'bg-blood' : ready ? 'bg-acid' : 'bg-ink-500',
            )}
          />
          {degraded
            ? 'Ink preview unavailable — skin only'
            : compare
              ? 'Ink hidden — comparison mode'
              : 'Ink live on surface'}
        </span>
        {degraded ? (
          <span className="normal-case tracking-normal text-mist/70">
            This GPU rejected the ink shader, so the body is rendered with the base skin material.
          </span>
        ) : null}
      </div>
    </div>
  );
}
