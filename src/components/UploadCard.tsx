import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseCsv, CsvParseError } from '@/lib/csv';
import type { Dataset } from '@/types';

const SIZE_BYTES = 2 * 1024 * 1024;     // 2 MB
const SIZE_ROWS = 10_000;

interface Props {
  dataset: Dataset | null;
  fileName: string | null;
  onLoad: (dataset: Dataset, fileName: string) => void;
  onError: (message: string) => void;
}

export function UploadCard({ dataset, fileName, onLoad, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const ds = await parseCsv(file);
      const tooBig = file.size > SIZE_BYTES || ds.rows.length > SIZE_ROWS;
      if (tooBig) {
        const ok = window.confirm(
          `This file is ${file.size > SIZE_BYTES ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${ds.rows.length.toLocaleString()} rows`} ` +
          `— sending it to Claude may be slow and costly. Continue?`
        );
        if (!ok) return;
      }
      onLoad(ds, file.name);
    } catch (e) {
      const msg = e instanceof CsvParseError ? e.message : 'Failed to parse CSV.';
      setParseError(msg);
      onError(msg);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Upload your data</CardTitle>
        <CardDescription>CSV, up to a few MB. Stays in your browser.</CardDescription>
      </CardHeader>
      <CardContent>
        {dataset && fileName ? (
          <div className="flex items-center gap-3 rounded-md border border-line bg-panel-2 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(203,55%,18%)] bg-accent-tint text-accent">📄</div>
            <div className="flex-1 font-medium">{fileName}</div>
            <div className="text-xs text-muted">
              {dataset.columns.length} columns · {dataset.rows.length.toLocaleString()} rows
            </div>
            <Badge className="bg-[hsl(158,40%,12%)] text-good border border-[hsl(158,40%,18%)]">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-good" />Loaded
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>Replace</Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-10 text-center transition ${dragOver ? 'border-accent bg-accent-tint/40' : 'border-line bg-panel-2/30'}`}
          >
            <div className="text-2xl">📤</div>
            <div className="text-sm text-ink-soft"><strong className="text-ink">Drop a CSV here</strong> or</div>
            <Button onClick={() => inputRef.current?.click()}>Choose file</Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        {parseError && (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {parseError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
