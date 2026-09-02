import { useEffect, useState } from 'react';
import { fetchInsightsRaw } from '../lib/metaApi';
import { useData } from '../context/DataContext';
import {
  mapAge, mapGender, mapCountries, mapRegions, mapPlacements,
  mapPublisherPlatforms, mapDevices, mapOperatingSystems,
  mapHours, mapWeekdays, mapMonths, mapHeatmap,
} from '../data/liveBreakdowns';
import type { BreakdownRow, HeatmapCell } from '../types';
import type { GeoPoint } from '../data/breakdownData';

/**
 * Lazily loaded Meta breakdowns.
 *
 * Breakdowns are fetched only when a page that needs them mounts, rather than
 * up front with the rest of the dashboard. Loading all of them eagerly would
 * add six more requests to every page load and burn the ad account's rate
 * limit for data most sessions never open.
 *
 * Several dimensions share one request — age and gender come back together, the
 * OS view is a regrouping of device rows, and publisher platform is placement
 * rows merged — so six requests cover eleven dimensions.
 */

/** One Meta request; the dimensions it can satisfy are derived from its rows. */
type RequestKey = 'demographics' | 'country' | 'region' | 'placement' | 'device' | 'time';

const REQUESTS: Record<RequestKey, { breakdowns: string; daily?: boolean }> = {
  demographics: { breakdowns: 'age,gender' },
  country: { breakdowns: 'country' },
  region: { breakdowns: 'region' },
  placement: { breakdowns: 'publisher_platform,platform_position' },
  device: { breakdowns: 'impression_device' },
  // Hourly rows per day: Meta cannot break down by hour and weekday together,
  // so the weekday axis comes from each row's date.
  time: { breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone', daily: true },
};

export interface BreakdownBundle {
  age: BreakdownRow[];
  gender: BreakdownRow[];
  country: GeoPoint[];
  region: BreakdownRow[];
  placement: BreakdownRow[];
  platform: BreakdownRow[];
  device: BreakdownRow[];
  os: BreakdownRow[];
  hour: BreakdownRow[];
  weekday: BreakdownRow[];
  month: BreakdownRow[];
  heatmap: HeatmapCell[];
}

const EMPTY: BreakdownBundle = {
  age: [], gender: [], country: [], region: [], placement: [], platform: [],
  device: [], os: [], hour: [], weekday: [], month: [], heatmap: [],
};

/**
 * Cache keyed by request + window + refresh nonce.
 *
 * Module-level so switching between Geography and Placements and back does not
 * re-request. Cleared implicitly when the key changes.
 */
const cache = new Map<string, Partial<BreakdownBundle>>();
const inflight = new Map<string, Promise<Partial<BreakdownBundle>>>();

async function loadRequest(key: RequestKey, since: string, until: string, nonce: number) {
  const cacheKey = `${key}|${since}|${until}|${nonce}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Two pages mounting at once must not fire the same request twice.
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const cfg = REQUESTS[key];
    const rows = await fetchInsightsRaw('account', {
      since,
      until,
      breakdowns: cfg.breakdowns,
      daily: cfg.daily,
    });

    let result: Partial<BreakdownBundle>;
    switch (key) {
      case 'demographics':
        result = { age: mapAge(rows), gender: mapGender(rows) };
        break;
      case 'country':
        result = { country: mapCountries(rows) };
        break;
      case 'region':
        result = { region: mapRegions(rows) };
        break;
      case 'placement':
        result = { placement: mapPlacements(rows), platform: mapPublisherPlatforms(rows) };
        break;
      case 'device':
        result = { device: mapDevices(rows), os: mapOperatingSystems(rows) };
        break;
      case 'time':
        result = {
          hour: mapHours(rows),
          weekday: mapWeekdays(rows),
          month: mapMonths(rows),
          heatmap: mapHeatmap(rows),
        };
        break;
    }

    cache.set(cacheKey, result);
    inflight.delete(cacheKey);
    return result;
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

/**
 * Run tasks with a concurrency cap.
 *
 * The Breakdowns page needs six requests. Firing them at once means six
 * simultaneous serverless invocations, which is what made the main dashboard
 * load fail — the platform rejects the excess with an HTML error page rather
 * than JSON. Two at a time keeps it well inside any limit and is still fast,
 * since these are network-bound.
 */
async function runLimited<T>(tasks: (() => Promise<T>)[], limit = 2): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export interface LiveBreakdownState {
  data: BreakdownBundle;
  loading: boolean;
  error: string | null;
  /** False when the dashboard is on sample data, so pages can label themselves. */
  isLive: boolean;
}

/**
 * Fetch the named requests for the active window.
 *
 * Pass only what the page renders — Geography needs country and region, the
 * Breakdowns page needs everything.
 */
export function useLiveBreakdown(keys: RequestKey[]): LiveBreakdownState {
  const { range, source, nonce } = useData();
  const [data, setData] = useState<BreakdownBundle>(EMPTY);
  const [loading, setLoading] = useState(source === 'live');
  const [error, setError] = useState<string | null>(null);

  // Stable dependency: the array literal a caller passes is a new object each
  // render, so depend on its contents instead.
  const keyList = keys.join(',');

  useEffect(() => {
    if (source !== 'live') {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    runLimited(
      keyList.split(',').map(k => () => loadRequest(k as RequestKey, range.since, range.until, nonce)),
    )
      .then(parts => {
        if (cancelled) return;
        setData(parts.reduce<BreakdownBundle>((acc, p) => ({ ...acc, ...p }), { ...EMPTY }));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [keyList, range.since, range.until, nonce, source]);

  return { data, loading, error, isLive: source === 'live' };
}
