import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SUGGESTIONS = [
  'Total revenue by region',
  'Which category has the highest profit?',
  'Show monthly sales trend',
];

interface Props {
  disabled: boolean;
  loading: boolean;
  onAsk: (question: string) => void;
}

export function AskCard({ disabled, loading, onAsk }: Props) {
  const [q, setQ] = useState('');
  function submit() {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    onAsk(trimmed);
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
          <Button onClick={submit} disabled={disabled || loading || !q.trim()}>
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
      </CardContent>
    </Card>
  );
}
