import { useState, useMemo } from 'react';
import { Play, Image, LayoutGrid, Zap, TrendingUp, TrendingDown, Search, Grid, List } from 'lucide-react';
import { clsx } from 'clsx';
import { ads } from '../data/mockData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { getRankingColor, getRankingLabel } from '../utils/formatters';
import type { Ad } from '../types';

const FORMAT_ICONS: Record<string, React.ElementType> = {
  VIDEO: Play,
  IMAGE: Image,
  CAROUSEL: LayoutGrid,
  DYNAMIC: Zap,
  COLLECTION: LayoutGrid,
};

function RankingBadge({ ranking }: { ranking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE' }) {
  return (
    <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded border', getRankingColor(ranking))}>
      {getRankingLabel(ranking)}
    </span>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  const FormatIcon = FORMAT_ICONS[ad.format] ?? Image;
  const roasColor = ad.roas >= 4 ? 'text-emerald-400' : ad.roas >= 2.5 ? 'text-amber-400' : 'text-rose-400';
  const isTopPerformer = ad.roas >= 4.5;
  const isUnderPerformer = ad.roas < 2 || (ad.conversionRanking === 'BELOW_AVERAGE' && ad.qualityRanking === 'BELOW_AVERAGE');

  return (
    <div className={clsx(
      'card flex flex-col overflow-hidden transition-all duration-200 hover:shadow-card-hover hover:border-brand-600/30 group',
      isTopPerformer && 'border-emerald-500/30',
      isUnderPerformer && 'border-rose-500/20',
    )}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        <img
          src={ad.thumbnail}
          alt={ad.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225/1E1E32/7C3AED?text=Ad'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base/60 via-transparent to-transparent" />

        {/* Format badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-bg-base/80 backdrop-blur-sm rounded-lg px-2 py-1">
          <FormatIcon size={11} className="text-brand-400" />
          <span className="text-xs font-medium text-slate-300">{ad.format}</span>
        </div>

        {/* Status */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={ad.status} />
        </div>

        {/* Top/Under performer */}
        {isTopPerformer && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-lg px-2 py-1">
            <TrendingUp size={11} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Top Performer</span>
          </div>
        )}
        {isUnderPerformer && !isTopPerformer && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-rose-500/20 backdrop-blur-sm border border-rose-500/30 rounded-lg px-2 py-1">
            <TrendingDown size={11} className="text-rose-400" />
            <span className="text-xs font-bold text-rose-400">Underperforming</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">{ad.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{ad.campaignName.replace('Pharmescence | ', '')}</p>
        </div>

        <div className="text-xs text-slate-400 space-y-0.5">
          <p className="font-medium text-slate-300 line-clamp-1">"{ad.headline}"</p>
          <p className="text-slate-500 line-clamp-2">{ad.primaryText}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-elevated rounded-lg p-2 text-center">
            <p className={clsx('text-sm font-bold', roasColor)}>{formatMultiplier(ad.roas)}</p>
            <p className="text-xs text-slate-500">ROAS</p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-white">{formatCurrency(ad.cpa)}</p>
            <p className="text-xs text-slate-500">CPA</p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-cyan-400">{formatNumber(ad.purchases)}</p>
            <p className="text-xs text-slate-500">Purchases</p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Spend</span>
            <span className="text-slate-300 font-medium">{formatCurrency(ad.spend)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CTR</span>
            <span className="text-slate-300 font-medium">{formatPercent(ad.ctr)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Frequency</span>
            <span className={clsx('font-medium', ad.frequency > 3 ? 'text-amber-400' : 'text-slate-300')}>{ad.frequency.toFixed(2)}</span>
          </div>
          {ad.format === 'VIDEO' && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Hook Rate</span>
                <span className="text-slate-300 font-medium">{formatPercent(ad.hookRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thumb Stop</span>
                <span className={clsx('font-medium', ad.thumbStopRate > 35 ? 'text-emerald-400' : 'text-slate-300')}>{formatPercent(ad.thumbStopRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Watch Time</span>
                <span className="text-slate-300 font-medium">{ad.videoWatchTime.toFixed(1)}s</span>
              </div>
            </>
          )}
        </div>

        {/* Rankings */}
        <div className="border-t border-bg-border pt-3">
          <p className="text-xs text-slate-500 mb-2 font-medium">Ad Rankings</p>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-slate-600">Quality</span>
              <RankingBadge ranking={ad.qualityRanking} />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-slate-600">Engagement</span>
              <RankingBadge ranking={ad.engagementRanking} />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-slate-600">Conversion</span>
              <RankingBadge ranking={ad.conversionRanking} />
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">vs previous period</span>
          <span className={clsx('text-xs font-bold flex items-center gap-1',
            ad.trend > 0 ? 'text-emerald-400' : ad.trend < 0 ? 'text-rose-400' : 'text-slate-400'
          )}>
            {ad.trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {ad.trend > 0 ? '+' : ''}{ad.trend.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function Ads() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'roas' | 'spend' | 'cpa' | 'purchases'>('roas');
  const [filterFormat, setFilterFormat] = useState('ALL');

  const sorted = useMemo(() => {
    let list = [...ads];
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    if (filterFormat !== 'ALL') list = list.filter(a => a.format === filterFormat);
    list.sort((a, b) => {
      if (sortBy === 'cpa') return a.cpa - b.cpa;
      return b[sortBy] - a[sortBy];
    });
    return list;
  }, [search, sortBy, filterFormat]);

  const topAds = [...ads].sort((a, b) => b.roas - a.roas).slice(0, 3);
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalPurchases = ads.reduce((s, a) => s + a.purchases, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.revenue, 0);

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Ads', value: String(ads.filter(a => a.status === 'ACTIVE').length), color: 'text-emerald-400' },
          { label: 'Total Spend', value: formatCurrency(totalSpend, true), color: 'text-white' },
          { label: 'Total Purchases', value: formatNumber(totalPurchases), color: 'text-cyan-400' },
          { label: 'Blended ROAS', value: formatMultiplier(totalRevenue / totalSpend), color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Top 3 Performers highlight */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Performers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {topAds.map((ad, i) => (
            <div key={ad.id} className="card p-4 flex items-center gap-3 border-l-2 border-emerald-500">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm font-black text-emerald-400 shrink-0">
                #{i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{ad.name.split('|').pop()?.trim()}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-emerald-400 font-bold">{formatMultiplier(ad.roas)} ROAS</span>
                  <span className="text-xs text-slate-500">{formatCurrency(ad.cpa)} CPA</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search ads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'VIDEO', 'IMAGE', 'CAROUSEL', 'DYNAMIC'].map(f => (
            <button
              key={f}
              onClick={() => setFilterFormat(f)}
              className={clsx(
                'px-3 py-2 text-xs font-medium rounded-xl border transition-colors',
                filterFormat === f ? 'bg-brand-600/15 text-brand-400 border-brand-600/30' : 'bg-bg-elevated text-slate-400 border-bg-border hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
          >
            <option value="roas">Best ROAS</option>
            <option value="spend">Most Spend</option>
            <option value="purchases">Most Purchases</option>
            <option value="cpa">Lowest CPA</option>
          </select>
        </div>
        <div className="flex border border-bg-border rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx('p-2 transition-colors', viewMode === 'grid' ? 'bg-brand-600/20 text-brand-400' : 'text-slate-500 hover:text-white bg-bg-elevated')}
          >
            <Grid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-brand-600/20 text-brand-400' : 'text-slate-500 hover:text-white bg-bg-elevated')}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Ad Grid */}
      <div className={clsx(
        viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'flex flex-col gap-3'
      )}>
        {sorted.map(ad => <AdCard key={ad.id} ad={ad} />)}
      </div>
    </div>
  );
}
