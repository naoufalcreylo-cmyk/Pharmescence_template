import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts';
import { clsx } from 'clsx';
import { Layers, Sparkles } from 'lucide-react';
import { DIMENSIONS, getDimension } from '../data/breakdownData';
import { BreakdownTable } from '../components/tables/BreakdownTable';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { summarize } from '../lib/selectors';
import { TARGET_ROAS } from '../data/performanceData';
import { useFilters } from '../context/FiltersContext';
import type { BreakdownDimension, BreakdownRow } from '../types';

/**
 * Breakdown section (§7).
 *
 * One control surface over every Meta breakdown dimension — demographic,
 * delivery, geographic and time — rendered through a single table and chart so
 * comparisons across dimensions stay apples-to-apples.
 */

type ChartMetric = 'spend' | 'purchases' | 'revenue' | 'roas' | 'cpa' | 'ctr';

const CHART_METRICS: { id: ChartMetric; label: string; color: string; fmt: (v: number) => string }[] = [
  { id: 'spend', label: 'Spend', color: '#7C3AED', fmt: v => formatCurrency(v, true) },
  { id: 'revenue', label: 'Revenue', color: '#06B6D4', fmt: v => formatCurrency(v, true) },
  { id: 'purchases', label: 'Purchases', color: '#10B981', fmt: v => formatNumber(v) },
  { id: 'roas', label: 'ROAS', color: '#FBBF24', fmt: v => formatMultiplier(v) },
  { id: 'cpa', label: 'CPA', color: '#F43F5E', fmt: v => formatCurrency(v) },
  { id: 'ctr', label: 'CTR', color: '#A780FF', fmt: v => formatPercent(v) },
];

const GROUPS = ['Demographic', 'Delivery', 'Geographic', 'Time'] as const;

export function Breakdowns() {
  const { filters } = useFilters();
  const [dimension, setDimension] = useState<BreakdownDimension>('placement');
  const [metric, setMetric] = useState<ChartMetric>('spend');

  const def = getDimension(dimension);
  const metricDef = CHART_METRICS.find(m => m.id === metric)!;

  // The Device filter is a breakdown-scoped filter (§18) — apply it here.
  const rows: BreakdownRow[] = useMemo(() => {
    if (dimension === 'device' && filters.devices.length > 0) {
      return def.rows.filter(r => filters.devices.includes(r.segment));
    }
    return def.rows;
  }, [def, dimension, filters.devices]);

  const totals = useMemo(() => summarize(rows), [rows]);

  const chartRows = useMemo(
    () => [...rows].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 12),
    [rows, metric],
  );

  // Best / worst segment carrying enough spend to be a real read, not noise.
  const material = useMemo(
    () => rows.filter(r => r.spend > totals.spend * 0.03 && r.purchases > 0),
    [rows, totals.spend],
  );
  const best = useMemo(() => [...material].sort((a, b) => b.roas - a.roas)[0], [material]);
  const worst = useMemo(() => [...material].sort((a, b) => a.roas - b.roas)[0], [material]);

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Dimension picker */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white">Breakdown Dimension</h2>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {GROUPS.map(group => (
            <div key={group}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {DIMENSIONS.filter(d => d.group === group).map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDimension(d.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      dimension === d.id
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white hover:border-brand-600/40',
                    )}
                  >
                    {d.label}
                    <span className="ml-1.5 opacity-50 tabular-nums">{d.rows.length}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            variant="no-results"
            title={`No ${def.label.toLowerCase()} rows match your filters`}
            description="The Device filter narrows breakdown views. Clear it from the filter bar to see every segment."
          />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Segments', value: formatNumber(rows.length) },
              { label: 'Spend', value: formatCurrency(totals.spend) },
              { label: 'Revenue', value: formatCurrency(totals.revenue) },
              { label: 'Purchases', value: formatNumber(totals.purchases) },
              { label: 'Blended ROAS', value: formatMultiplier(totals.roas) },
              { label: 'Blended CPA', value: formatCurrency(totals.cpa) },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{s.label}</p>
                <p className="text-lg font-bold text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Best / worst read */}
          {best && worst && best.segment !== worst.segment && (
            <div className="card p-4 flex flex-wrap items-start gap-4">
              <Sparkles size={15} className="text-brand-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-300 leading-relaxed flex-1 min-w-[280px]">
                Across <span className="text-white font-medium">{def.label.toLowerCase()}</span>,{' '}
                <span className="text-emerald-400 font-medium">{best.segment}</span> returns{' '}
                <span className="text-white font-medium">{formatMultiplier(best.roas)}</span> at{' '}
                {formatCurrency(best.cpa)} CPA, while{' '}
                <span className="text-rose-400 font-medium">{worst.segment}</span> returns only{' '}
                <span className="text-white font-medium">{formatMultiplier(worst.roas)}</span> at{' '}
                {formatCurrency(worst.cpa)} CPA — a{' '}
                <span className="text-white font-medium">{(best.roas / Math.max(worst.roas, 0.01)).toFixed(1)}x</span>{' '}
                efficiency gap on {formatCurrency(worst.spend)} of spend.
              </p>
            </div>
          )}

          {/* Chart pair */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold text-white">{def.label} by {metricDef.label}</h3>
                <div className="inline-flex flex-wrap gap-1">
                  {CHART_METRICS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMetric(m.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                        metric === m.id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-white',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(260, chartRows.length * 30)}>
                <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false}
                    tickFormatter={metricDef.fmt} />
                  <YAxis type="category" dataKey="segment" width={130} tick={{ fontSize: 11 }} stroke="#475569"
                    tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: '#7C3AED', fillOpacity: 0.06 }}
                    contentStyle={{ background: '#1E1E32', border: '1px solid #2A2A42', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [metricDef.fmt(v), metricDef.label]}
                  />
                  <Bar dataKey={metric} radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {chartRows.map((r, i) => (
                      <Cell
                        key={i}
                        fill={metricDef.color}
                        fillOpacity={metric === 'cpa'
                          // For CPA lower is better, so invert the emphasis ramp.
                          ? 0.35 + 0.5 * (1 - i / Math.max(chartRows.length - 1, 1))
                          : 0.9 - (i / Math.max(chartRows.length, 1)) * 0.55}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Efficiency scatter: where is spend buying ROAS? */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Spend vs ROAS</h3>
              <p className="text-xs text-slate-500 mb-4">
                Bubble size = purchases. Segments below the target line consume budget without returning it.
              </p>
              <ResponsiveContainer width="100%" height={330}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" />
                  <XAxis type="number" dataKey="spend" name="Spend" tick={{ fontSize: 11 }} stroke="#475569"
                    tickLine={false} axisLine={false} tickFormatter={v => formatCurrency(v, true)} />
                  <YAxis type="number" dataKey="roas" name="ROAS" tick={{ fontSize: 11 }} stroke="#475569"
                    tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}x`} />
                  <ZAxis type="number" dataKey="purchases" range={[50, 620]} name="Purchases" />
                  <ReferenceLine y={TARGET_ROAS} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.6}
                    label={{ value: `Target ${TARGET_ROAS}x`, position: 'insideTopRight', fill: '#10B981', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#7C3AED' }}
                    contentStyle={{ background: '#1E1E32', border: '1px solid #2A2A42', borderRadius: 12, fontSize: 12 }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d: BreakdownRow = payload[0].payload;
                      return (
                        <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 text-xs">
                          <p className="text-white font-semibold mb-1.5">{d.segment}</p>
                          <p className="text-slate-400">Spend <span className="text-white">{formatCurrency(d.spend)}</span></p>
                          <p className="text-slate-400">ROAS <span className="text-white">{formatMultiplier(d.roas)}</span></p>
                          <p className="text-slate-400">Purchases <span className="text-white">{formatNumber(d.purchases)}</span></p>
                          <p className="text-slate-400">CPA <span className="text-white">{formatCurrency(d.cpa)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={rows} name={def.label}>
                    {rows.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.roas >= TARGET_ROAS ? '#10B981' : r.roas >= TARGET_ROAS * 0.8 ? '#F59E0B' : '#F43F5E'}
                        fillOpacity={0.45}
                        stroke={r.roas >= TARGET_ROAS ? '#34D399' : r.roas >= TARGET_ROAS * 0.8 ? '#FBBF24' : '#FB7185'}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full table */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">{def.label} Breakdown</h3>
            <BreakdownTable
              rows={rows}
              segmentLabel={def.label}
              metaLabel={def.metaLabel}
              targetRoas={TARGET_ROAS}
              exportName={`pharmescence_breakdown_${def.id}`}
              exportTitle={`${def.label} Breakdown`}
            />
          </div>
        </>
      )}
    </div>
  );
}
