import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { useData } from '../context/DataContext';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier, formatDelta, getTrendColor } from '../utils/formatters';
import { StatusBadge } from '../components/ui/Badge';
import type { Campaign } from '../types';

type SortKey = keyof Campaign;
type SortDir = 'asc' | 'desc';

const columns: { key: SortKey; label: string; format: string; align: string }[] = [
  { key: 'name', label: 'Campaign', format: 'text', align: 'left' },
  { key: 'status', label: 'Status', format: 'status', align: 'center' },
  { key: 'budget', label: 'Budget/Day', format: 'currency', align: 'right' },
  { key: 'spend', label: 'Spend', format: 'currency', align: 'right' },
  { key: 'purchases', label: 'Purchases', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right' },
  { key: 'roas', label: 'ROAS', format: 'multiplier', align: 'right' },
  { key: 'cpa', label: 'CPA', format: 'currency', align: 'right' },
  { key: 'ctr', label: 'CTR', format: 'percent', align: 'right' },
  { key: 'cpm', label: 'CPM', format: 'currency', align: 'right' },
  { key: 'cpc', label: 'CPC', format: 'currency', align: 'right' },
  { key: 'frequency', label: 'Freq', format: 'raw', align: 'right' },
  { key: 'reach', label: 'Reach', format: 'compact', align: 'right' },
  { key: 'impressions', label: 'Impr.', format: 'compact', align: 'right' },
  { key: 'addToCart', label: 'ATC', format: 'number', align: 'right' },
  { key: 'initiateCheckout', label: 'Checkout', format: 'number', align: 'right' },
  { key: 'aov', label: 'AOV', format: 'currency', align: 'right' },
  { key: 'trend', label: 'Trend', format: 'trend', align: 'right' },
];

function formatCell(value: any, format: string): string {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency': return formatCurrency(value);
    case 'number': return formatNumber(value);
    case 'compact': return formatNumber(value, true);
    case 'percent': return formatPercent(value);
    case 'multiplier': return formatMultiplier(value);
    case 'raw': return Number(value).toFixed(2);
    default: return String(value);
  }
}

function TrendCell({ value }: { value: number }) {
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-slate-400';
  const sign = value > 0 ? '+' : '';
  return (
    <div className={clsx('flex items-center justify-end gap-1 text-xs font-medium', color)}>
      {value > 0 ? <ArrowUp size={11} /> : value < 0 ? <ArrowDown size={11} /> : null}
      {sign}{Math.abs(value).toFixed(1)}%
    </div>
  );
}

function ROASBar({ value }: { value: number }) {
  const pct = Math.min((value / 6) * 100, 100);
  const color = value >= 3 ? '#10B981' : value >= 2 ? '#F59E0B' : '#F43F5E';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-white w-12 text-right">{formatMultiplier(value)}</span>
      <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden min-w-[48px]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Campaigns() {
  const { campaigns } = useData();
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const sorted = useMemo(() => {
    let list = [...campaigns];
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'ALL') list = list.filter(c => c.status === filterStatus);
    list.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [sortKey, sortDir, search, filterStatus]);

  const totals = useMemo(() => ({
    spend: sorted.reduce((a, c) => a + c.spend, 0),
    purchases: sorted.reduce((a, c) => a + c.purchases, 0),
    revenue: sorted.reduce((a, c) => a + c.revenue, 0),
    addToCart: sorted.reduce((a, c) => a + c.addToCart, 0),
    initiateCheckout: sorted.reduce((a, c) => a + c.initiateCheckout, 0),
  }), [sorted]);

  const handle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-slate-600" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-brand-400" /> : <ArrowDown size={12} className="text-brand-400" />;
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Spend', value: formatCurrency(totals.spend, true), color: 'text-white' },
          { label: 'Total Purchases', value: formatNumber(totals.purchases), color: 'text-emerald-400' },
          { label: 'Total Revenue', value: formatCurrency(totals.revenue, true), color: 'text-cyan-400' },
          { label: 'Blended ROAS', value: formatMultiplier(totals.revenue / totals.spend), color: totals.revenue / totals.spend >= 2 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Blended CPA', value: formatCurrency(totals.spend / totals.purchases), color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVE', 'PAUSED', 'ARCHIVED'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={clsx(
                'px-3 py-2 text-xs font-medium rounded-xl border transition-colors',
                filterStatus === s
                  ? 'bg-brand-600/15 text-brand-400 border-brand-600/30'
                  : 'bg-bg-elevated text-slate-400 border-bg-border hover:text-white hover:border-bg-hover'
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border">
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handle(col.key)}
                    className={clsx(
                      'px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((campaign, i) => (
                <tr
                  key={campaign.id}
                  className={clsx(
                    'border-b border-bg-border/50 transition-colors table-row-hover',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-bg-surface/30'
                  )}
                >
                  {columns.map(col => {
                    const val = campaign[col.key];
                    if (col.key === 'name') return (
                      <td key={col.key} className="px-4 py-3">
                        <div className="max-w-xs">
                          <p className="text-sm font-medium text-white truncate">{String(val)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{campaign.objective.replace(/_/g, ' ')}</p>
                        </div>
                      </td>
                    );
                    if (col.key === 'status') return (
                      <td key={col.key} className="px-4 py-3 text-center">
                        <StatusBadge status={String(val)} />
                      </td>
                    );
                    if (col.key === 'roas') return (
                      <td key={col.key} className="px-4 py-3 min-w-[100px]">
                        <ROASBar value={Number(val)} />
                      </td>
                    );
                    if (col.key === 'trend') return (
                      <td key={col.key} className="px-4 py-3">
                        <TrendCell value={Number(val)} />
                      </td>
                    );
                    return (
                      <td key={col.key} className={clsx('px-4 py-3 whitespace-nowrap tabular-nums', col.align === 'right' ? 'text-right' : '')}>
                        <span className={clsx(
                          'text-sm',
                          col.key === 'cpa' && Number(val) > 40 ? 'text-rose-400' : 'text-slate-300',
                          col.key === 'frequency' && Number(val) > 3 ? 'text-amber-400' : '',
                        )}>
                          {formatCell(val, col.format)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-bg-border bg-bg-surface/50">
                <td className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Totals</td>
                <td />
                <td />
                <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(totals.spend)}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatNumber(totals.purchases)}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-cyan-400">{formatCurrency(totals.revenue)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={clsx('text-sm font-bold', totals.revenue / totals.spend >= 2 ? 'text-emerald-400' : 'text-rose-400')}>
                    {formatMultiplier(totals.revenue / totals.spend)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-amber-400">{formatCurrency(totals.spend / totals.purchases)}</td>
                <td colSpan={99} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
