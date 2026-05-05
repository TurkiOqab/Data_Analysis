import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { UploadCard } from '@/components/UploadCard';
import { PreviewCard } from '@/components/PreviewCard';
import { AskCard } from '@/components/AskCard';
import { ResultOverlay } from '@/components/ResultOverlay';
import { HistoryPanel } from '@/components/HistoryPanel';
import { ComparisonOverlay } from '@/components/ComparisonOverlay';
import { askClaude, AnthropicError } from '@/lib/anthropic';
import type { Dataset, Result, ChartType, SavedAsk } from '@/types';

function newId(): string {
  return `ask_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [savedAsks, setSavedAsks] = useState<SavedAsk[]>([]);
  const [comparison, setComparison] = useState<SavedAsk[] | null>(null);

  async function ask(question: string, allowedChartTypes: ChartType[]) {
    if (!dataset) return;
    setLastQuestion(question);
    setResult(null);
    setLoading(true);
    try {
      const r = await askClaude(question, dataset, allowedChartTypes);
      setResult(r);
      setSavedAsks((prev) => [
        ...prev,
        { id: newId(), question, allowedChartTypes, result: r, askedAt: Date.now() },
      ]);
    } catch (e) {
      const msg = e instanceof AnthropicError ? e.message : 'Failed to reach the server.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function viewSaved(saved: SavedAsk) {
    setLastQuestion(saved.question);
    setResult(saved.result);
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(203,55%,18%)] bg-accent-tint text-accent">⌘</div>
            <div className="font-semibold tracking-tight">Data <span className="font-normal text-muted">Analysis</span></div>
          </div>
          <div className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] text-muted">Local · dev</div>
        </header>

        <div className="space-y-4">
          <UploadCard
            dataset={dataset}
            fileName={fileName}
            onLoad={(ds, name) => {
              // Loading a new dataset starts a fresh session; old answers
              // were about a different file and would only confuse the history.
              setDataset(ds);
              setFileName(name);
              setResult(null);
              setLastQuestion(null);
              setSavedAsks([]);
              setComparison(null);
            }}
            onError={(msg) => toast.error(msg)}
          />
          {dataset && <PreviewCard dataset={dataset} />}
          {dataset && <AskCard disabled={!dataset} loading={loading} onAsk={ask} />}
          {dataset && (
            <HistoryPanel
              asks={savedAsks}
              onView={viewSaved}
              onCompare={(selected) => setComparison(selected)}
              onClear={() => setSavedAsks([])}
            />
          )}
        </div>
      </div>

      <ResultOverlay
        open={loading || !!result}
        loading={loading}
        result={result}
        question={lastQuestion}
        onClose={() => { setResult(null); setLastQuestion(null); }}
      />

      <ComparisonOverlay
        open={!!comparison}
        asks={comparison ?? []}
        onClose={() => setComparison(null)}
      />

      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
