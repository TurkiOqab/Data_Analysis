import type { Dataset, Result, ChartType } from '@/types';
import { shouldSummarize, summarize } from '@/lib/dataset-summary';

export class AnthropicError extends Error {}

export async function askClaude(
  question: string,
  dataset: Dataset,
  allowedChartTypes: ChartType[] = ['bar', 'line', 'pie'],
): Promise<Result> {
  const base = shouldSummarize(dataset)
    ? { question, summary: summarize(dataset) }
    : { question, columns: dataset.columns, rows: dataset.rows };
  const payload = { ...base, allowedChartTypes };

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
  if (!body || typeof body.insight !== 'string' || !Array.isArray(body.charts)) {
    throw new AnthropicError('Malformed response from server.');
  }
  return body as Result;
}
