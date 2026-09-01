import { useMemo, useState, useDeferredValue } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './Skeleton';
import { ExportMenu } from './ExportMenu';
import type { ExportColumn } from '../../utils/export';

export interface Column<T> {
  key: string;
  header: string;
  /** Sort/search/export value. Keep it primitive — `render` handles display. */
  accessor: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Pins the column to the left edge while the table scrolls horizontally. */
  sticky?: boolean;
  width?: number;
  headerHint?: string;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  initialSort?: SortState;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Columns searched by the filter box. Defaults to the first column. */
  searchKeys?: string[];
  pageSize?: number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Enables the CSV / Excel / PDF menu above the table. */
  exportName?: string;
  exportTitle?: string;
  /** Renders a pinned totals row beneath the body. */
  totals?: (rows: T[]) => Record<string, ReactNode>;
  toolbar?: ReactNode;
  dense?: boolean;
}

/**
 * Reusable sortable data table.
 *
 * Built for large Meta accounts: sorting and filtering run over the full row set
 * inside `useMemo` (so they are not redone on unrelated re-renders), the search
 * term is deferred so typing never blocks the sort, and only one page of rows is
 * ever committed to the DOM. Export always runs against the *filtered and
 * sorted* set, not just the visible page.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  initialSort,
  searchable,
  searchPlaceholder = 'Search...',
  searchKeys,
  pageSize = 25,
  loading,
  onRowClick,
  emptyTitle = 'No rows to display',
  emptyDescription,
  exportName,
  exportTitle,
  totals,
  toolbar,
  dense,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const searchCols = useMemo(
    () => (searchKeys ? columns.filter(c => searchKeys.includes(c.key)) : columns.slice(0, 1)),
    [columns, searchKeys],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => searchCols.some(c => String(c.accessor(r)).toLowerCase().includes(q)));
  }, [rows, deferredQuery, searchCols]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize],
  );

  const exportColumns: ExportColumn<T>[] = useMemo(
    () => columns.map(c => ({ key: c.key, header: c.header, value: c.accessor })),
    [columns],
  );

  const toggleSort = (key: string) => {
    setPage(0);
    setSort(s =>
      s?.key === key
        ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
        // Numbers are most useful largest-first; that is the media buyer's default.
        : { key, dir: 'desc' },
    );
  };

  const totalsRow = totals && sorted.length > 0 ? totals(sorted) : null;
  const hasToolbar = searchable || exportName || toolbar;

  return (
    <div className="flex flex-col gap-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {searchable && (
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setPage(0); }}
                  placeholder={searchPlaceholder}
                  className="w-full bg-bg-elevated border border-bg-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-600/60 transition-colors"
                />
              </div>
            )}
            {toolbar}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 tabular-nums">
              {sorted.length.toLocaleString()}
              {sorted.length !== rows.length && ` of ${rows.length.toLocaleString()}`} rows
            </span>
            {exportName && (
              <ExportMenu
                rows={sorted}
                columns={exportColumns}
                name={exportName}
                title={exportTitle ?? exportName}
              />
            )}
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : sorted.length === 0 ? (
        <EmptyState
          variant={rows.length === 0 ? 'empty' : 'no-results'}
          title={rows.length === 0 ? emptyTitle : 'No rows match your filters'}
          description={
            rows.length === 0
              ? emptyDescription
              : 'Try clearing the search box or widening the global filters in the header.'
          }
          action={rows.length > 0 && query ? { label: 'Clear search', onClick: () => setQuery('') } : undefined}
        />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-bg-border">
                {columns.map(c => {
                  const active = sort?.key === c.key;
                  const sortable = c.sortable !== false;
                  return (
                    <th
                      key={c.key}
                      title={c.headerHint}
                      style={c.width ? { width: c.width, minWidth: c.width } : undefined}
                      className={clsx(
                        'text-xs font-semibold uppercase tracking-wider py-3 px-3 whitespace-nowrap select-none',
                        active ? 'text-brand-400' : 'text-slate-500',
                        sortable && 'cursor-pointer hover:text-white transition-colors',
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.sticky && 'sticky left-0 z-10 bg-bg-card',
                      )}
                      onClick={sortable ? () => toggleSort(c.key) : undefined}
                    >
                      <span className={clsx('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                        {c.header}
                        {sortable && (
                          active
                            ? sort!.dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />
                            : <ArrowUpDown size={11} className="opacity-30" />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'border-b border-bg-border/60 table-row-hover group',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map(c => (
                    <td
                      key={c.key}
                      className={clsx(
                        'px-3 text-sm text-slate-300 whitespace-nowrap',
                        dense ? 'py-2' : 'py-3',
                        c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.sticky && 'sticky left-0 z-10 bg-bg-card group-hover:bg-bg-hover',
                      )}
                    >
                      {c.render ? c.render(row) : c.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totalsRow && (
              <tfoot>
                <tr className="border-t-2 border-bg-border bg-bg-elevated/50">
                  {columns.map(c => (
                    <td
                      key={c.key}
                      className={clsx(
                        'px-3 py-3 text-sm font-semibold text-white whitespace-nowrap',
                        c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.sticky && 'sticky left-0 z-10 bg-bg-elevated',
                      )}
                    >
                      {totalsRow[c.key] ?? ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!loading && pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-400 px-2 tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
