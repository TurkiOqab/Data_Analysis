import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Dataset } from '@/types';

const PREVIEW_ROWS = 20;

export function PreviewCard({ dataset }: { dataset: Dataset }) {
  const previewRows = dataset.rows.slice(0, PREVIEW_ROWS);
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Data preview</CardTitle>
        <CardDescription>
          First {Math.min(PREVIEW_ROWS, dataset.rows.length)} of {dataset.rows.length.toLocaleString()} rows
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                {dataset.columns.map((c) => (
                  <TableHead key={c} className="uppercase text-[11px] tracking-wider">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => (
                <TableRow key={i}>
                  {dataset.columns.map((c) => {
                    const v = row[c];
                    const isNum = typeof v === 'number';
                    return (
                      <TableCell key={c} className={isNum ? 'text-right tabular-nums' : ''}>
                        {v === null ? <span className="text-muted">—</span> : String(v)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
