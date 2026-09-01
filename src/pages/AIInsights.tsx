import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  Brain, TrendingUp, Pause, Copy, RefreshCw, Users2, LayoutGrid, Globe2, Clock,
  ArrowRight, CheckCircle2, ChevronDown,
} from 'lucide-react';
import {
  generateCampaignRecommendations, generateAdSetRecommendations, generateAdRecommendations,
} from '../data/engineData';
import { wasteFindings, benchmarks, TARGET_ROAS } from '../data/performanceData';
import { placementBreakdown, countryBreakdown, hourBreakdown } from '../data/breakdownData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { useFilters } from '../context/FiltersContext';
import type { BudgetRecommendation } from '../types';

/**
 * AI Insights / Action Center (§17).
 *
 * The Budget Engine (§21) answers "what should this entity's budget be". This
 * page answers the operator's actual morning question — "what do I do today" —
 * by merging engine recommendations, waste findings and breakdown-level signals
 * into one list ordered by expected value rather than by source.
 */

type ActionType =
  | 'SCALE' | 'PAUSE' | 'DUPLICATE' | 'REFRESH' | 'AUDIENCE' | 'PLACEMENT' | 'GEO' | 'SCHEDULE';

interface Recommendation {
  id: string;
  action: ActionType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  entity: string;
  entityType: string;
  reason: string;
  expectedImpact: string;
  confidence: number;
  /** Revenue this action is expected to add or protect. */
  value: number;
}

const ACTION_META: Record<ActionType, { label: string; icon: React.ElementType; tone: string; ring: string }> = {
  SCALE: { label: 'Increase Budget', icon: TrendingUp, tone: 'text-emerald-400', ring: 'bg-emerald-500/10 border-emerald-500/20' },
  PAUSE: { label: 'Pause', icon: Pause, tone: 'text-rose-400', ring: 'bg-rose-500/10 border-rose-500/20' },
  DUPLICATE: { label: 'Duplicate', icon: Copy, tone: 'text-cyan-400', ring: 'bg-cyan-500/10 border-cyan-500/20' },
  REFRESH: { label: 'Refresh Creative', icon: RefreshCw, tone: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20' },
  AUDIENCE: { label: 'Adjust Audience', icon: Users2, tone: 'text-brand-400', ring: 'bg-brand-500/10 border-brand-500/20' },
  PLACEMENT: { label: 'Switch Placements', icon: LayoutGrid, tone: 'text-brand-400', ring: 'bg-brand-500/10 border-brand-500/20' },
  GEO: { label: 'Geo Reallocation', icon: Globe2, tone: 'text-cyan-400', ring: 'bg-cyan-500/10 border-cyan-500/20' },
  SCHEDULE: { label: 'Dayparting', icon: Clock, tone: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20' },
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Map an engine recommendation onto the action-center vocabulary. */
function fromEngine(r: BudgetRecommendation): Recommendation | null {
  const map: Partial<Record<BudgetRecommendation['recommendation'], ActionType>> = {
    INCREASE_BUDGET: 'SCALE',
    SCALE_VERTICAL: 'SCALE',
    SCALE_HORIZONTAL: 'DUPLICATE',
    DUPLICATE: 'DUPLICATE',
    PAUSE: 'PAUSE',
    DECREASE_BUDGET: 'PAUSE',
    REFRESH_CREATIVE: 'REFRESH',
    TEST_NEW_CREATIVE: 'REFRESH',
    EXPAND_AUDIENCE: 'AUDIENCE',
    NARROW_AUDIENCE: 'AUDIENCE',
    TEST_NEW_AUDIENCE: 'AUDIENCE',
  };
  const action = map[r.recommendation];
  if (!action) return null;

  // Budgets live on campaigns and ad sets — an ad has no budget of its own, so a
  // scale recommendation there is about shifting delivery, not setting a number.
  const hasBudget = r.suggestedDailyBudget > 0;
  const title =
    action === 'SCALE'
      ? hasBudget
        ? `Increase budget ${r.budgetChangePct > 0 ? `${r.budgetChangePct}% ` : ''}to ${formatCurrency(r.suggestedDailyBudget)}/day`
        : 'Shift ad set budget toward this ad'
      : action === 'PAUSE' && r.recommendation === 'DECREASE_BUDGET'
        ? hasBudget
          ? `Cut budget to ${formatCurrency(r.suggestedDailyBudget)}/day`
          : 'Reduce delivery on this ad'
        : ACTION_META[action].label;

  return {
    id: `engine-${r.id}`,
    action,
    priority: r.confidence >= 85 ? 'high' : r.confidence >= 70 ? 'medium' : 'low',
    title,
    entity: r.entityName,
    entityType: r.entityType,
    reason: r.reason,
    expectedImpact: r.expectedImpact,
    confidence: r.confidence,
    value: Math.abs(r.estimatedAdditionalRevenue),
  };
}

export function AIInsights() {
  const { data } = useFilters();
  const [filter, setFilter] = useState<ActionType | 'ALL'>('ALL');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const recommendations: Recommendation[] = useMemo(() => {
    const names = new Set([
      ...data.campaigns.map(c => c.name),
      ...data.adSets.map(a => a.name),
      ...data.ads.map(a => a.name),
    ]);

    const out: Recommendation[] = [];

    // 1. Entity-level engine output.
    for (const r of [
      ...generateCampaignRecommendations(),
      ...generateAdSetRecommendations(),
      ...generateAdRecommendations(),
    ]) {
      if (!names.has(r.entityName)) continue;
      const mapped = fromEngine(r);
      if (mapped) out.push(mapped);
    }

    // 2. Critical waste findings become explicit pause/refresh actions.
    for (const f of wasteFindings) {
      if (!names.has(f.entity.name)) continue;
      if (f.severity !== 'critical') continue;
      out.push({
        id: `waste-${f.id}`,
        action: f.kind === 'CREATIVE_FATIGUE' ? 'REFRESH' : f.kind === 'HIGH_FREQUENCY' ? 'AUDIENCE' : 'PAUSE',
        priority: 'high',
        title: f.recommendedAction,
        entity: f.entity.name,
        entityType: f.entity.level,
        reason: f.detail,
        expectedImpact: `Protects ${formatCurrency(f.wastedSpend)} of spend, worth about ${formatCurrency(f.wastedSpend * benchmarks.roas)} in revenue if redeployed at account ROAS.`,
        confidence: f.severity === 'critical' ? 92 : 78,
        value: f.wastedSpend * benchmarks.roas,
      });
    }

    // 3. Account-level structural signals from the breakdown layer.
    const worstPlacement = [...placementBreakdown]
      .filter(p => p.spend > 500)
      .sort((a, b) => a.roas - b.roas)[0];
    const bestPlacement = [...placementBreakdown].sort((a, b) => b.roas - a.roas)[0];
    if (worstPlacement && bestPlacement && worstPlacement.roas < TARGET_ROAS) {
      out.push({
        id: 'struct-placement',
        action: 'PLACEMENT',
        priority: 'high',
        title: `Exclude ${worstPlacement.segment} and shift budget to ${bestPlacement.segment}`,
        entity: 'Account structure',
        entityType: 'account',
        reason: `${worstPlacement.segment} absorbs ${formatCurrency(worstPlacement.spend)} at ${formatMultiplier(worstPlacement.roas)} and ${formatCurrency(worstPlacement.cpa)} CPA, against ${formatMultiplier(bestPlacement.roas)} on ${bestPlacement.segment}. Automatic placements are routing budget to the weaker surface.`,
        expectedImpact: `Reallocating at ${bestPlacement.segment}'s efficiency would add roughly ${formatCurrency(worstPlacement.spend * (bestPlacement.roas - worstPlacement.roas))} in revenue.`,
        confidence: 88,
        value: worstPlacement.spend * (bestPlacement.roas - worstPlacement.roas),
      });
    }

    const bestGeo = [...countryBreakdown].filter(c => c.purchases > 20).sort((a, b) => b.roas - a.roas)[0];
    const worstGeo = [...countryBreakdown].filter(c => c.spend > 1000).sort((a, b) => a.roas - b.roas)[0];
    if (bestGeo && worstGeo && bestGeo.countryCode !== worstGeo.countryCode) {
      out.push({
        id: 'struct-geo',
        action: 'GEO',
        priority: 'medium',
        title: `Split ${bestGeo.segment} into its own campaign and cap ${worstGeo.segment}`,
        entity: 'Geographic allocation',
        entityType: 'account',
        reason: `${bestGeo.segment} returns ${formatMultiplier(bestGeo.roas)} at ${formatCurrency(bestGeo.cpa)} CPA but only holds ${formatCurrency(bestGeo.spend)}, while ${worstGeo.segment} carries ${formatCurrency(worstGeo.spend)} at ${formatMultiplier(worstGeo.roas)}. A shared campaign lets the weaker geo absorb budget the algorithm would otherwise send to the stronger one.`,
        expectedImpact: `Isolating ${bestGeo.segment} typically recovers 10-15% of the ROAS gap — about ${formatCurrency(worstGeo.spend * 0.12 * bestGeo.roas)} in revenue.`,
        confidence: 74,
        value: worstGeo.spend * 0.12 * bestGeo.roas,
      });
    }

    const peak = [...hourBreakdown].sort((a, b) => b.roas - a.roas).slice(0, 4);
    const trough = [...hourBreakdown].sort((a, b) => a.roas - b.roas).slice(0, 4);
    if (peak.length && trough.length) {
      const gap = peak[0].roas / Math.max(trough[0].roas, 0.01);
      if (gap > 1.4) {
        out.push({
          id: 'struct-schedule',
          action: 'SCHEDULE',
          priority: 'medium',
          title: `Daypart delivery toward ${peak.map(p => p.segment).join(', ')}`,
          entity: 'Delivery schedule',
          entityType: 'account',
          reason: `Top hours return ${formatMultiplier(peak[0].roas)} against ${formatMultiplier(trough[0].roas)} in the weakest hours — a ${gap.toFixed(1)}x spread. Lifetime budgets with a schedule can concentrate delivery into the converting window.`,
          expectedImpact: `Moving the ${formatCurrency(trough.reduce((s, t) => s + t.spend, 0))} spent in the weakest hours into peak hours would add roughly ${formatCurrency(trough.reduce((s, t) => s + t.spend, 0) * (peak[0].roas - trough[0].roas))}.`,
          confidence: 71,
          value: trough.reduce((s, t) => s + t.spend, 0) * (peak[0].roas - trough[0].roas),
        });
      }
    }

    return out.sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return p !== 0 ? p : b.value - a.value;
    });
  }, [data]);

  const counts = useMemo(() => {
    const c = {} as Record<ActionType, number>;
    for (const r of recommendations) c[r.action] = (c[r.action] ?? 0) + 1;
    return c;
  }, [recommendations]);

  const visible = filter === 'ALL' ? recommendations : recommendations.filter(r => r.action === filter);
  const open = visible.filter(r => !done.has(r.id));
  const totalValue = open.reduce((s, r) => s + r.value, 0);
  const highPriority = open.filter(r => r.priority === 'high').length;

  const toggleDone = (id: string) =>
    setDone(d => {
      const next = new Set(d);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded(e => {
      const next = new Set(e);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="card p-5 bg-gradient-to-br from-brand-600/[0.08] to-transparent border-brand-600/25">
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
            <Brain size={22} className="text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Today's action plan</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-none mb-2">
              {open.length} action{open.length === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              <span className="text-rose-400 font-medium">{highPriority} high priority</span>. Working the full list is
              worth approximately{' '}
              <span className="text-emerald-400 font-medium">{formatCurrency(totalValue)}</span> in added or protected
              revenue, against an account currently returning {formatMultiplier(benchmarks.roas)} at{' '}
              {formatCurrency(benchmarks.cpa)} CPA.
            </p>
          </div>
          <ExportMenu
            rows={open}
            columns={[
              { key: 'priority', header: 'Priority', value: r => r.priority },
              { key: 'action', header: 'Action', value: r => ACTION_META[r.action].label },
              { key: 'entity', header: 'Entity', value: r => r.entity },
              { key: 'level', header: 'Level', value: r => r.entityType },
              { key: 'title', header: 'Recommendation', value: r => r.title },
              { key: 'reason', header: 'Reason', value: r => r.reason },
              { key: 'impact', header: 'Expected Impact', value: r => r.expectedImpact },
              { key: 'confidence', header: 'Confidence %', value: r => r.confidence },
              { key: 'value', header: 'Est. Revenue Value', value: r => r.value.toFixed(2) },
            ]}
            name="pharmescence_action_plan"
            title="AI Action Plan"
          />
        </div>
      </div>

      {/* Action filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            filter === 'ALL' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white',
          )}
        >
          All actions <span className="ml-1 opacity-60 tabular-nums">{recommendations.length}</span>
        </button>
        {(Object.keys(ACTION_META) as ActionType[]).map(a => {
          const meta = ACTION_META[a];
          const Icon = meta.icon;
          const n = counts[a] ?? 0;
          return (
            <button
              key={a}
              onClick={() => setFilter(a)}
              disabled={n === 0}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filter === a ? 'bg-brand-600 border-brand-600 text-white' : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white',
                n === 0 && 'opacity-35 pointer-events-none',
              )}
            >
              <Icon size={12} className={filter === a ? 'text-white' : meta.tone} />
              {meta.label}
              <span className="opacity-60 tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            variant="all-clear"
            title="No recommendations in scope"
            description="Every entity matching the current filters is performing within its expected band. Widen the filters or check back after the next delivery window."
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(r => {
            const meta = ACTION_META[r.action];
            const Icon = meta.icon;
            const isDone = done.has(r.id);
            const isOpen = expanded.has(r.id);
            return (
              <div
                key={r.id}
                className={clsx(
                  'card p-4 transition-all duration-200',
                  isDone ? 'opacity-45' : 'hover:border-bg-hover',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={clsx('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', meta.ring)}>
                    <Icon size={16} className={meta.tone} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warning' : 'default'}>
                        {r.priority}
                      </Badge>
                      <Badge variant="purple">{meta.label}</Badge>
                      <span className="text-xs text-slate-500 capitalize">{r.entityType}</span>
                    </div>

                    <p className={clsx('text-sm font-semibold mb-0.5', isDone ? 'text-slate-500 line-through' : 'text-white')}>
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-500 mb-2 truncate">{r.entity}</p>

                    <p className={clsx('text-sm text-slate-400 leading-relaxed', !isOpen && 'line-clamp-2')}>
                      {r.reason}
                    </p>

                    {isOpen && (
                      <p className="text-sm text-emerald-400/90 leading-relaxed mt-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg px-3 py-2">
                        <ArrowRight size={13} className="inline mr-1.5 -mt-0.5" />
                        {r.expectedImpact}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-slate-500">Confidence</span>
                        <span className="w-16 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                          <span
                            className={clsx('block h-full rounded-full', r.confidence >= 85 ? 'bg-emerald-500' : r.confidence >= 70 ? 'bg-amber-500' : 'bg-slate-500')}
                            style={{ width: `${r.confidence}%` }}
                          />
                        </span>
                        <span className="text-xs font-semibold text-white tabular-nums">{r.confidence}%</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500">Est. value</span>
                        <span className="text-emerald-400 font-bold tabular-nums">{formatCurrency(r.value)}</span>
                      </span>

                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                      >
                        {isOpen ? 'Less' : 'Expected impact'}
                        <ChevronDown size={12} className={clsx('transition-transform', isOpen && 'rotate-180')} />
                      </button>

                      <button
                        onClick={() => toggleDone(r.id)}
                        className={clsx(
                          'ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          isDone
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white hover:border-brand-600/40',
                        )}
                      >
                        <CheckCircle2 size={13} />
                        {isDone ? 'Done' : 'Mark done'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
