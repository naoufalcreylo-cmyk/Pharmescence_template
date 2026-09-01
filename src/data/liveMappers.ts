import type { Campaign, AdSet, Ad, TimeSeriesPoint } from '../types';
import { displayStatus, entityBudget, num } from '../lib/metaApi';
import type { MetaEntity, NormalizedRow } from '../lib/metaApi';

/**
 * Meta API responses -> dashboard types.
 *
 * Two sources have to be joined for every level: the **entity edge** carries
 * status, objective, budget and targeting, while the **insights edge** carries
 * the metrics. Meta keeps them separate, so this module is where they meet.
 *
 * Anything Meta does not report is left at zero rather than invented — a chart
 * with a gap is honest, a chart with a plausible-looking guess is not.
 */

const RANKINGS = ['ABOVE_AVERAGE', 'AVERAGE', 'BELOW_AVERAGE'] as const;
type Ranking = (typeof RANKINGS)[number];

/**
 * Meta's ranking values are verbose ("below_average_10", meaning bottom 10%) and
 * become "UNKNOWN" until an ad has enough impressions to be scored.
 */
function toRanking(v: string | undefined): Ranking {
  if (!v) return 'AVERAGE';
  const s = v.toUpperCase();
  if (s.startsWith('ABOVE')) return 'ABOVE_AVERAGE';
  if (s.startsWith('BELOW')) return 'BELOW_AVERAGE';
  return 'AVERAGE';
}

type Status = Campaign['status'];

function toStatus(e: MetaEntity): Status {
  const s = displayStatus(e);
  return (['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'] as const).includes(s as Status)
    ? (s as Status)
    : 'PAUSED';
}

/** Percentage change, guarding the divide-by-zero that a new entity produces. */
function trendPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function indexBy<T>(rows: T[], key: (r: T) => string | undefined): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, r);
  }
  return m;
}

const EMPTY: NormalizedRow = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0,
  addToCart: 0, initiateCheckout: 0, purchases: 0, revenue: 0, roas: 0, cpa: 0,
  ctr: 0, cpm: 0, cpc: 0, frequency: 0, purchaseRate: 0,
};

// --- Campaigns ---------------------------------------------------------------

export function mapCampaigns(
  entities: MetaEntity[],
  insights: NormalizedRow[],
  previous: NormalizedRow[],
): Campaign[] {
  const byId = indexBy(insights, r => r.campaignId);
  const prevById = indexBy(previous, r => r.campaignId);

  return entities.map(e => {
    const m = byId.get(e.id) ?? EMPTY;
    const p = prevById.get(e.id) ?? EMPTY;
    const budget = entityBudget(e);

    return {
      id: e.id,
      name: e.name,
      status: toStatus(e),
      objective: e.objective ?? 'OUTCOME_SALES',
      budget: budget.amount,
      budgetType: budget.type,
      spend: m.spend,
      purchases: m.purchases,
      revenue: m.revenue,
      roas: m.roas,
      cpa: m.cpa,
      ctr: m.ctr,
      cpm: m.cpm,
      cpc: m.cpc,
      frequency: m.frequency,
      reach: m.reach,
      impressions: m.impressions,
      clicks: m.linkClicks,
      addToCart: m.addToCart,
      initiateCheckout: m.initiateCheckout,
      landingPageViews: m.landingPageViews,
      purchaseRate: m.purchaseRate,
      aov: m.purchases > 0 ? m.revenue / m.purchases : 0,
      // Conversion rate off landing page views: the denominator a media buyer
      // means when asking "what does the page convert at".
      conversionRate: m.landingPageViews > 0 ? (m.purchases / m.landingPageViews) * 100 : 0,
      trend: trendPct(m.roas, p.roas),
      previousSpend: p.spend,
      previousPurchases: p.purchases,
      previousRoas: p.roas,
    };
  });
}

// --- Ad sets -----------------------------------------------------------------

interface Targeting {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: { countries?: string[]; cities?: { name?: string }[]; regions?: { name?: string }[] };
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  flexible_spec?: { interests?: { name?: string }[] }[];
  custom_audiences?: { name?: string }[];
}

/** Meta encodes gender as [1]=male, [2]=female, absent/both = all. */
function toGender(t: Targeting): AdSet['gender'] {
  const g = t.genders;
  if (!g || g.length !== 1) return 'ALL';
  return g[0] === 1 ? 'MALE' : 'FEMALE';
}

/** Best available human label for who an ad set targets. */
function audienceLabel(t: Targeting): string {
  const custom = t.custom_audiences?.map(a => a.name).filter(Boolean);
  if (custom?.length) return custom.join(', ');
  const interests = t.flexible_spec?.flatMap(f => f.interests?.map(i => i.name) ?? []).filter(Boolean);
  if (interests?.length) return interests.slice(0, 3).join(', ');
  return 'Broad';
}

function locationLabel(t: Targeting): string {
  const geo = t.geo_locations;
  if (!geo) return 'Worldwide';
  if (geo.countries?.length) return geo.countries.join(', ');
  if (geo.regions?.length) return geo.regions.map(r => r.name).filter(Boolean).join(', ');
  if (geo.cities?.length) return geo.cities.map(c => c.name).filter(Boolean).join(', ');
  return 'Worldwide';
}

/** Flatten the placement tree into the flat list the dashboard displays. */
function placementList(t: Targeting): string[] {
  const out: string[] = [];
  for (const p of t.facebook_positions ?? []) out.push(`Facebook ${p.replace(/_/g, ' ')}`);
  for (const p of t.instagram_positions ?? []) out.push(`Instagram ${p.replace(/_/g, ' ')}`);
  if (!out.length && t.publisher_platforms?.length) {
    out.push(...t.publisher_platforms.map(p => p.replace(/_/g, ' ')));
  }
  return out.length ? out : ['Automatic'];
}

export function mapAdSets(
  entities: MetaEntity[],
  insights: NormalizedRow[],
  previous: NormalizedRow[],
  campaignNames: Map<string, string>,
): AdSet[] {
  const byId = indexBy(insights, r => r.adSetId);
  const prevById = indexBy(previous, r => r.adSetId);

  return entities.map(e => {
    const m = byId.get(e.id) ?? EMPTY;
    const p = prevById.get(e.id) ?? EMPTY;
    const budget = entityBudget(e);
    const t = (e.targeting ?? {}) as Targeting;

    return {
      id: e.id,
      campaignId: e.campaign_id ?? '',
      campaignName: campaignNames.get(e.campaign_id ?? '') ?? m.campaignName ?? '',
      name: e.name,
      status: toStatus(e),
      audience: audienceLabel(t),
      location: locationLabel(t),
      ageMin: t.age_min ?? 18,
      ageMax: t.age_max ?? 65,
      gender: toGender(t),
      placement: placementList(t),
      optimizationGoal: e.optimization_goal ?? 'OFFSITE_CONVERSIONS',
      budget: budget.amount,
      budgetType: budget.type,
      spend: m.spend,
      purchases: m.purchases,
      revenue: m.revenue,
      roas: m.roas,
      cpa: m.cpa,
      ctr: m.ctr,
      frequency: m.frequency,
      cpm: m.cpm,
      cpc: m.cpc,
      addToCart: m.addToCart,
      initiateCheckout: m.initiateCheckout,
      purchaseRate: m.purchaseRate,
      reach: m.reach,
      impressions: m.impressions,
      trend: trendPct(m.roas, p.roas),
    };
  });
}

// --- Ads ---------------------------------------------------------------------

/** Meta's creative object_type maps onto the dashboard's format vocabulary. */
function toFormat(objectType: string | undefined): Ad['format'] {
  switch ((objectType ?? '').toUpperCase()) {
    case 'VIDEO': return 'VIDEO';
    case 'SHARE': return 'CAROUSEL';
    case 'PHOTO': return 'IMAGE';
    case 'INVALID': return 'IMAGE';
    default: return 'IMAGE';
  }
}

export function mapAds(
  entities: MetaEntity[],
  insights: NormalizedRow[],
  previous: NormalizedRow[],
  adSetNames: Map<string, string>,
  campaignNames: Map<string, string>,
): Ad[] {
  const byId = indexBy(insights, r => r.adId);
  const prevById = indexBy(previous, r => r.adId);

  return entities.map(e => {
    const m = byId.get(e.id) ?? EMPTY;
    const p = prevById.get(e.id) ?? EMPTY;
    const c = e.creative ?? {};

    // Thumb-stop rate: how many people stopped scrolling long enough to trigger
    // a video play, as a share of impressions. Meaningless on static creative,
    // hence the guard rather than a fabricated number.
    const videoPlays = m.videoPlays ?? 0;
    const thumbStopRate = m.impressions > 0 && videoPlays > 0 ? (videoPlays / m.impressions) * 100 : 0;
    // Hook rate: of those who started, how many reached a ThruPlay.
    const hookRate = videoPlays > 0 && (m.thruPlays ?? 0) > 0 ? ((m.thruPlays ?? 0) / videoPlays) * 100 : 0;

    return {
      id: e.id,
      adSetId: e.adset_id ?? '',
      adSetName: adSetNames.get(e.adset_id ?? '') ?? m.adSetName ?? '',
      campaignName: campaignNames.get(e.campaign_id ?? '') ?? m.campaignName ?? '',
      name: e.name,
      status: toStatus(e),
      format: toFormat(c.object_type),
      thumbnail: c.thumbnail_url ?? '',
      spend: m.spend,
      purchases: m.purchases,
      revenue: m.revenue,
      roas: m.roas,
      cpa: m.cpa,
      ctr: m.ctr,
      thumbStopRate,
      videoPlays,
      videoWatchTime: m.videoWatchTime ?? 0,
      hookRate,
      outboundCtr: m.outboundCtr ?? 0,
      frequency: m.frequency,
      qualityRanking: toRanking(m.qualityRanking),
      engagementRanking: toRanking(m.engagementRanking),
      conversionRanking: toRanking(m.conversionRanking),
      impressions: m.impressions,
      reach: m.reach,
      headline: c.title ?? e.name,
      primaryText: c.body ?? '',
      cta: (c.call_to_action_type ?? 'LEARN_MORE').replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, ch => ch.toUpperCase()),
      trend: trendPct(m.roas, p.roas),
    };
  });
}

// --- Daily series ------------------------------------------------------------

/**
 * Daily rows -> the trend series. Meta omits days with no delivery entirely, so
 * the series can be shorter than the requested window; the charts handle that
 * because they plot by date rather than by index.
 */
export function mapTimeSeries(rows: NormalizedRow[]): TimeSeriesPoint[] {
  return rows
    .filter(r => r.date)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map(r => ({
      date: r.date!,
      spend: r.spend,
      purchases: r.purchases,
      revenue: r.revenue,
      roas: r.roas,
      cpa: r.cpa,
      ctr: r.ctr,
      cpm: r.cpm,
      cpc: r.cpc,
      frequency: r.frequency,
      impressions: r.impressions,
      clicks: r.linkClicks,
      landingPageViews: r.landingPageViews,
      addToCart: r.addToCart,
      initiateCheckout: r.initiateCheckout,
      reach: r.reach,
    }));
}

export { num };
