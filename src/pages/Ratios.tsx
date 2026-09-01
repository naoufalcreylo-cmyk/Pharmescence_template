import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { computeRatios } from '../data/engineData';
import { formatCurrency, formatPercent, formatMultiplier } from '../utils/formatters';
import type { KPIRatio, RatioStatus } from '../types';

interface RatiosProps {
  selectedDays: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<RatioStatus, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  excellent: { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
  good:      { label: 'Good',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: TrendingUp },
  average:   { label: 'Average',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: AlertTriangle },
  poor:      { label: 'Poor',      color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    icon: XCircle },
};

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmtRatio(value: number, format: KPIRatio['format']): string {
  switch (format) {
    case 'currency':    return formatCurrency(value);
    case 'percent':     return formatPercent(value);
    case 'multiplier':  return formatMultiplier(value);
    case 'raw':
    case 'index':       return value.toFixed(2);
    case 'number':      return value.toLocaleString();
    default:            return String(value);
  }
}

// ─── Trend Badge ──────────────────────────────────────────────────────────────
function TrendBadge({ current, previous, higherIsBetter }: { current: number; previous: number; higherIsBetter: boolean }) {
  if (!previous) return null;
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.5) return <span className="text-xs text-slate-500">—</span>;
  const isGood = higherIsBetter ? delta > 0 : delta < 0;
  return (
    <span className={clsx('text-xs font-medium flex items-center gap-0.5', isGood ? 'text-emerald-400' : 'text-rose-400')}>
      {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

// ─── Ratio Row ────────────────────────────────────────────────────────────────
function RatioRow({ ratio }: { ratio: KPIRatio }) {
  const [open, setOpen] = useState(false);
  const s = STATUS_CONFIG[ratio.status];
  const Icon = s.icon;

  // Score bar: how close to benchmark
  const pct = ratio.higherIsBetter
    ? Math.min(100, (ratio.value / (ratio.benchmark * 1.4)) * 100)
    : Math.min(100, (1 - (ratio.value - ratio.benchmark * 0.6) / (ratio.benchmark * 0.8)) * 100);
  const barColor = ratio.status === 'excellent' ? '#10B981' : ratio.status === 'good' ? '#06B6D4' : ratio.status === 'average' ? '#F59E0B' : '#F43F5E';

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={clsx('border-b border-bg-border/50 cursor-pointer transition-colors hover:bg-bg-hover group', open && 'bg-bg-elevated/30')}
      >
        <td className="px-4 py-3 w-[260px]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 font-medium">{ratio.label}</span>
            {open ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={clsx('text-sm font-bold tabular-nums', s.color)}>{fmtRatio(ratio.value, ratio.format)}</span>
        </td>
        <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
          <TrendBadge current={ratio.value} previous={ratio.previousValue} higherIsBetter={ratio.higherIsBetter} />
        </td>
        <td className="px-4 py-3 text-right text-xs text-slate-500">{ratio.benchmarkLabel}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <div className="w-24 h-1.5 rounded-full bg-bg-border overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: barColor }}
              />
            </div>
            <div className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', s.bg, s.color, s.border)}>
              <Icon size={11} />
              {s.label}
            </div>
          </div>
        </td>
      </tr>
      {open && (
        <tr className={clsx('border-b border-bg-border animate-fade-in', 'bg-bg-elevated/20')}>
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Formula</p>
                <code className="text-xs text-brand-300 bg-bg-elevated px-3 py-2 rounded-lg block font-mono">{ratio.formula}</code>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Info size={11} />What this measures</p>
                <p className="text-xs text-slate-400 leading-relaxed">{ratio.explanation}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><ArrowRight size={11} />Recommended action</p>
                <p className="text-xs text-slate-300 leading-relaxed">{ratio.recommendation}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────
function CategorySection({ category, ratios }: { category: string; ratios: KPIRatio[] }) {
  const avgScore =
    ratios.filter(r => r.status === 'excellent').length * 4 +
    ratios.filter(r => r.status === 'good').length * 3 +
    ratios.filter(r => r.status === 'average').length * 2 +
    ratios.filter(r => r.status === 'poor').length * 1;
  const maxScore = ratios.length * 4;
  const healthPct = (avgScore / maxScore) * 100;
  const healthColor = healthPct >= 80 ? 'text-emerald-400' : healthPct >= 65 ? 'text-cyan-400' : healthPct >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-elevated/40">
        <h3 className="text-sm font-semibold text-white">{category}</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(['excellent', 'good', 'average', 'poor'] as const).map(s => {
              const count = ratios.filter(r => r.status === s).length;
              if (!count) return null;
              return (
                <span key={s} className={clsx('text-xs font-medium px-2 py-0.5 rounded-full border', STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color, STATUS_CONFIG[s].border)}>
                  {count} {STATUS_CONFIG[s].label}
                </span>
              );
            })}
          </div>
          <span className={clsx('text-sm font-bold', healthColor)}>{healthPct.toFixed(0)}%</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bg-border/50">
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Metric</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Value</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">vs Prior</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Benchmark</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {ratios.map(r => <RatioRow key={r.id} ratio={r} />)}
        </tbody>
      </table>
    </div>
  );
}

// ─── Score Summary Card ───────────────────────────────────────────────────────
function ScoreSummary({ ratios }: { ratios: KPIRatio[] }) {
  const counts = {
    excellent: ratios.filter(r => r.status === 'excellent').length,
    good:      ratios.filter(r => r.status === 'good').length,
    average:   ratios.filter(r => r.status === 'average').length,
    poor:      ratios.filter(r => r.status === 'poor').length,
  };
  const total = ratios.length;

  return (
    <div className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {(['excellent', 'good', 'average', 'poor'] as RatioStatus[]).map(s => {
        const conf = STATUS_CONFIG[s];
        const Icon = conf.icon;
        return (
          <div key={s} className={clsx('rounded-xl p-3 border', conf.bg, conf.border)}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={conf.color} />
              <span className={clsx('text-xs font-semibold', conf.color)}>{conf.label}</span>
            </div>
            <p className={clsx('text-2xl font-black', conf.color)}>{counts[s]}</p>
            <p className="text-xs text-slate-500 mt-0.5">of {total} metrics ({((counts[s] / total) * 100).toFixed(0)}%)</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Ratios({ selectedDays }: RatiosProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | RatioStatus>('ALL');
  const ratios = useMemo(() => computeRatios(selectedDays), [selectedDays]);

  const categories = [...new Set(ratios.map(r => r.category))];

  const filteredRatios = filterStatus === 'ALL' ? ratios : ratios.filter(r => r.status === filterStatus);

  const filteredByCategory = categories.reduce<Record<string, KPIRatio[]>>((acc, cat) => {
    const items = filteredRatios.filter(r => r.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-white">Performance Ratios & Benchmark Metrics</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {ratios.length} advanced KPIs — click any row to see formula, explanation, and recommended action
        </p>
      </div>

      {/* Score summary */}
      <ScoreSummary ratios={ratios} />

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Filter:</span>
        {(['ALL', 'excellent', 'good', 'average', 'poor'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors',
              filterStatus === s
                ? s === 'ALL' ? 'bg-brand-600/15 text-brand-400 border-brand-600/30'
                  : clsx(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color, STATUS_CONFIG[s].border)
                : 'bg-bg-elevated text-slate-400 border-bg-border hover:text-white'
            )}
          >
            {s === 'ALL' ? 'All Metrics' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Category sections */}
      {Object.entries(filteredByCategory).map(([cat, items]) => (
        <CategorySection key={cat} category={cat} ratios={items} />
      ))}

      {Object.keys(filteredByCategory).length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No metrics match this filter.</p>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="font-semibold text-slate-400">Legend:</span>
        {(['excellent', 'good', 'average', 'poor'] as const).map(s => {
          const conf = STATUS_CONFIG[s];
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className={clsx('w-2 h-2 rounded-full', s === 'excellent' ? 'bg-emerald-400' : s === 'good' ? 'bg-cyan-400' : s === 'average' ? 'bg-amber-400' : 'bg-rose-400')} />
              <span className={conf.color}>{conf.label}</span>
              <span className="text-slate-600">— {s === 'excellent' ? '≥20% above benchmark' : s === 'good' ? 'at or above benchmark' : s === 'average' ? 'up to 20% below' : '>20% below benchmark'}</span>
            </div>
          );
        })}
        <span className="ml-auto italic">Click any row to expand</span>
      </div>
    </div>
  );
}
