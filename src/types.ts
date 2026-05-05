export type CellValue = string | number | null;

export interface Dataset {
  columns: string[];
  rows: Record<string, CellValue>[];
}

export interface BarOrPieChart {
  type: 'bar' | 'pie';
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ label: string; value: number }>;
}

export interface LineChart {
  type: 'line';
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ x: string | number; y: number }>;
}

export type Chart = BarOrPieChart | LineChart;

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
