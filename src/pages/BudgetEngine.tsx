import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Pause, RefreshCw, Copy,
  Expand, Target, Minus, ChevronDown, ChevronUp,
  DollarSign, ShoppingCart, BarChart2, AlertCircle,
  Layers, FlaskConical, Zap, ArrowRightLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  generateCampaignRecommendations,
  generateAdSetRecommendations,
  generateAdRecommendations,
} from '../data/engineData';
import { formatCurrency, formatMultiplier, formatPercent } from '../utils/formatters';
import type { BudgetRecommendation, RecommendationType } from '../types';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const REC_META: Record<RecommendationType, {
  label: string; icon: React.ElementType; color: string;
  bg: string; border: string; pillColor: string;
}> = {
  INCREASE_BUDGET:  { label: 'Increase Budget',    icon: TrendingUp,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', pillColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  SCALE_VERTICAL:   { label: 'Scale Vertically',   icon: Zap,             color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-l-emerald-400', pillColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25' },
  SCALE_HORIZONTAL: { label: 'Scale Horizontally', icon: ArrowRightLeft,  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-l-cyan-500',    pillColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'         },
  DECREASE_BUDGET:  { label: 'Decrease Budget',    icon: TrendingDown,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-l-amber-500',   pillColor: 'bg-amber-500/15 text-amber-400 border-amber-500/25'      },
  KEEP_STABLE:      { label: 'Keep Stable',         icon: Minus,           color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-l-slate-600',   pillColor: 'bg-slate-500/15 text-slate-400 border-slate-500/25'      },
  DUPLICATE:        { label: 'Duplicate',           icon: Copy,            color: 'text-brand-400',   bg: 'bg-brand-500/10',   border: 'border-l-brand-500',   pillColor: 'bg-brand-500/15 text-brand-400 border-brand-500/25'      },
  PAUSE:            { label: 'Pause',               icon: Pause,           color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-l-rose-500',    pillColor: 'bg-rose-500/15 text-rose-400 border-rose-500/25'         },
  REFRESH_CREATIVE: { label: 'Refresh Creative',   icon: RefreshCw,       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-l-amber-500',   pillColor: 'bg-amber-500/15 text-amber-400 border-amber-500/25'      },
  EXPAND_AUDIENCE:  { label: 'Expand Audience',    icon: Expand,          color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-l-cyan-400',    pillColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-400/25'         },
  NARROW_AUDIENCE:  { label: 'Narrow Audience',    icon: Target,          color: 'text-brand-400',   bg: 'bg-brand-500/10',   border: 'border-l-brand-500',   pillColor: 'bg-brand-500/15 text-brand-400 border-brand-500/25'      },
  TEST_NEW_CREATIVE:{ label: 'Test New Creative',  icon: FlaskConical,    color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-l-violet-500',  pillColor: 'bg-violet-500/15 text-violet-400 border-violet-500/25'   },
  TEST_NEW_AUDIENCE:{ label: 'Test New Audience',  icon: Layers,          color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-l-violet-500',  pillColor: 'bg-violet-500/15 text-violet-400 border-violet-500/25'   },
};

const RISK_COLORS = {
  low:    'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  high:   'text-rose-400 bg-rose-500/10 border border-rose-500/20',
};

// ─── Confidence Meter ─────────────────────────────────────────────────────────
function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 85 ? '#10B981' : value >= 70 ? '#F59E0B' : '#F43F5E';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#2A2A42" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
          style={{ fill: color, fontSize: 11, fontWeight: 700 }}>
          {value}%
        </text>
      </svg>
      <span className="text-xs text-slate-500">Confidence</span>
    </div>
  );
}

// ─── Rec Card ─────────────────────────────────────────────────────────────────
function RecommendationCard({ rec }: { rec: BudgetRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const meta = REC_META[rec.recommendation];
  const Icon = meta.icon;
  const secMeta = rec.secondaryRecommendation ? REC_META[rec.secondaryRecommendation] : null;

  const budgetChanged = rec.budgetChangePct !== 0;
  const isScaling = rec.budgetChangePct > 0;
  const isPausing = rec.recommendation === 'PAUSE';

  return (
    <div className={clsx(
      'card border-l-2 transition-all duration-200',
      meta.border,
      expanded && 'shadow-card-hover'
    )}>
      {/* Header */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Icon */}
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
          <Icon size={16} className={meta.color} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full border', meta.pillColor)}>
              {meta.label}
            </span>
            {secMeta && (
              <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full border', secMeta.pillColor)}>
                + {secMeta.label}
              </span>
            )}
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', RISK_COLORS[rec.riskLevel])}>
              {rec.riskLevel.toUpperCase()} RISK
            </span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug truncate">
            {rec.entityName.replace('Pharmescence | ', '')}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {rec.entityType} · ROAS {rec.currentROAS.toFixed(2)}x · CPA ${rec.currentCPA.toFixed(2)} · Freq {rec.currentFrequency.toFixed(2)}
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 shrink-0">
          <ConfidenceMeter value={rec.confidence} />
          {budgetChanged && !isPausing && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Budget Change</p>
              <p className={clsx('text-base font-black', isScaling ? 'text-emerald-400' : 'text-amber-400')}>
                {isScaling ? '+' : ''}{rec.budgetChangePct}%
              </p>
              {rec.currentDailyBudget > 0 && (
                <p className="text-xs text-slate-500">${rec.currentDailyBudget} → ${rec.suggestedDailyBudget}/day</p>
              )}
            </div>
          )}
          {isPausing && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Action</p>
              <p className="text-base font-black text-rose-400">PAUSE</p>
              <p className="text-xs text-slate-500">Stop delivery</p>
            </div>
          )}
          {!budgetChanged && !isPausing && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Budget</p>
              <p className="text-sm font-bold text-slate-400">Unchanged</p>
            </div>
          )}
          <div className="text-slate-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-bg-border px-4 pb-4 pt-3 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Reason */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Why this recommendation</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{rec.reason}</p>

              {/* Budget change details */}
              {!isPausing && rec.currentDailyBudget > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-bg-elevated rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Current Budget</p>
                    <p className="text-base font-bold text-white">${rec.currentDailyBudget}/day</p>
                  </div>
                  <div className={clsx('rounded-xl p-3', isScaling ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                    <p className="text-xs text-slate-500 mb-0.5">Suggested Budget</p>
                    <p className={clsx('text-base font-bold', isScaling ? 'text-emerald-400' : 'text-amber-400')}>
                      ${rec.suggestedDailyBudget}/day
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Expected Impact */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expected Impact</h4>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">{rec.expectedImpact}</p>

              {(rec.estimatedAdditionalPurchases > 0 || rec.estimatedAdditionalRevenue > 0) && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-bg-elevated rounded-xl p-3 text-center">
                    <ShoppingCart size={14} className="text-emerald-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-emerald-400">+{rec.estimatedAdditionalPurchases}</p>
                    <p className="text-xs text-slate-500">Purchases</p>
                  </div>
                  <div className="bg-bg-elevated rounded-xl p-3 text-center">
                    <DollarSign size={14} className="text-cyan-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-cyan-400">+{formatCurrency(rec.estimatedAdditionalRevenue, true)}</p>
                    <p className="text-xs text-slate-500">Revenue</p>
                  </div>
                  <div className="bg-bg-elevated rounded-xl p-3 text-center">
                    <BarChart2 size={14} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-amber-400">{rec.estimatedROAS.toFixed(2)}x</p>
                    <p className="text-xs text-slate-500">Est. ROAS</p>
                  </div>
                </div>
              )}

              {rec.performanceTrend !== 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Performance trend:</span>
                  <span className={clsx('text-xs font-semibold flex items-center gap-0.5',
                    rec.performanceTrend > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {rec.performanceTrend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {rec.performanceTrend > 0 ? '+' : ''}{rec.performanceTrend.toFixed(1)}% vs prev period
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="mt-4 flex gap-2">
            <button className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              meta.bg, meta.color, 'border border-current/20 hover:opacity-80'
            )}>
              <Icon size={14} />
              Apply: {meta.label}
              {rec.currentDailyBudget > 0 && !isPausing && ` ($${rec.suggestedDailyBudget}/day)`}
            </button>
            {secMeta && rec.secondaryRecommendation && (
              <button className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                'bg-bg-elevated text-slate-400 border-bg-border hover:text-white hover:border-brand-600/40'
              )}>
                {secMeta.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────
function SummaryBar({ recs }: { recs: BudgetRecommendation[] }) {
  const counts: Record<string, number> = {};
  recs.forEach(r => {
    const key = r.recommendation;
    counts[key] = (counts[key] ?? 0) + 1;
  });

  const scaleCount = (counts['INCREASE_BUDGET'] ?? 0) + (counts['SCALE_VERTICAL'] ?? 0) + (counts['SCALE_HORIZONTAL'] ?? 0);
  const pauseCount = counts['PAUSE'] ?? 0;
  const refreshCount = (counts['REFRESH_CREATIVE'] ?? 0) + (counts['TEST_NEW_CREATIVE'] ?? 0);
  const stableCount = counts['KEEP_STABLE'] ?? 0;
  const dupCount = (counts['DUPLICATE'] ?? 0) + (counts['EXPAND_AUDIENCE'] ?? 0);

  const potentialRevenue = recs
    .filter(r => r.estimatedAdditionalRevenue > 0)
    .reduce((s, r) => s + r.estimatedAdditionalRevenue, 0);
  const savedBudget = recs
    .filter(r => r.recommendation === 'PAUSE')
    .reduce((s, r) => s + r.currentDailyBudget * 30, 0);

  return (
    <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { label: 'Scale Up', count: scaleCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Pause', count: pauseCount, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        { label: 'Refresh Creative', count: refreshCount, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Duplicate / Expand', count: dupCount, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Keep Stable', count: stableCount, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        { label: 'Potential Revenue', count: 0, special: '+' + formatCurrency(potentialRevenue, true) + '/mo', color: 'text-brand-400', bg: 'bg-brand-500/10' },
      ].map(s => (
        <div key={s.label} className={clsx('rounded-xl p-3', s.bg)}>
          <p className={clsx('text-xl font-black', s.color)}>{s.special ?? s.count}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type FilterType = 'ALL' | 'SCALE' | 'PAUSE' | 'REFRESH' | 'DUPLICATE' | 'STABLE';
type EntityFilter = 'ALL' | 'campaign' | 'adset' | 'ad';

export function BudgetEngine() {
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [sortBy, setSortBy] = useState<'confidence' | 'roas' | 'spend'>('confidence');
  const [expandAll, setExpandAll] = useState(false);

  const all = useMemo(() => [
    ...generateCampaignRecommendations(),
    ...generateAdSetRecommendations(),
    ...generateAdRecommendations(),
  ], []);

  const filtered = useMemo(() => {
    let list = [...all];
    if (entityFilter !== 'ALL') list = list.filter(r => r.entityType === entityFilter);
    if (typeFilter === 'SCALE') list = list.filter(r => ['INCREASE_BUDGET', 'SCALE_VERTICAL', 'SCALE_HORIZONTAL'].includes(r.recommendation));
    if (typeFilter === 'PAUSE') list = list.filter(r => r.recommendation === 'PAUSE');
    if (typeFilter === 'REFRESH') list = list.filter(r => ['REFRESH_CREATIVE', 'TEST_NEW_CREATIVE'].includes(r.recommendation));
    if (typeFilter === 'DUPLICATE') list = list.filter(r => ['DUPLICATE', 'EXPAND_AUDIENCE', 'SCALE_HORIZONTAL'].includes(r.recommendation));
    if (typeFilter === 'STABLE') list = list.filter(r => r.recommendation === 'KEEP_STABLE');
    if (sortBy === 'confidence') list.sort((a, b) => b.confidence - a.confidence);
    if (sortBy === 'roas') list.sort((a, b) => b.currentROAS - a.currentROAS);
    if (sortBy === 'spend') list.sort((a, b) => b.currentSpend - a.currentSpend);
    return list;
  }, [all, entityFilter, typeFilter, sortBy]);

  const campRecs = all.filter(r => r.entityType === 'campaign');
  const adSetRecs = all.filter(r => r.entityType === 'adset');
  const adRecs = all.filter(r => r.entityType === 'ad');

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Zap size={18} className="text-brand-400" />
            AI Budget & Scaling Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {all.length} recommendations across {campRecs.length} campaigns, {adSetRecs.length} ad sets, and {adRecs.length} ads
          </p>
        </div>
        <button
          onClick={() => setExpandAll(e => !e)}
          className="text-xs text-brand-400 border border-brand-600/30 bg-brand-500/10 rounded-xl px-3 py-2 hover:bg-brand-500/20 transition-colors shrink-0"
        >
          {expandAll ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Summary */}
      <SummaryBar recs={all} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Entity type */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-bg-border rounded-xl p-1">
          {(['ALL', 'campaign', 'adset', 'ad'] as const).map(f => (
            <button key={f} onClick={() => setEntityFilter(f)}
              className={clsx('px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                entityFilter === f ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:text-white')}>
              {f === 'ALL' ? 'All Entities' : f === 'adset' ? 'Ad Sets' : f === 'ad' ? 'Ads' : 'Campaigns'}
            </button>
          ))}
        </div>

        {/* Rec type */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-bg-border rounded-xl p-1">
          {([['ALL', 'All Types'], ['SCALE', '↑ Scale'], ['PAUSE', '⏸ Pause'], ['REFRESH', '↻ Refresh'], ['DUPLICATE', '⎘ Duplicate'], ['STABLE', '— Stable']] as [FilterType, string][]).map(([f, l]) => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={clsx('px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                typeFilter === f ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:text-white')}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Sort by:</span>
          {(['confidence', 'roas', 'spend'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={clsx('px-3 py-1.5 text-xs font-medium rounded-xl border capitalize transition-colors',
                sortBy === s ? 'bg-brand-600/15 text-brand-400 border-brand-600/30' : 'bg-bg-elevated text-slate-400 border-bg-border hover:text-white')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-slate-500">
        Showing <span className="text-white font-semibold">{filtered.length}</span> recommendations
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {filtered.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <AlertCircle size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No recommendations match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
