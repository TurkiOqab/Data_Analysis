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
