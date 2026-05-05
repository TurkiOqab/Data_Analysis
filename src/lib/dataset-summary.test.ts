import { describe, it, expect } from 'vitest';
import { summarize, shouldSummarize, SUMMARY_ROW_THRESHOLD } from './dataset-summary';
import type { Dataset, NumericStats, CategoricalStats, DateStats } from '@/types';

function makeDataset(rows: number, builder: (i: number) => Record<string, string | number | null>): Dataset {
  const data = Array.from({ length: rows }, (_, i) => builder(i));
  return {
    columns: data.length > 0 ? Object.keys(data[0]) : [],
    rows: data,
  };
}

describe('shouldSummarize', () => {
  it('returns false for small datasets', () => {
    const ds = makeDataset(100, (i) => ({ a: i }));
    expect(shouldSummarize(ds)).toBe(false);
  });

  it('returns true once the row count exceeds the threshold', () => {
    const ds = makeDataset(SUMMARY_ROW_THRESHOLD + 1, (i) => ({ a: i }));
    expect(shouldSummarize(ds)).toBe(true);
  });

  it('returns true for a small dataset that exceeds 200 KB serialized', () => {
    const fat = 'x'.repeat(2000);
    const ds = makeDataset(150, () => ({ a: fat }));
    expect(shouldSummarize(ds)).toBe(true);
  });
});

describe('summarize — schema inference', () => {
  it('infers numeric, categorical, date, and text', () => {
    const ds: Dataset = {
      columns: ['n', 'c', 'd', 't'],
      rows: [
        { n: 1, c: 'A', d: '2026-01-01', t: 'lorem ipsum dolor 1' },
        { n: 2, c: 'B', d: '2026-01-02', t: 'fully unique sentence 2' },
        { n: 3, c: 'A', d: '2026-01-03', t: 'each row is its own text 3' },
        { n: 4, c: 'B', d: '2026-01-04', t: 'absolutely never repeats 4' },
        { n: 5, c: 'A', d: '2026-01-05', t: 'so this should be text 5' },
      ],
    };
    const s = summarize(ds);
    const types = Object.fromEntries(s.schema.map((c) => [c.name, c.type]));
    expect(types).toEqual({ n: 'numeric', c: 'categorical', d: 'date', t: 'text' });
  });
});

describe('summarize — numeric stats', () => {
  it('computes count, nulls, min, max, mean, sum, percentiles', () => {
    const ds: Dataset = {
      columns: ['x'],
      rows: [
        { x: 10 }, { x: 20 }, { x: 30 }, { x: 40 }, { x: 50 },
        { x: 60 }, { x: 70 }, { x: 80 }, { x: 90 }, { x: 100 },
        { x: null },
      ],
    };
    const s = summarize(ds);
    const x = s.stats.x as NumericStats;
    expect(x.type).toBe('numeric');
    expect(x.count).toBe(10);
    expect(x.nulls).toBe(1);
    expect(x.min).toBe(10);
    expect(x.max).toBe(100);
    expect(x.sum).toBe(550);
    expect(x.mean).toBe(55);
    expect(x.p50).toBe(55);
    expect(x.p25).toBe(32.5);
    expect(x.p75).toBe(77.5);
  });
});

describe('summarize — categorical stats', () => {
  it('returns distinct count and top values with counts', () => {
    const ds: Dataset = {
      columns: ['c'],
      rows: [
        { c: 'A' }, { c: 'A' }, { c: 'A' },
        { c: 'B' }, { c: 'B' },
        { c: 'C' },
        { c: null },
      ],
    };
    const s = summarize(ds);
    const c = s.stats.c as CategoricalStats;
    expect(c.type).toBe('categorical');
    expect(c.distinct).toBe(3);
    expect(c.nulls).toBe(1);
    expect(c.top[0]).toEqual(['A', 3]);
    expect(c.top[1]).toEqual(['B', 2]);
    expect(c.top[2]).toEqual(['C', 1]);
  });

  it('caps top values at 10', () => {
    // 30 rows, 15 distinct categories appearing twice each — distinct/total = 0.5 → categorical
    const ds: Dataset = {
      columns: ['c'],
      rows: Array.from({ length: 30 }, (_, i) => ({ c: `cat${i % 15}` })),
    };
    const s = summarize(ds);
    const c = s.stats.c as CategoricalStats;
    expect(c.top.length).toBe(10);
    expect(c.distinct).toBe(15);
  });
});

describe('summarize — date stats', () => {
  it('returns min and max dates', () => {
    const ds: Dataset = {
      columns: ['d'],
      rows: [
        { d: '2026-03-15' }, { d: '2026-01-01' }, { d: '2026-12-31' }, { d: '2026-07-04' },
      ],
    };
    const s = summarize(ds);
    const d = s.stats.d as DateStats;
    expect(d.type).toBe('date');
    expect(d.min).toBe('2026-01-01');
    expect(d.max).toBe('2026-12-31');
  });
});

describe('summarize — group-bys', () => {
  it('produces group-by tables for low-cardinality categorical × numeric pairs', () => {
    const ds: Dataset = {
      columns: ['region', 'revenue'],
      rows: [
        { region: 'North', revenue: 100 },
        { region: 'North', revenue: 200 },
        { region: 'South', revenue: 50 },
        { region: 'South', revenue: 150 },
        { region: 'East',  revenue: 300 },
      ],
    };
    const s = summarize(ds);
    expect(s.groupBys).toHaveLength(1);
    const gb = s.groupBys[0];
    expect(gb.by).toBe('region');
    expect(gb.metric).toBe('revenue');
    const map = Object.fromEntries(gb.groups.map((g) => [g.category, g]));
    expect(map.North.sum).toBe(300);
    expect(map.North.mean).toBe(150);
    expect(map.North.count).toBe(2);
    expect(map.South.sum).toBe(200);
    expect(map.East.sum).toBe(300);
  });

  it('skips high-cardinality categoricals (>20 distinct)', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      product: `p${i}`, // 25 distinct
      revenue: i * 10,
    }));
    const ds: Dataset = { columns: ['product', 'revenue'], rows };
    const s = summarize(ds);
    expect(s.groupBys).toHaveLength(0);
  });
});

describe('summarize — sampling', () => {
  it('returns 100 rows or fewer (whichever is less)', () => {
    const small = makeDataset(50, (i) => ({ a: i }));
    expect(summarize(small).sample).toHaveLength(50);

    const big = makeDataset(5000, (i) => ({ a: i }));
    expect(summarize(big).sample).toHaveLength(100);
  });

  it('preserves all original columns in sample rows', () => {
    const ds: Dataset = {
      columns: ['a', 'b', 'c'],
      rows: Array.from({ length: 200 }, (_, i) => ({ a: i, b: 'x', c: null })),
    };
    const s = summarize(ds);
    for (const row of s.sample) {
      expect(Object.keys(row).sort()).toEqual(['a', 'b', 'c']);
    }
  });
});

describe('summarize — totals', () => {
  it('records totalRows', () => {
    const ds = makeDataset(742, (i) => ({ a: i }));
    expect(summarize(ds).totalRows).toBe(742);
  });
});
