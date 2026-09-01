import type { Campaign, AdSet, Ad, GlobalFilters, FilterKey } from '../types';
import { campaigns, adSets, ads, geoData, placementData } from '../data/mockData';

/**
 * Filter selectors (§18).
 *
 * The filters form a hierarchy: a campaign survives if it still owns a surviving
 * ad set, and an ad survives if its ad set does. Targeting filters (age, gender,
 * placement, country) are evaluated against the ad set — the level Meta actually
 * stores targeting on — and then propagate up to campaigns and down to ads.
 */

export const DEFAULT_FILTERS: GlobalFilters = {
  days: 30,
  campaigns: [],
  adSets: [],
  ads: [],
  countries: [],
  placements: [],
  devices: [],
  ages: [],
  genders: [],
  objectives: [],
  statuses: [],
};

export interface FilterOption {
  value: string;
  label: string;
  meta?: string;
}

export interface FilterDef {
  key: FilterKey;
  label: string;
  options: FilterOption[];
  /**
   * Some Meta breakdowns (device) exist only on the insights endpoint and have
   * no entity-level field to filter, so they scope the breakdown views only.
   */
  scope: 'entity' | 'breakdown';
}

const AGE_BRACKETS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

/** Does an ad set's [ageMin, ageMax] target overlap a bracket like "25-34"? */
function bracketOverlaps(bracket: string, min: number, max: number): boolean {
  const [lo, hi] = bracket.endsWith('+')
    ? [parseInt(bracket, 10), 200]
    : bracket.split('-').map(n => parseInt(n, 10));
  return min <= hi && max >= lo;
}

export const FILTER_DEFS: FilterDef[] = [
  {
    key: 'campaigns',
    label: 'Campaign',
    scope: 'entity',
    options: campaigns.map(c => ({ value: c.id, label: c.name, meta: c.status })),
  },
  {
    key: 'adSets',
    label: 'Ad Set',
    scope: 'entity',
    options: adSets.map(a => ({ value: a.id, label: a.name, meta: a.campaignName })),
  },
  {
    key: 'ads',
    label: 'Ad',
    scope: 'entity',
    options: ads.map(a => ({ value: a.id, label: a.name, meta: a.format })),
  },
  {
    key: 'objectives',
    label: 'Objective',
    scope: 'entity',
    options: [...new Set(campaigns.map(c => c.objective))].map(o => ({
      value: o,
      label: o.replace(/^OUTCOME_/, '').replace(/_/g, ' '),
    })),
  },
  {
    key: 'statuses',
    label: 'Status',
    scope: 'entity',
    options: [...new Set(campaigns.map(c => c.status))].map(s => ({
      value: s,
      label: s.charAt(0) + s.slice(1).toLowerCase(),
    })),
  },
  {
    key: 'countries',
    label: 'Country',
    scope: 'entity',
    options: geoData.map(g => ({ value: g.country, label: g.country, meta: g.countryCode })),
  },
  {
    key: 'placements',
    label: 'Placement',
    scope: 'entity',
    options: placementData.map(p => ({ value: p.placement, label: p.placement, meta: p.platform })),
  },
  {
    key: 'ages',
    label: 'Age',
    scope: 'entity',
    options: AGE_BRACKETS.map(a => ({ value: a, label: a })),
  },
  {
    key: 'genders',
    label: 'Gender',
    scope: 'entity',
    options: [
      { value: 'ALL', label: 'All genders' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'MALE', label: 'Male' },
    ],
  },
  {
    key: 'devices',
    label: 'Device',
    scope: 'breakdown',
    options: [
      { value: 'Mobile App', label: 'Mobile App' },
      { value: 'Mobile Web', label: 'Mobile Web' },
      { value: 'Desktop', label: 'Desktop' },
      { value: 'Tablet', label: 'Tablet' },
    ],
  },
];

const any = (selected: string[]) => selected.length === 0;

/** Ad-set level predicate: targeting, identity and inherited campaign filters. */
function adSetMatches(a: AdSet, f: GlobalFilters, allowedCampaignIds: Set<string> | null): boolean {
  if (allowedCampaignIds && !allowedCampaignIds.has(a.campaignId)) return false;
  if (!any(f.adSets) && !f.adSets.includes(a.id)) return false;
  if (!any(f.statuses) && !f.statuses.includes(a.status)) return false;
  if (!any(f.placements) && !f.placements.some(p => a.placement.includes(p))) return false;
  if (!any(f.countries) && !f.countries.some(c => a.location.includes(c))) return false;
  if (!any(f.ages) && !f.ages.some(b => bracketOverlaps(b, a.ageMin, a.ageMax))) return false;
  // An "All genders" ad set is reached by a Female or Male filter too.
  if (!any(f.genders) && !f.genders.includes(a.gender) && a.gender !== 'ALL') return false;
  return true;
}

export interface FilteredData {
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
}

export function applyFilters(f: GlobalFilters): FilteredData {
  // 1. Campaign-level attributes first.
  const campaignPool = campaigns.filter(c => {
    if (!any(f.campaigns) && !f.campaigns.includes(c.id)) return false;
    if (!any(f.objectives) && !f.objectives.includes(c.objective)) return false;
    if (!any(f.statuses) && !f.statuses.includes(c.status)) return false;
    return true;
  });
  const campaignIds = new Set(campaignPool.map(c => c.id));

  // 2. Ad sets, constrained by the surviving campaigns plus targeting filters.
  const filteredAdSets = adSets.filter(a => adSetMatches(a, f, campaignIds));
  const adSetIds = new Set(filteredAdSets.map(a => a.id));

  // 3. Ads inherit their ad set, and can be narrowed further by name/status.
  const filteredAds = ads.filter(ad => {
    if (!adSetIds.has(ad.adSetId)) return false;
    if (!any(f.ads) && !f.ads.includes(ad.id)) return false;
    if (!any(f.statuses) && !f.statuses.includes(ad.status)) return false;
    return true;
  });

  // 4. Drop campaigns whose ad sets were all filtered out, so totals reconcile
  //    across the three levels instead of a campaign row with no children.
  const survivingCampaignIds = new Set(filteredAdSets.map(a => a.campaignId));
  const targetingActive =
    !any(f.placements) || !any(f.countries) || !any(f.ages) || !any(f.genders) || !any(f.adSets) || !any(f.ads);
  const filteredCampaigns = targetingActive
    ? campaignPool.filter(c => survivingCampaignIds.has(c.id))
    : campaignPool;

  return { campaigns: filteredCampaigns, adSets: filteredAdSets, ads: filteredAds };
}

/** How many filter groups are currently narrowing the view. */
export function activeFilterCount(f: GlobalFilters): number {
  return (Object.keys(f) as (keyof GlobalFilters)[]).reduce((n, k) => {
    if (k === 'days') return n;
    return n + ((f[k] as string[]).length > 0 ? 1 : 0);
  }, 0);
}

/** Roll a set of entities into the account-level counters and ratios. */
export function summarize(rows: { spend: number; revenue: number; purchases: number; impressions: number; clicks?: number; reach: number }[]) {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const purchases = rows.reduce((s, r) => s + r.purchases, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const reach = rows.reduce((s, r) => s + r.reach, 0);
  return {
    spend,
    revenue,
    purchases,
    impressions,
    clicks,
    reach,
    roas: spend > 0 ? revenue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    aov: purchases > 0 ? revenue / purchases : 0,
  };
}
