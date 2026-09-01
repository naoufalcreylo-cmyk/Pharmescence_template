import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Campaign, AdSet, Ad, TimeSeriesPoint } from '../types';
import {
  campaigns as mockCampaigns,
  adSets as mockAdSets,
  ads as mockAds,
  timeSeriesData as mockTimeSeries,
} from '../data/mockData';
import { fetchEntities, fetchInsights, MetaApiError } from '../lib/metaApi';
import { mapCampaigns, mapAdSets, mapAds, mapTimeSeries } from '../data/liveMappers';

/**
 * The dashboard's single source of entity data.
 *
 * Tries the live Meta API first and falls back to the bundled sample data when
 * there is no backend, no token, or the API refuses. The fallback is what lets
 * the same build serve as a static demo on GitHub Pages and as a live dashboard
 * on Vercel, and it means a Meta outage degrades the dashboard rather than
 * breaking it.
 *
 * `source` is exposed so the UI can say which one it is showing — a dashboard
 * that silently displays sample data as if it were real is worse than one that
 * shows nothing.
 */

export type DataSource = 'live' | 'sample';

interface DataContextValue {
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  timeSeries: TimeSeriesPoint[];
  source: DataSource;
  loading: boolean;
  /** Why live data was unavailable, when it was attempted and failed. */
  error: string | null;
  refresh: () => void;
  days: number;
  setDays: (d: number) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const SAMPLE = {
  campaigns: mockCampaigns,
  adSets: mockAdSets,
  ads: mockAds,
  timeSeries: mockTimeSeries,
};

export function DataProvider({ children, days }: { children: ReactNode; days: number }) {
  const [state, setState] = useState({ ...SAMPLE, source: 'sample' as DataSource });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [activeDays, setActiveDays] = useState(days);

  useEffect(() => { setActiveDays(days); }, [days]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Eight calls, issued together rather than in sequence: the entity edges
        // and the insight edges are independent, and Meta's per-account rate
        // limit counts calls, not concurrency.
        const [
          campaignEntities, adSetEntities, adEntities,
          campaignInsights, adSetInsights, adInsights,
          daily,
          campaignPrev, adSetPrev, adPrev,
        ] = await Promise.all([
          fetchEntities('campaigns'),
          fetchEntities('adsets'),
          fetchEntities('ads'),
          fetchInsights('campaign', { days: activeDays }),
          fetchInsights('adset', { days: activeDays }),
          fetchInsights('ad', { days: activeDays }),
          // Twice the window: the KPI cards compare the latest N days against the N
          // before them, and that comparison is a slice of this one series.
          fetchInsights('account', { days: activeDays * 2, daily: true }),
          fetchInsights('campaign', { days: activeDays, previous: true }),
          fetchInsights('adset', { days: activeDays, previous: true }),
          fetchInsights('ad', { days: activeDays, previous: true }),
        ]);

        if (cancelled) return;

        const campaignNames = new Map(campaignEntities.map(c => [c.id, c.name]));
        const adSetNames = new Map(adSetEntities.map(a => [a.id, a.name]));

        const liveCampaigns = mapCampaigns(campaignEntities, campaignInsights, campaignPrev);
        const liveAdSets = mapAdSets(adSetEntities, adSetInsights, adSetPrev, campaignNames);
        const liveAds = mapAds(adEntities, adInsights, adPrev, adSetNames, campaignNames);
        const liveSeries = mapTimeSeries(daily);

        // An account that returns nothing at all is almost always a date range
        // with no delivery rather than a working dashboard. Showing empty tables
        // is still the honest outcome, so only the totally-empty case falls back.
        if (liveCampaigns.length === 0 && liveSeries.length === 0) {
          setState({ ...SAMPLE, source: 'sample' });
          setError('Meta returned no campaigns or delivery for this period. Showing sample data.');
        } else {
          setState({
            campaigns: liveCampaigns,
            adSets: liveAdSets,
            ads: liveAds,
            timeSeries: liveSeries,
            source: 'live',
          });
        }
      } catch (err) {
        if (cancelled) return;
        const e = err as MetaApiError;
        setState({ ...SAMPLE, source: 'sample' });
        // Not being configured is the expected static-demo case, not a failure
        // worth alarming the user about.
        setError(e.notConfigured ? null : e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [activeDays, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const value = useMemo<DataContextValue>(
    () => ({ ...state, loading, error, refresh, days: activeDays, setDays: setActiveDays }),
    [state, loading, error, refresh, activeDays],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside a <DataProvider>');
  return ctx;
}
