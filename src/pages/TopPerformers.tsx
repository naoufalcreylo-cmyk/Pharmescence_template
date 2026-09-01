import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Trophy, TrendingUp, TrendingDown, Megaphone, Users, Image as ImageIcon } from 'lucide-react';
import {
  rankBy, RANK_METRICS, rankedCampaigns, rankedAdSets, rankedAds, benchmarks, TARGET_ROAS,
} from '../data/performanceData';
import type { RankedEntity, RankMetric } from '../data/performanceData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { useFilters } from '../context/FiltersContext';

/**
 * Top Performers (§8).
 *
 * Top 10 campaigns, ad sets and ads under five ranking rules. Rankings respect
 * the global filters, and cost-efficiency rules exclude zero-conversion rows so
 * a CPA of $0.00 can never take first place.
 */

type Level = 'campaign' | 'adset' | 'ad';

const LEVELS: { id: Level; label: string; icon: React.ElementType }[] = [
  { id: 'campaign', label: 'Campaigns', icon: Megaphone },
  { id: 'adset', label: 'Ad Sets', icon: Users },
  { id: 'ad', label: 'Ads', icon: ImageIcon },
];

const MEDALS = ['#FBBF24', '#CBD5E1', '#D97706'];

function metricValue(e: RankedEntity, m: RankMetric): string {
  switch (m) {
    case 'roas': return formatMultiplier(e.roas);
    case 'purchases': return formatNumber(e.purchases);
    case 'revenue': return formatCurrency(e.revenue);
    case 'cpa': return formatCurrency(e.cpa);
    case 'ctr': return formatPercent(e.ctr);
  }
}

function LeaderRow({ entity, rank, metric }: { entity: RankedEntity; rank: number; metric: RankMetric }) {
  const medal = rank < 3 ? MEDALS[rank] : undefined;
  const vsAccount =
    metric === 'cpa' ? ((benchmarks.cpa - entity.cpa) / benchmarks.cpa) * 100
    : metric === 'ctr' ? ((entity.ctr - benchmarks.ctr) / benchmarks.ctr) * 100
    : ((entity.roas - benchmarks.roas) / benchmarks.roas) * 100;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-bg-border/60 last:border-0">
      <span
        className={clsx(
          'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 tabular-nums',
          medal ? 'text-bg-base' : 'bg-bg-elevated text-slate-500',
        )}
        style={medal ? { background: medal } : undefined}
      >
        {rank + 1}
      </span>

      {entity.thumbnail && (
        <img
          src={entity.thumbnail}
          alt=""
          loading="lazy"
          className="w-9 h-9 rounded-lg object-cover shrink-0 border border-bg-border"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{entity.name}</p>
        <p className="text-xs text-slate-500 truncate">{entity.subtitle}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white tabular-nums">{metricValue(entity, metric)}</p>
        <p
          className={clsx(
            'text-xs tabular-nums',
            vsAccount >= 0 ? 'text-emerald-400' : 'text-rose-400',
          )}
        >
          {vsAccount >= 0 ? '+' : ''}{vsAccount.toFixed(0)}% vs acct
        </p>
      </div>
    </div>
  );
}

export function TopPerformers() {
  const { data } = useFilters();
  const [metric, setMetric] = useState<RankMetric>('roas');

  // Re-derive the ranking pools from the filtered entity sets.
  const pools = useMemo(() => {
    const campaignIds = new Set(data.campaigns.map(c => c.id));
    const adSetIds = new Set(data.adSets.map(a => a.id));
    const adIds = new Set(data.ads.map(a => a.id));
    return {
      campaign: rankedCampaigns.filter(r => campaignIds.has(r.id)),
      adset: rankedAdSets.filter(r => adSetIds.has(r.id)),
      ad: rankedAds.filter(r => adIds.has(r.id)),
    };
  }, [data]);

  const leaderboards = useMemo(
    () =>
      LEVELS.map(l => ({
        ...l,
        rows: rankBy(pools[l.id], metric, 10),
      })),
    [pools, metric],
  );

  const hallOfFame = useMemo(() => {
    const all = [...pools.campaign, ...pools.adset, ...pools.ad];
    return {
      roas: rankBy(all, 'roas', 1)[0],
      revenue: rankBy(all, 'revenue', 1)[0],
      cpa: rankBy(all, 'cpa', 1)[0],
      ctr: rankBy(all, 'ctr', 1)[0],
    };
  }, [pools]);

  const exportRows = useMemo(
    () => leaderboards.flatMap(l => l.rows.map((r, i) => ({ ...r, rank: i + 1, board: l.label }))),
    [leaderboards],
  );

  const isEmpty = leaderboards.every(l => l.rows.length === 0);

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Ranking rule */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Trophy size={13} className="text-amber-400" />
          Rank by
        </span>
        <div className="inline-flex flex-wrap rounded-xl bg-bg-elevated border border-bg-border p-0.5 gap-0.5">
          {RANK_METRICS.map(m => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                metric === m.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <ExportMenu
          rows={exportRows}
          columns={[
            { key: 'board', header: 'Leaderboard', value: r => r.board },
            { key: 'rank', header: 'Rank', value: r => r.rank },
            { key: 'name', header: 'Name', value: r => r.name },
            { key: 'subtitle', header: 'Context', value: r => r.subtitle },
            { key: 'status', header: 'Status', value: r => r.status },
            { key: 'spend', header: 'Spend', value: r => r.spend.toFixed(2) },
            { key: 'revenue', header: 'Revenue', value: r => r.revenue.toFixed(2) },
            { key: 'purchases', header: 'Purchases', value: r => r.purchases },
            { key: 'roas', header: 'ROAS', value: r => r.roas.toFixed(2) },
            { key: 'cpa', header: 'CPA', value: r => r.cpa.toFixed(2) },
            { key: 'ctr', header: 'CTR', value: r => `${r.ctr.toFixed(2)}%` },
          ]}
          name="pharmescence_top_performers"
          title={`Top Performers — ${RANK_METRICS.find(m => m.id === metric)?.label}`}
        />
      </div>

      {isEmpty ? (
        <div className="card">
          <EmptyState
            variant="no-results"
            title="Nothing to rank"
            description="No campaigns, ad sets or ads match the current global filters."
          />
        </div>
      ) : (
        <>
          {/* Hall of fame */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Best ROAS', e: hallOfFame.roas, value: hallOfFame.roas && formatMultiplier(hallOfFame.roas.roas), tone: 'emerald' },
              { label: 'Most Revenue', e: hallOfFame.revenue, value: hallOfFame.revenue && formatCurrency(hallOfFame.revenue.revenue), tone: 'cyan' },
              { label: 'Lowest CPA', e: hallOfFame.cpa, value: hallOfFame.cpa && formatCurrency(hallOfFame.cpa.cpa), tone: 'brand' },
              { label: 'Highest CTR', e: hallOfFame.ctr, value: hallOfFame.ctr && formatPercent(hallOfFame.ctr.ctr), tone: 'amber' },
            ].map(card => (
              <div key={card.label} className="card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{card.label}</p>
                {card.e ? (
                  <>
                    <p
                      className={clsx(
                        'text-2xl font-bold tabular-nums leading-none mb-2',
                        card.tone === 'emerald' ? 'text-emerald-400'
                        : card.tone === 'cyan' ? 'text-cyan-400'
                        : card.tone === 'amber' ? 'text-amber-400'
                        : 'text-brand-400',
                      )}
                    >
                      {card.value}
                    </p>
                    <p className="text-sm text-white truncate">{card.e.name}</p>
                    <p className="text-xs text-slate-500 truncate capitalize">{card.e.level} · {card.e.subtitle}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">No qualifying rows</p>
                )}
              </div>
            ))}
          </div>

          {/* Three leaderboards */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {leaderboards.map(board => {
              const Icon = board.icon;
              return (
                <div key={board.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
                      <Icon size={14} className="text-brand-400" />
                      Top {board.rows.length} {board.label}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {RANK_METRICS.find(m => m.id === metric)?.label}
                    </span>
                  </div>
                  {board.rows.length === 0 ? (
                    <EmptyState
                      compact
                      variant="no-results"
                      title={`No ${board.label.toLowerCase()} qualify`}
                      description={
                        metric === 'cpa' || metric === 'roas'
                          ? 'Rows need at least one purchase to be ranked on efficiency.'
                          : undefined
                      }
                    />
                  ) : (
                    <div>
                      {board.rows.map((e, i) => (
                        <LeaderRow key={e.id} entity={e} rank={i} metric={metric} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Concentration read */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Where performance is concentrated</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaderboards.map(board => {
                const top3 = board.rows.slice(0, 3);
                const revShare = top3.reduce((s, r) => s + r.revenue, 0);
                const totalRev = pools[board.id].reduce((s, r) => s + r.revenue, 0);
                const share = totalRev > 0 ? (revShare / totalRev) * 100 : 0;
                const above = board.rows.filter(r => r.roas >= TARGET_ROAS).length;
                return (
                  <div key={board.id}>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{board.label}</p>
                    <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-2">
                      <div className="h-full bg-gradient-brand rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(share, 100)}%` }} />
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Top 3 hold <span className="text-white font-semibold">{share.toFixed(0)}%</span> of revenue.{' '}
                      <span className={above > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {above} of {board.rows.length}
                      </span>{' '}
                      clear the {TARGET_ROAS}x target.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
