import { useEffect, useState } from 'react';
import { ChartCard } from '@/components/ChartCard';
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
  question: string | null;
  onClose: () => void;
}

export function ResultOverlay({ open, loading, result, question, onClose }: Props) {
  const [line, setLine] = useState('');

  useEffect(() => {
    if (loading) {
      setLine(WAITING_LINES[Math.floor(Math.random() * WAITING_LINES.length)]);
    }
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
            <LoadingView line={line} />
          ) : result ? (
            <ResultView result={result} question={question} />
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
        <div className="text-sm text-ink-soft">{line}</div>
      </div>
    </div>
  );
}

function ResultView({ result, question }: { result: Result; question: string | null }) {
  const paragraphs = result.insight.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="px-6 py-7 sm:px-8 sm:py-8">
      {question && (
        <div className="mb-6 flex items-start gap-3 pr-8">
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">You asked</div>
          <div className="flex-1 text-sm text-ink-soft italic">{question}</div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(203,55%,18%)] bg-accent-tint text-accent">✦</div>
        <h3 className="text-sm font-semibold tracking-tight">Insight</h3>
      </div>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-ink">{p}</p>
        ))}
      </div>

      {result.charts.length > 0 && (
        <>
          <div className="my-7 h-px bg-line" />
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold tracking-tight">
              {result.charts.length === 1 ? 'Chart' : 'Charts'}
            </h3>
            <span className="text-[11px] text-muted">
              {result.charts.length} {result.charts.length === 1 ? 'visualization' : 'visualizations'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {result.charts.map((c, i) => <ChartCard key={i} chart={c} />)}
          </div>
        </>
      )}
    </div>
  );
}
