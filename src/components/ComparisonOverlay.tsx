import { useEffect } from 'react';
import { ChartCard } from '@/components/ChartCard';
import type { SavedAsk } from '@/types';

interface Props {
  open: boolean;
  asks: SavedAsk[];
  onClose: () => void;
}

export function ComparisonOverlay({ open, asks, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || asks.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-sm animate-in fade-in"
    >
      <div className="flex min-h-screen items-start justify-center p-4 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-7xl my-4 rounded-xl border border-line bg-panel shadow-2xl animate-in fade-in zoom-in-95"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-ink transition"
          >
            ✕
          </button>

          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <div className="mb-5 flex items-baseline justify-between pr-8">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Comparison</div>
                <h2 className="text-base font-semibold tracking-tight">
                  {asks.length} answer{asks.length === 1 ? '' : 's'} side by side
                </h2>
              </div>
            </div>

            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${asks.length}, minmax(0, 1fr))` }}
            >
              {asks.map((ask) => (
                <ComparisonColumn key={ask.id} ask={ask} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonColumn({ ask }: { ask: SavedAsk }) {
  const paragraphs = ask.result.insight.split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="rounded-lg border border-line bg-bg p-4 min-w-0">
      <div className="mb-3 pb-3 border-b border-line-soft">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">You asked</div>
        <div className="text-sm italic text-ink-soft break-words">{ask.question}</div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded border border-[hsl(203,55%,18%)] bg-accent-tint text-accent text-xs">✦</div>
          <h4 className="text-xs font-semibold tracking-tight">Insight</h4>
        </div>
        <div className="space-y-2">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-ink-soft">{p}</p>
          ))}
        </div>
      </div>

      {ask.result.charts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-tight text-muted">
            {ask.result.charts.length === 1 ? 'Chart' : 'Charts'}
          </h4>
          {ask.result.charts.map((c, i) => (
            <ChartCard key={i} chart={c} />
          ))}
        </div>
      )}
    </div>
  );
}
