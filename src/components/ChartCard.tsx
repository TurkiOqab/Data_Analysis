import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart as ReLineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Chart } from '@/types';

const ACCENT = '#7dd3fc';
const PIE_COLORS = ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'];
const AXIS_COLOR = '#7e8499';
const GRID_COLOR = '#1c1f2c';

const tooltipStyle = {
  background: '#12141d',
  border: '1px solid #222637',
  borderRadius: 8,
  color: '#e8eaf0',
  fontSize: 12,
};

export function ChartCard({ chart }: { chart: Chart }) {
  return (
    <div className="rounded-md border border-line bg-panel-2 p-4">
      <h4 className="text-sm font-semibold">{chart.title}</h4>
      <p className="mt-0.5 text-[11px] text-muted">
        {chart.type[0].toUpperCase() + chart.type.slice(1)} chart
      </p>
      <div className="mt-3 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chart)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(chart: Chart) {
  if (chart.type === 'bar') {
    return (
      <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 11 }} stroke={AXIS_COLOR} />
        <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} stroke={AXIS_COLOR} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff10' }} />
        <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }
  if (chart.type === 'line') {
    return (
      <ReLineChart data={chart.data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="x" tick={{ fill: AXIS_COLOR, fontSize: 11 }} stroke={AXIS_COLOR} />
        <YAxis dataKey="y" tick={{ fill: AXIS_COLOR, fontSize: 11 }} stroke={AXIS_COLOR} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="y" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} />
      </ReLineChart>
    );
  }
  // pie
  return (
    <PieChart>
      <Tooltip contentStyle={tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }} />
      <Pie data={chart.data} dataKey="value" nameKey="label" outerRadius={90} stroke="#0a0c12">
        {chart.data.map((_, i) => (
          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
        ))}
      </Pie>
    </PieChart>
  );
}
