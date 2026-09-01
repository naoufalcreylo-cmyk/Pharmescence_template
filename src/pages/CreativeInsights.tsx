import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { clsx } from 'clsx';
import {
  Sparkles, Image as ImageIcon, Video, Type, MessageSquareQuote, MousePointerClick, Layers3,
} from 'lucide-react';
import {
  formatStats, headlineStats, primaryTextStats, ctaStats,
  winningImages, winningVideos, formatComparisons, bestFormat, benchmarks, TARGET_ROAS,
} from '../data/performanceData';
import type { CreativeElementStat, Ad } from '../types';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { Badge } from '../components/ui/Badge';
import { useFilters } from '../context/FiltersContext';

/**
 * Creative Insights (§10).
 *
 * Rolls the ad table up by creative attribute — format, headline, primary text,
 * call to action — so the question stops being "which ad won" and becomes "which
 * creative decision won", which is the one that transfers to the next test.
 */

const FORMAT_ICON: Record<string, React.ElementType> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  CAROUSEL: Layers3,
  COLLECTION: Layers3,
  DYNAMIC: Sparkles,
};

function WinnerCard({ ad, rank }: { ad: Ad; rank: number }) {
  return (
    <div className="card overflow-hidden group hover:border-brand-600/40 transition-colors">
      <div className="relative aspect-[4/3] bg-bg-elevated overflow-hidden">
        <img
          src={ad.thumbnail}
          alt={ad.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-bg-base/85 backdrop-blur text-xs font-bold text-amber-400">
          #{rank + 1}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-bg-base/85 backdrop-blur text-xs font-bold text-emerald-400">
          {formatMultiplier(ad.roas)}
        </span>
      </div>
      <div className="p-3.5">
        <p className="text-sm font-medium text-white truncate mb-0.5">{ad.name}</p>
        <p className="text-xs text-slate-500 truncate mb-3">{ad.headline}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: 'Spend', v: formatCurrency(ad.spend, true) },
            { l: 'Purch.', v: formatNumber(ad.purchases) },
            { l: 'CTR', v: formatPercent(ad.ctr) },
          ].map(s => (
            <div key={s.l}>
              <p className="text-xs text-slate-600 uppercase tracking-wider">{s.l}</p>
              <p className="text-sm font-semibold text-white tabular-nums">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ElementTable({
  title,
  subtitle,
  icon: Icon,
  stats,
  valueLabel = 'Copy',
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  stats: CreativeElementStat[];
  valueLabel?: string;
}) {
  const maxRoas = Math.max(...stats.map(s => s.roas), 0.01);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
          <Icon size={14} className="text-brand-400" />
          {title}
        </h3>
        <ExportMenu
          rows={stats}
          columns={[
            { key: 'value', header: valueLabel, value: s => s.value },
            { key: 'ads', header: 'Ads', value: s => s.ads },
            { key: 'spend', header: 'Spend', value: s => s.spend.toFixed(2) },
            { key: 'revenue', header: 'Revenue', value: s => s.revenue.toFixed(2) },
            { key: 'purchases', header: 'Purchases', value: s => s.purchases },
            { key: 'roas', header: 'ROAS', value: s => s.roas.toFixed(2) },
            { key: 'cpa', header: 'CPA', value: s => s.cpa.toFixed(2) },
            { key: 'ctr', header: 'CTR', value: s => `${s.ctr.toFixed(2)}%` },
          ]}
          name={`pharmescence_creative_${title.toLowerCase().replace(/\s+/g, '_')}`}
          title={title}
          label=""
        />
      </div>
      <p className="text-xs text-slate-500 mb-4">{subtitle}</p>

      {stats.length === 0 ? (
        <EmptyState compact variant="empty" title="No creative data" />
      ) : (
        <div className="space-y-3">
          {stats.slice(0, 6).map((s, i) => (
            <div key={s.value} className="group">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-sm text-white leading-snug flex-1 min-w-0 line-clamp-2">
                  <span className="text-slate-600 mr-1.5 tabular-nums">{i + 1}.</span>
                  {s.value}
                </p>
                <span
                  className={clsx(
                    'text-sm font-bold tabular-nums shrink-0',
                    s.roas >= TARGET_ROAS ? 'text-emerald-400' : s.roas >= TARGET_ROAS * 0.8 ? 'text-amber-400' : 'text-rose-400',
                  )}
                >
                  {formatMultiplier(s.roas)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-bg-elevated overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full bg-gradient-brand transition-all duration-500"
                  style={{ width: `${(s.roas / maxRoas) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {s.ads} ad{s.ads > 1 ? 's' : ''} · {formatCurrency(s.spend)} spend · {formatNumber(s.purchases)} purchases ·{' '}
                {formatCurrency(s.cpa)} CPA · {formatPercent(s.ctr)} CTR
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreativeInsights() {
  const { data } = useFilters();
  const [gallery, setGallery] = useState<'images' | 'videos'>('images');

  const adIds = useMemo(() => new Set(data.ads.map(a => a.id)), [data.ads]);
  const images = useMemo(() => winningImages.filter(a => adIds.has(a.id)).slice(0, 6), [adIds]);
  const videos = useMemo(() => winningVideos.filter(a => adIds.has(a.id)).slice(0, 6), [adIds]);
  const shown = gallery === 'images' ? images : videos;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Best format callout */}
      {bestFormat && (
        <div className="card p-5 bg-gradient-to-br from-brand-600/[0.08] to-transparent border-brand-600/25">
          <div className="flex flex-wrap items-start gap-5">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-brand-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Best performing format</p>
              <p className="text-2xl font-bold text-white leading-none mb-2 capitalize">
                {bestFormat.value.toLowerCase()}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                {bestFormat.ads} ads carrying {formatCurrency(bestFormat.spend)} returned{' '}
                <span className="text-emerald-400 font-medium">{formatMultiplier(bestFormat.roas)}</span> at{' '}
                {formatCurrency(bestFormat.cpa)} CPA and {formatPercent(bestFormat.ctr)} CTR —{' '}
                {(((bestFormat.roas - benchmarks.roas) / benchmarks.roas) * 100).toFixed(0)}% above the account average.
                Weight the next production round toward this format.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Format performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Format Performance</h3>
          <p className="text-xs text-slate-500 mb-4">ROAS by creative format, sized by spend behind each.</p>
          {formatStats.length === 0 ? (
            <EmptyState compact variant="empty" title="No format data" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={formatStats} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
                <XAxis dataKey="value" tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false}
                  tickFormatter={v => `${v.toFixed(1)}x`} />
                <Tooltip
                  cursor={{ fill: '#7C3AED', fillOpacity: 0.06 }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d: CreativeElementStat = payload[0].payload;
                    return (
                      <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 text-xs space-y-1">
                        <p className="text-white font-semibold capitalize">{d.value.toLowerCase()}</p>
                        <p className="text-slate-400">ROAS <span className="text-white">{formatMultiplier(d.roas)}</span></p>
                        <p className="text-slate-400">Spend <span className="text-white">{formatCurrency(d.spend)}</span></p>
                        <p className="text-slate-400">Purchases <span className="text-white">{formatNumber(d.purchases)}</span></p>
                        <p className="text-slate-400">CTR <span className="text-white">{formatPercent(d.ctr)}</span></p>
                        <p className="text-slate-400">{d.ads} ads</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="roas" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {formatStats.map((s, i) => (
                    <Cell key={i} fill={s.roas >= TARGET_ROAS ? '#10B981' : s.roas >= TARGET_ROAS * 0.8 ? '#F59E0B' : '#F43F5E'} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Head-to-head comparisons */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Head to Head</h3>
          <p className="text-xs text-slate-500 mb-4">The two format decisions that matter most on this account.</p>
          <div className="space-y-5">
            {formatComparisons.map(cmp => {
              if (!cmp.left || !cmp.right) {
                return (
                  <div key={cmp.label}>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{cmp.label}</p>
                    <p className="text-sm text-slate-600">Not enough data on both formats to compare.</p>
                  </div>
                );
              }
              const total = cmp.left.roas + cmp.right.roas;
              const leftPct = (cmp.left.roas / total) * 100;
              const winner = cmp.left.roas >= cmp.right.roas ? cmp.left : cmp.right;
              const lift = Math.abs(((cmp.left.roas - cmp.right.roas) / Math.min(cmp.left.roas, cmp.right.roas)) * 100);
              const LeftIcon = FORMAT_ICON[cmp.left.value] ?? ImageIcon;
              const RightIcon = FORMAT_ICON[cmp.right.value] ?? ImageIcon;
              return (
                <div key={cmp.label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{cmp.label}</p>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="inline-flex items-center gap-1.5 text-white capitalize">
                      <LeftIcon size={13} className="text-brand-400" />
                      {cmp.left.value.toLowerCase()}
                      <span className="font-bold tabular-nums">{formatMultiplier(cmp.left.roas)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-white capitalize">
                      <span className="font-bold tabular-nums">{formatMultiplier(cmp.right.roas)}</span>
                      {cmp.right.value.toLowerCase()}
                      <RightIcon size={13} className="text-cyan-400" />
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex mb-2">
                    <div className="bg-brand-500 transition-all duration-500" style={{ width: `${leftPct}%` }} />
                    <div className="bg-cyan-500 transition-all duration-500" style={{ width: `${100 - leftPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="capitalize text-white font-medium">{winner.value.toLowerCase()}</span> wins by{' '}
                    <span className="text-emerald-400 font-medium">{lift.toFixed(0)}%</span> on ROAS — CPA{' '}
                    <span className="capitalize">{cmp.left.value.toLowerCase()}</span> {formatCurrency(cmp.left.cpa)} vs{' '}
                    <span className="capitalize">{cmp.right.value.toLowerCase()}</span> {formatCurrency(cmp.right.cpa)}, over{' '}
                    {cmp.left.ads + cmp.right.ads} ads.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Winning creative gallery */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white">
            Winning {gallery === 'images' ? 'Images & Carousels' : 'Videos'}
          </h3>
          <div className="inline-flex rounded-xl bg-bg-elevated border border-bg-border p-0.5">
            {([
              { id: 'images' as const, label: `Images (${images.length})`, icon: ImageIcon },
              { id: 'videos' as const, label: `Videos (${videos.length})`, icon: Video },
            ]).map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setGallery(t.id)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    gallery === t.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            variant="no-results"
            title={`No ${gallery} in scope`}
            description="Adjust the global filters, or switch to the other creative type."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {shown.map((ad, i) => <WinnerCard key={ad.id} ad={ad} rank={i} />)}
          </div>
        )}
      </div>

      {/* Copy elements */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ElementTable
          title="Winning Headlines"
          subtitle="Headline text ranked by the ROAS of every ad that used it."
          icon={Type}
          stats={headlineStats}
          valueLabel="Headline"
        />
        <ElementTable
          title="Winning Primary Texts"
          subtitle="Opening body copy, aggregated across ads."
          icon={MessageSquareQuote}
          stats={primaryTextStats}
          valueLabel="Primary text"
        />
        <ElementTable
          title="Best Calls To Action"
          subtitle="CTA button choice, aggregated across ads."
          icon={MousePointerClick}
          stats={ctaStats}
          valueLabel="CTA"
        />
      </div>
    </div>
  );
}
