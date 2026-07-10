'use client';

import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// 12-month P&L projection — real vs potential ALWAYS separated (Josh rule).
// Palette is the CVD-validated dark-surface set from Phase D.
const C = {
  actual: '#00a887',
  projected: '#8b5cf6',
  cost: '#d97706',
  grid: '#16222f',
  ink4: '#5c6b80',
};

export type PnlMonth = {
  month: string; // 'Jul 26'
  actual_revenue: number;
  projected_revenue: number;
  cost: number;
};

export function ProjectionChart({ data }: { data: PnlMonth[] }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <XAxis
            dataKey="month"
            tick={{ fill: C.ink4, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            axisLine={{ stroke: C.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: C.ink4, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            width={36}
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,212,170,0.04)' }}
            contentStyle={{
              background: '#0d1725',
              border: '1px solid #16222f',
              borderRadius: 3,
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
            }}
            labelStyle={{ color: '#93a1b5' }}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString()}`,
              String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
            iconSize={9}
          />
          <Bar dataKey="actual_revenue" name="Actual revenue" stackId="rev" fill={C.actual} radius={[2, 2, 0, 0]} />
          <Bar dataKey="projected_revenue" name="Potential (weighted)" stackId="rev" fill={C.projected} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
          <Line dataKey="cost" name="Costs" stroke={C.cost} strokeWidth={2} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
