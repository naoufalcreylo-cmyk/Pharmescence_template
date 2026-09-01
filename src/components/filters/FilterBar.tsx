import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Filter, X, Check, Search } from 'lucide-react';
import { useFilters } from '../../context/FiltersContext';

import type { FilterDef, FilterOption } from '../../lib/selectors';
import type { FilterKey } from '../../types';

function FilterDropdown({ def }: { def: FilterDef }) {
  const { filters, toggle, clear } = useFilters();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = filters[def.key];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const options: FilterOption[] = q
    ? def.options.filter(o => o.label.toLowerCase().includes(q) || o.meta?.toLowerCase().includes(q))
    : def.options;

  const count = selected.length;
  const summary =
    count === 0 ? def.label
    : count === 1 ? (def.options.find(o => o.value === selected[0])?.label ?? `1 ${def.label}`)
    : `${def.label}: ${count}`;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors max-w-[190px]',
          count > 0
            ? 'bg-brand-600/15 border-brand-600/40 text-brand-300'
            : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white hover:border-brand-600/40',
        )}
      >
        <span className="truncate">{summary}</span>
        {count > 0 ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${def.label} filter`}
            onClick={e => { e.stopPropagation(); clear(def.key); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); clear(def.key); } }}
            className="shrink-0 rounded hover:bg-brand-600/30 p-0.5"
          >
            <X size={11} />
          </span>
        ) : (
          <ChevronDown size={12} className="shrink-0 opacity-60" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-bg-border bg-bg-elevated shadow-card-hover z-50 overflow-hidden animate-fade-in">
          {def.scope === 'breakdown' && (
            <p className="px-3 pt-2.5 text-xs text-amber-400/90 leading-snug">
              Applies to breakdown views — Meta exposes device only on the insights endpoint.
            </p>
          )}
          {def.options.length > 8 && (
            <div className="relative border-b border-bg-border">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${def.label.toLowerCase()}...`}
                className="w-full bg-transparent pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500 text-center">No matches</p>
            ) : (
              options.map(o => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggle(def.key, o.value)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
                  >
                    <span
                      className={clsx(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        on ? 'bg-brand-600 border-brand-600' : 'border-bg-border',
                      )}
                    >
                      {on && <Check size={11} className="text-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{o.label}</span>
                      {o.meta && <span className="block text-xs text-slate-500 truncate">{o.meta}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {count > 0 && (
            <button
              onClick={() => clear(def.key)}
              className="w-full border-t border-bg-border px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-bg-hover transition-colors"
            >
              Clear {count} selected
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Global filter bar (§18). Every filter writes to one context, so a selection
 * made here narrows every table, chart and recommendation in the dashboard.
 */
export function FilterBar() {
  const { activeCount, clear, data, filters, filterDefs } = useFilters();
  const [expanded, setExpanded] = useState(false);

  // Keep the common four visible; the rest live behind "More filters" so the
  // bar does not dominate the viewport on smaller screens.
  const primary: FilterKey[] = ['campaigns', 'adSets', 'ads', 'statuses'];
  const primaryDefs = filterDefs.filter(d => primary.includes(d.key));
  const secondaryDefs = filterDefs.filter(d => !primary.includes(d.key));

  return (
    <div className="card px-4 py-3 flex flex-wrap items-center gap-2 print:hidden">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
        <Filter size={13} />
        Filters
      </span>

      {primaryDefs.map(d => <FilterDropdown key={d.key} def={d} />)}

      {expanded && secondaryDefs.map(d => <FilterDropdown key={d.key} def={d} />)}

      <button
        onClick={() => setExpanded(e => !e)}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-bg-hover border border-transparent hover:border-bg-border transition-colors"
      >
        {expanded ? 'Fewer filters' : `More filters (${secondaryDefs.length})`}
      </button>

      <div className="flex-1" />

      <span className="text-xs text-slate-500 tabular-nums shrink-0">
        {data.campaigns.length} campaigns · {data.adSets.length} ad sets · {data.ads.length} ads · last {filters.days}d
      </span>

      {activeCount > 0 && (
        <button
          onClick={() => clear()}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
        >
          <X size={12} />
          Clear all ({activeCount})
        </button>
      )}
    </div>
  );
}
