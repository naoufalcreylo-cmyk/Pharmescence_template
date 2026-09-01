import type { BreakdownRow, HeatmapCell } from '../types';
import { normalizeRow, num } from '../lib/metaApi';
import type { MetaInsightRow } from '../lib/metaApi';
import type { GeoPoint } from './breakdownData';

/**
 * Meta breakdown responses -> the dashboard's BreakdownRow shape.
 *
 * A breakdown row carries its segment as an extra top-level property named
 * after the breakdown itself, so the segment key has to be read per dimension.
 * Everything below that is the same normalisation the rest of the app uses, and
 * ratios are recomputed from counters so the rows survive re-aggregation.
 */

function toRow(r: MetaInsightRow, segment: string, meta?: string): BreakdownRow {
  const n = normalizeRow(r);
  return {
    segment,
    meta,
    spend: n.spend,
    impressions: n.impressions,
    reach: n.reach,
    clicks: n.linkClicks,
    landingPageViews: n.landingPageViews,
    addToCart: n.addToCart,
    initiateCheckout: n.initiateCheckout,
    purchases: n.purchases,
    revenue: n.revenue,
    roas: n.roas,
    cpa: n.cpa,
    ctr: n.ctr,
    cpm: n.cpm,
    cpc: n.cpc,
    frequency: n.frequency,
    purchaseRate: n.purchaseRate,
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Merge rows that share a segment, summing counters then re-deriving ratios. */
function mergeBySegment(rows: BreakdownRow[]): BreakdownRow[] {
  const groups = new Map<string, BreakdownRow[]>();
  for (const r of rows) {
    const arr = groups.get(r.segment) ?? [];
    arr.push(r);
    groups.set(r.segment, arr);
  }

  return [...groups.entries()].map(([segment, list]) => {
    if (list.length === 1) return list[0];
    const s = (f: (r: BreakdownRow) => number) => list.reduce((acc, r) => acc + f(r), 0);
    const spend = s(r => r.spend);
    const impressions = s(r => r.impressions);
    const reach = s(r => r.reach);
    const clicks = s(r => r.clicks);
    const purchases = s(r => r.purchases);
    const revenue = s(r => r.revenue);
    return {
      segment,
      meta: list[0].meta,
      spend,
      impressions,
      reach,
      clicks,
      landingPageViews: s(r => r.landingPageViews),
      addToCart: s(r => r.addToCart),
      initiateCheckout: s(r => r.initiateCheckout),
      purchases,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      cpa: purchases > 0 ? spend / purchases : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      purchaseRate: clicks > 0 ? (purchases / clicks) * 100 : 0,
    };
  });
}

const bySpend = (a: BreakdownRow, b: BreakdownRow) => b.spend - a.spend;

// --- Demographics ------------------------------------------------------------

export function mapAge(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(rows.map(r => toRow(r, str(r.age) || 'Unknown', 'Age range'))).sort(bySpend);
}

const GENDER_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
};

export function mapGender(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => {
      const g = str(r.gender).toLowerCase();
      return toRow(r, GENDER_LABEL[g] ?? 'Unknown', 'Gender');
    }),
  ).sort(bySpend);
}

// --- Geography ---------------------------------------------------------------

/**
 * Centroids for bubble placement. Meta returns ISO-3166 alpha-2 codes; anything
 * not listed still appears in the tables, just not on the map — better than
 * inventing a location.
 */
const COUNTRY_META: Record<string, { name: string; lat: number; lng: number }> = {
  US: { name: 'United States', lat: 39.8, lng: -98.6 },
  CA: { name: 'Canada', lat: 56.1, lng: -106.3 },
  GB: { name: 'United Kingdom', lat: 54.0, lng: -2.0 },
  AU: { name: 'Australia', lat: -25.3, lng: 133.8 },
  DE: { name: 'Germany', lat: 51.2, lng: 10.5 },
  FR: { name: 'France', lat: 46.2, lng: 2.2 },
  NL: { name: 'Netherlands', lat: 52.1, lng: 5.3 },
  SE: { name: 'Sweden', lat: 60.1, lng: 18.6 },
  ES: { name: 'Spain', lat: 40.4, lng: -3.7 },
  IT: { name: 'Italy', lat: 41.9, lng: 12.6 },
  MA: { name: 'Morocco', lat: 31.8, lng: -7.1 },
  DZ: { name: 'Algeria', lat: 28.0, lng: 1.7 },
  TN: { name: 'Tunisia', lat: 33.9, lng: 9.5 },
  BE: { name: 'Belgium', lat: 50.5, lng: 4.5 },
  CH: { name: 'Switzerland', lat: 46.8, lng: 8.2 },
  PT: { name: 'Portugal', lat: 39.4, lng: -8.2 },
  AE: { name: 'United Arab Emirates', lat: 24.0, lng: 54.0 },
  SA: { name: 'Saudi Arabia', lat: 24.0, lng: 45.0 },
  EG: { name: 'Egypt', lat: 26.8, lng: 30.8 },
  BR: { name: 'Brazil', lat: -14.2, lng: -51.9 },
  MX: { name: 'Mexico', lat: 23.6, lng: -102.5 },
  IN: { name: 'India', lat: 20.6, lng: 79.0 },
};

export function mapCountries(rows: MetaInsightRow[]): GeoPoint[] {
  const merged = mergeBySegment(
    rows.map(r => {
      const code = str(r.country).toUpperCase();
      return toRow(r, (COUNTRY_META[code]?.name ?? code) || 'Unknown', code);
    }),
  ).sort(bySpend);

  return merged.map(row => {
    const code = row.meta ?? '';
    const geo = COUNTRY_META[code];
    return {
      ...row,
      countryCode: code,
      // Countries without a known centroid sit at 0,0 and are filtered out of
      // the map by the page rather than drawn in the Atlantic.
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
    };
  });
}

export function mapRegions(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => toRow(r, str(r.region) || 'Unknown', COUNTRY_META[str(r.country).toUpperCase()]?.name)),
  ).sort(bySpend);
}

// --- Delivery ----------------------------------------------------------------

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  audience_network: 'Audience Network',
  threads: 'Threads',
};

function titleCase(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Placement is the pairing of publisher_platform and platform_position, which
 * is how Ads Manager names surfaces ("Instagram Reels", "Facebook Feed").
 */
export function mapPlacements(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => {
      const platform = PLATFORM_LABEL[str(r.publisher_platform)] ?? titleCase(str(r.publisher_platform));
      const position = titleCase(str(r.platform_position));
      return toRow(r, position ? `${platform} ${position}` : platform, platform);
    }),
  ).sort(bySpend);
}

export function mapPublisherPlatforms(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => {
      const platform = PLATFORM_LABEL[str(r.publisher_platform)] ?? titleCase(str(r.publisher_platform));
      return toRow(r, platform, 'Publisher platform');
    }),
  ).sort(bySpend);
}

export function mapDevices(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => toRow(r, titleCase(str(r.impression_device)) || 'Unknown', 'Device')),
  ).sort(bySpend);
}

/**
 * Meta has no operating-system breakdown; impression_device carries the OS in
 * its value (`iphone`, `android_smartphone`, `desktop`), so the OS view is a
 * regrouping of the device rows rather than a separate request.
 */
export function mapOperatingSystems(rows: MetaInsightRow[]): BreakdownRow[] {
  return mergeBySegment(
    rows.map(r => {
      const d = str(r.impression_device).toLowerCase();
      const os =
        d.includes('iphone') || d.includes('ipad') || d.includes('ipod') ? 'iOS'
        : d.includes('android') ? 'Android'
        : d.includes('desktop') ? 'Desktop'
        : 'Other';
      return toRow(r, os, 'Operating system');
    }),
  ).sort(bySpend);
}

// --- Time --------------------------------------------------------------------

/** Meta returns the hourly breakdown as a "HH:MM:SS - HH:MM:SS" range string. */
function hourFromRange(v: string): number {
  const m = /^(\d{2})/.exec(v);
  return m ? parseInt(m[1], 10) : 0;
}

export function mapHours(rows: MetaInsightRow[]): BreakdownRow[] {
  const withHour = rows.map(r => {
    const raw = str(r.hourly_stats_aggregated_by_advertiser_time_zone);
    const hour = hourFromRange(raw);
    return {
      hour,
      row: toRow(
        r,
        `${String(hour).padStart(2, '0')}:00`,
        hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Late night',
      ),
    };
  });

  const merged = mergeBySegment(withHour.map(w => w.row));
  return merged.sort((a, b) => a.segment.localeCompare(b.segment));
}

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekday and month come from the daily series, not a Meta breakdown. */
export function mapWeekdays(daily: MetaInsightRow[]): BreakdownRow[] {
  const rows = daily
    .filter(r => r.date_start)
    .map(r => {
      const d = new Date(`${r.date_start}T00:00:00`);
      const dow = d.getDay();
      return toRow(r, WEEKDAY_FULL[dow], dow === 0 || dow === 6 ? 'Weekend' : 'Weekday');
    });
  const merged = mergeBySegment(rows);
  // Monday-first, matching how delivery schedules are usually read.
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return merged.sort((a, b) => order.indexOf(a.segment) - order.indexOf(b.segment));
}

export function mapMonths(daily: MetaInsightRow[]): BreakdownRow[] {
  const rows = daily
    .filter(r => r.date_start)
    .map(r => {
      const key = str(r.date_start).slice(0, 7);
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return toRow(r, label, 'Delivery');
    });
  return mergeBySegment(rows);
}

/**
 * Hour x weekday heatmap.
 *
 * Meta cannot break down by hour and weekday at once, so the grid is built by
 * requesting the hourly breakdown with `time_increment=1`: each row is then one
 * (date, hour) pair, and the date supplies the weekday.
 */
export function mapHeatmap(rows: MetaInsightRow[]): HeatmapCell[] {
  const cells = new Map<string, { purchases: number; spend: number; revenue: number }>();

  for (const r of rows) {
    const date = str(r.date_start);
    const raw = str(r.hourly_stats_aggregated_by_advertiser_time_zone);
    if (!date || !raw) continue;

    const hour = hourFromRange(raw);
    // Monday = 0, to match the dashboard's row order.
    const day = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
    const key = `${day}-${hour}`;
    const n = normalizeRow(r);

    const cur = cells.get(key) ?? { purchases: 0, spend: 0, revenue: 0 };
    cur.purchases += n.purchases;
    cur.spend += n.spend;
    cur.revenue += n.revenue;
    cells.set(key, cur);
  }

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const out: HeatmapCell[] = [];
  for (const [key, v] of cells) {
    const [day, hour] = key.split('-').map(Number);
    out.push({
      hour,
      day,
      dayLabel: labels[day],
      value: v.purchases,
      purchases: v.purchases,
      roas: v.spend > 0 ? parseFloat((v.revenue / v.spend).toFixed(2)) : 0,
    });
  }
  return out.sort((a, b) => a.day - b.day || a.hour - b.hour);
}

export { num };
