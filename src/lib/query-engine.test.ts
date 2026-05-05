import { describe, it, expect } from 'vitest';
import { runQuery } from './query-engine';
import type { Dataset, QuerySpec } from '@/types';

const dataset: Dataset = {
  columns: ['region', 'category', 'units', 'revenue'],
  rows: [
    { region: 'North', category: 'Electronics', units: 10, revenue: 100 },
    { region: 'North', category: 'Apparel',     units: 5,  revenue: 50  },
    { region: 'South', category: 'Electronics', units: 20, revenue: 200 },
    { region: 'South', category: 'Apparel',     units: 8,  revenue: 80  },
    { region: 'East',  category: 'Electronics', units: 15, revenue: 150 },
    { region: 'East',  category: 'Apparel',     units: 7,  revenue: 70  },
    { region: 'West',  category: 'Electronics', units: 25, revenue: 250 },
    { region: 'West',  category: 'Apparel',     units: 4,  revenue: 40  },
  ],
};

describe('runQuery — limit + sort', () => {
  it('returns top-N rows by a numeric column descending', () => {
    const spec: QuerySpec = { sortBy: 'revenue', direction: 'desc', limit: 3 };
    const r = runQuery(dataset, spec);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0].revenue).toBe(250);
    expect(r.rows[1].revenue).toBe(200);
    expect(r.rows[2].revenue).toBe(150);
    expect(r.totalMatched).toBe(8);
    expect(r.truncated).toBe(true);
  });

  it('returns ascending when direction=asc', () => {
    const r = runQuery(dataset, { sortBy: 'revenue', direction: 'asc', limit: 2 });
    expect(r.rows[0].revenue).toBe(40);
    expect(r.rows[1].revenue).toBe(50);
  });

  it('truncated=false when limit exceeds matched rows', () => {
    const r = runQuery(dataset, { sortBy: 'revenue', direction: 'desc', limit: 100 });
    expect(r.rows).toHaveLength(8);
    expect(r.truncated).toBe(false);
  });
});

describe('runQuery — filter', () => {
  it('eq filter narrows the rows', () => {
    const r = runQuery(dataset, {
      filter: [{ column: 'region', op: 'eq', value: 'North' }],
      limit: 50,
    });
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((row) => row.region === 'North')).toBe(true);
  });

  it('AND-combines multiple filters', () => {
    const r = runQuery(dataset, {
      filter: [
        { column: 'region', op: 'eq', value: 'North' },
        { column: 'category', op: 'eq', value: 'Electronics' },
      ],
      limit: 50,
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].region).toBe('North');
    expect(r.rows[0].category).toBe('Electronics');
  });

  it('numeric comparisons (gt, gte, lt, lte, neq)', () => {
    const gt = runQuery(dataset, { filter: [{ column: 'revenue', op: 'gt', value: 150 }], limit: 50 });
    expect(gt.rows.map((r) => r.revenue).sort((a, b) => (a as number) - (b as number))).toEqual([200, 250]);

    const lte = runQuery(dataset, { filter: [{ column: 'revenue', op: 'lte', value: 50 }], limit: 50 });
    expect(lte.rows).toHaveLength(2);

    const neq = runQuery(dataset, { filter: [{ column: 'category', op: 'neq', value: 'Electronics' }], limit: 50 });
    expect(neq.rows.every((r) => r.category !== 'Electronics')).toBe(true);
  });
});

describe('runQuery — select', () => {
  it('projects only the listed columns', () => {
    const r = runQuery(dataset, {
      select: ['region', 'revenue'],
      sortBy: 'revenue',
      direction: 'desc',
      limit: 2,
    });
    expect(Object.keys(r.rows[0]).sort()).toEqual(['region', 'revenue']);
  });
});

describe('runQuery — groupBy + aggregate', () => {
  it('groups by a categorical column and aggregates a numeric column', () => {
    const r = runQuery(dataset, {
      groupBy: 'region',
      aggregate: [{ column: 'revenue', fn: 'sum' }],
      sortBy: 'revenue_sum',
      direction: 'desc',
      limit: 10,
    });
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0].region).toBe('West');
    expect(r.rows[0].revenue_sum).toBe(290);
    expect(r.rows[1].revenue_sum).toBe(280); // South
  });

  it('supports multiple aggregates with aliases', () => {
    const r = runQuery(dataset, {
      groupBy: 'region',
      aggregate: [
        { column: 'revenue', fn: 'sum', alias: 'totalRevenue' },
        { column: 'units',   fn: 'mean', alias: 'avgUnits' },
        { column: 'revenue', fn: 'count' },
      ],
      sortBy: 'totalRevenue',
      direction: 'desc',
      limit: 10,
    });
    const west = r.rows.find((row) => row.region === 'West');
    expect(west).toBeDefined();
    expect(west!.totalRevenue).toBe(290);
    expect(west!.avgUnits).toBeCloseTo(14.5);
    expect(west!.revenue_count).toBe(2);
  });

  it('mean / min / max work', () => {
    const r = runQuery(dataset, {
      groupBy: 'category',
      aggregate: [
        { column: 'revenue', fn: 'mean', alias: 'avg' },
        { column: 'revenue', fn: 'min', alias: 'lo' },
        { column: 'revenue', fn: 'max', alias: 'hi' },
      ],
      limit: 10,
    });
    const elec = r.rows.find((row) => row.category === 'Electronics');
    expect(elec!.avg).toBeCloseTo(175);
    expect(elec!.lo).toBe(100);
    expect(elec!.hi).toBe(250);
  });
});

describe('runQuery — limit clamping', () => {
  it('clamps limit to a max of 50', () => {
    const big: Dataset = {
      columns: ['x'],
      rows: Array.from({ length: 200 }, (_, i) => ({ x: i })),
    };
    const r = runQuery(big, { limit: 1000 });
    expect(r.rows.length).toBeLessThanOrEqual(50);
    expect(r.totalMatched).toBe(200);
    expect(r.truncated).toBe(true);
  });
});
