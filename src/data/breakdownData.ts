import type {
  BreakdownRow, BreakdownDimension, TimeSeriesPoint, TrendGranularity,
} from '../types';
import {
  timeSeriesData, geoData, placementData, ageData, genderData, heatmapData,
} from './mockData';

/**
 * Breakdown layer (§7 / §13 / §14 / §15).
 *
 * Meta's Insights API returns one row per (entity x breakdown value) carrying the
 * raw event counters only — every ratio (ROAS, CPA, CTR, CPM, CPC, frequency,
 * purchase rate) has to be recomputed from the counters after aggregation,
 * because a ratio of sums is not the sum of ratios. `buildRow` is the single
 * place that derivation happens, so every dimension stays internally consistent.
 */

interface RawSegment {
  segment: string;
  meta?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  revenue: number;
  /** Landing-page-view rate off link clicks — varies by surface quality. */
  lpvRate?: number;
  atcRate?: number;
  icRate?: number;
}

export function buildRow(r: RawSegment): BreakdownRow {
  const landingPageViews = Math.round(r.clicks * (r.lpvRate ?? 0.82));
  const addToCart = Math.round(landingPageViews * (r.atcRate ?? 0.16));
  const initiateCheckout = Math.round(addToCart * (r.icRate ?? 0.55));
  return {
    segment: r.segment,
    meta: r.meta,
    spend: r.spend,
    impressions: r.impressions,
    reach: r.reach,
    clicks: r.clicks,
    landingPageViews,
    addToCart,
    initiateCheckout,
    purchases: r.purchases,
    revenue: r.revenue,
    roas: r.spend > 0 ? r.revenue / r.spend : 0,
    cpa: r.purchases > 0 ? r.spend / r.purchases : 0,
    ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
    cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
    frequency: r.reach > 0 ? r.impressions / r.reach : 0,
    purchaseRate: r.clicks > 0 ? (r.purchases / r.clicks) * 100 : 0,
  };
}

/** Rebuild a raw segment from headline metrics, keeping the counters coherent. */
function segmentFrom(
  segment: string,
  spend: number,
  purchases: number,
  roas: number,
  ctr: number,
  cpm: number,
  meta?: string,
  extra: Partial<RawSegment> = {},
): BreakdownRow {
  const impressions = Math.round((spend / cpm) * 1000);
  const clicks = Math.round(impressions * (ctr / 100));
  return buildRow({
    segment,
    meta,
    spend,
    impressions,
    reach: Math.round(impressions / 1.68),
    clicks,
    purchases,
    revenue: spend * roas,
    ...extra,
  });
}

// --- Country / Region / City (§13) -------------------------------------------

export interface GeoPoint extends BreakdownRow {
  countryCode: string;
  lat: number;
  lng: number;
}

const COUNTRY_COORDS: Record<string, { lat: number; lng: number; ctr: number; cpm: number }> = {
  US: { lat: 39.8, lng: -98.6, ctr: 2.18, cpm: 11.40 },
  CA: { lat: 56.1, lng: -106.3, ctr: 2.34, cpm: 9.20 },
  GB: { lat: 54.0, lng: -2.0, ctr: 2.42, cpm: 10.10 },
  AU: { lat: -25.3, lng: 133.8, ctr: 2.28, cpm: 9.80 },
  DE: { lat: 51.2, lng: 10.5, ctr: 1.92, cpm: 8.60 },
  FR: { lat: 46.2, lng: 2.2, ctr: 1.98, cpm: 8.20 },
  NL: { lat: 52.1, lng: 5.3, ctr: 2.44, cpm: 7.90 },
  SE: { lat: 60.1, lng: 18.6, ctr: 2.52, cpm: 7.40 },
};

export const countryBreakdown: GeoPoint[] = geoData.map(g => {
  const c = COUNTRY_COORDS[g.countryCode];
  return {
    ...segmentFrom(g.country, g.spend, g.purchases, g.roas, c.ctr, c.cpm, g.countryCode),
    countryCode: g.countryCode,
    lat: c.lat,
    lng: c.lng,
  };
});

interface RegionSeed { name: string; country: string; spendShare: number; roas: number; ctr: number; cpm: number; aov: number }

const REGION_SEEDS: RegionSeed[] = [
  { name: 'California', country: 'United States', spendShare: 0.148, roas: 2.72, ctr: 2.28, cpm: 12.80, aov: 74 },
  { name: 'Texas', country: 'United States', spendShare: 0.101, roas: 2.48, ctr: 2.12, cpm: 11.10, aov: 71 },
  { name: 'Florida', country: 'United States', spendShare: 0.094, roas: 2.64, ctr: 2.22, cpm: 10.90, aov: 73 },
  { name: 'New York', country: 'United States', spendShare: 0.088, roas: 2.86, ctr: 2.34, cpm: 13.40, aov: 79 },
  { name: 'Illinois', country: 'United States', spendShare: 0.052, roas: 2.42, ctr: 2.04, cpm: 11.60, aov: 69 },
  { name: 'Pennsylvania', country: 'United States', spendShare: 0.041, roas: 2.28, ctr: 1.96, cpm: 10.40, aov: 67 },
  { name: 'Ohio', country: 'United States', spendShare: 0.034, roas: 2.18, ctr: 1.88, cpm: 9.80, aov: 65 },
  { name: 'Ontario', country: 'Canada', spendShare: 0.062, roas: 3.24, ctr: 2.42, cpm: 9.40, aov: 80 },
  { name: 'British Columbia', country: 'Canada', spendShare: 0.031, roas: 3.08, ctr: 2.28, cpm: 9.10, aov: 78 },
  { name: 'Quebec', country: 'Canada', spendShare: 0.024, roas: 2.94, ctr: 2.18, cpm: 8.80, aov: 76 },
  { name: 'England', country: 'United Kingdom', spendShare: 0.068, roas: 3.42, ctr: 2.48, cpm: 10.30, aov: 86 },
  { name: 'Scotland', country: 'United Kingdom', spendShare: 0.017, roas: 3.12, ctr: 2.32, cpm: 9.20, aov: 82 },
  { name: 'New South Wales', country: 'Australia', spendShare: 0.029, roas: 3.46, ctr: 2.36, cpm: 10.20, aov: 84 },
  { name: 'Victoria', country: 'Australia', spendShare: 0.021, roas: 3.22, ctr: 2.24, cpm: 9.60, aov: 83 },
  { name: 'Bavaria', country: 'Germany', spendShare: 0.014, roas: 2.84, ctr: 1.96, cpm: 8.80, aov: 76 },
  { name: 'Ile-de-France', country: 'France', spendShare: 0.012, roas: 3.02, ctr: 2.02, cpm: 8.40, aov: 76 },
  { name: 'North Holland', country: 'Netherlands', spendShare: 0.008, roas: 3.48, ctr: 2.48, cpm: 7.90, aov: 80 },
  { name: 'Stockholm County', country: 'Sweden', spendShare: 0.006, roas: 3.56, ctr: 2.56, cpm: 7.40, aov: 80 },
];

const TOTAL_GEO_SPEND = geoData.reduce((s, g) => s + g.spend, 0);

export const regionBreakdown: BreakdownRow[] = REGION_SEEDS
  .map(r => {
    const spend = TOTAL_GEO_SPEND * r.spendShare;
    const purchases = Math.round((spend * r.roas) / r.aov);
    return segmentFrom(r.name, spend, purchases, r.roas, r.ctr, r.cpm, r.country);
  })
  .sort((a, b) => b.spend - a.spend);

interface CitySeed { name: string; region: string; spendShare: number; roas: number; ctr: number; cpm: number; aov: number }

const CITY_SEEDS: CitySeed[] = [
  { name: 'Los Angeles', region: 'California, US', spendShare: 0.062, roas: 2.78, ctr: 2.32, cpm: 13.20, aov: 75 },
  { name: 'New York City', region: 'New York, US', spendShare: 0.058, roas: 2.92, ctr: 2.38, cpm: 14.10, aov: 81 },
  { name: 'Chicago', region: 'Illinois, US', spendShare: 0.038, roas: 2.46, ctr: 2.08, cpm: 12.00, aov: 70 },
  { name: 'Houston', region: 'Texas, US', spendShare: 0.036, roas: 2.52, ctr: 2.14, cpm: 11.40, aov: 71 },
  { name: 'Miami', region: 'Florida, US', spendShare: 0.034, roas: 2.88, ctr: 2.34, cpm: 11.80, aov: 77 },
  { name: 'Phoenix', region: 'Arizona, US', spendShare: 0.028, roas: 2.34, ctr: 1.98, cpm: 10.20, aov: 68 },
  { name: 'San Francisco', region: 'California, US', spendShare: 0.026, roas: 3.06, ctr: 2.44, cpm: 15.20, aov: 88 },
  { name: 'Dallas', region: 'Texas, US', spendShare: 0.025, roas: 2.44, ctr: 2.06, cpm: 11.00, aov: 70 },
  { name: 'Toronto', region: 'Ontario, CA', spendShare: 0.031, roas: 3.32, ctr: 2.46, cpm: 9.80, aov: 81 },
  { name: 'London', region: 'England, UK', spendShare: 0.040, roas: 3.54, ctr: 2.52, cpm: 11.20, aov: 88 },
  { name: 'Manchester', region: 'England, UK', spendShare: 0.014, roas: 3.28, ctr: 2.42, cpm: 9.40, aov: 84 },
  { name: 'Sydney', region: 'NSW, AU', spendShare: 0.019, roas: 3.52, ctr: 2.40, cpm: 10.60, aov: 85 },
  { name: 'Melbourne', region: 'Victoria, AU', spendShare: 0.015, roas: 3.26, ctr: 2.26, cpm: 9.80, aov: 83 },
  { name: 'Vancouver', region: 'BC, CA', spendShare: 0.017, roas: 3.14, ctr: 2.30, cpm: 9.40, aov: 79 },
  { name: 'Seattle', region: 'Washington, US', spendShare: 0.021, roas: 2.82, ctr: 2.26, cpm: 12.40, aov: 76 },
  { name: 'Boston', region: 'Massachusetts, US', spendShare: 0.020, roas: 2.94, ctr: 2.30, cpm: 13.00, aov: 80 },
  { name: 'Denver', region: 'Colorado, US', spendShare: 0.016, roas: 2.68, ctr: 2.18, cpm: 11.20, aov: 73 },
  { name: 'Amsterdam', region: 'North Holland, NL', spendShare: 0.007, roas: 3.52, ctr: 2.50, cpm: 8.10, aov: 81 },
];

export const cityBreakdown: BreakdownRow[] = CITY_SEEDS
  .map(c => {
    const spend = TOTAL_GEO_SPEND * c.spendShare;
    const purchases = Math.round((spend * c.roas) / c.aov);
    return segmentFrom(c.name, spend, purchases, c.roas, c.ctr, c.cpm, c.region);
  })
  .sort((a, b) => b.spend - a.spend);

// --- Placement / Publisher platform (§14) ------------------------------------

export const placementBreakdown: BreakdownRow[] = placementData.map(p =>
  buildRow({
    segment: p.placement,
    meta: p.platform,
    spend: p.spend,
    impressions: p.impressions,
    reach: Math.round(p.impressions / (p.platform === 'Meta' ? 1.32 : 1.74)),
    clicks: Math.round(p.impressions * (p.ctr / 100)),
    purchases: p.purchases,
    revenue: p.spend * p.roas,
    // Audience Network drives far more accidental clicks that never render the LP.
    lpvRate: p.platform === 'Meta' ? 0.54 : 0.84,
  }),
);

export const publisherPlatformBreakdown: BreakdownRow[] = (() => {
  const groups = new Map<string, BreakdownRow[]>();
  for (const p of placementBreakdown) {
    const key =
      p.segment === 'Audience Network' ? 'Audience Network'
      : p.segment === 'Messenger' ? 'Messenger'
      : (p.meta ?? 'Other');
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  return [...groups.entries()]
    .map(([platform, rows]) =>
      buildRow({
        segment: platform,
        meta: `${rows.length} placement${rows.length > 1 ? 's' : ''}`,
        spend: rows.reduce((s, r) => s + r.spend, 0),
        impressions: rows.reduce((s, r) => s + r.impressions, 0),
        reach: rows.reduce((s, r) => s + r.reach, 0),
        clicks: rows.reduce((s, r) => s + r.clicks, 0),
        purchases: rows.reduce((s, r) => s + r.purchases, 0),
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
      }),
    )
    .sort((a, b) => b.spend - a.spend);
})();

// --- Device / OS (§7) --------------------------------------------------------

export const deviceBreakdown: BreakdownRow[] = [
  segmentFrom('Mobile App', 34820.60, 1268, 2.98, 2.34, 9.80, 'Facebook / Instagram app'),
  segmentFrom('Mobile Web', 7420.40, 218, 2.42, 1.88, 8.40, 'In-app browser'),
  segmentFrom('Desktop', 6180.20, 208, 3.18, 1.62, 12.60, 'facebook.com'),
  segmentFrom('Tablet', 1962.80, 58, 2.28, 1.74, 8.90, 'iPad / Android tablet'),
].sort((a, b) => b.spend - a.spend);

export const osBreakdown: BreakdownRow[] = [
  segmentFrom('iOS', 26840.40, 1042, 3.24, 2.28, 11.40, 'iPhone / iPad'),
  segmentFrom('Android', 18420.80, 578, 2.42, 2.02, 8.20, 'Android phone / tablet'),
  segmentFrom('Windows', 3820.60, 108, 2.68, 1.58, 12.20, 'Desktop'),
  segmentFrom('macOS', 1302.20, 48, 3.02, 1.66, 13.10, 'Desktop'),
].sort((a, b) => b.spend - a.spend);

// --- Demographics (§7) -------------------------------------------------------

const AGE_CPM: Record<string, number> = {
  '18-24': 7.20, '25-34': 9.40, '35-44': 10.80, '45-54': 12.20, '55-64': 13.40, '65+': 14.60,
};

export const ageBreakdown: BreakdownRow[] = ageData.map(a =>
  segmentFrom(a.segment, a.spend, a.purchases, a.roas, a.ctr, AGE_CPM[a.segment] ?? 10, 'Age range'),
);

export const genderBreakdown: BreakdownRow[] = genderData.map(g =>
  segmentFrom(g.segment, g.spend, g.purchases, g.roas, g.ctr, g.segment === 'Female' ? 10.4 : 9.6, 'Gender'),
);

// --- Time dimensions (§15) ---------------------------------------------------

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Purchase mass sitting in the hour x day heatmap — used to weight time buckets. */
const HEATMAP_TOTAL = heatmapData.reduce((s, c) => s + c.purchases, 0);
const ACCOUNT_SPEND = timeSeriesData.reduce((s, d) => s + d.spend, 0);
const ACCOUNT_REVENUE = timeSeriesData.reduce((s, d) => s + d.revenue, 0);
const ACCOUNT_PURCHASES = timeSeriesData.reduce((s, d) => s + d.purchases, 0);
const ACCOUNT_IMPRESSIONS = timeSeriesData.reduce((s, d) => s + d.impressions, 0);
const ACCOUNT_CLICKS = timeSeriesData.reduce((s, d) => s + d.clicks, 0);

/**
 * Distribute account totals across a time bucket using its share of the heatmap's
 * purchase mass. `roasIndex` is the bucket's ROAS relative to the account average:
 * a bucket that converts better than average needs proportionally less spend to
 * produce the same revenue, which is what makes CPA/ROAS differ per bucket.
 *
 * Clicks carry a damped version of the same index. Scaling impressions and clicks
 * by the identical share would pin CTR to exactly the account average in every
 * bucket — hours genuinely differ in how engaged the audience is, just less
 * sharply than they differ in conversion rate, hence the square root.
 */
function timeRow(segment: string, meta: string, purchaseMass: number, roasIndex: number): BreakdownRow {
  const share = purchaseMass / HEATMAP_TOTAL;
  const revenue = ACCOUNT_REVENUE * share;
  const spend = (ACCOUNT_SPEND * share) / roasIndex;
  const impressions = Math.round(ACCOUNT_IMPRESSIONS * share);
  return buildRow({
    segment,
    meta,
    spend,
    impressions,
    reach: Math.round(impressions / 1.68),
    clicks: Math.round(ACCOUNT_CLICKS * share * Math.sqrt(roasIndex)),
    purchases: Math.round(ACCOUNT_PURCHASES * share),
    revenue,
  });
}

export const hourBreakdown: BreakdownRow[] = (() => {
  const byHour = new Map<number, { purchases: number; roasSum: number; n: number }>();
  for (const c of heatmapData) {
    const cur = byHour.get(c.hour) ?? { purchases: 0, roasSum: 0, n: 0 };
    cur.purchases += c.purchases;
    cur.roasSum += c.roas;
    cur.n += 1;
    byHour.set(c.hour, cur);
  }
  const avgRoas = [...byHour.values()].reduce((s, v) => s + v.roasSum / v.n, 0) / byHour.size;
  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) =>
      timeRow(
        `${String(hour).padStart(2, '0')}:00`,
        hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Late night',
        v.purchases,
        (v.roasSum / v.n) / avgRoas,
      ),
    );
})();

export const weekdayBreakdown: BreakdownRow[] = (() => {
  const byDay = new Map<number, { purchases: number; roasSum: number; n: number }>();
  for (const c of heatmapData) {
    const cur = byDay.get(c.day) ?? { purchases: 0, roasSum: 0, n: 0 };
    cur.purchases += c.purchases;
    cur.roasSum += c.roas;
    cur.n += 1;
    byDay.set(c.day, cur);
  }
  const avgRoas = [...byDay.values()].reduce((s, v) => s + v.roasSum / v.n, 0) / byDay.size;
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, v]) =>
      timeRow(
        WEEKDAY_FULL[day],
        day >= 5 ? 'Weekend' : 'Weekday',
        v.purchases,
        (v.roasSum / v.n) / avgRoas,
      ),
    );
})();

export const monthBreakdown: BreakdownRow[] = (() => {
  const byMonth = new Map<string, TimeSeriesPoint[]>();
  for (const d of timeSeriesData) {
    const key = d.date.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(d);
    byMonth.set(key, arr);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, days]) => {
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return buildRow({
        segment: label,
        meta: `${days.length} day${days.length > 1 ? 's' : ''} of delivery`,
        spend: days.reduce((s, d) => s + d.spend, 0),
        impressions: days.reduce((s, d) => s + d.impressions, 0),
        reach: days.reduce((s, d) => s + d.reach, 0),
        clicks: days.reduce((s, d) => s + d.clicks, 0),
        purchases: days.reduce((s, d) => s + d.purchases, 0),
        revenue: days.reduce((s, d) => s + d.revenue, 0),
      });
    });
})();

// --- Dimension registry ------------------------------------------------------

export interface DimensionDef {
  id: BreakdownDimension;
  label: string;
  group: 'Demographic' | 'Delivery' | 'Geographic' | 'Time';
  metaLabel: string;
  rows: BreakdownRow[];
}

export const DIMENSIONS: DimensionDef[] = [
  { id: 'age', label: 'Age', group: 'Demographic', metaLabel: 'Bracket', rows: ageBreakdown },
  { id: 'gender', label: 'Gender', group: 'Demographic', metaLabel: 'Segment', rows: genderBreakdown },
  { id: 'placement', label: 'Placement', group: 'Delivery', metaLabel: 'Platform', rows: placementBreakdown },
  { id: 'platform', label: 'Publisher Platform', group: 'Delivery', metaLabel: 'Coverage', rows: publisherPlatformBreakdown },
  { id: 'device', label: 'Device', group: 'Delivery', metaLabel: 'Surface', rows: deviceBreakdown },
  { id: 'os', label: 'Operating System', group: 'Delivery', metaLabel: 'Family', rows: osBreakdown },
  { id: 'country', label: 'Country', group: 'Geographic', metaLabel: 'Code', rows: countryBreakdown },
  { id: 'region', label: 'Region', group: 'Geographic', metaLabel: 'Country', rows: regionBreakdown },
  { id: 'city', label: 'City', group: 'Geographic', metaLabel: 'Region', rows: cityBreakdown },
  { id: 'hour', label: 'Hour of Day', group: 'Time', metaLabel: 'Daypart', rows: hourBreakdown },
  { id: 'weekday', label: 'Day of Week', group: 'Time', metaLabel: 'Type', rows: weekdayBreakdown },
  { id: 'month', label: 'Month', group: 'Time', metaLabel: 'Delivery', rows: monthBreakdown },
];

export function getDimension(id: BreakdownDimension): DimensionDef {
  return DIMENSIONS.find(d => d.id === id) ?? DIMENSIONS[0];
}

// --- Trend grouping (§2) -----------------------------------------------------

export interface TrendPoint extends TimeSeriesPoint {
  label: string;
  days: number;
}

/**
 * Roll the daily series up to weeks or months. Counters sum; ratios are
 * recomputed from the summed counters so one heavy day cannot skew the bucket.
 */
export function groupTimeSeries(
  data: TimeSeriesPoint[],
  granularity: TrendGranularity,
): TrendPoint[] {
  if (granularity === 'daily') {
    return data.map(d => ({
      ...d,
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      days: 1,
    }));
  }

  const buckets = new Map<string, TimeSeriesPoint[]>();
  for (const d of data) {
    const dt = new Date(`${d.date}T00:00:00`);
    let key: string;
    if (granularity === 'monthly') {
      key = d.date.slice(0, 7);
    } else {
      // Bucket by the Monday that opens the week (ISO week start).
      const dow = (dt.getDay() + 6) % 7;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - dow);
      key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }
    const arr = buckets.get(key) ?? [];
    arr.push(d);
    buckets.set(key, arr);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, days]) => {
      const sum = (f: (d: TimeSeriesPoint) => number) => days.reduce((s, d) => s + f(d), 0);
      const spend = sum(d => d.spend);
      const revenue = sum(d => d.revenue);
      const purchases = sum(d => d.purchases);
      const impressions = sum(d => d.impressions);
      const clicks = sum(d => d.clicks);
      const reach = sum(d => d.reach);
      const label =
        granularity === 'monthly'
          ? new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : `Wk ${new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return {
        date: key,
        label,
        days: days.length,
        spend: parseFloat(spend.toFixed(2)),
        purchases,
        revenue: parseFloat(revenue.toFixed(2)),
        roas: spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0,
        cpa: purchases > 0 ? parseFloat((spend / purchases).toFixed(2)) : 0,
        ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
        cpm: impressions > 0 ? parseFloat(((spend / impressions) * 1000).toFixed(2)) : 0,
        cpc: clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0,
        frequency: reach > 0 ? parseFloat((impressions / reach).toFixed(2)) : 0,
        impressions,
        clicks,
        landingPageViews: sum(d => d.landingPageViews),
        addToCart: sum(d => d.addToCart),
        initiateCheckout: sum(d => d.initiateCheckout),
        reach,
      };
    });
}
