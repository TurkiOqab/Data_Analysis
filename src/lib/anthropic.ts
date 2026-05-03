import type { Dataset, Result } from '@/types';

export class AnthropicError extends Error {}

export async function askClaude(question: string, dataset: Dataset): Promise<Result> {
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, columns: dataset.columns, rows: dataset.rows }),
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
