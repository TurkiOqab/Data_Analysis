import { describe, it, expect } from 'vitest';
import { parseCsv, CsvParseError } from './csv';

function makeFile(text: string, name = 'test.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

describe('parseCsv', () => {
  it('parses headers and rows with mixed types', async () => {
    const file = makeFile('region,units,revenue\nNorth,42,3780\nSouth,18,1080.5\n');
    const ds = await parseCsv(file);
    expect(ds.columns).toEqual(['region', 'units', 'revenue']);
    expect(ds.rows).toEqual([
      { region: 'North', units: 42, revenue: 3780 },
      { region: 'South', units: 18, revenue: 1080.5 },
    ]);
  });

  it('keeps empty cells as null', async () => {
    const file = makeFile('a,b\n1,\n,2\n');
    const ds = await parseCsv(file);
    expect(ds.rows).toEqual([
      { a: 1, b: null },
      { a: null, b: 2 },
    ]);
  });

  it('throws CsvParseError on a file with no headers', async () => {
    const file = makeFile('');
    await expect(parseCsv(file)).rejects.toBeInstanceOf(CsvParseError);
  });

  it('throws CsvParseError when there are no data rows', async () => {
    const file = makeFile('a,b,c\n');
    await expect(parseCsv(file)).rejects.toBeInstanceOf(CsvParseError);
  });
});
