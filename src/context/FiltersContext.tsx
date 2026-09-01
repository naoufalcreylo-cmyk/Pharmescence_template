import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GlobalFilters, FilterKey } from '../types';
import { DEFAULT_FILTERS, applyFilters, activeFilterCount, buildFilterDefs } from '../lib/selectors';
import type { FilteredData, FilterDef } from '../lib/selectors';
import { useData } from './DataContext';
import type { DateRange } from '../lib/dateRanges';

interface FiltersContextValue {
  filters: GlobalFilters;
  data: FilteredData;
  /** Filter options, derived from whichever dataset is currently active. */
  filterDefs: FilterDef[];
  activeCount: number;
  range: DateRange;
  setRange: (range: DateRange) => void;
  toggle: (key: FilterKey, value: string) => void;
  setValues: (key: FilterKey, values: string[]) => void;
  clear: (key?: FilterKey) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

/**
 * `days` is lifted to the app root rather than owned here, because DataProvider
 * sits above this provider and needs the same value to decide which window to
 * request from Meta.
 */
export function FiltersProvider({
  children, range, onRangeChange,
}: {
  children: ReactNode;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}) {
  const days = range.days;
  const [selection, setSelection] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const filters = useMemo<GlobalFilters>(() => ({ ...selection, days }), [selection, days]);
  const setFilters = setSelection;

  const setRange = onRangeChange;

  const toggle = useCallback((key: FilterKey, value: string) => {
    setFilters(f => {
      const current = f[key];
      return {
        ...f,
        [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
      };
    });
  }, []);

  const setValues = useCallback((key: FilterKey, values: string[]) => {
    setFilters(f => ({ ...f, [key]: values }));
  }, []);

  const clear = useCallback((key?: FilterKey) => {
    setFilters(f => (key ? { ...f, [key]: [] } : { ...DEFAULT_FILTERS, days: f.days }));
  }, []);

  // The entity set comes from DataContext, so the filters operate on live Meta
  // data when it is available and on sample data otherwise, with no change here.
  const { campaigns, adSets, ads } = useData();
  const source = useMemo(() => ({ campaigns, adSets, ads }), [campaigns, adSets, ads]);

  // Re-filtering walks every entity, so memoise on the filter and source
  // identities — this is the hot path on large accounts.
  const data = useMemo(() => applyFilters(filters, source), [filters, source]);
  const filterDefs = useMemo(() => buildFilterDefs(source), [source]);
  const activeCount = useMemo(() => activeFilterCount(filters), [filters]);

  const value = useMemo(
    () => ({ filters, data, filterDefs, activeCount, range, setRange, toggle, setValues, clear }),
    [filters, data, filterDefs, activeCount, range, setRange, toggle, setValues, clear],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside a <FiltersProvider>');
  return ctx;
}
