import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Campaign, AdSet, Ad, TimeSeriesPoint } from '../types';
import {
  campaigns as mockCampaigns,
  adSets as mockAdSets,
  ads as mockAds,
  timeSeriesData as mockTimeSeries,
} from '../data/mockData';
import { fetchDashboardBundle, normalizeRow, MetaApiError } from '../lib/metaApi';
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

      // One request, fanned out server-side. Eleven parallel browser requests
      // meant eleven concurrent serverless invocations per page load, and a
      // platform-level rejection of any of them came back as an HTML error page
      // rather than JSON — which the client could not even report.
      try {
        const { bundle, errors } = await fetchDashboardBundle({
          since,
          until,
          // Calendar presets like "This month" have a previous period that is
          // not simply N more days back, so it is computed here and sent along.
          prevSince: prev.since,
          prevUntil: prev.until,
        });

        if (cancelled) return;

        const campaignNames = new Map(bundle.campaigns.map(c => [c.id, c.name]));
        const adSetNames = new Map(bundle.adsets.map(a => [a.id, a.name]));
        const rows = (list: typeof bundle.campaignInsights) => list.map(normalizeRow);

        const liveCampaigns = mapCampaigns(
          bundle.campaigns, rows(bundle.campaignInsights), rows(bundle.campaignPrev),
        );
        const liveAdSets = mapAdSets(
          bundle.adsets, rows(bundle.adSetInsights), rows(bundle.adSetPrev), campaignNames,
        );
        const liveAds = mapAds(
          bundle.ads, rows(bundle.adInsights), rows(bundle.adPrev), adSetNames, campaignNames,
        );

        // Previous days first, then current: the KPI helpers read the comparison
        // period as `slice(-days*2, -days)` of one continuous series.
        const liveSeries = [...mapTimeSeries(rows(bundle.dailyPrev)), ...mapTimeSeries(rows(bundle.daily))];

        // Reaching Meta at all means the data is real, even when the window is
        // empty. Falling back to sample here would quietly replace "no delivery
        // yet today" with fabricated numbers — the exact failure the data-source
        // badge exists to prevent. Empty states are the honest answer.
        setState({
          campaigns: liveCampaigns,
          adSets: liveAdSets,
          ads: liveAds,
          timeSeries: liveSeries,
          source: 'live',
        });

        const failed = errors ? Object.entries(errors) : [];
        setError(
          failed.length > 0
            ? `${failed.length} Meta request${failed.length > 1 ? 's' : ''} failed (${failed.map(([k]) => k).join(', ')}). First error: ${failed[0][1]}`
            : null,
        );
      } catch (err) {
        if (cancelled) return;
        const e = err as MetaApiError;
        setState({ ...SAMPLE, source: 'sample' });
        // No backend or no token is the expected static-demo case, not a failure
        // worth alarming the user about.
        setError(e.notConfigured ? null : e.message);
      }

      setLoading(false);
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
