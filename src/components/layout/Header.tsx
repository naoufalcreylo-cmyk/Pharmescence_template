import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Sun, Moon, RefreshCw, Printer, Calendar, ChevronDown, Search, Megaphone, Users, Image } from 'lucide-react';
import { clsx } from 'clsx';
import { format, subDays } from 'date-fns';
import { campaigns, adSets, ads } from '../../data/mockData';
import { useFilters } from '../../context/FiltersContext';
import { printView } from '../../utils/export';
import type { NavPage } from '../../types';

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
};

const DATE_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
  { label: 'Last 90 Days', days: 90 },
];

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

/** Flat index over every entity — the quick-jump search runs against this. */
const SEARCH_INDEX: SearchHit[] = [
  ...campaigns.map(c => ({ id: c.id, name: c.name, context: c.objective.replace(/_/g, ' '), kind: 'campaigns' as const, page: 'campaigns' as NavPage, icon: Megaphone })),
  ...adSets.map(a => ({ id: a.id, name: a.name, context: a.campaignName, kind: 'adSets' as const, page: 'adsets' as NavPage, icon: Users })),
  ...ads.map(a => ({ id: a.id, name: a.name, context: a.adSetName, kind: 'ads' as const, page: 'ads' as NavPage, icon: Image })),
];

export function Header({
  activePage, onToggleSidebar, onNavigate, darkMode, onToggleDark, onRefresh, isRefreshing, offsetLeft,
}: HeaderProps) {
  const { filters, setDays, setValues } = useFilters();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date(2026, 5, 29);
  const startDate = subDays(today, filters.days - 1);
  const selectedLabel = DATE_PRESETS.find(p => p.days === filters.days)?.label ?? `Last ${filters.days} Days`;

  // Cmd/Ctrl+K focuses quick-jump, Escape closes any open popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setShowDatePicker(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
      if (!dateRef.current?.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX
      .filter(h => h.name.toLowerCase().includes(q) || h.context.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query]);

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
                  Type to search {SEARCH_INDEX.length} entities. Selecting one pins it in the global filters.
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

      {/* Date range */}
      <div className="relative" ref={dateRef}>
        <button
          onClick={() => setShowDatePicker(v => !v)}
          className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:border-brand-600/50 transition-colors"
        >
          <Calendar size={14} className="text-brand-400" />
          <span className="hidden sm:block">{selectedLabel}</span>
          <span className="hidden md:block text-slate-500">
            {format(startDate, 'MMM d')} – {format(today, 'MMM d, yyyy')}
          </span>
          <ChevronDown size={12} className="text-slate-500" />
        </button>

        {showDatePicker && (
          <div className="absolute right-0 top-full mt-2 bg-bg-elevated border border-bg-border rounded-2xl shadow-card p-2 w-48 z-50 animate-fade-in">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.days}
                onClick={() => { setDays(preset.days); setShowDatePicker(false); }}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm rounded-xl transition-colors',
                  filters.days === preset.days
                    ? 'bg-brand-600/20 text-brand-400 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-bg-hover',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
