import Papa from 'papaparse';
import type { Dataset, CellValue } from '@/types';

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        if (result.errors.length > 0) {
          return reject(new CsvParseError(result.errors[0].message));
        }
        const columns = result.meta.fields ?? [];
        if (columns.length === 0) {
          return reject(new CsvParseError('CSV has no header row.'));
        }
        if (result.data.length === 0) {
          return reject(new CsvParseError('CSV has no data rows.'));
        }
        const rows = result.data.map((raw) => {
          const out: Record<string, CellValue> = {};
          for (const col of columns) {
            out[col] = coerce(raw[col]);
          }
          return out;
        });
        resolve({ columns, rows });
      },
      error: (err) => reject(new CsvParseError(err.message)),
    });
  });
}

function coerce(raw: string | undefined): CellValue {
  if (raw === undefined || raw === '') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Number if it parses cleanly and round-trips
  const n = Number(trimmed);
  if (!Number.isNaN(n) && Number.isFinite(n) && trimmed === String(n)) return n;
  // Allow leading-zero / formatted numbers like "1080.5"
  if (!Number.isNaN(n) && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(trimmed)) return n;
  return trimmed;
}
