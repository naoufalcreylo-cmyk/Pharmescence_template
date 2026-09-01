import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { clsx } from 'clsx';
import { LayoutGrid, Facebook, Instagram, MessageCircle, Network } from 'lucide-react';
import { placementBreakdown, publisherPlatformBreakdown } from '../data/breakdownData';
import { BreakdownTable } from '../components/tables/BreakdownTable';
import { TARGET_ROAS } from '../data/performanceData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { summarize } from '../lib/selectors';
import { EmptyState } from '../components/ui/EmptyState';
import { useFilters } from '../context/FiltersContext';
import type { BreakdownRow } from '../types';

/**
 * Placement Analysis (§14).
 *
 * Meta's automatic placements hide a wide efficiency spread — this view splits
 * every surface out so budget can be steered toward the ones that actually
 * convert, and away from the ones that only absorb impressions.
 */

const PLATFORM_ICON: Record<string, React.ElementType> = {
  Facebook: Facebook,
  Instagram: Instagram,
  Messenger: MessageCircle,
  'Audience Network': Network,
  Meta: Network,
};

type CompareMetric = 'spend' | 'purchases' | 'roas' | 'cpa' | 'ctr' | 'cpm';

const COMPARE: { id: CompareMetric; label: string; color: string; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { id: 'spend', label: 'Spend', color: '#7C3AED', fmt: v => formatCurrency(v, true) },
  { id: 'purchases', label: 'Purchases', color: '#10B981', fmt: v => formatNumber(v) },
  { id: 'roas', label: 'ROAS', color: '#FBBF24', fmt: v => formatMultiplier(v) },
  { id: 'cpa', label: 'CPA', color: '#F43F5E', fmt: v => formatCurrency(v), lowerIsBetter: true },
  { id: 'ctr', label: 'CTR', color: '#A780FF', fmt: v => formatPercent(v) },
  { id: 'cpm', label: 'CPM', color: '#F59E0B', fmt: v => formatCurrency(v), lowerIsBetter: true },
];

export function Placements() {
  const { filters } = useFilters();
  const [metric, setMetric] = useState<CompareMetric>('roas');

  const rows: BreakdownRow[] = useMemo(
    () =>
      filters.placements.length > 0
        ? placementBreakdown.filter(p => filters.placements.includes(p.segment))
        : placementBreakdown,
    [filters.placements],
  );

  const totals = useMemo(() => summarize(rows), [rows]);
  const metricDef = COMPARE.find(m => m.id === metric)!;

  const chartRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        metricDef.lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric],
      ),
    [rows, metric, metricDef.lowerIsBetter],
  );

  const bestPlacement = useMemo(
    () => [...rows].filter(r => r.purchases > 0).sort((a, b) => b.roas - a.roas)[0],
    [rows],
  );
  const worstPlacement = useMemo(
    () => [...rows].filter(r => r.spend > totals.spend * 0.02).sort((a, b) => a.roas - b.roas)[0],
    [rows, totals.spend],
  );

  // Share-of-spend ring per publisher platform.
  const platformRings = useMemo(
    () =>
      publisherPlatformBreakdown.map((p, i) => ({
        name: p.segment,
        value: totals.spend > 0 ? (p.spend / publisherPlatformBreakdown.reduce((s, x) => s + x.spend, 0)) * 100 : 0,
        roas: p.roas,
        spend: p.spend,
        fill: ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B'][i % 4],
      })),
    [totals.spend],
  );

  if (rows.length === 0) {
    return (
      <div className="card animate-slide-up">
        <EmptyState
          variant="no-results"
          title="No placements match your filters"
          description="Clear the Placement filter in the header to see every surface."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Placements', value: formatNumber(rows.length) },
          { label: 'Spend', value: formatCurrency(totals.spend) },
          { label: 'Revenue', value: formatCurrency(totals.revenue) },
          { label: 'Purchases', value: formatNumber(totals.purchases) },
          { label: 'Blended ROAS', value: formatMultiplier(totals.roas) },
          { label: 'Blended CPM', value: formatCurrency(totals.cpm) },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{s.label}</p>
            <p className="text-lg font-bold text-white tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Efficiency read */}
      {bestPlacement && worstPlacement && bestPlacement.segment !== worstPlacement.segment && (
        <div className="card p-4 flex flex-wrap items-start gap-3">
          <LayoutGrid size={15} className="text-brand-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300 leading-relaxed flex-1 min-w-[280px]">
            <span className="text-emerald-400 font-medium">{bestPlacement.segment}</span> is the strongest surface at{' '}
            <span className="text-white font-medium">{formatMultiplier(bestPlacement.roas)}</span> and{' '}
            {formatCurrency(bestPlacement.cpa)} CPA.{' '}
            <span className="text-rose-400 font-medium">{worstPlacement.segment}</span> absorbs{' '}
            <span className="text-white font-medium">{formatCurrency(worstPlacement.spend)}</span> at only{' '}
            {formatMultiplier(worstPlacement.roas)} — excluding it would free{' '}
            <span className="text-white font-medium">
              {formatCurrency(worstPlacement.spend * (1 - worstPlacement.roas / Math.max(totals.roas, 0.01)))}
            </span>{' '}
            to redeploy at account-average efficiency.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Comparison bars */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-semibold text-white">Placement Comparison</h3>
            <div className="inline-flex flex-wrap gap-1">
              {COMPARE.map(m => (
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
          <ResponsiveContainer width="100%" height={Math.max(280, chartRows.length * 38)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false}
                tickFormatter={metricDef.fmt} />
              <YAxis type="category" dataKey="segment" width={128} tick={{ fontSize: 11 }} stroke="#475569"
                tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: '#7C3AED', fillOpacity: 0.06 }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d: BreakdownRow = payload[0].payload;
                  return (
                    <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 text-xs space-y-1">
                      <p className="text-white font-semibold">{d.segment}</p>
                      <p className="text-slate-500">{d.meta}</p>
                      <p className="text-slate-400">Spend <span className="text-white">{formatCurrency(d.spend)}</span></p>
                      <p className="text-slate-400">Purchases <span className="text-white">{formatNumber(d.purchases)}</span></p>
                      <p className="text-slate-400">ROAS <span className="text-white">{formatMultiplier(d.roas)}</span></p>
                      <p className="text-slate-400">CPA <span className="text-white">{formatCurrency(d.cpa)}</span></p>
                      <p className="text-slate-400">CTR <span className="text-white">{formatPercent(d.ctr)}</span></p>
                      <p className="text-slate-400">CPM <span className="text-white">{formatCurrency(d.cpm)}</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey={metric} radius={[0, 6, 6, 0]} maxBarSize={24}>
                {chartRows.map((r, i) => (
                  <Cell
                    key={i}
                    fill={
                      metric === 'roas'
                        ? r.roas >= TARGET_ROAS ? '#10B981' : r.roas >= TARGET_ROAS * 0.8 ? '#F59E0B' : '#F43F5E'
                        : metricDef.color
                    }
                    fillOpacity={0.85 - (i / Math.max(chartRows.length, 1)) * 0.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Publisher platform split */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Publisher Platform</h3>
          <p className="text-xs text-slate-500 mb-3">Share of spend across Meta's four properties.</p>
          <ResponsiveContainer width="100%" height={210}>
            <RadialBarChart innerRadius="35%" outerRadius="100%" data={platformRings} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#1E1E32' }} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 text-xs">
                      <p className="text-white font-semibold mb-1">{d.name}</p>
                      <p className="text-slate-400">{d.value.toFixed(1)}% of spend</p>
                      <p className="text-slate-400">{formatCurrency(d.spend)} · {formatMultiplier(d.roas)}</p>
                    </div>
                  );
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {publisherPlatformBreakdown.map((p, i) => {
              const Icon = PLATFORM_ICON[p.segment] ?? Network;
              return (
                <div key={p.segment} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B'][i % 4] }} />
                  <Icon size={13} className="text-slate-500 shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{p.segment}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{formatCurrency(p.spend, true)}</span>
                  <span
                    className={clsx(
                      'text-xs font-semibold tabular-nums w-12 text-right shrink-0',
                      p.roas >= TARGET_ROAS ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {formatMultiplier(p.roas)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full table */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Placement Detail</h3>
        <BreakdownTable
          rows={rows}
          segmentLabel="Placement"
          metaLabel="Platform"
          targetRoas={TARGET_ROAS}
          exportName="pharmescence_placements"
          exportTitle="Placement Analysis"
        />
      </div>
    </div>
  );
}
