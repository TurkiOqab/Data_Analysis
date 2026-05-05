export type CellValue = string | number | null;

export interface Dataset {
  columns: string[];
  rows: Record<string, CellValue>[];
}

export type ChartType = 'bar' | 'line';

export interface BarChartSpec {
  type: 'bar';
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ label: string; value: number }>;
}

export interface LineChartSpec {
  type: 'line';
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ x: string | number; y: number }>;
}

export type Chart = BarChartSpec | LineChartSpec;

export interface Result {
  insight: string;
  charts: Chart[];
}

// Dataset summary (used when CSV exceeds the size threshold)

export type ColumnType = 'numeric' | 'categorical' | 'date' | 'text';

export interface ColumnSchema {
  name: string;
  type: ColumnType;
}

export interface NumericStats {
  type: 'numeric';
  count: number;
  nulls: number;
  min: number;
  max: number;
  mean: number;
  sum: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface CategoricalStats {
  type: 'categorical';
  count: number;
  nulls: number;
  distinct: number;
  top: Array<[string, number]>;
}

export interface DateStats {
  type: 'date';
  count: number;
  nulls: number;
  min: string;
  max: string;
}

export interface TextStats {
  type: 'text';
  count: number;
  nulls: number;
  distinct: number;
}

export type ColumnStats = NumericStats | CategoricalStats | DateStats | TextStats;

export interface GroupByCell {
  category: string;
  sum: number;
  mean: number;
  count: number;
}

export interface GroupBy {
  by: string;
  metric: string;
  groups: GroupByCell[];
}

export interface DatasetSummary {
  totalRows: number;
  schema: ColumnSchema[];
  stats: Record<string, ColumnStats>;
  groupBys: GroupBy[];
  sample: Record<string, CellValue>[];
}

// query_dataset — Claude calls this when it needs raw rows or aggregations
// the precomputed summary doesn't already contain. The browser executes it
// against the in-memory full dataset and returns the result.

export type SortDirection = 'asc' | 'desc';
export type Aggregator = 'sum' | 'mean' | 'count' | 'min' | 'max';

export interface QuerySpec {
  // Optional projection — which columns to return. Defaults to all.
  select?: string[];

  // Optional filter expressions: AND-ed together. Each {column, op, value}.
  filter?: Array<{
    column: string;
    op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
    value: string | number;
  }>;

  // Optional group-by + aggregation. When set, returns one row per
  // unique value of `groupBy` with the aggregated metrics.
  groupBy?: string;
  aggregate?: Array<{
    column: string;
    fn: Aggregator;
    alias?: string;
  }>;

  // Optional sort.
  sortBy?: string;
  direction?: SortDirection;

  // Required hard cap on returned rows. Server-clamped to a max of 50.
  limit: number;
}

export interface QueryResult {
  rows: Record<string, CellValue>[];
  totalMatched: number;
  truncated: boolean;
}

// Session history — every successful ask is auto-saved so the user can
// re-open it and compare answers side by side.
export interface SavedAsk {
  id: string;
  question: string;
  allowedChartTypes: ChartType[];
  result: Result;
  askedAt: number;
}
