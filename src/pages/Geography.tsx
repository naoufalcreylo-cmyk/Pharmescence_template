import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Globe2, MapPin, Building2 } from 'lucide-react';
import { WorldMap } from '../components/charts/WorldMap';
import type { MapMetric } from '../components/charts/WorldMap';
import { BreakdownTable } from '../components/tables/BreakdownTable';
import { countryBreakdown, regionBreakdown, cityBreakdown } from '../data/breakdownData';
import { TARGET_ROAS } from '../data/performanceData';
import { formatCurrency, formatNumber, formatMultiplier } from '../utils/formatters';
import { summarize } from '../lib/selectors';
import { useFilters } from '../context/FiltersContext';
import type { BreakdownRow } from '../types';

/**
 * Geographic Performance (§13).
 *
 * Country / region / city at three levels of zoom, with the map answering
 * "where is the money" and the colour answering "is it working there".
 */

type GeoLevel = 'country' | 'region' | 'city';

const LEVELS: { id: GeoLevel; label: string; icon: React.ElementType; metaLabel: string }[] = [
  { id: 'country', label: 'Country', icon: Globe2, metaLabel: 'Code' },
  { id: 'region', label: 'Region', icon: MapPin, metaLabel: 'Country' },
  { id: 'city', label: 'City', icon: Building2, metaLabel: 'Region' },
];

const MAP_METRICS: { id: MapMetric; label: string }[] = [
  { id: 'spend', label: 'Spend' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'roas', label: 'ROAS' },
  { id: 'cpa', label: 'CPA' },
];

export function Geography() {
  const { filters } = useFilters();
  const [level, setLevel] = useState<GeoLevel>('country');
  const [mapMetric, setMapMetric] = useState<MapMetric>('spend');
  const [selectedCode, setSelectedCode] = useState<string | undefined>();

  // The global Country filter narrows every level of this view.
  const countries = useMemo(
    () =>
      filters.countries.length > 0
        ? countryBreakdown.filter(c => filters.countries.includes(c.segment))
        : countryBreakdown,
    [filters.countries],
  );

  const rows: BreakdownRow[] = useMemo(() => {
    if (level === 'country') return countries;
    const allowed = new Set(countries.map(c => c.segment));
    const codes = new Set(countries.map(c => c.countryCode));
    if (level === 'region') return regionBreakdown.filter(r => !r.meta || allowed.has(r.meta));
    // City meta reads "Region, CC" — match on the trailing country code.
    return cityBreakdown.filter(c => {
      const cc = c.meta?.split(',').pop()?.trim();
      return !cc || codes.has(cc === 'UK' ? 'GB' : cc);
    });
  }, [level, countries]);

  const totals = useMemo(() => summarize(rows), [rows]);
  const activeLevel = LEVELS.find(l => l.id === level)!;

  const topByRevenue = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue)[0], [rows]);
  const bestRoas = useMemo(
    () => [...rows].filter(r => r.spend > totals.spend * 0.02).sort((a, b) => b.roas - a.roas)[0],
    [rows, totals.spend],
  );
  const worstRoas = useMemo(
    () => [...rows].filter(r => r.spend > totals.spend * 0.02).sort((a, b) => a.roas - b.roas)[0],
    [rows, totals.spend],
  );

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Map */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Global Delivery Map</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {countries.length} countries · last {filters.days} days
            </p>
          </div>
          <div className="inline-flex flex-wrap rounded-xl bg-bg-elevated border border-bg-border p-0.5 gap-0.5">
            {MAP_METRICS.map(m => (
              <button
                key={m.id}
                onClick={() => setMapMetric(m.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  mapMetric === m.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <WorldMap
          points={countries}
          metric={mapMetric}
          targetRoas={TARGET_ROAS}
          selectedCode={selectedCode}
          onSelect={p => setSelectedCode(c => (c === p.countryCode ? undefined : p.countryCode))}
        />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Markets', value: formatNumber(rows.length) },
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

      {/* Read-out */}
      {topByRevenue && bestRoas && worstRoas && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GeoCallout
            tone="cyan"
            label="Largest market"
            name={topByRevenue.segment}
            value={formatCurrency(topByRevenue.revenue)}
            detail={`${((topByRevenue.revenue / Math.max(totals.revenue, 1)) * 100).toFixed(0)}% of revenue on ${formatCurrency(topByRevenue.spend)} spend`}
          />
          <GeoCallout
            tone="emerald"
            label="Most efficient"
            name={bestRoas.segment}
            value={formatMultiplier(bestRoas.roas)}
            detail={`${formatCurrency(bestRoas.cpa)} CPA — headroom to increase budget here first`}
          />
          <GeoCallout
            tone="rose"
            label="Least efficient"
            name={worstRoas.segment}
            value={formatMultiplier(worstRoas.roas)}
            detail={`${formatCurrency(worstRoas.cpa)} CPA on ${formatCurrency(worstRoas.spend)} — exclude or bid down`}
          />
        </div>
      )}

      {/* Level table */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white">Performance by {activeLevel.label}</h3>
          <div className="inline-flex rounded-xl bg-bg-elevated border border-bg-border p-0.5">
            {LEVELS.map(l => {
              const Icon = l.icon;
              return (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    level === l.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  <Icon size={12} />
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        <BreakdownTable
          rows={rows}
          segmentLabel={activeLevel.label}
          metaLabel={activeLevel.metaLabel}
          targetRoas={TARGET_ROAS}
          exportName={`pharmescence_geo_${level}`}
          exportTitle={`Geographic Performance — ${activeLevel.label}`}
          emptyTitle={`No ${activeLevel.label.toLowerCase()} data in scope`}
        />
      </div>
    </div>
  );
}

function GeoCallout({
  tone, label, name, value, detail,
}: {
  tone: 'cyan' | 'emerald' | 'rose';
  label: string;
  name: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p
          className={clsx(
            'text-lg font-bold tabular-nums shrink-0',
            tone === 'cyan' ? 'text-cyan-400' : tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400',
          )}
        >
          {value}
        </p>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
    </div>
  );
}
