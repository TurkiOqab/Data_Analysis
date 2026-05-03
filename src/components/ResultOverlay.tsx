import { useEffect, useState } from 'react';
import { InsightCard } from '@/components/InsightCard';
import { ChartsGrid } from '@/components/ChartsGrid';
import type { Result } from '@/types';

const WAITING_LINES = [
  'Teaching the model to count past ten…',
  'Convincing the AI that pie charts are real food…',
  'Asking the spreadsheet very nicely for the truth…',
  'Untangling your data, one cell at a time…',
  'Polishing the axes for your reading pleasure…',
  'Looking for patterns in all the right places…',
  'Bribing the algorithm with virtual coffee…',
  'Double-checking the math (it is a triple-check, actually)…',
  'Negotiating with the bar chart for a fair height…',
  'Loading insightful insights and chartful charts…',
];

interface Props {
  open: boolean;
  loading: boolean;
  result: Result | null;
  onClose: () => void;
}

export function ResultOverlay({ open, loading, result, onClose }: Props) {
  const [lineIndex, setLineIndex] = useState(() => Math.floor(Math.random() * WAITING_LINES.length));

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % WAITING_LINES.length);
    }, 2500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy={loading}
      onClick={() => { if (!loading) onClose(); }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-sm animate-in fade-in"
    >
      <div className="flex min-h-screen items-start justify-center p-4 sm:p-8">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl my-4 rounded-xl border border-line bg-panel shadow-2xl animate-in fade-in zoom-in-95"
        >
          {!loading && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-ink transition"
            >
              ✕
            </button>
          )}

          {loading ? (
            <LoadingView line={WAITING_LINES[lineIndex]} />
          ) : result ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InsightCard insight={result.insight} />
              {result.charts.length > 0 && <ChartsGrid charts={result.charts} />}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoadingView({ line }: { line: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 p-12">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-accent" />
        <div className="h-2 w-2 rounded-full bg-accent" />
      </div>
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Asking Claude</div>
        <div key={line} className="text-sm text-ink-soft animate-in fade-in">{line}</div>
      </div>
    </div>
  );
}
