import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GlobalFilters, FilterKey } from '../types';
import { DEFAULT_FILTERS, applyFilters, activeFilterCount } from '../lib/selectors';
import type { FilteredData } from '../lib/selectors';

interface FiltersContextValue {
  filters: GlobalFilters;
  data: FilteredData;
  activeCount: number;
  setDays: (days: number) => void;
  toggle: (key: FilterKey, value: string) => void;
  setValues: (key: FilterKey, values: string[]) => void;
  clear: (key?: FilterKey) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);

  const setDays = useCallback((days: number) => {
    setFilters(f => ({ ...f, days }));
  }, []);

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

  // Re-filtering walks every entity, so memoise on the filter object identity —
  // this is the hot path on large accounts.
  const data = useMemo(() => applyFilters(filters), [filters]);
  const activeCount = useMemo(() => activeFilterCount(filters), [filters]);

  const value = useMemo(
    () => ({ filters, data, activeCount, setDays, toggle, setValues, clear }),
    [filters, data, activeCount, setDays, toggle, setValues, clear],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside a <FiltersProvider>');
  return ctx;
}
