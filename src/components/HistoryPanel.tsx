import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SavedAsk } from '@/types';

interface Props {
  asks: SavedAsk[];
  onView: (ask: SavedAsk) => void;
  onCompare: (selected: SavedAsk[]) => void;
  onClear: () => void;
}

const MAX_COMPARE = 3;

export function HistoryPanel({ asks, onView, onCompare, onClear }: Props) {
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (asks.length === 0) return null;

  const sorted = [...asks].sort((a, b) => b.askedAt - a.askedAt);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  }

  function exitCompare() {
    setCompareMode(false);
    setSelected(new Set());
  }

  function viewComparison() {
    const selectedAsks = sorted.filter((a) => selected.has(a.id));
    onCompare(selectedAsks);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>4. History</CardTitle>
            <CardDescription>
              {compareMode
                ? `Pick up to ${MAX_COMPARE} answers to view side-by-side. Selected: ${selected.size}.`
                : `${asks.length} past answer${asks.length === 1 ? '' : 's'} for this dataset. Click to re-open.`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!compareMode ? (
              <>
                {asks.length >= 2 && (
                  <Button variant="ghost" size="sm" onClick={() => setCompareMode(true)}>Compare</Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={viewComparison}
                  disabled={selected.size < 2}
                >
                  View {selected.size > 0 ? `(${selected.size})` : ''}
                </Button>
                <Button variant="ghost" size="sm" onClick={exitCompare}>Cancel</Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-line-soft">
          {sorted.map((ask) => {
            const isSelected = selected.has(ask.id);
            const onClick = () => (compareMode ? toggleSelect(ask.id) : onView(ask));
            const charts = ask.result.charts.length;
            return (
              <li
                key={ask.id}
                onClick={onClick}
                className={[
                  'flex cursor-pointer items-center gap-3 py-2.5 px-2 -mx-2 rounded-md transition',
                  compareMode && isSelected ? 'bg-accent-tint' : 'hover:bg-panel-2',
                ].join(' ')}
              >
                {compareMode && (
                  <div
                    aria-hidden="true"
                    className={[
                      'flex h-4 w-4 flex-none items-center justify-center rounded border transition',
                      isSelected ? 'border-accent bg-accent text-[hsl(220,30%,6%)]' : 'border-line bg-panel-2',
                    ].join(' ')}
                  >
                    {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm text-ink">{ask.question}</div>
                  <div className="text-[11px] text-muted">
                    {charts} chart{charts === 1 ? '' : 's'} · {timeAgo(ask.askedAt)}
                  </div>
                </div>
                {!compareMode && <span aria-hidden="true" className="text-muted text-xs">→</span>}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
