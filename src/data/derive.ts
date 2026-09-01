import type { TimeSeriesPoint, FunnelStep } from '../types';

/**
 * Account-level aggregates, computed over whichever daily series is supplied —
 * live Meta data or the bundled sample.
 *
 * These were originally bound to the sample series. Taking the series as an
 * argument is what lets the same maths serve both sources, and keeps the
 * "recompute ratios from summed counters" rule in one place.
 *
 * Callers pass a series covering **twice** the reporting window, because the
 * KPI cards compare the most recent `days` against the `days` before them.
 */

const sum = (arr: TimeSeriesPoint[], key: keyof TimeSeriesPoint) =>
  arr.reduce((acc, d) => acc + (d[key] as number), 0);

/** Guarded divide: an empty period is 0, never NaN or Infinity on screen. */
const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export interface KPIPair { value: number; previous: number }

export function computeAccountKPIs(series: TimeSeriesPoint[], days = 30) {
  const current = series.slice(-days);
  const previous = series.slice(-days * 2, -days);

  const cSpend = sum(current, 'spend');
  const cPurchases = sum(current, 'purchases');
  const cRevenue = sum(current, 'revenue');
  const cImpressions = sum(current, 'impressions');
  const cClicks = sum(current, 'clicks');
  const cLPV = sum(current, 'landingPageViews');
  const cATC = sum(current, 'addToCart');
  const cIC = sum(current, 'initiateCheckout');
  const cReach = sum(current, 'reach');

  const pSpend = sum(previous, 'spend');
  const pPurchases = sum(previous, 'purchases');
  const pRevenue = sum(previous, 'revenue');
  const pImpressions = sum(previous, 'impressions');
  const pClicks = sum(previous, 'clicks');
  const pLPV = sum(previous, 'landingPageViews');
  const pATC = sum(previous, 'addToCart');
  const pIC = sum(previous, 'initiateCheckout');
  const pReach = sum(previous, 'reach');

  return {
    spend: { value: cSpend, previous: pSpend },
    purchases: { value: cPurchases, previous: pPurchases },
    revenue: { value: cRevenue, previous: pRevenue },
    roas: { value: div(cRevenue, cSpend), previous: div(pRevenue, pSpend) },
    cpa: { value: div(cSpend, cPurchases), previous: div(pSpend, pPurchases) },
    cpm: { value: div(cSpend, cImpressions) * 1000, previous: div(pSpend, pImpressions) * 1000 },
    ctr: { value: div(cClicks, cImpressions) * 100, previous: div(pClicks, pImpressions) * 100 },
    cpc: { value: div(cSpend, cClicks), previous: div(pSpend, pClicks) },
    clicks: { value: cClicks, previous: pClicks },
    // Previous-period values for the funnel steps, which the original version
    // left at zero and so always rendered a 0% delta.
    landingPageViews: { value: cLPV, previous: pLPV },
    addToCart: { value: cATC, previous: pATC },
    initiateCheckout: { value: cIC, previous: pIC },
    costPerATC: { value: div(cSpend, cATC), previous: div(pSpend, pATC) },
    costPerCheckout: { value: div(cSpend, cIC), previous: div(pSpend, pIC) },
    // Frequency is impressions over reach for the whole period, not the mean of
    // daily frequencies — averaging ratios across days overweights quiet days.
    frequency: { value: div(cImpressions, cReach), previous: div(pImpressions, pReach) },
    reach: { value: cReach, previous: pReach },
    impressions: { value: cImpressions, previous: pImpressions },
  };
}

export type AccountKPIs = ReturnType<typeof computeAccountKPIs>;

export function computeFunnel(series: TimeSeriesPoint[], days = 30): FunnelStep[] {
  const recent = series.slice(-days);
  const s = (key: keyof TimeSeriesPoint) => sum(recent, key);

  const spend = s('spend');
  const impressions = s('impressions');
  const clicks = s('clicks');
  const lpv = s('landingPageViews');
  const atc = s('addToCart');
  const ic = s('initiateCheckout');
  const purchases = s('purchases');

  const step = (name: string, value: number, prev: number, cost: number): FunnelStep => {
    const rate = prev > 0 ? (value / prev) * 100 : 0;
    return { name, value, cost, conversionRate: rate, dropOff: prev > 0 ? 100 - rate : 0 };
  };

  return [
    { name: 'Impressions', value: impressions, cost: div(spend, impressions) * 1000, conversionRate: 100, dropOff: 0 },
    step('Link Clicks', clicks, impressions, div(spend, clicks)),
    step('Landing Page Views', lpv, clicks, div(spend, lpv)),
    step('Add to Cart', atc, lpv, div(spend, atc)),
    step('Initiate Checkout', ic, atc, div(spend, ic)),
    step('Purchase', purchases, ic, div(spend, purchases)),
  ];
}
