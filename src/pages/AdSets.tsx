import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { adSets } from '../data/mockData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { StatusBadge } from '../components/ui/Badge';
import type { AdSet } from '../types';

type SortKey = keyof AdSet;

function GenderBadge({ gender }: { gender: string }) {
  return (
    <span className={clsx(
      'text-xs font-medium px-2 py-0.5 rounded-full border',
      gender === 'FEMALE' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20' :
      gender === 'MALE' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
      'text-slate-400 bg-slate-500/10 border-slate-500/20'
    )}>
      {gender === 'ALL' ? 'All' : gender === 'FEMALE' ? '♀ Female' : '♂ Male'}
    </span>
  );
}

export function AdSets() {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('ALL');

  const uniqueCampaigns = useMemo(() => {
    const names = [...new Set(adSets.map(a => a.campaignName))];
    return names;
  }, []);

  const sorted = useMemo(() => {
    let list = [...adSets];
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.audience.toLowerCase().includes(search.toLowerCase()));
    if (filterCampaign !== 'ALL') list = list.filter(a => a.campaignName === filterCampaign);
    list.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (Array.isArray(av)) return 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [sortKey, sortDir, search, filterCampaign]);

  const handle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => handle(col)}
      className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-white transition-colors text-right select-none"
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {sortKey === col
          ? (sortDir === 'asc' ? <ArrowUp size={12} className="text-brand-400" /> : <ArrowDown size={12} className="text-brand-400" />)
          : <ArrowUpDown size={12} className="text-slate-600" />
        }
      </span>
    </th>
  );

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search ad sets or audiences..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
          />
        </div>
        <select
          value={filterCampaign}
          onChange={e => setFilterCampaign(e.target.value)}
          className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer hover:border-brand-600/40 transition-colors max-w-xs"
        >
          <option value="ALL">All Campaigns</option>
          {uniqueCampaigns.map(c => (
            <option key={c} value={c}>{c.replace('Pharmescence | ', '')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ad Set</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Audience</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
                <Th col="spend" label="Spend" />
                <Th col="purchases" label="Purchases" />
                <Th col="roas" label="ROAS" />
                <Th col="cpa" label="CPA" />
                <Th col="ctr" label="CTR" />
                <Th col="cpm" label="CPM" />
                <Th col="cpc" label="CPC" />
                <Th col="frequency" label="Freq" />
                <Th col="addToCart" label="ATC" />
                <Th col="initiateCheckout" label="Checkout" />
                <Th col="purchaseRate" label="CVR" />
                <Th col="trend" label="Trend" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((adset, i) => (
                <tr
                  key={adset.id}
                  className={clsx('border-b border-bg-border/50 transition-colors table-row-hover', i % 2 === 0 ? '' : 'bg-bg-surface/20')}
                >
                  <td className="px-4 py-3">
                    <div className="max-w-[220px]">
                      <p className="text-sm font-medium text-white truncate">{adset.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{adset.campaignName.replace('Pharmescence | ', '')}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={adset.status} /></td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-400 max-w-[160px] truncate">{adset.audience}</p>
                  </td>
                  <td className="px-4 py-3"><GenderBadge gender={adset.gender} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{adset.ageMin}–{adset.ageMax}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatCurrency(adset.spend)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-semibold">{formatNumber(adset.purchases)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={clsx('font-semibold', adset.roas >= 3 ? 'text-emerald-400' : adset.roas >= 2 ? 'text-amber-400' : 'text-rose-400')}>
                      {formatMultiplier(adset.roas)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={clsx(adset.cpa > 40 ? 'text-rose-400' : 'text-slate-300')}>{formatCurrency(adset.cpa)}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatPercent(adset.ctr)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatCurrency(adset.cpm)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatCurrency(adset.cpc)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={clsx(adset.frequency > 3 ? 'text-amber-400' : 'text-slate-300')}>{adset.frequency.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(adset.addToCart)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(adset.initiateCheckout)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatPercent(adset.purchaseRate)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={clsx('text-xs font-semibold', adset.trend > 0 ? 'text-emerald-400' : adset.trend < 0 ? 'text-rose-400' : 'text-slate-400')}>
                      {adset.trend > 0 ? '+' : ''}{adset.trend.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
