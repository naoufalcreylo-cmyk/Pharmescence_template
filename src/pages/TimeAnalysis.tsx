import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Clock, CalendarDays, CalendarRange, Sunrise } from 'lucide-react';
import { heatmapData } from '../data/mockData';
import { hourBreakdown, weekdayBreakdown, monthBreakdown, WEEKDAY_LABELS } from '../data/breakdownData';
import { BreakdownTable } from '../components/tables/BreakdownTable';
import { TARGET_ROAS } from '../data/performanceData';
import { formatCurrency, formatNumber, formatMultiplier } from '../utils/formatters';
import { useFilters } from '../context/FiltersContext';
import type { BreakdownRow } from '../types';

/**
 * Time Analysis (§15).
 *
 * The hour x weekday heatmap answers when to concentrate delivery; the three
 * tables underneath answer it again in the shape a dayparting schedule or an ad
 * set's delivery window actually takes.
 */

type HeatMetric = 'purchases' | 'roas' | 'cpa';

const HEAT_METRICS: { id: HeatMetric; label: string; lowerIsBetter?: boolean }[] = [
  { id: 'purchases', label: 'Purchases' },
  { id: 'roas', label: 'ROAS' },
  { id: 'cpa', label: 'CPA', lowerIsBetter: true },
];

type TimeLevel = 'hour' | 'weekday' | 'month';

const LEVELS: { id: TimeLevel; label: string; icon: React.ElementType; rows: BreakdownRow[]; metaLabel: string }[] = [
  { id: 'hour', label: 'Hour of Day', icon: Clock, rows: hourBreakdown, metaLabel: 'Daypart' },
  { id: 'weekday', label: 'Day of Week', icon: CalendarDays, rows: weekdayBreakdown, metaLabel: 'Type' },
  { id: 'month', label: 'Month', icon: CalendarRange, rows: monthBreakdown, metaLabel: 'Delivery' },
];

const HOURS = [...new Set(heatmapData.map(c => c.hour))].sort((a, b) => a - b);

export function TimeAnalysis() {
  const { filters } = useFilters();
  const [heatMetric, setHeatMetric] = useState<HeatMetric>('purchases');
  const [level, setLevel] = useState<TimeLevel>('hour');

  // Each heatmap cell carries purchases and ROAS; CPA is derived from the two so
  // the third view stays consistent with the first two rather than inventing data.
  const cells = useMemo(
    () =>
      heatmapData.map(c => ({
        ...c,
        cpa: c.purchases > 0 ? (c.purchases * 68) / c.roas / c.purchases : 0,
      })),
    [],
  );

  const valueOf = (c: (typeof cells)[number]) =>
    heatMetric === 'purchases' ? c.purchases : heatMetric === 'roas' ? c.roas : c.cpa;

  const { min, max } = useMemo(() => {
    const vals = cells.map(valueOf).filter(v => v > 0);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [cells, heatMetric]);

  const metricDef = HEAT_METRICS.find(m => m.id === heatMetric)!;

  /** 0 = worst, 1 = best, accounting for cost metrics running the other way. */
  const intensity = (v: number) => {
    if (v <= 0 || max === min) return 0;
    const t = (v - min) / (max - min);
    return metricDef.lowerIsBetter ? 1 - t : t;
  };

  const best = useMemo(() => [...cells].sort((a, b) => intensity(valueOf(b)) - intensity(valueOf(a)))[0], [cells, heatMetric]);
  const worst = useMemo(() => [...cells].filter(c => valueOf(c) > 0).sort((a, b) => intensity(valueOf(a)) - intensity(valueOf(b)))[0], [cells, heatMetric]);

  /**
   * "Best" on ROAS alone hands the title to whichever thin slot got lucky, so
   * only buckets carrying at least median volume are eligible.
   */
  const bestBy = (rows: BreakdownRow[]) => {
    const volumes = rows.map(r => r.purchases).sort((a, b) => a - b);
    const median = volumes[Math.floor(volumes.length / 2)] ?? 0;
    const eligible = rows.filter(r => r.purchases >= median);
    return [...(eligible.length ? eligible : rows)].sort((a, b) => b.roas - a.roas)[0];
  };

  const bestHour = useMemo(() => bestBy(hourBreakdown), []);
  const bestDay = useMemo(() => bestBy(weekdayBreakdown), []);
  const bestMonth = useMemo(() => bestBy(monthBreakdown), []);
  const activeLevel = LEVELS.find(l => l.id === level)!;

  const fmtHeat = (v: number) =>
    heatMetric === 'purchases' ? formatNumber(v) : heatMetric === 'roas' ? formatMultiplier(v) : formatCurrency(v);

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Best-of tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <BestTile icon={Clock} label="Best hour" name={bestHour?.segment ?? '—'}
          value={bestHour ? formatMultiplier(bestHour.roas) : '—'}
          detail={bestHour ? `${formatNumber(bestHour.purchases)} purchases at ${formatCurrency(bestHour.cpa)} CPA` : ''} />
        <BestTile icon={CalendarDays} label="Best weekday" name={bestDay?.segment ?? '—'}
          value={bestDay ? formatMultiplier(bestDay.roas) : '—'}
          detail={bestDay ? `${formatNumber(bestDay.purchases)} purchases at ${formatCurrency(bestDay.cpa)} CPA` : ''} />
        <BestTile icon={CalendarRange} label="Best month" name={bestMonth?.segment ?? '—'}
          value={bestMonth ? formatMultiplier(bestMonth.roas) : '—'}
          detail={bestMonth ? `${formatCurrency(bestMonth.revenue)} revenue on ${formatCurrency(bestMonth.spend)}` : ''} />
        <BestTile icon={Sunrise} label="Peak slot" name={best ? `${best.dayLabel} ${String(best.hour).padStart(2, '0')}:00` : '—'}
          value={best ? fmtHeat(valueOf(best)) : '—'}
          detail={worst ? `Weakest: ${worst.dayLabel} ${String(worst.hour).padStart(2, '0')}:00 at ${fmtHeat(valueOf(worst))}` : ''} />
      </div>

      {/* Heatmap */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Hour × Weekday Heatmap</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Account timezone · last {filters.days} days · brighter is better
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-bg-elevated border border-bg-border p-0.5">
            {HEAT_METRICS.map(m => (
              <button
                key={m.id}
                onClick={() => setHeatMetric(m.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  heatMetric === m.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[760px]">
            {/* Hour axis */}
            <div className="flex gap-1 mb-1 pl-10">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-xs text-slate-600 tabular-nums">
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                </div>
              ))}
            </div>

            {WEEKDAY_LABELS.map((day, di) => (
              <div key={day} className="flex gap-1 mb-1 items-center">
                <div className="w-10 text-xs text-slate-500 font-medium shrink-0">{day}</div>
                {HOURS.map(h => {
                  const cell = cells.find(c => c.day === di && c.hour === h);
                  const v = cell ? valueOf(cell) : 0;
                  const t = intensity(v);
                  return (
                    <div
                      key={h}
                      title={
                        cell
                          ? `${day} ${String(h).padStart(2, '0')}:00 — ${metricDef.label} ${fmtHeat(v)}`
                          : 'No delivery'
                      }
                      className="flex-1 aspect-square rounded-md transition-all duration-200 hover:ring-2 hover:ring-brand-400 hover:z-10 relative cursor-default"
                      style={{
                        background: v > 0
                          ? `rgba(124, 58, 237, ${0.1 + t * 0.85})`
                          : 'rgba(30, 30, 50, 0.5)',
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* Scale */}
            <div className="flex items-center gap-2 mt-3 pl-10">
              <span className="text-xs text-slate-500">{fmtHeat(metricDef.lowerIsBetter ? max : min)}</span>
              <div
                className="h-2 flex-1 rounded-full max-w-xs"
                style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.1), rgba(124,58,237,0.95))' }}
              />
              <span className="text-xs text-slate-500">{fmtHeat(metricDef.lowerIsBetter ? min : max)}</span>
              <span className="text-xs text-slate-600 ml-2">{metricDef.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time tables */}
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
          rows={activeLevel.rows}
          segmentLabel={activeLevel.label}
          metaLabel={activeLevel.metaLabel}
          targetRoas={TARGET_ROAS}
          exportName={`pharmescence_time_${level}`}
          exportTitle={`Time Analysis — ${activeLevel.label}`}
          pageSize={30}
        />
      </div>
    </div>
  );
}

function BestTile({
  icon: Icon, label, name, value, detail,
}: {
  icon: React.ElementType;
  label: string;
  name: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
        <Icon size={12} className="text-brand-400" />
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-base font-semibold text-white truncate">{name}</p>
        <p className="text-lg font-bold text-emerald-400 tabular-nums shrink-0">{value}</p>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
    </div>
  );
}
