import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle, TrendingDown, Flame, Ban, Wallet, Repeat, ShieldAlert,
} from 'lucide-react';
import {
  wasteFindings, totalWastedSpend, benchmarks, TARGET_ROAS, fatigueRanking,
} from '../data/performanceData';
import type { WasteFinding, WasteKind } from '../data/performanceData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { Badge } from '../components/ui/Badge';
import { useFilters } from '../context/FiltersContext';

/**
 * Worst Performers & Budget Waste (§9).
 *
 * Six detectors run over every campaign, ad set and ad: zero-purchase spend,
 * sub-target ROAS, CPA blowout, frequency saturation, creative fatigue and
 * budget mis-allocation. Each finding carries the spend it puts at risk so the
 * list can be worked top-down by money rather than by severity label alone.
 */

const KIND_META: Record<WasteKind, { label: string; icon: React.ElementType; tone: string; ring: string }> = {
  ZERO_PURCHASE_SPEND: { label: 'Zero Purchases', icon: Ban, tone: 'text-rose-400', ring: 'bg-rose-500/10 border-rose-500/20' },
  LOW_ROAS: { label: 'Below Target ROAS', icon: TrendingDown, tone: 'text-rose-400', ring: 'bg-rose-500/10 border-rose-500/20' },
  HIGH_CPA: { label: 'High CPA', icon: Wallet, tone: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20' },
  HIGH_FREQUENCY: { label: 'High Frequency', icon: Repeat, tone: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20' },
  CREATIVE_FATIGUE: { label: 'Creative Fatigue', icon: Flame, tone: 'text-amber-400', ring: 'bg-amber-500/10 border-amber-500/20' },
  BUDGET_WASTE: { label: 'Budget Waste', icon: ShieldAlert, tone: 'text-brand-400', ring: 'bg-brand-500/10 border-brand-500/20' },
};

const SEVERITY_BADGE = {
  critical: 'danger',
  high: 'warning',
  medium: 'default',
} as const;

function FindingCard({ f }: { f: WasteFinding }) {
  const meta = KIND_META[f.kind];
  const Icon = meta.icon;
  return (
    <div className="card p-4 hover:border-bg-hover transition-colors">
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', meta.ring)}>
          <Icon size={16} className={meta.tone} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-white truncate">{f.entity.name}</p>
            <Badge variant={SEVERITY_BADGE[f.severity]}>{f.severity}</Badge>
            <Badge variant="default" className="capitalize">{f.entity.level}</Badge>
          </div>

          <p className={clsx('text-sm font-medium mb-1.5', meta.tone)}>{f.headline}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{f.detail}</p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 pt-3 border-t border-bg-border/60 text-xs">
            <Stat label="Spend" value={formatCurrency(f.entity.spend)} />
            <Stat label="ROAS" value={formatMultiplier(f.entity.roas)} tone={f.entity.roas >= TARGET_ROAS ? 'good' : 'bad'} />
            <Stat label="CPA" value={f.entity.purchases > 0 ? formatCurrency(f.entity.cpa) : '—'} />
            <Stat label="Freq." value={f.entity.frequency.toFixed(2)} tone={f.entity.frequency > 3 ? 'bad' : undefined} />
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className="text-slate-500">At risk</span>
              <span className="text-rose-400 font-bold tabular-nums">{formatCurrency(f.wastedSpend)}</span>
            </span>
          </div>

          <p className="mt-2.5 text-xs text-slate-300 bg-bg-elevated rounded-lg px-3 py-2 border border-bg-border">
            <span className="text-brand-400 font-medium">Action </span>
            {f.recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={clsx('font-medium tabular-nums', tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-white')}>
        {value}
      </span>
    </span>
  );
}

export function WorstPerformers() {
  const { data } = useFilters();
  const [kind, setKind] = useState<WasteKind | 'ALL'>('ALL');

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    data.campaigns.forEach(c => ids.add(`campaign-${c.id}`));
    data.adSets.forEach(a => ids.add(`adset-${a.id}`));
    data.ads.forEach(a => ids.add(`ad-${a.id}`));
    return ids;
  }, [data]);

  const scoped = useMemo(
    () => wasteFindings.filter(f => visibleIds.has(`${f.entity.level}-${f.entity.id}`)),
    [visibleIds],
  );

  const counts = useMemo(() => {
    const c = {} as Record<WasteKind, number>;
    for (const f of scoped) c[f.kind] = (c[f.kind] ?? 0) + 1;
    return c;
  }, [scoped]);

  const filtered = kind === 'ALL' ? scoped : scoped.filter(f => f.kind === kind);

  const scopedWaste = useMemo(() => {
    const worst = new Map<string, number>();
    for (const f of scoped) {
      const key = `${f.entity.level}-${f.entity.id}`;
      worst.set(key, Math.max(worst.get(key) ?? 0, f.wastedSpend));
    }
    return [...worst.values()].reduce((s, v) => s + v, 0);
  }, [scoped]);

  const topFatigue = useMemo(
    () => fatigueRanking.filter(a => visibleIds.has(`ad-${a.id}`)).slice(0, 6),
    [visibleIds],
  );

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Headline */}
      <div className="card p-5 border-rose-500/25 bg-gradient-to-br from-rose-500/[0.07] to-transparent">
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} className="text-rose-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Recoverable spend detected</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-none mb-2">
              {formatCurrency(scopedWaste)}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              Across {scoped.length} findings on {new Set(scoped.map(f => `${f.entity.level}-${f.entity.id}`)).size} entities.
              Reallocating this at the account average ROAS of {formatMultiplier(benchmarks.roas)} would return roughly{' '}
              <span className="text-emerald-400 font-medium">{formatCurrency(scopedWaste * benchmarks.roas)}</span>{' '}
              in revenue, or about{' '}
              <span className="text-white font-medium">{formatNumber(Math.round(scopedWaste / Math.max(benchmarks.cpa, 1)))}</span>{' '}
              additional purchases.
            </p>
          </div>
          <ExportMenu
            rows={filtered}
            columns={[
              { key: 'severity', header: 'Severity', value: f => f.severity },
              { key: 'kind', header: 'Type', value: f => KIND_META[f.kind].label },
              { key: 'level', header: 'Level', value: f => f.entity.level },
              { key: 'name', header: 'Entity', value: f => f.entity.name },
              { key: 'headline', header: 'Finding', value: f => f.headline },
              { key: 'spend', header: 'Spend', value: f => f.entity.spend.toFixed(2) },
              { key: 'roas', header: 'ROAS', value: f => f.entity.roas.toFixed(2) },
              { key: 'cpa', header: 'CPA', value: f => f.entity.cpa.toFixed(2) },
              { key: 'frequency', header: 'Frequency', value: f => f.entity.frequency.toFixed(2) },
              { key: 'wasted', header: 'Spend At Risk', value: f => f.wastedSpend.toFixed(2) },
              { key: 'action', header: 'Recommended Action', value: f => f.recommendedAction },
            ]}
            name="pharmescence_waste_report"
            title="Budget Waste Report"
          />
        </div>
      </div>

      {/* Detector filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setKind('ALL')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            kind === 'ALL' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white',
          )}
        >
          All findings <span className="ml-1 opacity-60 tabular-nums">{scoped.length}</span>
        </button>
        {(Object.keys(KIND_META) as WasteKind[]).map(k => {
          const meta = KIND_META[k];
          const Icon = meta.icon;
          const n = counts[k] ?? 0;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              disabled={n === 0}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                kind === k ? 'bg-brand-600 border-brand-600 text-white' : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white',
                n === 0 && 'opacity-35 pointer-events-none',
              )}
            >
              <Icon size={12} className={kind === k ? 'text-white' : meta.tone} />
              {meta.label}
              <span className="opacity-60 tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Findings */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            variant="all-clear"
            title={scoped.length === 0 ? 'No waste detected' : 'No findings of this type'}
            description={
              scoped.length === 0
                ? `Every entity in scope clears the ${TARGET_ROAS}x ROAS target, sits under frequency 3.0 and converts within 40% of the ${formatCurrency(benchmarks.cpa)} account CPA.`
                : 'Switch detector or clear the global filters to review other findings.'
            }
            action={scoped.length > 0 ? { label: 'Show all findings', onClick: () => setKind('ALL') } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map(f => <FindingCard key={f.id} f={f} />)}
        </div>
      )}

      {/* Creative fatigue ranking */}
      {topFatigue.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Creative Fatigue Ranking</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Composite of frequency pressure, CTR gap against the {formatPercent(benchmarks.ctr)} account average, and trend direction.
          </p>
          <div className="space-y-2.5">
            {topFatigue.map(ad => (
              <div key={ad.id} className="flex items-center gap-3">
                {ad.thumbnail && (
                  <img src={ad.thumbnail} alt="" loading="lazy" className="w-9 h-9 rounded-lg object-cover border border-bg-border shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{ad.name}</p>
                  <p className="text-xs text-slate-500">
                    Freq {ad.frequency.toFixed(2)} · CTR {formatPercent(ad.ctr)} · {ad.trend >= 0 ? '+' : ''}{ad.trend.toFixed(1)}%
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full', ad.fatigueScore >= 65 ? 'bg-rose-500' : ad.fatigueScore >= 45 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${Math.min(ad.fatigueScore, 100)}%` }}
                    />
                  </div>
                </div>
                <span
                  className={clsx(
                    'text-sm font-bold tabular-nums w-10 text-right shrink-0',
                    ad.fatigueScore >= 65 ? 'text-rose-400' : ad.fatigueScore >= 45 ? 'text-amber-400' : 'text-emerald-400',
                  )}
                >
                  {ad.fatigueScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
