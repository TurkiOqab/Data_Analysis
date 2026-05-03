import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartCard } from '@/components/ChartCard';
import type { Chart } from '@/types';

export function ChartsGrid({ charts }: { charts: Chart[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Visualizations</CardTitle>
        <CardDescription>{charts.length} chart{charts.length === 1 ? '' : 's'} · returned by Claude</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {charts.map((c, i) => <ChartCard key={i} chart={c} />)}
        </div>
      </CardContent>
    </Card>
  );
}
