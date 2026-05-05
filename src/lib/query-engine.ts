import type { Dataset, QuerySpec, QueryResult, CellValue, Aggregator } from '@/types';

const HARD_LIMIT = 50;

export function runQuery(dataset: Dataset, spec: QuerySpec): QueryResult {
  let rows = dataset.rows;

  // 1. Filter
  if (spec.filter && spec.filter.length > 0) {
    rows = rows.filter((row) =>
      spec.filter!.every(({ column, op, value }) => {
        const cell = row[column];
        if (cell === null || cell === undefined) return false;
        switch (op) {
          case 'eq':  return cell === value;
          case 'neq': return cell !== value;
          case 'gt':  return typeof cell === 'number' && typeof value === 'number' && cell > value;
          case 'gte': return typeof cell === 'number' && typeof value === 'number' && cell >= value;
          case 'lt':  return typeof cell === 'number' && typeof value === 'number' && cell < value;
          case 'lte': return typeof cell === 'number' && typeof value === 'number' && cell <= value;
        }
      }),
    );
  }

  // 2. GroupBy + Aggregate
  let processed: Record<string, CellValue>[];
  if (spec.groupBy) {
    processed = aggregate(rows, spec.groupBy, spec.aggregate ?? []);
  } else {
    processed = rows;
  }

  const totalMatched = processed.length;

  // 3. Sort
  if (spec.sortBy) {
    const dir = spec.direction === 'asc' ? 1 : -1;
    const key = spec.sortBy;
    processed = [...processed].sort((a, b) => compareCells(a[key], b[key]) * dir);
  }

  // 4. Limit (clamped server-side, regardless of what Claude requests)
  const limit = Math.min(Math.max(0, spec.limit ?? HARD_LIMIT), HARD_LIMIT);
  const limited = processed.slice(0, limit);

  // 5. Select / project
  const projected = spec.select && spec.select.length > 0
    ? limited.map((row) => Object.fromEntries(spec.select!.map((c) => [c, row[c] ?? null])))
    : limited;

  return {
    rows: projected,
    totalMatched,
    truncated: totalMatched > limited.length,
  };
}

function aggregate(
  rows: Record<string, CellValue>[],
  groupBy: string,
  aggs: Array<{ column: string; fn: Aggregator; alias?: string }>,
): Record<string, CellValue>[] {
  const buckets = new Map<string, Record<string, CellValue>[]>();
  for (const row of rows) {
    const key = String(row[groupBy] ?? '');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(row);
  }

  const out: Record<string, CellValue>[] = [];
  for (const [key, bucketRows] of buckets) {
    const result: Record<string, CellValue> = { [groupBy]: key };
    for (const a of aggs) {
      const colName = a.alias ?? `${a.column}_${a.fn}`;
      result[colName] = applyAggregator(bucketRows, a.column, a.fn);
    }
    out.push(result);
  }
  return out;
}

function applyAggregator(rows: Record<string, CellValue>[], column: string, fn: Aggregator): number {
  if (fn === 'count') return rows.length;
  const nums = rows.map((r) => r[column]).filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return 0;
  switch (fn) {
    case 'sum':  return nums.reduce((a, b) => a + b, 0);
    case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':  return Math.min(...nums);
    case 'max':  return Math.max(...nums);
  }
}

function compareCells(a: CellValue, b: CellValue): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}
