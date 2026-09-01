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
import { previousRange } from '../lib/dateRanges';
import type { DateRange } from '../lib/dateRanges';

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
  range: DateRange;
  /** Bumped on every refresh, so lazy loaders can invalidate their caches. */
  nonce: number;
}

const DataContext = createContext<DataContextValue | null>(null);

const SAMPLE = {
  campaigns: mockCampaigns,
  adSets: mockAdSets,
  ads: mockAds,
  timeSeries: mockTimeSeries,
};

export function DataProvider({ children, range }: { children: ReactNode; range: DateRange }) {
  const [state, setState] = useState({ ...SAMPLE, source: 'sample' as DataSource });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const { since, until } = range;
  const prev = useMemo(() => previousRange(range), [range]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Issued together rather than in sequence: the entity edges and the
        // insight edges are independent, and each reaches Meta through its own
        // serverless invocation, so concurrency costs nothing extra.
        const [
          campaignEntities, adSetEntities, adEntities,
          campaignInsights, adSetInsights, adInsights,
          daily, dailyPrev,
          campaignPrev, adSetPrev, adPrev,
        ] = await Promise.all([
          fetchEntities('campaigns'),
          fetchEntities('adsets'),
          fetchEntities('ads'),
          fetchInsights('campaign', { since, until }),
          fetchInsights('adset', { since, until }),
          fetchInsights('ad', { since, until }),
          fetchInsights('account', { since, until, daily: true }),
          // The previous window is fetched as its own daily series rather than
          // by over-fetching one long series: calendar presets like "This month"
          // have a previous period that is not simply N more days back.
          fetchInsights('account', { since: prev.since, until: prev.until, daily: true }),
          fetchInsights('campaign', { since: prev.since, until: prev.until }),
          fetchInsights('adset', { since: prev.since, until: prev.until }),
          fetchInsights('ad', { since: prev.since, until: prev.until }),
        ]);

        if (cancelled) return;

        const campaignNames = new Map(campaignEntities.map(c => [c.id, c.name]));
        const adSetNames = new Map(adSetEntities.map(a => [a.id, a.name]));

        const liveCampaigns = mapCampaigns(campaignEntities, campaignInsights, campaignPrev);
        const liveAdSets = mapAdSets(adSetEntities, adSetInsights, adSetPrev, campaignNames);
        const liveAds = mapAds(adEntities, adInsights, adPrev, adSetNames, campaignNames);

        // Previous days first, then current: the KPI helpers read the comparison
        // period as `slice(-days*2, -days)` of one continuous series.
        const liveSeries = [...mapTimeSeries(dailyPrev), ...mapTimeSeries(daily)];

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
  }, [since, until, prev.since, prev.until, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const value = useMemo<DataContextValue>(
    () => ({ ...state, loading, error, refresh, range, nonce }),
    [state, loading, error, refresh, range, nonce],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside a <DataProvider>');
  return ctx;
}
