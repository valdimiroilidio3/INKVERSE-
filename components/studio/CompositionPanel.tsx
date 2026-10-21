'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { Copy, FlipHorizontal2, Layers, RotateCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeControl } from '@/components/ui/RangeControl';
import { Tag } from '@/components/ui/Tag';
import { computePlacement, formatPlacementSize } from '@/lib/placement';
import { getRegions, primarySlot, REGION_LABELS } from '@/lib/regions';
import { getDesign, TATTOO_LIBRARY } from '@/lib/tattoos';
import { formatRelative } from '@/lib/format';
import type { AppliedTattoo, CharacterModel } from '@/lib/types';
import { useStudioStore } from '@/store/studio';
import { useLibraryStore } from '@/store/library';

export function CompositionPanel({
  characterId,
  tattoos,
  selectedTattoo,
  regionId,
  onSelect,
  className,
}: {
  characterId: CharacterModel['id'];
  tattoos: AppliedTattoo[];
  selectedTattoo: AppliedTattoo | null;
  regionId: string;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const updateTattoo = useStudioStore((s) => s.updateTattoo);
  const removeTattoo = useStudioStore((s) => s.removeTattoo);
  const duplicateTattoo = useStudioStore((s) => s.duplicateTattoo);
  const selectTattoo = useStudioStore((s) => s.selectTattoo);
  const regions = useMemo(() => getRegions(characterId), [characterId]);
  const design = selectedTattoo ? getDesign(selectedTattoo.designId) : null;
  const slot = useMemo(() => {
    if (!selectedTattoo) return null;
    return primarySlot(regions.find((r) => r.id === selectedTattoo.bodyRegion));
  }, [selectedTattoo, regions]);

  const placement = useMemo(() => {
    if (!selectedTattoo || !slot || !design) return null;
    return computePlacement({
      slot,
      designSize: design.defaultSize,
      scale: selectedTattoo.scale,
      offset: selectedTattoo.offset,
      rotation: selectedTattoo.rotation,
    });
  }, [selectedTattoo, slot, design]);

  const recommended = design?.recommendedRegions ?? [];

  return (
    <div className={cn('flex min-h-0 flex-col bg-ink-900', className)}>
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <span className="label-caps text-[10px]">Composition</span>
        <span className="font-mono text-[10px] text-mist">{tattoos.length.toString().padStart(2, '0')} / 08</span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <section aria-label="Selected tattoo" className="border-b border-white/8 p-4">
          {selectedTattoo && design ? (
            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden border border-white/10">
                  <Image src={design.imageUrl} alt={design.name} fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-xl leading-tight text-paper">{design.name}</h2>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mist">
                    {design.artist} · {REGION_LABELS[selectedTattoo.bodyRegion]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Tag tone="acid">{formatPlacementSize(placement?.sizeMeters ?? design.defaultSize)}</Tag>
                    {placement?.clamped ? <Tag tone="dark">fitted to zone</Tag> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <RangeControl
                  label="Size"
                  value={selectedTattoo.scale}
                  min={0.3}
                  max={1.6}
                  step={0.01}
                  onChange={(value) => updateTattoo(selectedTattoo.id, { scale: value })}
                  format={(v) => `${Math.round((placement?.sizeMeters ?? design.defaultSize) * 100)} cm`}
                />
                <RangeControl
                  label="Rotation"
                  value={selectedTattoo.rotation}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={(value) => updateTattoo(selectedTattoo.id, { rotation: value })}
                  format={(v) => `${Math.round(v)}°`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <RangeControl
                    label="Position X"
                    value={selectedTattoo.offset[0]}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateTattoo(selectedTattoo.id, { offset: [value, selectedTattoo.offset[1]] })}
                    format={(v) => v.toFixed(2)}
                  />
                  <RangeControl
                    label="Position Y"
                    value={selectedTattoo.offset[1]}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateTattoo(selectedTattoo.id, { offset: [selectedTattoo.offset[0], value] })}
                    format={(v) => v.toFixed(2)}
                  />
                </div>
                <RangeControl
                  label="Ink density"
                  value={selectedTattoo.opacity}
                  min={0.15}
                  max={1}
                  step={0.01}
                  onChange={(value) => updateTattoo(selectedTattoo.id, { opacity: value })}
                  format={(v) => `${Math.round(v * 100)}%`}
                  hint="Preview opacity only — a real tattoo is permanent."
                />
              </div>

              <div className="space-y-2">
                <label className="label-caps block text-[10px]" htmlFor="region-move">
                  Body zone
                </label>
                <select
                  id="region-move"
                  value={selectedTattoo.bodyRegion}
                  onChange={(event) => {
                    const next = event.target.value;
                    updateTattoo(selectedTattoo.id, { bodyRegion: next, offset: [0, 0] });
                    selectTattoo(selectedTattoo.id);
                  }}
                  className="h-9 w-full border border-white/12 bg-ink-850 px-2 text-xs text-paper"
                >
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                      {recommended.includes(region.id) ? ' — recommended' : ''}
                    </option>
                  ))}
                </select>
                {!recommended.includes(selectedTattoo.bodyRegion) ? (
                  <p className="text-[10px] leading-relaxed text-mist/80">
                    This zone is not a recommended fit for this artwork. The piece is fitted to the available surface.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="label-caps block text-[10px]" htmlFor="design-swap">
                  Swap design
                </label>
                <select
                  id="design-swap"
                  value={selectedTattoo.designId}
                  onChange={(event) => updateTattoo(selectedTattoo.id, { designId: event.target.value })}
                  className="h-9 w-full border border-white/12 bg-ink-850 px-2 text-xs text-paper"
                >
                  {TATTOO_LIBRARY.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <ToolButton
                  label="Duplicate tattoo"
                  onClick={() => duplicateTattoo(selectedTattoo.id)}
                >
                  <Copy className="size-4" strokeWidth={1.5} />
                </ToolButton>
                <ToolButton
                  label="Mirror tattoo"
                  active={selectedTattoo.mirrored}
                  onClick={() => updateTattoo(selectedTattoo.id, { mirrored: !selectedTattoo.mirrored })}
                >
                  <FlipHorizontal2 className="size-4" strokeWidth={1.5} />
                </ToolButton>
                <ToolButton
                  label="Rotate 90 degrees"
                  onClick={() => updateTattoo(selectedTattoo.id, { rotation: selectedTattoo.rotation + 90 > 180 ? -180 + (selectedTattoo.rotation + 90 - 180) : selectedTattoo.rotation + 90 })}
                >
                  <RotateCw className="size-4" strokeWidth={1.5} />
                </ToolButton>
                <ToolButton label="Remove tattoo" danger onClick={() => removeTattoo(selectedTattoo.id)}>
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </ToolButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-mist">
                <Layers className="size-4" strokeWidth={1.4} />
                <span className="label-caps text-[10px]">No tattoo selected</span>
              </div>
              <p className="text-xs leading-relaxed text-mist">
                Pick a design from the library to apply it to{' '}
                <span className="text-paper">{REGION_LABELS[regionId] ?? 'the selected zone'}</span>, or select a layer
                below to edit it.
              </p>
            </div>
          )}
        </section>

        <section aria-label="Layers" className="p-2">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="label-caps text-[10px]">Layers</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-mist">highest first</span>
          </div>
          {tattoos.length === 0 ? (
            <p className="px-2 py-4 text-[11px] leading-relaxed text-mist">
              The skin is clean. Applied designs will stack here — up to eight independent layers.
            </p>
          ) : (
            <ul className="space-y-1">
              {[...tattoos].reverse().map((tattoo, index) => {
                const item = getDesign(tattoo.designId);
                const active = selectedTattoo?.id === tattoo.id;
                return (
                  <li key={tattoo.id}>
                    <div
                      className={cn(
                        'group flex items-center gap-2 border px-2 py-1.5 transition-colors',
                        active ? 'border-acid/40 bg-acid/5' : 'border-transparent hover:border-white/12',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(tattoo.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-pressed={active}
                      >
                        <span className="relative size-8 shrink-0 overflow-hidden border border-white/10">
                          {item ? (
                            <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] text-paper-dim">
                            {item?.name ?? 'Unavailable design'}
                          </span>
                          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-mist">
                            {String(tattoos.length - index).padStart(2, '0')} · {REGION_LABELS[tattoo.bodyRegion] ?? tattoo.bodyRegion}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTattoo(tattoo.id)}
                        aria-label={`Remove ${item?.name ?? 'layer'}`}
                        className="text-mist opacity-0 transition-opacity hover:text-blood focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  children,
  onClick,
  danger = false,
  active = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 items-center justify-center border border-white/12 text-mist transition-colors hover:border-white/30 hover:text-paper',
        active && 'border-acid/50 text-acid',
        danger && 'hover:border-blood/60 hover:text-blood',
      )}
    >
      {children}
    </button>
  );
}

export function CompositionMeta({ lastSaved }: { lastSaved: string | null }) {
  const name = useStudioStore((s) => s.name);
  const setName = useStudioStore((s) => s.setName);
  const compositions = useLibraryStore((s) => s.compositions);
  return (
    <div className="space-y-2 border-b border-white/8 p-4">
      <label htmlFor="composition-name" className="label-caps block text-[10px]">
        Project name
      </label>
      <input
        id="composition-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={48}
        className="h-9 w-full border border-white/12 bg-ink-850 px-2 text-sm text-paper outline-none focus:border-acid/60"
      />
      <p className="text-[10px] text-mist">
        {lastSaved
          ? `Workspace saved locally ${formatRelative(lastSaved)} · ${compositions.length} saved compositions`
          : `${compositions.length} saved compositions on this device`}
      </p>
    </div>
  );
}
