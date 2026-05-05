import type {
  Dataset, DatasetSummary, ColumnSchema, ColumnType, ColumnStats,
  NumericStats, CategoricalStats, DateStats, TextStats, GroupBy, GroupByCell, CellValue,
} from '@/types';

export const SUMMARY_ROW_THRESHOLD = 500;
export const SUMMARY_BYTES_THRESHOLD = 200_000;
const SAMPLE_SIZE = 100;
const TOP_K = 10;
const MAX_GROUPBY_CARDINALITY = 20;
const TEXT_DISTINCT_RATIO = 0.8;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function shouldSummarize(dataset: Dataset): boolean {
  if (dataset.rows.length > SUMMARY_ROW_THRESHOLD) return true;
  return JSON.stringify(dataset).length > SUMMARY_BYTES_THRESHOLD;
}

export function summarize(dataset: Dataset): DatasetSummary {
  const schema = inferSchema(dataset);
  const stats: Record<string, ColumnStats> = {};
  for (const col of schema) {
    stats[col.name] = computeStats(dataset, col);
  }
  const groupBys = computeGroupBys(dataset, schema, stats);
  const sample = randomSample(dataset.rows, SAMPLE_SIZE);
  return {
    totalRows: dataset.rows.length,
    schema,
    stats,
    groupBys,
    sample,
  };
}

function inferSchema(dataset: Dataset): ColumnSchema[] {
  return dataset.columns.map((name) => ({
    name,
    type: inferColumnType(dataset.rows, name),
  }));
}

function inferColumnType(rows: Array<Record<string, CellValue>>, name: string): ColumnType {
  const nonNull = rows.map((r) => r[name]).filter((v): v is string | number => v !== null);
  if (nonNull.length === 0) return 'text';

  const allNumeric = nonNull.every((v) => typeof v === 'number');
  if (allNumeric) return 'numeric';

  const allDates = nonNull.every((v) => typeof v === 'string' && DATE_PATTERN.test(v));
  if (allDates) return 'date';

  const distinct = new Set(nonNull.map(String)).size;
  if (distinct / nonNull.length < TEXT_DISTINCT_RATIO) return 'categorical';
  return 'text';
}

function computeStats(dataset: Dataset, col: ColumnSchema): ColumnStats {
  switch (col.type) {
    case 'numeric':    return numericStats(dataset, col.name);
    case 'categorical':return categoricalStats(dataset, col.name);
    case 'date':       return dateStats(dataset, col.name);
    case 'text':       return textStats(dataset, col.name);
  }
}

function numericStats(dataset: Dataset, name: string): NumericStats {
  let nulls = 0;
  const vals: number[] = [];
  for (const row of dataset.rows) {
    const v = row[name];
    if (v === null) nulls++;
    else if (typeof v === 'number') vals.push(v);
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    type: 'numeric',
    count: vals.length,
    nulls,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum,
    mean: round(sum / vals.length),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.50),
    p75: percentile(sorted, 0.75),
  };
}

function categoricalStats(dataset: Dataset, name: string): CategoricalStats {
  const counts = new Map<string, number>();
  let nulls = 0;
  let count = 0;
  for (const row of dataset.rows) {
    const v = row[name];
    if (v === null) { nulls++; continue; }
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    count++;
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_K) as Array<[string, number]>;
  return {
    type: 'categorical',
    count,
    nulls,
    distinct: counts.size,
    top,
  };
}

function dateStats(dataset: Dataset, name: string): DateStats {
  let nulls = 0;
  let min: string | null = null;
  let max: string | null = null;
  let count = 0;
  for (const row of dataset.rows) {
    const v = row[name];
    if (v === null) { nulls++; continue; }
    const s = String(v);
    count++;
    if (min === null || s < min) min = s;
    if (max === null || s > max) max = s;
  }
  return {
    type: 'date',
    count,
    nulls,
    min: min ?? '',
    max: max ?? '',
  };
}

function textStats(dataset: Dataset, name: string): TextStats {
  const seen = new Set<string>();
  let nulls = 0;
  let count = 0;
  for (const row of dataset.rows) {
    const v = row[name];
    if (v === null) { nulls++; continue; }
    seen.add(String(v));
    count++;
  }
  return {
    type: 'text',
    count,
    nulls,
    distinct: seen.size,
  };
}

function computeGroupBys(dataset: Dataset, schema: ColumnSchema[], stats: Record<string, ColumnStats>): GroupBy[] {
  const out: GroupBy[] = [];
  const cats = schema.filter((c) => c.type === 'categorical' && (stats[c.name] as CategoricalStats).distinct <= MAX_GROUPBY_CARDINALITY);
  const nums = schema.filter((c) => c.type === 'numeric');
  for (const cat of cats) {
    for (const num of nums) {
      out.push(groupBy(dataset, cat.name, num.name));
    }
  }
  return out;
}

function groupBy(dataset: Dataset, by: string, metric: string): GroupBy {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of dataset.rows) {
    const key = row[by];
    const val = row[metric];
    if (key === null || typeof val !== 'number') continue;
    const k = String(key);
    const b = buckets.get(k) ?? { sum: 0, count: 0 };
    b.sum += val;
    b.count += 1;
    buckets.set(k, b);
  }
  const groups: GroupByCell[] = [...buckets.entries()]
    .map(([category, b]) => ({ category, sum: round(b.sum), mean: round(b.sum / b.count), count: b.count }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, TOP_K);
  return { by, metric, groups };
}

function randomSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const out: T[] = [];
  const seen = new Set<number>();
  while (out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(arr[i]);
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
