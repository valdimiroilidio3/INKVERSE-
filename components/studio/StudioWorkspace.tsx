'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Layers,
  Redo2,
  RotateCcw,
  Share2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { StudioCanvas } from './StudioCanvas';
import { DesignPanel } from './DesignPanel';
import { CompositionMeta, CompositionPanel } from './CompositionPanel';
import { CHARACTERS, getCharacter } from '@/lib/characters';
import { buildShareUrl, decodeComposition, encodeComposition } from '@/lib/share';
import { REGION_LABELS, getRegion, primarySlot } from '@/lib/regions';
import { getDesign } from '@/lib/tattoos';
import { formatPlacementSize } from '@/lib/placement';
import type { AppliedTattoo, CharacterModel, StudioView } from '@/lib/types';
import { MAX_TATTOOS } from '@/lib/schemas';
import { selectValidTattoos, useStudioStore } from '@/store/studio';
import { useLibraryStore } from '@/store/library';

const VIEW_OPTIONS: { value: StudioView; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export function StudioWorkspace() {
  const toast = useToast();
  const hydrated = useStudioStore((s) => s.hydrated);
  const hydrate = useStudioStore((s) => s.hydrate);
  const characterId = useStudioStore((s) => s.characterId);
  const regionId = useStudioStore((s) => s.regionId);
  const tattoos = useStudioStore(selectValidTattoos);
  const selectedId = useStudioStore((s) => s.selectedId);
  const view = useStudioStore((s) => s.view);
  const compare = useStudioStore((s) => s.compare);
  const spotlight = useStudioStore((s) => s.spotlight);
  const name = useStudioStore((s) => s.name);

  const setCharacter = useStudioStore((s) => s.setCharacter);
  const setRegion = useStudioStore((s) => s.setRegion);
  const setView = useStudioStore((s) => s.setView);
  const setCompare = useStudioStore((s) => s.setCompare);
  const setSpotlight = useStudioStore((s) => s.setSpotlight);
  const addTattoo = useStudioStore((s) => s.addTattoo);
  const removeTattoo = useStudioStore((s) => s.removeTattoo);
  const selectTattoo = useStudioStore((s) => s.selectTattoo);
  const clearAll = useStudioStore((s) => s.clearAll);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const loadComposition = useStudioStore((s) => s.loadComposition);

  const hydrateLibrary = useLibraryStore((s) => s.hydrate);
  const saveComposition = useLibraryStore((s) => s.saveComposition);
  const savedCount = useLibraryStore((s) => s.compositions.length);
  const entryApplied = useRef(false);
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  const character = getCharacter(characterId);
  const selectedTattoo = tattoos.find((t) => t.id === selectedId) ?? null;
  const region = getRegion(characterId, regionId);
  const slot = primarySlot(region);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shareApplied = useRef(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<'designs' | 'layers' | null>(null);
  const [sheetTab, setSheetTab] = useState<'library' | 'body'>('library');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    hydrateRef.current();
    hydrateLibrary();
  }, [hydrateLibrary]);

  // Restore a shared composition exactly once, after hydration.
  useEffect(() => {
    if (!hydrated || shareApplied.current) return;
    shareApplied.current = true;
    const param = new URLSearchParams(window.location.search).get('c');
    if (!param) return;
    const decoded = decodeComposition(param);
    if (!decoded) {
      toast.push('That share link is invalid or incomplete.', 'error');
      return;
    }
    loadComposition(decoded);
    toast.push(`Loaded shared composition “${decoded.name}”.`, 'success');
  }, [hydrated, loadComposition, toast]);

  useEffect(() => {
    if (!hydrated || entryApplied.current) return;
    entryApplied.current = true;
    const search = new URLSearchParams(window.location.search);
    const requestedCharacter = search.get('character');
    if (requestedCharacter === 'male' || requestedCharacter === 'female') {
      setCharacter(requestedCharacter);
    }
    const requestedDesign = search.get('design');
    if (requestedDesign) {
      const design = getDesign(requestedDesign);
      if (design) {
        const preferred = design.recommendedRegions[0];
        const target = preferred ?? 'forearm-l';
        useStudioStore.getState().setRegion(target);
        useStudioStore.getState().addTattoo(design.id, target);
        toast.push(`${design.name} staged in the studio.`, 'success');
      }
    }
  }, [hydrated, setCharacter, toast]);

  const appliedByRegion = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tattoo of tattoos) {
      counts[tattoo.bodyRegion] = (counts[tattoo.bodyRegion] ?? 0) + 1;
    }
    return counts;
  }, [tattoos]);

  const handleAdd = useCallback(
    (designId: string) => {
      const design = getDesign(designId);
      if (!design) return;
      if (tattoos.length >= MAX_TATTOOS) {
        toast.push('Eight layers is the limit. Remove one to continue.', 'error');
        return;
      }
      const created = addTattoo(designId, regionId);
      if (!created) {
        toast.push('This zone cannot hold the piece at the current size.', 'error');
        return;
      }
      toast.push(`${design.name} applied to ${REGION_LABELS[regionId] ?? 'the body'}.`, 'success');
    },
    [addTattoo, regionId, tattoos.length, toast],
  );

  const handlePickRegion = useCallback(
    (id: string) => {
      setRegion(id);
      const existing = tattoos.find((t) => t.bodyRegion === id);
      if (existing) selectTattoo(existing.id);
    },
    [selectTattoo, setRegion, tattoos],
  );

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.push('The 3D canvas is not ready yet.', 'error');
      return;
    }
    try {
      // The viewport is transparent by design; composite onto the stage colour so
      // the file opens as a framed still rather than a cut-out.
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('2D context unavailable');
      ctx.fillStyle = '#0b0b0c';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);
      const url = out.toDataURL('image/png');
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `inkverse-${characterId}-${stamp}.png`;
      link.click();
      toast.push('PNG captured from the 3D viewport.', 'success');
    } catch {
      toast.push('This browser blocked the capture. Try a different browser.', 'error');
    }
  }, [characterId, toast]);

  const handleShare = useCallback(async () => {
    const encoded = encodeComposition({ name, characterId, tattoos });
    const url = buildShareUrl(window.location.origin, encoded);
    setShareUrl(url);
    setShareOpen(true);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [characterId, name, tattoos]);

  const handleSave = useCallback(() => {
    const result = saveComposition({ name, characterId, tattoos });
    if (!result.ok) {
      const message =
        result.reason === 'empty'
          ? 'Add at least one tattoo before saving.'
          : result.reason === 'quota'
            ? 'Local storage is full. Delete a saved composition and try again.'
            : 'That composition could not be saved.';
      toast.push(message, 'error');
      return;
    }
    setLastSaved(result.composition.updatedAt);
    setSaveOpen(false);
    toast.push('Composition saved on this device.', 'success');
  }, [characterId, name, saveComposition, tattoos, toast]);

  // keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (!meta && event.key.toLowerCase() === 'c') {
        setCompare(!useStudioStore.getState().compare);
      } else if (!meta && ['1', '2', '3', '4'].includes(event.key)) {
        const option = VIEW_OPTIONS[Number(event.key) - 1];
        if (option) setView(option.value);
      } else if (event.key === 'Escape') {
        selectTattoo(null);
        setSheet(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [redo, selectTattoo, setCompare, setView, undo]);

  const supportedCount = character.supportedRegions.length;

  return (
    <div className="flex min-h-[calc(100dvh-var(--header-h))] flex-col bg-ink-950 pt-[var(--header-h)]">
      {/* ------------------------------------------------------------ top bar */}
      <div className="border-b border-white/8 bg-ink-900">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 md:px-4">
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-mist md:inline">Body</span>
            <Segmented
              label="Character"
              value={characterId}
              size="sm"
              onChange={(value) => setCharacter(value as CharacterModel['id'])}
              options={CHARACTERS.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="hidden h-5 w-px bg-white/10 md:block" />

          <Segmented
            label="Camera view"
            value={view}
            size="sm"
            onChange={(value) => setView(value)}
            options={VIEW_OPTIONS}
          />

          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 className="size-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 className="size-4" strokeWidth={1.5} />
            </IconButton>
            <IconButton
              label={compare ? 'Show ink' : 'Hide ink to compare'}
              active={compare}
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              {compare ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </IconButton>
            <IconButton
              label={spotlight ? 'Turn zone highlight off' : 'Highlight selected zone'}
              active={spotlight}
              aria-pressed={spotlight}
              onClick={() => setSpotlight(!spotlight)}
            >
              <Sparkles className="size-4" strokeWidth={1.5} />
            </IconButton>
            <button
              type="button"
              onClick={() => {
                if (tattoos.length === 0) {
                  toast.push('Nothing to reset yet.', 'info');
                  return;
                }
                clearAll();
                toast.push('Canvas cleared. Undo is available.', 'info');
              }}
              className="hidden h-9 items-center gap-1.5 border border-white/10 px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-mist transition-colors hover:border-white/30 hover:text-paper lg:inline-flex"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.5} /> Reset
            </button>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 border border-white/15 px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-white/35"
            >
              <Check className="size-3.5" strokeWidth={1.6} /> Save
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-9 items-center gap-1.5 border border-white/15 px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper transition-colors hover:border-white/35"
            >
              <Share2 className="size-3.5" strokeWidth={1.6} /> <span className="hidden sm:inline">Share</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-9 items-center gap-1.5 border border-acid bg-acid px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-950 transition-colors hover:bg-[#e2ff7e]"
            >
              <Download className="size-3.5" strokeWidth={1.8} /> <span className="hidden sm:inline">PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- workspace */}
      <div className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="hidden min-h-0 border-r border-white/8 lg:block" aria-label="Designs and body zones">
          <DesignPanel
            characterId={characterId}
            regionId={regionId}
            onAdd={handleAdd}
            onSelectRegion={handlePickRegion}
            appliedByRegion={appliedByRegion}
            className="h-[calc(100dvh-var(--header-h)-57px)]"
          />
        </aside>

        <main className="min-h-0 p-3 md:p-4">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="font-serif text-2xl leading-none text-paper md:text-3xl">{character.name}</h1>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist">3D studio</span>
              </div>
              <AppliedSummary tattoos={tattoos} characterId={characterId} className="mt-1.5 hidden sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <Tag tone="dark">{tattoos.length.toString().padStart(2, '0')} / 08 layers</Tag>
              <Tag tone={compare ? 'acid' : 'default'}>{compare ? 'ink hidden' : 'ink live'}</Tag>
            </div>
          </div>

          <StudioCanvas
            characterId={characterId}
            tattoos={tattoos}
            regionId={regionId}
            selectedTattooId={selectedId}
            compare={compare}
            spotlight={spotlight}
            view={view}
            onPickRegion={handlePickRegion}
            onCanvasReady={(canvas) => {
              canvasRef.current = canvas;
            }}
            className="h-[52dvh] min-h-[340px] lg:h-[calc(100dvh-var(--header-h)-190px)]"
          />

          <div className="mt-3 hidden items-start justify-between gap-6 lg:flex">
            <p className="max-w-xl text-[11px] leading-relaxed text-mist">
              Ink is composited in the skin shader using each design&apos;s UV placement, so it follows the anatomy while
              you orbit. {supportedCount} body zones are mapped on this mesh.
            </p>
            <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-mist/80">
              ⌘Z undo · C compare · 1–4 views
            </p>
          </div>
        </main>

        <aside className="hidden min-h-0 border-l border-white/8 xl:block" aria-label="Composition and properties">
          <div className="flex h-[calc(100dvh-var(--header-h)-57px)] flex-col">
            <CompositionMeta lastSaved={lastSaved} />
            <CompositionPanel
              characterId={characterId}
              tattoos={tattoos}
              selectedTattoo={selectedTattoo}
              regionId={regionId}
              onSelect={(id) => selectTattoo(id)}
              className="min-h-0 flex-1"
            />
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------------ mobile dock */}
      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-ink-900/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setSheetTab('library');
              setSheet('designs');
            }}
            className="flex h-14 flex-col items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-dim"
          >
            <Sparkles className="size-4" strokeWidth={1.5} />
            Designs
          </button>
          <button
            type="button"
            onClick={() => {
              setSheetTab('body');
              setSheet('designs');
            }}
            className="flex h-14 flex-col items-center justify-center gap-1 border-x border-white/10 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-dim"
          >
            <span className="font-mono text-[11px] text-acid">{REGION_LABELS[regionId] ?? 'Zone'}</span>
            Body zone
          </button>
          <button
            type="button"
            onClick={() => setSheet('layers')}
            className="flex h-14 flex-col items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-dim"
          >
            <Layers className="size-4" strokeWidth={1.5} />
            Layers · {tattoos.length.toString().padStart(2, '0')}
          </button>
        </div>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-black/70"
            onClick={() => setSheet(null)}
          />
          <div className="relative flex h-[66dvh] flex-col border-t border-white/15 bg-ink-900">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
              <span className="label-caps text-[10px]">{sheet === 'layers' ? 'Composition' : 'Design library'}</span>
              <button type="button" onClick={() => setSheet(null)} aria-label="Close" className="text-mist hover:text-paper">
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            {sheet === 'designs' ? (
              <DesignPanel
                key={sheetTab}
                characterId={characterId}
                regionId={regionId}
                onAdd={handleAdd}
                onSelectRegion={handlePickRegion}
                appliedByRegion={appliedByRegion}
                className="min-h-0 flex-1"
              />
            ) : (
              <CompositionPanel
                characterId={characterId}
                tattoos={tattoos}
                selectedTattoo={selectedTattoo}
                regionId={regionId}
                onSelect={(id) => selectTattoo(id)}
                className="min-h-0 flex-1"
              />
            )}
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- dialogs */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save composition" size="sm">
        <div className="space-y-4">
          <label className="block">
            <span className="label-caps mb-2 block text-[10px]">Project name</span>
            <input
              data-autofocus
              value={name}
              maxLength={48}
              onChange={(event) => useStudioStore.getState().setName(event.target.value)}
              className="h-11 w-full border border-white/15 bg-ink-850 px-3 text-sm text-paper outline-none focus:border-acid/60"
            />
          </label>
          <p className="text-xs leading-relaxed text-mist">
            {tattoos.length} tattoo{tattoos.length === 1 ? '' : 's'} on the {character.name} model. Saved compositions
            live in this browser — no account required.
          </p>
          <div className="flex items-center justify-between gap-3 pt-1">
            <Link href="/saved" className="text-[11px] uppercase tracking-[0.12em] text-mist underline-offset-4 hover:text-paper hover:underline">
              {savedCount} saved
            </Link>
            <Button variant="primary" onClick={handleSave}>
              Save composition
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this composition" size="sm">
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-mist">
            The link carries the whole composition — no account needed. Anyone who opens it gets the same body, zones
            and placements.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              aria-label="Share link"
              className="h-10 min-w-0 flex-1 border border-white/15 bg-ink-850 px-2 font-mono text-[10px] text-paper-dim"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              variant={copied ? 'primary' : 'outline'}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  toast.push('Link copied to clipboard.', 'success');
                } catch {
                  toast.push('Copy failed — select the link manually.', 'error');
                }
              }}
              icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[10px] leading-relaxed text-mist/80">
            Links are self-contained and can be long. Extremely long links are rejected rather than silently truncated.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export function AppliedSummary({
  tattoos,
  characterId,
  className,
}: {
  tattoos: AppliedTattoo[];
  characterId: CharacterModel['id'];
  className?: string;
}) {
  const region = tattoos[0] ? getRegion(characterId, tattoos[0].bodyRegion) : undefined;
  const slot = primarySlot(region);
  if (!tattoos[0] || !slot) return null;
  const design = getDesign(tattoos[0].designId);
  if (!design) return null;
  return (
    <div className={cn('font-mono text-[9px] uppercase tracking-[0.14em] text-mist', className)}>
      {formatPlacementSize(design.defaultSize)} · {REGION_LABELS[tattoos[0].bodyRegion]}
    </div>
  );
}
