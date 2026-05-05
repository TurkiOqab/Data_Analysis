import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChartType } from '@/types';

const SUGGESTIONS = [
  'Total revenue by region',
  'Which category has the highest profit?',
  'Show monthly sales trend',
];

const CHART_TYPES: ChartType[] = ['bar', 'line', 'pie'];
const CHART_LABELS: Record<ChartType, string> = { bar: 'Bar', line: 'Line', pie: 'Pie' };

interface Props {
  disabled: boolean;
  loading: boolean;
  onAsk: (question: string, allowedChartTypes: ChartType[]) => void;
}

export function AskCard({ disabled, loading, onAsk }: Props) {
  const [q, setQ] = useState('');
  const [allowed, setAllowed] = useState<ChartType[]>(CHART_TYPES);

  function submit() {
    const trimmed = q.trim();
    if (!trimmed || loading || allowed.length === 0) return;
    onAsk(trimmed, allowed);
  }

  function toggle(t: ChartType) {
    setAllowed((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Ask a question</CardTitle>
        <CardDescription>Plain English — Claude does the analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Show total sales by region"
            disabled={disabled || loading}
          />
          <Button onClick={submit} disabled={disabled || loading || !q.trim() || allowed.length === 0}>
            {loading ? 'Thinking…' : 'Ask ↵'}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQ(s); }}
              disabled={disabled || loading}
              className="rounded-full border border-line bg-[hsl(228,21%,11%)] px-2.5 py-1 text-xs text-ink-soft transition hover:border-accent hover:text-ink disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Charts</span>
          <div className="flex gap-1.5">
            {CHART_TYPES.map((t) => {
              const on = allowed.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  disabled={disabled || loading}
                  aria-pressed={on}
                  className={[
                    'rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50',
                    on
                      ? 'border-accent bg-accent-tint text-accent'
                      : 'border-line bg-[hsl(228,21%,11%)] text-muted hover:border-line hover:text-ink-soft',
                  ].join(' ')}
                >
                  {CHART_LABELS[t]}
                </button>
              );
            })}
          </div>
          {allowed.length === 0 && (
            <span className="text-[11px] text-destructive ml-1">Select at least one chart type.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
