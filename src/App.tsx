import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { UploadCard } from '@/components/UploadCard';
import { PreviewCard } from '@/components/PreviewCard';
import { AskCard } from '@/components/AskCard';
import { ResultOverlay } from '@/components/ResultOverlay';
import { askClaude, AnthropicError } from '@/lib/anthropic';
import type { Dataset, Result } from '@/types';

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function ask(question: string) {
    if (!dataset) return;
    setLoading(true);
    try {
      const r = await askClaude(question, dataset);
      setResult(r);
    } catch (e) {
      const msg = e instanceof AnthropicError ? e.message : 'Failed to reach the server.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(203,55%,18%)] bg-accent-tint text-accent">⌘</div>
            <div className="font-semibold tracking-tight">Insight<span className="font-normal text-muted">.csv</span></div>
          </div>
          <div className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] text-muted">Local · dev</div>
        </header>

        <div className="space-y-4">
          <UploadCard
            dataset={dataset}
            fileName={fileName}
            onLoad={(ds, name) => { setDataset(ds); setFileName(name); setResult(null); }}
            onError={(msg) => toast.error(msg)}
          />
          {dataset && <PreviewCard dataset={dataset} />}
          {dataset && <AskCard disabled={!dataset} loading={loading} onAsk={ask} />}
        </div>
      </div>

      <ResultOverlay
        open={loading || !!result}
        loading={loading}
        result={result}
        onClose={() => setResult(null)}
      />

      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
