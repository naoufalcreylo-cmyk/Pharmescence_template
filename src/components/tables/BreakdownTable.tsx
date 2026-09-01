import { useMemo } from 'react';
import { clsx } from 'clsx';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../../utils/formatters';
import { summarize } from '../../lib/selectors';
import type { BreakdownRow } from '../../types';

/**
 * Dimension labels reach the totals row as free text ("Country", "City",
 * "Hour of Day"), so naive `+ "s"` produces "countrys". Handles the consonant-y
 * and sibilant cases, which covers every label in the dimension registry.
 */
function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

interface BreakdownTableProps {
  rows: BreakdownRow[];
  /** Column header for the segment's secondary attribute (e.g. "Platform"). */
  metaLabel?: string;
  segmentLabel?: string;
  targetRoas?: number;
  exportName: string;
  exportTitle?: string;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
}

/**
 * One table shape for every breakdown dimension (§7, §13, §14, §15).
 *
 * The funnel counters and every ratio come from the same `BreakdownRow`, so
 * Placement, Country and Hour of Day all read identically — a media buyer learns
 * the column order once.
 */
export function BreakdownTable({
  rows,
  metaLabel = 'Detail',
  segmentLabel = 'Segment',
  targetRoas = 2.5,
  exportName,
  exportTitle,
  loading,
  pageSize = 25,
  emptyTitle = 'No breakdown data',
}: BreakdownTableProps) {
  const maxSpend = useMemo(() => Math.max(...rows.map(r => r.spend), 0) || 1, [rows]);

  const columns: Column<BreakdownRow>[] = useMemo(
    () => [
      {
        key: 'segment',
        header: segmentLabel,
        accessor: r => r.segment,
        sticky: true,
        width: 210,
        render: r => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{r.segment}</p>
            {r.meta && <p className="text-xs text-slate-500 truncate">{r.meta}</p>}
          </div>
        ),
      },
      {
        key: 'meta',
        header: metaLabel,
        accessor: r => r.meta ?? '',
        render: r => <span className="text-xs text-slate-400">{r.meta ?? '—'}</span>,
      },
      {
        key: 'spend',
        header: 'Spend',
        accessor: r => r.spend,
        align: 'right',
        render: r => (
          <div className="flex items-center justify-end gap-2">
            {/* Inline share-of-spend bar: shows budget concentration at a glance. */}
            <span className="hidden lg:block w-12 h-1 rounded-full bg-bg-border overflow-hidden">
              <span className="block h-full bg-brand-500" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
            </span>
            <span className="text-white font-medium">{formatCurrency(r.spend)}</span>
          </div>
        ),
      },
      { key: 'revenue', header: 'Revenue', accessor: r => r.revenue, align: 'right', render: r => <span className="text-cyan-400">{formatCurrency(r.revenue)}</span> },
      { key: 'purchases', header: 'Purchases', accessor: r => r.purchases, align: 'right', render: r => formatNumber(r.purchases) },
      {
        key: 'roas',
        header: 'ROAS',
        accessor: r => r.roas,
        align: 'right',
        render: r => (
          <span className={clsx('font-semibold', r.roas >= targetRoas ? 'text-emerald-400' : r.roas >= targetRoas * 0.8 ? 'text-amber-400' : 'text-rose-400')}>
            {formatMultiplier(r.roas)}
          </span>
        ),
      },
      { key: 'cpa', header: 'CPA', accessor: r => r.cpa, align: 'right', render: r => formatCurrency(r.cpa) },
      { key: 'ctr', header: 'CTR', accessor: r => r.ctr, align: 'right', render: r => formatPercent(r.ctr) },
      { key: 'cpm', header: 'CPM', accessor: r => r.cpm, align: 'right', render: r => formatCurrency(r.cpm) },
      { key: 'cpc', header: 'CPC', accessor: r => r.cpc, align: 'right', render: r => formatCurrency(r.cpc) },
      { key: 'impressions', header: 'Impr.', accessor: r => r.impressions, align: 'right', render: r => formatNumber(r.impressions, true) },
      { key: 'reach', header: 'Reach', accessor: r => r.reach, align: 'right', render: r => formatNumber(r.reach, true) },
      { key: 'frequency', header: 'Freq.', accessor: r => r.frequency, align: 'right', render: r => <span className={r.frequency > 3 ? 'text-amber-400' : ''}>{r.frequency.toFixed(2)}</span> },
      { key: 'landingPageViews', header: 'LPV', accessor: r => r.landingPageViews, align: 'right', render: r => formatNumber(r.landingPageViews, true) },
      { key: 'addToCart', header: 'ATC', accessor: r => r.addToCart, align: 'right', render: r => formatNumber(r.addToCart) },
      { key: 'initiateCheckout', header: 'Checkout', accessor: r => r.initiateCheckout, align: 'right', render: r => formatNumber(r.initiateCheckout) },
      { key: 'purchaseRate', header: 'Purch. Rate', accessor: r => r.purchaseRate, align: 'right', render: r => formatPercent(r.purchaseRate) },
    ],
    [metaLabel, segmentLabel, targetRoas, maxSpend],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={r => r.segment}
      initialSort={{ key: 'spend', dir: 'desc' }}
      searchable
      searchKeys={['segment', 'meta']}
      searchPlaceholder={`Search ${segmentLabel.toLowerCase()}...`}
      pageSize={pageSize}
      loading={loading}
      exportName={exportName}
      exportTitle={exportTitle}
      emptyTitle={emptyTitle}
      totals={rs => {
        const t = summarize(rs);
        return {
          segment: `${rs.length} ${pluralize(segmentLabel.toLowerCase(), rs.length)}`,
          spend: formatCurrency(t.spend),
          revenue: formatCurrency(t.revenue),
          purchases: formatNumber(t.purchases),
          roas: formatMultiplier(t.roas),
          cpa: formatCurrency(t.cpa),
          ctr: formatPercent(t.ctr),
          cpm: formatCurrency(t.cpm),
          cpc: formatCurrency(t.cpc),
          impressions: formatNumber(t.impressions, true),
          reach: formatNumber(t.reach, true),
          frequency: t.frequency.toFixed(2),
          landingPageViews: formatNumber(rs.reduce((s, r) => s + r.landingPageViews, 0), true),
          addToCart: formatNumber(rs.reduce((s, r) => s + r.addToCart, 0)),
          initiateCheckout: formatNumber(rs.reduce((s, r) => s + r.initiateCheckout, 0)),
          purchaseRate: formatPercent(t.clicks > 0 ? (t.purchases / t.clicks) * 100 : 0),
        };
      }}
    />
  );
}
