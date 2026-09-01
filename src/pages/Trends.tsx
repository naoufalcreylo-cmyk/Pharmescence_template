import { useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { clsx } from 'clsx';
import { CalendarDays, TrendingUp, TrendingDown } from 'lucide-react';
import { timeSeriesData } from '../data/mockData';
import { groupTimeSeries } from '../data/breakdownData';
import type { TrendPoint } from '../data/breakdownData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { ExportMenu } from '../components/ui/ExportMenu';
import { EmptyState } from '../components/ui/EmptyState';
import { useFilters } from '../context/FiltersContext';
import type { TrendGranularity } from '../types';

/**
 * Performance Trend (§2).
 *
 * Nine metrics over time at daily / weekly / monthly grain. Cost and efficiency
 * metrics get their own axis so a $2k spend day cannot flatten a 3.1x ROAS line
 * into the baseline.
 */

type MetricId = 'spend' | 'purchases' | 'revenue' | 'roas' | 'cpa' | 'ctr' | 'cpm' | 'cpc' | 'frequency';

interface MetricDef {
  id: MetricId;
  label: string;
  color: string;
  axis: 'money' | 'count' | 'ratio';
  shape: 'area' | 'line' | 'bar';
  format: (v: number) => string;
  /** Cost metrics improve when they fall. */
  lowerIsBetter?: boolean;
}

const METRICS: MetricDef[] = [
  { id: 'spend', label: 'Spend', color: '#7C3AED', axis: 'money', shape: 'bar', format: v => formatCurrency(v, true) },
  { id: 'revenue', label: 'Revenue', color: '#06B6D4', axis: 'money', shape: 'area', format: v => formatCurrency(v, true) },
  { id: 'purchases', label: 'Purchases', color: '#10B981', axis: 'count', shape: 'line', format: v => formatNumber(v) },
  { id: 'roas', label: 'ROAS', color: '#FBBF24', axis: 'ratio', shape: 'line', format: v => formatMultiplier(v) },
  { id: 'cpa', label: 'CPA', color: '#F43F5E', axis: 'money', shape: 'line', format: v => formatCurrency(v), lowerIsBetter: true },
  { id: 'ctr', label: 'CTR', color: '#A780FF', axis: 'ratio', shape: 'line', format: v => formatPercent(v) },
  { id: 'cpm', label: 'CPM', color: '#F59E0B', axis: 'money', shape: 'line', format: v => formatCurrency(v), lowerIsBetter: true },
  { id: 'cpc', label: 'CPC', color: '#22D3EE', axis: 'money', shape: 'line', format: v => formatCurrency(v), lowerIsBetter: true },
  { id: 'frequency', label: 'Frequency', color: '#94A3B8', axis: 'ratio', shape: 'line', format: v => v.toFixed(2), lowerIsBetter: true },
];

const GRANULARITIES: { id: TrendGranularity; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const FULL_BUCKET_DAYS: Record<TrendGranularity, number> = { daily: 1, weekly: 7, monthly: 28 };

function TrendTooltip({ active, payload, label, granularity }: any) {
  if (!active || !payload?.length) return null;
  const days: number = payload[0]?.payload?.days ?? 1;
  // A window rarely lands on clean week or month boundaries, so the first and
  // last buckets are usually short — say so rather than let them read as a drop.
  const partial = days < FULL_BUCKET_DAYS[granularity as TrendGranularity];
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 shadow-card-hover text-xs min-w-[170px]">
      <p className="text-slate-400 mb-2 font-medium">
        {label}
        {partial && (
          <span className="block text-amber-400 font-normal mt-0.5">
            Partial period — {days} of {FULL_BUCKET_DAYS[granularity as TrendGranularity]} days
          </span>
        )}
      </p>
      {payload.map((p: any) => {
        const def = METRICS.find(m => m.id === p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <span className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {def?.label ?? p.name}
            </span>
            <span className="text-white font-medium tabular-nums">
              {def ? def.format(p.value) : p.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Trends() {
  const { filters } = useFilters();
  const [granularity, setGranularity] = useState<TrendGranularity>('daily');
  const [selected, setSelected] = useState<MetricId[]>(['spend', 'revenue', 'roas']);

  const points: TrendPoint[] = useMemo(
    () => groupTimeSeries(timeSeriesData.slice(-filters.days), granularity),
    [filters.days, granularity],
  );

  const activeMetrics = METRICS.filter(m => selected.includes(m.id));
  const usedAxes = new Set(activeMetrics.map(m => m.axis));

  const toggle = (id: MetricId) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  // Period-over-period: compare the back half of the window against the front.
  const deltas = useMemo(() => {
    const half = Math.floor(points.length / 2);
    if (half === 0) return {} as Record<MetricId, number>;
    const avg = (rows: TrendPoint[], id: MetricId) =>
      rows.reduce((s, r) => s + (r[id] as number), 0) / Math.max(rows.length, 1);
    const first = points.slice(0, half);
    const second = points.slice(half);
    return METRICS.reduce((acc, m) => {
      const a = avg(first, m.id);
      const b = avg(second, m.id);
      acc[m.id] = a > 0 ? ((b - a) / a) * 100 : 0;
      return acc;
    }, {} as Record<MetricId, number>);
  }, [points]);

  const exportColumns = [
    { key: 'label', header: 'Period', value: (p: TrendPoint) => p.label },
    { key: 'days', header: 'Days', value: (p: TrendPoint) => p.days },
    ...METRICS.map(m => ({
      key: m.id,
      header: m.label,
      value: (p: TrendPoint) => (p[m.id] as number).toFixed(2),
    })),
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-bg-elevated border border-bg-border p-0.5">
          {GRANULARITIES.map(g => (
            <button
              key={g.id}
              onClick={() => setGranularity(g.id)}
              className={clsx(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                granularity === g.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays size={13} />
          {points.length} {granularity === 'daily' ? 'days' : granularity === 'weekly' ? 'weeks' : 'months'}
        </span>

        <div className="flex-1" />

        <ExportMenu
          rows={points}
          columns={exportColumns}
          name="pharmescence_trends"
          title={`Performance Trend — ${granularity}`}
          subtitle={`Last ${filters.days} days, grouped ${granularity}`}
        />
      </div>

      {/* Metric toggles with period deltas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
        {METRICS.map(m => {
          const on = selected.includes(m.id);
          const delta = deltas[m.id] ?? 0;
          const improving = m.lowerIsBetter ? delta < 0 : delta > 0;
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={clsx(
                'card p-3 text-left transition-all duration-150 border',
                on ? 'border-brand-600/50 shadow-card-hover' : 'hover:border-bg-hover opacity-70 hover:opacity-100',
              )}
            >
              <span className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: on ? m.color : '#475569' }} />
                <span className="text-xs font-medium text-slate-300 truncate">{m.label}</span>
              </span>
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                  Math.abs(delta) < 0.05 ? 'text-slate-500' : improving ? 'text-emerald-400' : 'text-rose-400',
                )}
              >
                {Math.abs(delta) >= 0.05 && (improving ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Performance Over Time</h2>
          <p className="text-xs text-slate-500">
            Second half vs first half of the selected window
          </p>
        </div>

        {activeMetrics.length === 0 ? (
          <EmptyState
            variant="no-results"
            title="No metrics selected"
            description="Pick one or more metrics above to plot them over time."
            action={{ label: 'Show spend & revenue', onClick: () => setSelected(['spend', 'revenue']) }}
          />
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                {activeMetrics.map(m => (
                  <linearGradient key={m.id} id={`trend-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={m.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="#475569"
                tickLine={false}
                axisLine={{ stroke: '#2A2A42' }}
                minTickGap={granularity === 'daily' ? 28 : 8}
              />
              {usedAxes.has('money') && (
                <YAxis yAxisId="money" tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false}
                  tickFormatter={v => formatCurrency(v, true)} />
              )}
              {usedAxes.has('count') && (
                <YAxis yAxisId="count" orientation={usedAxes.has('money') ? 'right' : 'left'}
                  tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false}
                  tickFormatter={v => formatNumber(v, true)} />
              )}
              {usedAxes.has('ratio') && (
                <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 11 }} stroke="#475569"
                  tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
              )}
              <Tooltip
                content={<TrendTooltip granularity={granularity} />}
                cursor={{ stroke: '#7C3AED', strokeOpacity: 0.25, strokeWidth: 24 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

              {selected.includes('roas') && (
                <ReferenceLine yAxisId="ratio" y={2.5} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: 'Target 2.5x', position: 'right', fill: '#10B981', fontSize: 10 }} />
              )}

              {activeMetrics.map(m =>
                m.shape === 'bar' ? (
                  <Bar key={m.id} yAxisId={m.axis} dataKey={m.id} name={m.label} fill={m.color}
                    fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={granularity === 'daily' ? 14 : 46} />
                ) : m.shape === 'area' ? (
                  <Area key={m.id} yAxisId={m.axis} type="monotone" dataKey={m.id} name={m.label}
                    stroke={m.color} strokeWidth={2} fill={`url(#trend-${m.id})`} />
                ) : (
                  <Line key={m.id} yAxisId={m.axis} type="monotone" dataKey={m.id} name={m.label}
                    stroke={m.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
