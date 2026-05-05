import type { Dataset, Result, ChartType, QuerySpec, QueryResult } from '@/types';
import { shouldSummarize, summarize } from '@/lib/dataset-summary';
import { runQuery } from '@/lib/query-engine';

export class AnthropicError extends Error {}

interface PriorTurn {
  toolUseId: string;
  toolInput: QuerySpec;
  toolResult: QueryResult;
}

const MAX_TURNS = 4;

export async function askClaude(
  question: string,
  dataset: Dataset,
  allowedChartTypes: ChartType[] = ['bar', 'line', 'pie'],
  onTurn?: (turn: number, kind: 'thinking' | 'querying') => void,
): Promise<Result> {
  const useSummary = shouldSummarize(dataset);
  const summary = useSummary ? summarize(dataset) : undefined;

  const priorTurns: PriorTurn[] = [];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    onTurn?.(turn, priorTurns.length === 0 ? 'thinking' : 'thinking');

    const base = useSummary
      ? { question, summary }
      : { question, columns: dataset.columns, rows: dataset.rows };
    const payload = { ...base, allowedChartTypes, priorTurns };

    const res = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    if (!res.ok) {
      throw new AnthropicError(body?.error ?? `Request failed (${res.status})`);
    }
    if (!body || typeof body.kind !== 'string') {
      throw new AnthropicError('Malformed response from server.');
    }

    if (body.kind === 'present_analysis') {
      const r = body.input;
      if (!r || typeof r.insight !== 'string' || !Array.isArray(r.charts)) {
        throw new AnthropicError('Malformed analysis from Claude.');
      }
      return r as Result;
    }

    if (body.kind === 'query_dataset') {
      // Run the query locally and append a turn for the next round trip.
      onTurn?.(turn, 'querying');
      const queryResult = runQuery(dataset, body.input as QuerySpec);
      priorTurns.push({
        toolUseId: body.toolUseId,
        toolInput: body.input,
        toolResult: queryResult,
      });
      continue;
    }

    throw new AnthropicError(`Unexpected tool from Claude: ${body.kind}`);
  }

  throw new AnthropicError(`Claude needed more than ${MAX_TURNS} turns. Try a simpler question.`);
}
