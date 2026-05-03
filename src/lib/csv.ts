import Papa from 'papaparse';
import type { Dataset, CellValue } from '@/types';

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export async function parseCsv(file: File): Promise<Dataset> {
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (result.errors.length > 0) {
    throw new CsvParseError(result.errors[0].message);
  }
  const columns = result.meta.fields ?? [];
  if (columns.length === 0) {
    throw new CsvParseError('CSV has no header row.');
  }
  if (result.data.length === 0) {
    throw new CsvParseError('CSV has no data rows.');
  }
  const rows = result.data.map((raw) => {
    const out: Record<string, CellValue> = {};
    for (const col of columns) {
      out[col] = coerce(raw[col]);
    }
    return out;
  });
  return { columns, rows };
}

function coerce(raw: string | undefined): CellValue {
  if (raw === undefined || raw === '') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isNaN(n) && Number.isFinite(n) && trimmed === String(n)) return n;
  if (!Number.isNaN(n) && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(trimmed)) return n;
  return trimmed;
}
