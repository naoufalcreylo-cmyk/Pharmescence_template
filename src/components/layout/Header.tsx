import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Sun, Moon, RefreshCw, Printer, Search, Megaphone, Users, Image } from 'lucide-react';
import { clsx } from 'clsx';

import { useFilters } from '../../context/FiltersContext';
import { useData } from '../../context/DataContext';
import { printView } from '../../utils/export';
import { DateRangePicker } from './DateRangePicker';
import type { NavPage, Campaign, AdSet, Ad } from '../../types';

const pageTitles: Record<NavPage, string> = {
  overview: 'Executive Overview',
  trends: 'Performance Trends',
  funnel: 'Funnel Analysis',
  campaigns: 'Campaign Performance',
  adsets: 'Ad Set Performance',
  ads: 'Ads & Creative',
  creative: 'Creative Insights',
  breakdowns: 'Breakdowns',
  geography: 'Geographic Performance',
  placements: 'Placement Analysis',
  time: 'Time Analysis',
  top: 'Top Performers',
  worst: 'Worst Performers & Waste',
  scaling: 'Scaling Opportunities',
  engine: 'AI Budget & Scaling Engine',
  insights: 'AI Insights & Action Center',
  ratios: 'Performance Ratios & Benchmarks',
  profitability: 'Profitability Dashboard',
  alerts: 'Alerts & Monitoring',
  reports: 'Reports & Export',
  connection: 'Live Data Connection',
};

interface HeaderProps {
  activePage: NavPage;
  onToggleSidebar: () => void;
  onNavigate: (page: NavPage) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** Sidebar width, so the fixed header starts beside it instead of under it. */
  offsetLeft: number;
}

interface SearchHit {
  id: string;
  name: string;
  context: string;
  kind: 'campaigns' | 'adSets' | 'ads';
  page: NavPage;
  icon: React.ElementType;
}

/** Flat index over every entity, built from whichever dataset is active. */
function buildSearchIndex(source: { campaigns: Campaign[]; adSets: AdSet[]; ads: Ad[] }): SearchHit[] {
  return [
    ...source.campaigns.map(c => ({ id: c.id, name: c.name, context: c.objective.replace(/_/g, ' '), kind: 'campaigns' as const, page: 'campaigns' as NavPage, icon: Megaphone })),
    ...source.adSets.map(a => ({ id: a.id, name: a.name, context: a.campaignName, kind: 'adSets' as const, page: 'adsets' as NavPage, icon: Users })),
    ...source.ads.map(a => ({ id: a.id, name: a.name, context: a.adSetName, kind: 'ads' as const, page: 'ads' as NavPage, icon: Image })),
  ];
}

/**
 * Says whether the numbers on screen came from Meta or from the bundled sample.
 *
 * Sitting in the header rather than on one page because the risk it guards
 * against is someone reading a chart on any page and assuming it is real.
 */
function DataSourceBadge({ onOpenConnection }: { onOpenConnection: () => void }) {
  const { source, loading } = useData();

  if (loading) {
    return (
      <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse-soft" />
        Loading
      </span>
    );
  }

  return (
    <button
      onClick={onOpenConnection}
      title={source === 'live' ? 'Live Meta data — click for details' : 'Sample data — click to connect your ad account'}
      className={clsx(
        'hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
        source === 'live'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', source === 'live' ? 'bg-emerald-400' : 'bg-amber-400')} />
      {source === 'live' ? 'Live data' : 'Sample data'}
    </button>
  );
}

export function Header({
  activePage, onToggleSidebar, onNavigate, darkMode, onToggleDark, onRefresh, isRefreshing, offsetLeft,
}: HeaderProps) {
  const { setValues, range, setRange } = useFilters();
  const { campaigns, adSets, ads } = useData();
  const searchIndex = useMemo(() => buildSearchIndex({ campaigns, adSets, ads }), [campaigns, adSets, ads]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Cmd/Ctrl+K focuses quick-jump, Escape closes any open popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(h => h.name.toLowerCase().includes(q) || h.context.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, searchIndex]);

  /** Jump to an entity by pinning it in the global filters, then navigating. */
  const jumpTo = (hit: SearchHit) => {
    setValues(hit.kind, [hit.id]);
    onNavigate(hit.page);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <header
      className="fixed top-0 right-0 z-20 h-16 bg-bg-surface/80 backdrop-blur-md border-b border-bg-border flex items-center px-4 gap-3 print:hidden transition-all duration-300 print:!left-0"
      style={{ left: offsetLeft }}
    >
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-sm font-semibold text-white truncate">{pageTitles[activePage]}</h1>
        <span className="text-slate-600 hidden sm:block">·</span>
        <span className="text-xs text-slate-500 hidden sm:block">Pharmescence</span>
        <DataSourceBadge onOpenConnection={() => onNavigate('connection')} />
      </div>

      <div className="flex-1" />

      {/* Quick jump */}
      <div className="relative hidden lg:block" ref={searchRef}>
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={clsx(
            'flex items-center gap-2 bg-bg-elevated border rounded-xl px-3 py-2 w-60 transition-colors',
            searchOpen ? 'border-brand-600/60' : 'border-bg-border hover:border-brand-600/40',
          )}
        >
          <Search size={14} className="text-slate-500 shrink-0" />
          <span className="text-xs text-slate-500">Search campaigns, ad sets, ads</span>
          <kbd className="ml-auto text-xs text-slate-600 bg-bg-border rounded px-1.5 py-0.5">⌘K</kbd>
        </button>

        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-bg-elevated border border-bg-border rounded-2xl shadow-card-hover z-50 overflow-hidden animate-fade-in">
            <div className="relative border-b border-bg-border">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full bg-transparent pl-9 pr-3 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {query.trim() === '' ? (
                <p className="px-3 py-6 text-xs text-slate-500 text-center">
                  Type to search {searchIndex.length} entities. Selecting one pins it in the global filters.
                </p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-6 text-xs text-slate-500 text-center">No matches for “{query}”</p>
              ) : (
                hits.map(h => {
                  const Icon = h.icon;
                  return (
                    <button
                      key={`${h.kind}-${h.id}`}
                      onClick={() => jumpTo(h)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-hover transition-colors"
                    >
                      <Icon size={14} className="text-brand-400 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-white truncate">{h.name}</span>
                        <span className="block text-xs text-slate-500 truncate">{h.context}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <DateRangePicker value={range} onChange={setRange} />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={15} className={clsx(isRefreshing && 'animate-spin')} />
        </button>
        <button
          onClick={printView}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover transition-colors"
          title="Print current view"
        >
          <Printer size={15} />
        </button>
        <button
          onClick={onToggleDark}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
