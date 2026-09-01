import type { Campaign, AdSet, Ad, CreativeElementStat } from '../types';
import { campaigns, adSets, ads } from './mockData';

/**
 * Ranking + diagnostics layer (§8 Top Performers, §9 Worst Performers,
 * §10 Creative Insights).
 *
 * Everything here is derived from the entity tables rather than hand-authored,
 * so the leaderboards and the waste report can never disagree with the tables
 * they are ranking.
 */

// --- Account benchmarks ------------------------------------------------------

export interface Benchmarks {
  roas: number;
  cpa: number;
  ctr: number;
  frequency: number;
  spend: number;
  purchases: number;
  revenue: number;
  aov: number;
}

/** Account averages, computed from summed counters (never averaged ratios). */
export const benchmarks: Benchmarks = (() => {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const purchases = campaigns.reduce((s, c) => s + c.purchases, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const reach = campaigns.reduce((s, c) => s + c.reach, 0);
  return {
    roas: spend > 0 ? revenue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    spend,
    purchases,
    revenue,
    aov: purchases > 0 ? revenue / purchases : 0,
  };
})();

/** ROAS the account has to clear to break even at the configured margin. */
export const TARGET_ROAS = 2.5;

// --- Top performers (§8) -----------------------------------------------------

export type RankMetric = 'roas' | 'purchases' | 'revenue' | 'cpa' | 'ctr';

export interface RankMetricDef {
  id: RankMetric;
  label: string;
  /** Lower values win for cost metrics. */
  ascending: boolean;
  format: 'multiplier' | 'number' | 'currency' | 'percent';
}

export const RANK_METRICS: RankMetricDef[] = [
  { id: 'roas', label: 'Highest ROAS', ascending: false, format: 'multiplier' },
  { id: 'purchases', label: 'Most Purchases', ascending: false, format: 'number' },
  { id: 'revenue', label: 'Most Revenue', ascending: false, format: 'currency' },
  { id: 'cpa', label: 'Lowest CPA', ascending: true, format: 'currency' },
  { id: 'ctr', label: 'Highest CTR', ascending: false, format: 'percent' },
];

export interface RankedEntity {
  id: string;
  name: string;
  subtitle: string;
  level: 'campaign' | 'adset' | 'ad';
  status: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  frequency: number;
  trend: number;
  /** Share of the account's total spend — how much of the account this row is. */
  spendShare: number;
  thumbnail?: string;
  format?: string;
}

function toRanked(level: 'campaign' | 'adset' | 'ad', e: Campaign | AdSet | Ad): RankedEntity {
  const anyE = e as Campaign & AdSet & Ad;
  const subtitle =
    level === 'campaign' ? (e as Campaign).objective.replace(/_/g, ' ')
    : level === 'adset' ? (e as AdSet).campaignName
    : `${(e as Ad).campaignName} - ${(e as Ad).format}`;
  return {
    id: e.id,
    name: e.name,
    subtitle,
    level,
    status: e.status,
    spend: anyE.spend,
    purchases: anyE.purchases,
    revenue: anyE.revenue,
    roas: anyE.roas,
    cpa: anyE.cpa,
    ctr: anyE.ctr,
    frequency: anyE.frequency,
    trend: anyE.trend,
    spendShare: benchmarks.spend > 0 ? anyE.spend / benchmarks.spend : 0,
    thumbnail: level === 'ad' ? (e as Ad).thumbnail : undefined,
    format: level === 'ad' ? (e as Ad).format : undefined,
  };
}

export const rankedCampaigns: RankedEntity[] = campaigns.map(c => toRanked('campaign', c));
export const rankedAdSets: RankedEntity[] = adSets.map(a => toRanked('adset', a));
export const rankedAds: RankedEntity[] = ads.map(a => toRanked('ad', a));

/**
 * Rank entities by a metric. Rows with no conversions are excluded from
 * cost-efficiency rankings — a CPA of 0 is missing data, not a perfect score,
 * and letting it sort first is the classic way a leaderboard lies.
 */
export function rankBy(
  rows: RankedEntity[],
  metric: RankMetric,
  limit = 10,
  { minPurchases = 1 }: { minPurchases?: number } = {},
): RankedEntity[] {
  const eligible = rows.filter(r => {
    if (metric === 'cpa' || metric === 'roas') return r.purchases >= minPurchases;
    return true;
  });
  const def = RANK_METRICS.find(m => m.id === metric)!;
  return [...eligible]
    .sort((a, b) => (def.ascending ? a[metric] - b[metric] : b[metric] - a[metric]))
    .slice(0, limit);
}

// --- Worst performers / waste (§9) -------------------------------------------

export type WasteKind =
  | 'ZERO_PURCHASE_SPEND'
  | 'LOW_ROAS'
  | 'HIGH_CPA'
  | 'HIGH_FREQUENCY'
  | 'CREATIVE_FATIGUE'
  | 'BUDGET_WASTE';

export interface WasteFinding {
  id: string;
  kind: WasteKind;
  severity: 'critical' | 'high' | 'medium';
  entity: RankedEntity;
  headline: string;
  detail: string;
  /** Spend this finding puts at risk over the period, in account currency. */
  wastedSpend: number;
  recommendedAction: string;
}

const SEVERITY_RANK: Record<WasteFinding['severity'], number> = { critical: 0, high: 1, medium: 2 };

/**
 * Fatigue signal: frequency climbing while CTR sits below the account average
 * and the trend is negative. Any one of those alone is noise; together they are
 * the standard read on a creative the audience has stopped responding to.
 *
 * Each component is normalised to 0..1 before weighting, and the weights sum to
 * 100 — so the score is a real 0-100 scale and an ad with healthy frequency and
 * above-average CTR cannot score high on a mild negative trend alone.
 */
function fatigueScore(e: RankedEntity): number {
  // Frequency only starts costing incremental conversions past ~2.0, and is
  // saturated by 4.0.
  const freqPressure = clamp01((e.frequency - 2.0) / 2.0);
  const ctrGap = clamp01((benchmarks.ctr - e.ctr) / Math.max(benchmarks.ctr, 0.01));
  // A 30% period-over-period decline is treated as a fully expressed signal.
  const decline = clamp01(-e.trend / 30);
  return Math.round(freqPressure * 45 + ctrGap * 30 + decline * 25);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function detectWaste(): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const all: RankedEntity[] = [...rankedCampaigns, ...rankedAdSets, ...rankedAds];

  for (const e of all) {
    // Spend with nothing to show for it.
    if (e.purchases === 0 && e.spend > 100) {
      findings.push({
        id: `waste-zero-${e.level}-${e.id}`,
        kind: 'ZERO_PURCHASE_SPEND',
        severity: 'critical',
        entity: e,
        headline: 'Spend with zero purchases',
        detail: `${formatMoney(e.spend)} spent with no recorded Purchase events. At the account CPA of ${formatMoney(benchmarks.cpa)} this budget should have produced roughly ${Math.floor(e.spend / benchmarks.cpa)} purchases.`,
        wastedSpend: e.spend,
        recommendedAction: 'Pause immediately and audit pixel / CAPI event delivery before relaunching.',
      });
      continue;
    }

    if (e.purchases > 0 && e.roas < TARGET_ROAS && e.spend > 300) {
      const breakEvenSpend = e.revenue / TARGET_ROAS;
      findings.push({
        id: `waste-roas-${e.level}-${e.id}`,
        kind: 'LOW_ROAS',
        severity: e.roas < TARGET_ROAS * 0.6 ? 'critical' : 'high',
        entity: e,
        headline: `ROAS ${e.roas.toFixed(2)} is below the ${TARGET_ROAS.toFixed(1)} target`,
        detail: `Returning ${e.roas.toFixed(2)}x against a ${TARGET_ROAS.toFixed(1)}x break-even target. The same revenue at target would have cost ${formatMoney(breakEvenSpend)}.`,
        wastedSpend: Math.max(0, e.spend - breakEvenSpend),
        recommendedAction: e.roas < TARGET_ROAS * 0.6
          ? 'Pause or cut budget by 50% and reallocate to top-quartile ad sets.'
          : 'Cut budget 25-30% and refresh the creative before spending further.',
      });
    }

    if (e.purchases > 0 && e.cpa > benchmarks.cpa * 1.4 && e.spend > 300) {
      findings.push({
        id: `waste-cpa-${e.level}-${e.id}`,
        kind: 'HIGH_CPA',
        severity: e.cpa > benchmarks.cpa * 1.9 ? 'critical' : 'high',
        entity: e,
        headline: `CPA ${formatMoney(e.cpa)} is ${(((e.cpa - benchmarks.cpa) / benchmarks.cpa) * 100).toFixed(0)}% above account average`,
        detail: `Account average CPA is ${formatMoney(benchmarks.cpa)}. This entity is paying ${formatMoney(e.cpa - benchmarks.cpa)} more per purchase across ${e.purchases} purchases.`,
        wastedSpend: (e.cpa - benchmarks.cpa) * e.purchases,
        recommendedAction: 'Tighten the audience or move budget to the placements already converting below average CPA.',
      });
    }

    if (e.frequency > 3) {
      findings.push({
        id: `waste-freq-${e.level}-${e.id}`,
        kind: 'HIGH_FREQUENCY',
        severity: e.frequency > 4 ? 'critical' : 'medium',
        entity: e,
        headline: `Frequency at ${e.frequency.toFixed(2)}`,
        detail: `Each reached person has seen this ${e.frequency.toFixed(2)} times. Above 3.0 incremental purchases fall off sharply while CPM keeps rising.`,
        // Above frequency 3 roughly the excess share of delivery stops paying back.
        wastedSpend: e.spend * Math.min(0.4, (e.frequency - 3) / 10),
        recommendedAction: 'Expand the audience or rotate in fresh creative to reset frequency.',
      });
    }

    if (e.level === 'ad') {
      const score = fatigueScore(e);
      if (score >= 45) {
        findings.push({
          id: `waste-fatigue-${e.level}-${e.id}`,
          kind: 'CREATIVE_FATIGUE',
          severity: score >= 65 ? 'high' : 'medium',
          entity: e,
          headline: `Creative fatigue score ${score}/100`,
          detail: `Frequency ${e.frequency.toFixed(2)} with CTR ${e.ctr.toFixed(2)}% against a ${benchmarks.ctr.toFixed(2)}% account average, trending ${e.trend >= 0 ? '+' : ''}${e.trend.toFixed(1)}%.`,
          wastedSpend: e.spend * (score / 400),
          recommendedAction: 'Refresh the hook and first three seconds, then relaunch as a new ad to reset delivery.',
        });
      }
    }
  }

  // Budget concentrated in campaigns that under-return: allocation waste.
  for (const c of campaigns) {
    const share = benchmarks.spend > 0 ? c.spend / benchmarks.spend : 0;
    if (share > 0.15 && c.roas < benchmarks.roas * 0.85 && c.purchases > 0) {
      const entity = rankedCampaigns.find(r => r.id === c.id)!;
      findings.push({
        id: `waste-alloc-${c.id}`,
        kind: 'BUDGET_WASTE',
        severity: 'high',
        entity,
        headline: `${(share * 100).toFixed(0)}% of account spend at below-average ROAS`,
        detail: `This campaign holds ${(share * 100).toFixed(0)}% of budget while returning ${c.roas.toFixed(2)}x against the ${benchmarks.roas.toFixed(2)}x account average. Moving spend to top-quartile campaigns is the single largest available gain.`,
        wastedSpend: c.spend * (1 - c.roas / benchmarks.roas),
        recommendedAction: 'Shift 20-30% of this budget into the top three campaigns by ROAS.',
      });
    }
  }

  return findings.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return s !== 0 ? s : b.wastedSpend - a.wastedSpend;
  });
}

export const wasteFindings: WasteFinding[] = detectWaste();

export const totalWastedSpend: number = (() => {
  // One entity can trigger several findings; count its worst finding only so the
  // headline number stays a real recoverable figure rather than a double count.
  const worstPerEntity = new Map<string, number>();
  for (const f of wasteFindings) {
    const key = `${f.entity.level}-${f.entity.id}`;
    worstPerEntity.set(key, Math.max(worstPerEntity.get(key) ?? 0, f.wastedSpend));
  }
  return [...worstPerEntity.values()].reduce((s, v) => s + v, 0);
})();

export const fatigueRanking: (RankedEntity & { fatigueScore: number })[] = rankedAds
  .map(a => ({ ...a, fatigueScore: fatigueScore(a) }))
  .sort((a, b) => b.fatigueScore - a.fatigueScore);

// --- Creative insights (§10) -------------------------------------------------

/** Aggregate ads by a creative attribute, recomputing ratios from counters. */
function groupCreative(
  kind: CreativeElementStat['kind'],
  key: (a: Ad) => string,
  minAds = 1,
): CreativeElementStat[] {
  const groups = new Map<string, Ad[]>();
  for (const a of ads) {
    const k = key(a);
    if (!k) continue;
    const arr = groups.get(k) ?? [];
    arr.push(a);
    groups.set(k, arr);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= minAds)
    .map(([value, list]) => {
      const spend = list.reduce((s, a) => s + a.spend, 0);
      const revenue = list.reduce((s, a) => s + a.revenue, 0);
      const purchases = list.reduce((s, a) => s + a.purchases, 0);
      const impressions = list.reduce((s, a) => s + a.impressions, 0);
      // CTR is stored per ad, so reconstruct clicks before re-averaging.
      const clicks = list.reduce((s, a) => s + a.impressions * (a.ctr / 100), 0);
      return {
        value,
        kind,
        ads: list.length,
        spend,
        purchases,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: purchases > 0 ? spend / purchases : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      };
    })
    .sort((a, b) => b.roas - a.roas);
}

export const formatStats: CreativeElementStat[] = groupCreative('format', a => a.format);
export const headlineStats: CreativeElementStat[] = groupCreative('headline', a => a.headline);
export const primaryTextStats: CreativeElementStat[] = groupCreative('primaryText', a => a.primaryText);
export const ctaStats: CreativeElementStat[] = groupCreative('cta', a => a.cta);

export const winningImages: Ad[] = ads
  .filter(a => a.format === 'IMAGE' || a.format === 'CAROUSEL')
  .sort((a, b) => b.roas - a.roas);

export const winningVideos: Ad[] = ads
  .filter(a => a.format === 'VIDEO')
  .sort((a, b) => b.roas - a.roas);

export interface FormatComparison {
  label: string;
  left: CreativeElementStat | undefined;
  right: CreativeElementStat | undefined;
}

export const formatComparisons: FormatComparison[] = [
  {
    label: 'Video vs Image',
    left: formatStats.find(f => f.value === 'VIDEO'),
    right: formatStats.find(f => f.value === 'IMAGE'),
  },
  {
    label: 'Carousel vs Single Image',
    left: formatStats.find(f => f.value === 'CAROUSEL'),
    right: formatStats.find(f => f.value === 'IMAGE'),
  },
];

export const bestFormat: CreativeElementStat | undefined = [...formatStats]
  // Judge "best" on ROAS but require the format to carry real spend behind it.
  .filter(f => f.spend > benchmarks.spend * 0.05)
  .sort((a, b) => b.roas - a.roas)[0];

// --- shared -----------------------------------------------------------------

function formatMoney(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { fatigueScore };
