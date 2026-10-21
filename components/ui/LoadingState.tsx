import { cn } from '@/lib/cn';

export function LoadingState({
  label = 'Loading',
  className,
  progress,
}: {
  label?: string;
  className?: string;
  progress?: number;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3', className)} role="status" aria-live="polite">
      <span className="label-caps text-[10px] text-mist">{label}</span>
      <span className="relative block h-px w-40 overflow-hidden bg-ink-500">
        {progress === undefined ? (
          <span className="absolute inset-y-0 left-0 w-1/3 animate-[loading_1.4s_ease-in-out_infinite] bg-acid" />
        ) : (
          <span className="absolute inset-y-0 left-0 bg-acid transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        )}
      </span>
      <style>{`@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
