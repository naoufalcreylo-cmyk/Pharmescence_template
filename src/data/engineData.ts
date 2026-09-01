import { campaigns, adSets, ads, getAccountKPIs, timeSeriesData } from './mockData';
import type {
  BudgetRecommendation, KPIRatio, AccountScore,
  ScoreDimension, RecommendationType, RiskLevel, RatioStatus
} from '../types';

// ─── Recommendation Engine ────────────────────────────────────────────────────

const ROAS_TARGET = 2.5;
const CPA_TARGET = 30;
const FREQ_THRESHOLD = 3.0;

type Signal =
  | 'roas_excellent' | 'roas_good' | 'roas_ok' | 'roas_poor' | 'roas_critical'
  | 'cpa_excellent' | 'cpa_good' | 'cpa_poor'
  | 'freq_low' | 'freq_ok' | 'freq_high' | 'freq_critical'
  | 'trend_strong_up' | 'trend_up' | 'trend_flat' | 'trend_down' | 'trend_crash'
  | 'spend_low' | 'spend_high'
  | 'status_paused';

function classifySignals(
  roas: number, cpa: number, freq: number, trend: number,
  spend: number, status: string
): Signal[] {
  const s: Signal[] = [];
  if (status !== 'ACTIVE') s.push('status_paused');
  if (roas >= 4.5) s.push('roas_excellent');
  else if (roas >= 3.0) s.push('roas_good');
  else if (roas >= 2.0) s.push('roas_ok');
  else if (roas >= 1.5) s.push('roas_poor');
  else s.push('roas_critical');
  if (cpa < 20) s.push('cpa_excellent');
  else if (cpa < 32) s.push('cpa_good');
  else s.push('cpa_poor');
  if (freq < 2.0) s.push('freq_low');
  else if (freq < 3.0) s.push('freq_ok');
  else if (freq < 4.0) s.push('freq_high');
  else s.push('freq_critical');
  if (trend > 12) s.push('trend_strong_up');
  else if (trend > 0) s.push('trend_up');
  else if (trend > -10) s.push('trend_flat');
  else if (trend > -25) s.push('trend_down');
  else s.push('trend_crash');
  if (spend < 2000) s.push('spend_low');
  else s.push('spend_high');
  return s;
}

function deriveRecommendation(signals: Signal[]): {
  rec: RecommendationType;
  secondary?: RecommendationType;
  confidence: number;
  riskLevel: RiskLevel;
  budgetChangePct: number;
} {
  const has = (...s: Signal[]) => s.every(x => signals.includes(x));
  const any = (...s: Signal[]) => s.some(x => signals.includes(x));

  // Pause — critical cases
  if (has('roas_critical') && any('spend_high')) {
    return { rec: 'PAUSE', confidence: 96, riskLevel: 'low', budgetChangePct: -100 };
  }
  if (has('roas_critical')) {
    return { rec: 'PAUSE', confidence: 88, riskLevel: 'low', budgetChangePct: -100 };
  }
  if (has('roas_poor') && has('trend_crash')) {
    return { rec: 'PAUSE', confidence: 82, riskLevel: 'low', budgetChangePct: -100 };
  }
  // Creative fatigue — refresh first
  if (has('freq_critical') && any('roas_excellent', 'roas_good')) {
    return { rec: 'REFRESH_CREATIVE', secondary: 'DUPLICATE', confidence: 90, riskLevel: 'medium', budgetChangePct: 0 };
  }
  if (has('freq_high') && any('roas_poor', 'trend_down', 'trend_crash')) {
    return { rec: 'PAUSE', confidence: 78, riskLevel: 'low', budgetChangePct: -100 };
  }
  if (has('freq_high')) {
    return { rec: 'REFRESH_CREATIVE', confidence: 85, riskLevel: 'medium', budgetChangePct: 0 };
  }
  // Scale up — excellent performance
  if (has('roas_excellent') && has('cpa_excellent') && has('freq_low') && any('trend_strong_up', 'trend_up')) {
    return { rec: 'SCALE_VERTICAL', secondary: 'INCREASE_BUDGET', confidence: 94, riskLevel: 'low', budgetChangePct: 35 };
  }
  if (has('roas_excellent') && has('freq_low') && any('trend_strong_up', 'trend_up')) {
    return { rec: 'INCREASE_BUDGET', confidence: 91, riskLevel: 'low', budgetChangePct: 30 };
  }
  if (has('roas_excellent') && has('freq_ok') && any('trend_strong_up', 'trend_up')) {
    return { rec: 'INCREASE_BUDGET', secondary: 'DUPLICATE', confidence: 85, riskLevel: 'medium', budgetChangePct: 20 };
  }
  // Good ROAS, scale moderately
  if (has('roas_good') && has('freq_low') && any('trend_strong_up', 'trend_up')) {
    return { rec: 'INCREASE_BUDGET', confidence: 82, riskLevel: 'low', budgetChangePct: 20 };
  }
  if (has('roas_good') && has('freq_low') && has('trend_flat')) {
    return { rec: 'INCREASE_BUDGET', confidence: 72, riskLevel: 'medium', budgetChangePct: 15 };
  }
  if (has('roas_good') && has('cpa_excellent') && any('trend_strong_up')) {
    return { rec: 'SCALE_HORIZONTAL', secondary: 'DUPLICATE', confidence: 80, riskLevel: 'medium', budgetChangePct: 25 };
  }
  // Duplicate into new audiences
  if (has('roas_good') && any('freq_ok', 'freq_high') && any('trend_up', 'trend_flat')) {
    return { rec: 'DUPLICATE', secondary: 'EXPAND_AUDIENCE', confidence: 76, riskLevel: 'medium', budgetChangePct: 0 };
  }
  // OK ROAS, declining trend
  if (has('roas_ok') && has('trend_down')) {
    return { rec: 'DECREASE_BUDGET', confidence: 72, riskLevel: 'medium', budgetChangePct: -20 };
  }
  if (has('roas_ok') && has('trend_crash')) {
    return { rec: 'DECREASE_BUDGET', secondary: 'TEST_NEW_CREATIVE', confidence: 80, riskLevel: 'medium', budgetChangePct: -30 };
  }
  // OK ROAS, stable
  if (has('roas_ok') && any('trend_flat', 'trend_up')) {
    return { rec: 'KEEP_STABLE', secondary: 'TEST_NEW_CREATIVE', confidence: 68, riskLevel: 'low', budgetChangePct: 0 };
  }
  // Poor ROAS
  if (has('roas_poor') && has('cpa_poor')) {
    return { rec: 'DECREASE_BUDGET', secondary: 'NARROW_AUDIENCE', confidence: 78, riskLevel: 'medium', budgetChangePct: -25 };
  }
  // Default
  return { rec: 'KEEP_STABLE', confidence: 60, riskLevel: 'low', budgetChangePct: 0 };
}

function buildReason(
  name: string, roas: number, cpa: number, freq: number, trend: number,
  rec: RecommendationType, signals: Signal[]
): string {
  const has = (s: Signal) => signals.includes(s);
  const parts: string[] = [];

  if (has('roas_excellent'))
    parts.push(`ROAS of ${roas.toFixed(2)}x is well above the ${ROAS_TARGET}x target (+${(((roas - ROAS_TARGET) / ROAS_TARGET) * 100).toFixed(0)}%)`);
  else if (has('roas_good'))
    parts.push(`ROAS of ${roas.toFixed(2)}x exceeds the ${ROAS_TARGET}x target`);
  else if (has('roas_ok'))
    parts.push(`ROAS of ${roas.toFixed(2)}x is below the ${ROAS_TARGET}x target`);
  else if (has('roas_poor'))
    parts.push(`ROAS of ${roas.toFixed(2)}x is significantly below break-even`);
  else
    parts.push(`ROAS of ${roas.toFixed(2)}x is critically low — spending more than generating`);

  if (has('cpa_excellent'))
    parts.push(`CPA of $${cpa.toFixed(2)} is ${(((CPA_TARGET - cpa) / CPA_TARGET) * 100).toFixed(0)}% below the $${CPA_TARGET} target`);
  else if (has('cpa_good'))
    parts.push(`CPA of $${cpa.toFixed(2)} is within acceptable range`);
  else
    parts.push(`CPA of $${cpa.toFixed(2)} exceeds the $${CPA_TARGET} target`);

  if (has('freq_low'))
    parts.push(`Frequency is healthy at ${freq.toFixed(2)} — room to scale without creative fatigue`);
  else if (has('freq_ok'))
    parts.push(`Frequency of ${freq.toFixed(2)} is approaching caution zone`);
  else if (has('freq_high'))
    parts.push(`Frequency of ${freq.toFixed(2)} is above 3.0 — signs of creative fatigue detected`);
  else
    parts.push(`Frequency of ${freq.toFixed(2)} is critically high — severe audience saturation`);

  if (has('trend_strong_up'))
    parts.push(`Performance trend is strongly positive (+${trend.toFixed(1)}% vs prior period)`);
  else if (has('trend_up'))
    parts.push(`Performance trend is positive (+${trend.toFixed(1)}% vs prior period)`);
  else if (has('trend_flat'))
    parts.push(`Performance is stable (${trend.toFixed(1)}% change vs prior period)`);
  else if (has('trend_down'))
    parts.push(`Performance is declining (${trend.toFixed(1)}% vs prior period) — monitoring required`);
  else
    parts.push(`Performance has crashed (${trend.toFixed(1)}% vs prior period) — urgent action needed`);

  return parts.join('. ') + '.';
}

function buildImpact(
  rec: RecommendationType, budgetChangePct: number,
  currentBudget: number, roas: number, spend: number, purchases: number
): { impact: string; addPurchases: number; addRevenue: number; estRoas: number } {
  if (rec === 'PAUSE') {
    return { impact: `Save ~$${currentBudget}/day in budget. Reallocate to better-performing campaigns.`, addPurchases: 0, addRevenue: 0, estRoas: 0 };
  }
  if (rec === 'REFRESH_CREATIVE') {
    const estImprovement = 0.15;
    const addRev = spend * roas * estImprovement;
    const addPurch = Math.round(purchases * estImprovement);
    return { impact: `New creative expected to recover CTR and reduce CPA by ~15–20%.`, addPurchases: addPurch, addRevenue: addRev, estRoas: roas * 1.08 };
  }
  if (rec === 'KEEP_STABLE' || budgetChangePct === 0) {
    return { impact: `Maintain current performance. Monitor for 3–5 days before any changes.`, addPurchases: 0, addRevenue: 0, estRoas: roas };
  }
  if (budgetChangePct < 0) {
    const budgetReduction = Math.abs(budgetChangePct) / 100;
    const savedSpend = spend * budgetReduction;
    return { impact: `Save ~$${savedSpend.toFixed(0)}/month. Reduce exposure on underperforming segment.`, addPurchases: 0, addRevenue: 0, estRoas: roas * 0.95 };
  }
  // Scale up
  const scaleFactor = budgetChangePct / 100;
  const efficiency = 0.85; // 85% efficiency when scaling
  const addPurch = Math.round(purchases * scaleFactor * efficiency);
  const addRev = spend * roas * scaleFactor * efficiency;
  const estRoas = roas * (0.92 + Math.random() * 0.06); // slight ROAS compression when scaling
  return {
    impact: `+${addPurch} purchases, +$${addRev.toFixed(0)} revenue at estimated ${estRoas.toFixed(2)}x ROAS.`,
    addPurchases: addPurch,
    addRevenue: addRev,
    estRoas: parseFloat(estRoas.toFixed(2)),
  };
}

export function generateCampaignRecommendations(): BudgetRecommendation[] {
  return campaigns.map(c => {
    const signals = classifySignals(c.roas, c.cpa, c.frequency, c.trend, c.spend, c.status);
    const { rec, secondary, confidence, riskLevel, budgetChangePct } = deriveRecommendation(signals);
    const reason = buildReason(c.name, c.roas, c.cpa, c.frequency, c.trend, rec, signals);
    const suggestedBudget = rec === 'PAUSE' ? 0 :
      Math.round(c.budget * (1 + budgetChangePct / 100) / 5) * 5;
    const { impact, addPurchases, addRevenue, estRoas } = buildImpact(
      rec, budgetChangePct, c.budget, c.roas, c.spend, c.purchases
    );
    return {
      id: `cr-${c.id}`,
      entityId: c.id,
      entityName: c.name,
      entityType: 'campaign',
      recommendation: rec,
      secondaryRecommendation: secondary,
      confidence,
      reason,
      signals: signals as string[],
      riskLevel,
      budgetChangePct,
      currentDailyBudget: c.budget,
      suggestedDailyBudget: suggestedBudget,
      estimatedAdditionalPurchases: addPurchases,
      estimatedAdditionalRevenue: addRevenue,
      estimatedROAS: estRoas,
      expectedImpact: impact,
      currentROAS: c.roas,
      currentCPA: c.cpa,
      currentFrequency: c.frequency,
      currentSpend: c.spend,
      performanceTrend: c.trend,
      status: c.status,
    };
  });
}

export function generateAdSetRecommendations(): BudgetRecommendation[] {
  return adSets.map(a => {
    const signals = classifySignals(a.roas, a.cpa, a.frequency, a.trend, a.spend, a.status);
    const { rec, secondary, confidence, riskLevel, budgetChangePct } = deriveRecommendation(signals);
    const reason = buildReason(a.name, a.roas, a.cpa, a.frequency, a.trend, rec, signals);
    const suggestedBudget = rec === 'PAUSE' ? 0 :
      Math.round(a.budget * (1 + budgetChangePct / 100) / 5) * 5;
    const { impact, addPurchases, addRevenue, estRoas } = buildImpact(
      rec, budgetChangePct, a.budget, a.roas, a.spend, a.purchases
    );
    return {
      id: `ar-${a.id}`,
      entityId: a.id,
      entityName: a.name,
      entityType: 'adset',
      recommendation: rec,
      secondaryRecommendation: secondary,
      confidence,
      reason,
      signals: signals as string[],
      riskLevel,
      budgetChangePct,
      currentDailyBudget: a.budget,
      suggestedDailyBudget: suggestedBudget,
      estimatedAdditionalPurchases: addPurchases,
      estimatedAdditionalRevenue: addRevenue,
      estimatedROAS: estRoas,
      expectedImpact: impact,
      currentROAS: a.roas,
      currentCPA: a.cpa,
      currentFrequency: a.frequency,
      currentSpend: a.spend,
      performanceTrend: a.trend,
      status: a.status,
    };
  });
}

export function generateAdRecommendations(): BudgetRecommendation[] {
  return ads.map(ad => {
    // For ads, derive CPA-proxy and adjust logic
    const adFreq = ad.frequency;
    const adTrend = ad.trend;
    // Quality signal boost/penalty
    const qualityBonus =
      (ad.qualityRanking === 'ABOVE_AVERAGE' ? 0.3 : ad.qualityRanking === 'BELOW_AVERAGE' ? -0.5 : 0) +
      (ad.conversionRanking === 'ABOVE_AVERAGE' ? 0.3 : ad.conversionRanking === 'BELOW_AVERAGE' ? -0.5 : 0);
    const adjustedRoas = ad.roas + qualityBonus;

    const signals = classifySignals(adjustedRoas, ad.cpa, adFreq, adTrend, ad.spend, ad.status);

    // Below-average rankings always push toward refresh/pause
    if (ad.qualityRanking === 'BELOW_AVERAGE' && ad.conversionRanking === 'BELOW_AVERAGE' && !signals.includes('roas_excellent')) {
      const reason = `All ad rankings are below average (Quality: Below Average, Conversion: Below Average). CTR of ${ad.ctr.toFixed(2)}% and ROAS of ${ad.roas.toFixed(2)}x indicate poor creative-audience fit. Facebook's algorithm is actively suppressing this ad.`;
      return {
        id: `adr-${ad.id}`,
        entityId: ad.id,
        entityName: ad.name,
        entityType: 'ad',
        recommendation: 'PAUSE' as const,
        secondaryRecommendation: 'TEST_NEW_CREATIVE' as const,
        confidence: 92,
        reason,
        signals: signals as string[],
        riskLevel: 'low' as const,
        budgetChangePct: -100,
        currentDailyBudget: 0,
        suggestedDailyBudget: 0,
        estimatedAdditionalPurchases: 0,
        estimatedAdditionalRevenue: 0,
        estimatedROAS: 0,
        expectedImpact: 'Pause immediately. Reallocate budget to above-average ads. Test new creative within 3 days.',
        currentROAS: ad.roas,
        currentCPA: ad.cpa,
        currentFrequency: adFreq,
        currentSpend: ad.spend,
        performanceTrend: adTrend,
        status: ad.status,
      };
    }

    const { rec, secondary, confidence, riskLevel, budgetChangePct } = deriveRecommendation(signals);
    const reason = buildReason(ad.name, ad.roas, ad.cpa, adFreq, adTrend, rec, signals);
    const { impact, addPurchases, addRevenue, estRoas } = buildImpact(
      rec, budgetChangePct, 50, ad.roas, ad.spend, ad.purchases
    );

    // Add video-specific signal to reason
    let fullReason = reason;
    if (ad.format === 'VIDEO') {
      if (ad.thumbStopRate > 35) fullReason += ` Thumb stop rate of ${ad.thumbStopRate.toFixed(1)}% is strong.`;
      else if (ad.thumbStopRate > 0) fullReason += ` Thumb stop rate of ${ad.thumbStopRate.toFixed(1)}% needs improvement — test new hook.`;
    }

    return {
      id: `adr-${ad.id}`,
      entityId: ad.id,
      entityName: ad.name,
      entityType: 'ad',
      recommendation: rec,
      secondaryRecommendation: secondary,
      confidence,
      reason: fullReason,
      signals: signals as string[],
      riskLevel,
      budgetChangePct,
      currentDailyBudget: 0,
      suggestedDailyBudget: 0,
      estimatedAdditionalPurchases: addPurchases,
      estimatedAdditionalRevenue: addRevenue,
      estimatedROAS: estRoas,
      expectedImpact: impact,
      currentROAS: ad.roas,
      currentCPA: ad.cpa,
      currentFrequency: adFreq,
      currentSpend: ad.spend,
      performanceTrend: adTrend,
      status: ad.status,
    };
  });
}

// ─── KPI Ratios Engine ────────────────────────────────────────────────────────

function getStatus(value: number, benchmark: number, higherIsBetter: boolean, excellentPct = 0.2, poorPct = -0.2): RatioStatus {
  const delta = (value - benchmark) / benchmark;
  if (higherIsBetter) {
    if (delta >= excellentPct) return 'excellent';
    if (delta >= 0) return 'good';
    if (delta >= poorPct) return 'average';
    return 'poor';
  } else {
    if (delta <= -excellentPct) return 'excellent';
    if (delta <= 0) return 'good';
    if (delta <= Math.abs(poorPct)) return 'average';
    return 'poor';
  }
}

export function computeRatios(days = 30): KPIRatio[] {
  const kpis = getAccountKPIs(days);
  const kpis7 = getAccountKPIs(7);
  const kpis14 = getAccountKPIs(14);
  const recent = timeSeriesData.slice(-days);
  const prev = timeSeriesData.slice(-days * 2, -days);

  const sumR = (key: keyof typeof recent[0]) => recent.reduce((a, d) => a + (d[key] as number), 0);
  const sumP = (key: keyof typeof recent[0]) => prev.reduce((a, d) => a + (d[key] as number), 0);

  const spend = kpis.spend.value;
  const revenue = kpis.revenue.value;
  const purchases = kpis.purchases.value;
  const impressions = kpis.impressions.value;
  const clicks = kpis.clicks.value;
  const lpv = kpis.landingPageViews.value;
  const atc = kpis.addToCart.value;
  const ic = kpis.initiateCheckout.value;
  const roas = kpis.roas.value;
  const cpa = kpis.cpa.value;
  const cpm = kpis.cpm.value;
  const ctr = kpis.ctr.value;
  const cpc = kpis.cpc.value;
  const freq = kpis.frequency.value;

  const pSpend = kpis.spend.previous;
  const pRevenue = kpis.revenue.previous;
  const pPurchases = kpis.purchases.previous;
  const pImpressions = kpis.impressions.previous;
  const pClicks = kpis.clicks.previous;

  // Velocity (7-day vs 14-day)
  const spendVelocity = ((kpis7.spend.value / 7) / (kpis14.spend.value / 14) - 1) * 100;
  const revenueVelocity = ((kpis7.revenue.value / 7) / (kpis14.revenue.value / 14) - 1) * 100;
  const purchaseVelocity = ((kpis7.purchases.value / 7) / (kpis14.purchases.value / 14) - 1) * 100;

  // Budget utilization: sum of daily spend vs sum of daily budget caps
  const totalDailyBudgetCap = 1500; // sum of all active campaign budgets
  const avgDailySpend = spend / days;
  const budgetUtilization = (avgDailySpend / totalDailyBudgetCap) * 100;

  // Creative fatigue: weighted avg frequency vs 3.0 threshold
  const activeCampaignAvgFreq = 2.08; // weighted avg of active campaigns
  const creativeFatigueScore = Math.max(0, Math.min(100, (activeCampaignAvgFreq / 3.0) * 100));

  // Audience saturation: based on frequency of top ad sets
  const audienceSatScore = Math.max(0, Math.min(100, (freq / 4.0) * 100));

  // Reach efficiency = unique people reached / impressions
  const reach = kpis.reach.value;
  const reachEfficiency = (reach / impressions) * 100;

  // Health scores
  const healthScore = computeAccountScore(days).overall;
  const scalingScore = Math.round(
    (roas >= 4 ? 30 : roas >= 3 ? 20 : roas >= 2 ? 10 : 0) +
    (freq < 2 ? 20 : freq < 2.5 ? 15 : freq < 3 ? 10 : 0) +
    (spendVelocity > 5 ? 20 : spendVelocity > 0 ? 15 : 10) +
    (atc / lpv > 0.15 ? 30 : atc / lpv > 0.10 ? 20 : 10)
  );
  const profitabilityScore = Math.round(
    Math.min(100, Math.max(0, (roas / 4.0) * 60 + (1 - cpa / 50) * 40))
  );
  const opportunityScore = Math.round(
    Math.min(100, (roas < 3 ? 30 : 10) + (freq < 2 ? 30 : 15) + (spend / 50000 * 20) + 20)
  );
  const riskScore = Math.round(
    Math.min(100, (freq > 3 ? 30 : freq > 2.5 ? 15 : 5) +
    (roas < 2 ? 40 : roas < 2.5 ? 20 : 5) +
    (revenueVelocity < -10 ? 30 : revenueVelocity < 0 ? 15 : 5))
  );

  const r: KPIRatio[] = [
    // ── Funnel Conversion ─────────────────────────────────────────────────
    {
      id: 'purchase_rate',
      category: 'Funnel Conversion',
      label: 'Purchase Rate (Click → Purchase)',
      value: (purchases / clicks) * 100,
      previousValue: (pPurchases / pClicks) * 100,
      format: 'percent',
      benchmark: 3.0,
      benchmarkLabel: '3.0% (eComm avg)',
      status: getStatus((purchases / clicks) * 100, 3.0, true),
      formula: 'Purchases ÷ Link Clicks × 100',
      explanation: 'Percentage of clicks that convert into a purchase. A low rate indicates issues with the landing page, price, or product-market fit.',
      recommendation: (purchases / clicks) * 100 < 2.5
        ? 'Below benchmark. A/B test landing page CTA, offer, and checkout friction.'
        : 'Strong rate. Protect this by maintaining landing page quality.',
      higherIsBetter: true,
    },
    {
      id: 'lpv_rate',
      category: 'Funnel Conversion',
      label: 'Landing Page View Rate',
      value: (lpv / clicks) * 100,
      previousValue: 0,
      format: 'percent',
      benchmark: 80,
      benchmarkLabel: '80% (industry avg)',
      status: getStatus((lpv / clicks) * 100, 80, true),
      formula: 'Landing Page Views ÷ Link Clicks × 100',
      explanation: 'Percentage of clicks that successfully load the landing page. Low rates indicate page speed issues or bot traffic.',
      recommendation: (lpv / clicks) * 100 < 75
        ? 'Below 75% — investigate page load speed. Aim for <3s on mobile.'
        : 'Good. Page loads efficiently after click.',
      higherIsBetter: true,
    },
    {
      id: 'atc_rate',
      category: 'Funnel Conversion',
      label: 'Add-to-Cart Rate (LPV → ATC)',
      value: (atc / lpv) * 100,
      previousValue: 0,
      format: 'percent',
      benchmark: 12,
      benchmarkLabel: '12% (eComm avg)',
      status: getStatus((atc / lpv) * 100, 12, true),
      formula: 'Add to Carts ÷ Landing Page Views × 100',
      explanation: 'Rate at which visitors add to cart after viewing the landing page. Reflects product appeal and page quality.',
      recommendation: (atc / lpv) * 100 < 10
        ? 'Low ATC rate. Test product imagery, pricing, and page layout.'
        : 'Above benchmark. Good product-page alignment.',
      higherIsBetter: true,
    },
    {
      id: 'checkout_rate',
      category: 'Funnel Conversion',
      label: 'Checkout Rate (ATC → Checkout)',
      value: (ic / atc) * 100,
      previousValue: 0,
      format: 'percent',
      benchmark: 50,
      benchmarkLabel: '50% (eComm avg)',
      status: getStatus((ic / atc) * 100, 50, true),
      formula: 'Initiate Checkout ÷ Add to Carts × 100',
      explanation: 'Rate at which cart additions proceed to checkout. Low rates suggest cart abandonment friction.',
      recommendation: (ic / atc) * 100 < 45
        ? 'High cart abandonment. Add urgency triggers and cart abandonment emails.'
        : 'Good checkout initiation rate.',
      higherIsBetter: true,
    },
    {
      id: 'cart_purchase_rate',
      category: 'Funnel Conversion',
      label: 'Cart-to-Purchase Rate (Checkout → Purchase)',
      value: (purchases / ic) * 100,
      previousValue: 0,
      format: 'percent',
      benchmark: 55,
      benchmarkLabel: '55% (eComm avg)',
      status: getStatus((purchases / ic) * 100, 55, true),
      formula: 'Purchases ÷ Initiate Checkout × 100',
      explanation: 'Rate at which checkout initiations convert to completed purchases. Low rates indicate payment friction.',
      recommendation: (purchases / ic) * 100 < 45
        ? 'High checkout abandonment. Test payment options, trust badges, and checkout flow.'
        : 'Strong close rate from checkout.',
      higherIsBetter: true,
    },
    // ── Revenue Efficiency ────────────────────────────────────────────────
    {
      id: 'rpc',
      category: 'Revenue Efficiency',
      label: 'Revenue per Click (RPC)',
      value: revenue / clicks,
      previousValue: pRevenue / pClicks,
      format: 'currency',
      benchmark: 1.80,
      benchmarkLabel: '$1.80 (eComm avg)',
      status: getStatus(revenue / clicks, 1.80, true),
      formula: 'Revenue ÷ Link Clicks',
      explanation: 'Average revenue generated per ad click. Combines CTR quality and conversion strength into one metric.',
      recommendation: revenue / clicks < 1.5
        ? 'Low RPC. Improve targeting quality and landing page CVR to increase post-click revenue.'
        : 'Strong RPC. Maintain or expand current approach.',
      higherIsBetter: true,
    },
    {
      id: 'rev_per_lpv',
      category: 'Revenue Efficiency',
      label: 'Revenue per Landing Page View',
      value: revenue / lpv,
      previousValue: 0,
      format: 'currency',
      benchmark: 2.20,
      benchmarkLabel: '$2.20 (eComm avg)',
      status: getStatus(revenue / lpv, 2.20, true),
      formula: 'Revenue ÷ Landing Page Views',
      explanation: 'Revenue generated per landing page session. Directly measures landing page revenue performance.',
      recommendation: revenue / lpv < 2.0
        ? 'Optimize landing page for higher conversion and AOV. Test upsells and bundles.'
        : 'Landing page generates strong revenue per session.',
      higherIsBetter: true,
    },
    {
      id: 'rev_per_impression',
      category: 'Revenue Efficiency',
      label: 'Revenue per 1,000 Impressions',
      value: (revenue / impressions) * 1000,
      previousValue: (pRevenue / pImpressions) * 1000,
      format: 'currency',
      benchmark: 14,
      benchmarkLabel: '$14 (eComm avg)',
      status: getStatus((revenue / impressions) * 1000, 14, true),
      formula: 'Revenue ÷ Impressions × 1,000',
      explanation: 'How much revenue every 1,000 ad impressions generate. Combines reach quality with conversion efficiency.',
      recommendation: (revenue / impressions) * 1000 < 12
        ? 'Low eCPM-to-Revenue ratio. Improve creative performance or targeting precision.'
        : 'Good revenue density per thousand impressions.',
      higherIsBetter: true,
    },
    {
      id: 'cost_per_rev_dollar',
      category: 'Revenue Efficiency',
      label: 'Cost per Revenue Dollar',
      value: spend / revenue,
      previousValue: pSpend / pRevenue,
      format: 'raw',
      benchmark: 0.33,
      benchmarkLabel: '$0.33 (≈3x ROAS)',
      status: getStatus(spend / revenue, 0.33, false),
      formula: 'Ad Spend ÷ Revenue (= 1 ÷ ROAS)',
      explanation: 'How many cents in ad spend it costs to generate $1 in revenue. The inverse of ROAS.',
      recommendation: spend / revenue > 0.40
        ? 'You\'re spending more than 40¢ to earn $1. Optimize creative and targeting for better ROAS.'
        : 'Efficient — spending less than 35¢ per revenue dollar.',
      higherIsBetter: false,
    },
    {
      id: 'purchases_per_1k',
      category: 'Revenue Efficiency',
      label: 'Purchases per 1,000 Impressions',
      value: (purchases / impressions) * 1000,
      previousValue: (pPurchases / pImpressions) * 1000,
      format: 'raw',
      benchmark: 0.55,
      benchmarkLabel: '0.55 (eComm avg)',
      status: getStatus((purchases / impressions) * 1000, 0.55, true),
      formula: 'Purchases ÷ Impressions × 1,000',
      explanation: 'Purchase density per thousand ad views. Combines creative quality, audience fit, and funnel efficiency.',
      recommendation: (purchases / impressions) * 1000 < 0.4
        ? 'Low purchase density. Test new creative angles and tighten audience targeting.'
        : 'Good purchase density. Scale where CPM allows.',
      higherIsBetter: true,
    },
    {
      id: 'purchases_per_100_clicks',
      category: 'Revenue Efficiency',
      label: 'Purchases per 100 Clicks',
      value: (purchases / clicks) * 100,
      previousValue: (pPurchases / pClicks) * 100,
      format: 'raw',
      benchmark: 3.0,
      benchmarkLabel: '3.0 (eComm avg)',
      status: getStatus((purchases / clicks) * 100, 3.0, true),
      formula: 'Purchases ÷ Link Clicks × 100',
      explanation: 'Purchase conversion rate expressed per 100 ad clicks. Equivalent to purchase CVR.',
      recommendation: (purchases / clicks) * 100 < 2.5
        ? 'Below benchmark. Investigate landing page friction and offer alignment.'
        : 'Strong click-to-purchase conversion.',
      higherIsBetter: true,
    },
    // ── Cost Efficiency ────────────────────────────────────────────────────
    {
      id: 'cpm_ctr_efficiency',
      category: 'Cost Efficiency',
      label: 'CPM-to-CTR Efficiency Ratio',
      value: (ctr / cpm) * 100,
      previousValue: (kpis.ctr.previous / kpis.cpm.previous) * 100,
      format: 'raw',
      benchmark: 0.19,
      benchmarkLabel: '0.19 (avg)',
      status: getStatus((ctr / cpm) * 100, 0.19, true),
      formula: '(CTR ÷ CPM) × 100',
      explanation: 'How much CTR you get per dollar of CPM. Measures how efficiently your creative captures attention relative to its cost.',
      recommendation: (ctr / cpm) * 100 < 0.15
        ? 'Low creative efficiency. High CPM not being offset by enough CTR. Test creative hooks.'
        : 'Creative is generating good CTR relative to its CPM cost.',
      higherIsBetter: true,
    },
    {
      id: 'cpc_cpa_ratio',
      category: 'Cost Efficiency',
      label: 'CPC-to-CPA Ratio',
      value: cpa / cpc,
      previousValue: kpis.cpa.previous / kpis.cpc.previous,
      format: 'raw',
      benchmark: 40,
      benchmarkLabel: '40 (avg)',
      status: getStatus(cpa / cpc, 40, false),
      formula: 'CPA ÷ CPC',
      explanation: 'How many clicks it takes to generate one purchase. Lower is better — indicates tight funnel efficiency from click to conversion.',
      recommendation: cpa / cpc > 50
        ? 'It takes 50+ clicks per purchase. Improve landing page CVR to reduce click wastage.'
        : 'Efficient funnel — low click-to-purchase ratio.',
      higherIsBetter: false,
    },
    {
      id: 'roas_efficiency_index',
      category: 'Cost Efficiency',
      label: 'ROAS Efficiency Index',
      value: (roas / ROAS_TARGET) * 100,
      previousValue: (kpis.roas.previous / ROAS_TARGET) * 100,
      format: 'raw',
      benchmark: 100,
      benchmarkLabel: '100 (at target)',
      status: getStatus((roas / ROAS_TARGET) * 100, 100, true),
      formula: '(Current ROAS ÷ Target ROAS) × 100',
      explanation: 'How close you are to your ROAS target (2.5x). 100 = on target. >100 = above target. <100 = below.',
      recommendation: roas / ROAS_TARGET < 1.0
        ? 'Below ROAS target. Pause underperformers and reallocate budget to top campaigns.'
        : 'Above target ROAS. Prioritize scaling winning campaigns.',
      higherIsBetter: true,
    },
    // ── Velocity & Pacing ──────────────────────────────────────────────────
    {
      id: 'avg_daily_spend',
      category: 'Velocity & Pacing',
      label: 'Average Daily Spend',
      value: avgDailySpend,
      previousValue: pSpend / days,
      format: 'currency',
      benchmark: totalDailyBudgetCap * 0.85,
      benchmarkLabel: `$${(totalDailyBudgetCap * 0.85).toFixed(0)}/day (85% utilization)`,
      status: getStatus(avgDailySpend, totalDailyBudgetCap * 0.85, false, 0.1, -0.15),
      formula: 'Total Spend ÷ Days in Period',
      explanation: 'Average ad spend per day. Compare against total daily budget cap to see budget utilization.',
      recommendation: avgDailySpend > totalDailyBudgetCap * 0.95
        ? 'Near budget cap. Increase budgets on top performers to prevent delivery loss.'
        : 'Budget pacing is within healthy range.',
      higherIsBetter: false,
    },
    {
      id: 'spend_velocity',
      category: 'Velocity & Pacing',
      label: 'Spend Velocity (7d vs 14d)',
      value: spendVelocity,
      previousValue: 0,
      format: 'percent',
      benchmark: 5,
      benchmarkLabel: '+5% (healthy growth)',
      status: getStatus(spendVelocity, 5, true),
      formula: '(Avg Daily Spend L7D ÷ Avg Daily Spend L14D - 1) × 100',
      explanation: 'Rate of change in daily spend. Positive means accelerating spend, negative means decelerating.',
      recommendation: spendVelocity < 0
        ? 'Spend is decelerating. Check for ad rejections, budget limits, or auction competition.'
        : 'Spend velocity is positive — account is scaling.',
      higherIsBetter: true,
    },
    {
      id: 'revenue_velocity',
      category: 'Velocity & Pacing',
      label: 'Revenue Velocity (7d vs 14d)',
      value: revenueVelocity,
      previousValue: 0,
      format: 'percent',
      benchmark: 5,
      benchmarkLabel: '+5% (healthy growth)',
      status: getStatus(revenueVelocity, 5, true),
      formula: '(Avg Daily Revenue L7D ÷ Avg Daily Revenue L14D - 1) × 100',
      explanation: 'Rate of revenue growth. Should track or exceed spend velocity for improving efficiency.',
      recommendation: revenueVelocity < spendVelocity
        ? 'Revenue growth lagging spend growth — efficiency is compressing. Monitor ROAS closely.'
        : 'Revenue outpacing spend — efficiency is improving.',
      higherIsBetter: true,
    },
    {
      id: 'purchase_velocity',
      category: 'Velocity & Pacing',
      label: 'Purchase Velocity (7d vs 14d)',
      value: purchaseVelocity,
      previousValue: 0,
      format: 'percent',
      benchmark: 5,
      benchmarkLabel: '+5% (healthy growth)',
      status: getStatus(purchaseVelocity, 5, true),
      formula: '(Avg Daily Purchases L7D ÷ Avg Daily Purchases L14D - 1) × 100',
      explanation: 'Rate of purchase volume growth. Leading indicator of scaling health.',
      recommendation: purchaseVelocity < 0
        ? 'Purchase volume shrinking. Investigate creative fatigue and audience saturation.'
        : 'Purchase volume growing. Keep scaling.',
      higherIsBetter: true,
    },
    {
      id: 'budget_utilization',
      category: 'Velocity & Pacing',
      label: 'Budget Utilization',
      value: budgetUtilization,
      previousValue: 0,
      format: 'percent',
      benchmark: 90,
      benchmarkLabel: '85–95% (ideal range)',
      status: budgetUtilization > 95 ? 'poor' : budgetUtilization > 80 ? 'excellent' : budgetUtilization > 60 ? 'good' : 'average',
      formula: 'Avg Daily Spend ÷ Total Daily Budget Cap × 100',
      explanation: 'How much of the total approved daily budget is actually being spent. Too low means delivery issues; too high means potential missed opportunities.',
      recommendation: budgetUtilization > 95
        ? 'Budget capped — delivery is limited. Increase budgets on top campaigns.'
        : budgetUtilization < 70
        ? 'Under-delivering. Check ad approval status and audience sizes.'
        : 'Budget utilization in healthy range.',
      higherIsBetter: true,
    },
    // ── Audience & Creative Health ─────────────────────────────────────────
    {
      id: 'reach_efficiency',
      category: 'Audience & Creative Health',
      label: 'Reach Efficiency',
      value: reachEfficiency,
      previousValue: 0,
      format: 'percent',
      benchmark: 55,
      benchmarkLabel: '55% (avg)',
      status: getStatus(reachEfficiency, 55, true),
      formula: 'Unique Reach ÷ Impressions × 100',
      explanation: 'Percentage of impressions reaching unique people. Higher means less repetition per person (lower frequency).',
      recommendation: reachEfficiency < 45
        ? 'Low reach efficiency — impressions concentrated on same users. Expand audience or refresh creative.'
        : 'Good reach diversity. Audiences are fresh.',
      higherIsBetter: true,
    },
    {
      id: 'freq_efficiency',
      category: 'Audience & Creative Health',
      label: 'Frequency Efficiency Score',
      value: Math.max(0, 100 - (freq - 1.5) * 33),
      previousValue: 0,
      format: 'raw',
      benchmark: 75,
      benchmarkLabel: '75+ (healthy)',
      status: freq < 2.0 ? 'excellent' : freq < 2.5 ? 'good' : freq < 3.5 ? 'average' : 'poor',
      formula: '100 - (Frequency - 1.5) × 33',
      explanation: 'Composite score measuring how healthy account frequency is. Above 75 means minimal creative fatigue risk.',
      recommendation: freq > 3.0
        ? 'Score below 50 — refresh creatives across high-frequency campaigns immediately.'
        : 'Frequency is in healthy range. Continue monitoring.',
      higherIsBetter: true,
    },
    {
      id: 'creative_fatigue',
      category: 'Audience & Creative Health',
      label: 'Creative Fatigue Score',
      value: creativeFatigueScore,
      previousValue: 0,
      format: 'raw',
      benchmark: 60,
      benchmarkLabel: '< 60 (safe zone)',
      status: creativeFatigueScore < 50 ? 'excellent' : creativeFatigueScore < 65 ? 'good' : creativeFatigueScore < 80 ? 'average' : 'poor',
      formula: '(Avg Frequency ÷ 3.0) × 100',
      explanation: 'Score from 0–100 measuring creative fatigue risk. Above 80 means creatives are burning out and CTR is likely declining.',
      recommendation: creativeFatigueScore > 70
        ? 'High fatigue risk. Launch 2–3 new creative variants within the next week.'
        : 'Creative health is good. Refresh proactively before score exceeds 70.',
      higherIsBetter: false,
    },
    {
      id: 'audience_saturation',
      category: 'Audience & Creative Health',
      label: 'Audience Saturation Score',
      value: audienceSatScore,
      previousValue: 0,
      format: 'raw',
      benchmark: 50,
      benchmarkLabel: '< 50 (safe zone)',
      status: audienceSatScore < 40 ? 'excellent' : audienceSatScore < 55 ? 'good' : audienceSatScore < 70 ? 'average' : 'poor',
      formula: '(Account Avg Frequency ÷ 4.0) × 100',
      explanation: 'Score measuring how saturated your audiences are. Above 70 indicates the core audience has seen your ads too many times.',
      recommendation: audienceSatScore > 60
        ? 'Audience is saturating. Expand lookalike percentages or test new interest-based audiences.'
        : 'Audience size is healthy. Room to scale within current targeting.',
      higherIsBetter: false,
    },
    // ── Composite Scores ───────────────────────────────────────────────────
    {
      id: 'account_health',
      category: 'Composite Scores',
      label: 'Account Health Score',
      value: healthScore,
      previousValue: Math.max(0, healthScore - 3),
      format: 'raw',
      benchmark: 75,
      benchmarkLabel: '75+ (healthy account)',
      status: healthScore >= 80 ? 'excellent' : healthScore >= 65 ? 'good' : healthScore >= 50 ? 'average' : 'poor',
      formula: 'Weighted composite of ROAS, CPA, CTR, Frequency, Funnel Health, Creative Performance',
      explanation: 'Overall account health from 0–100 based on 12 performance dimensions. A score above 75 indicates a profitable, well-optimized account.',
      recommendation: healthScore < 65
        ? 'Prioritize pausing underperformers and refreshing fatigued creatives to lift score above 70.'
        : 'Account is in good health. Focus on scaling top performers.',
      higherIsBetter: true,
    },
    {
      id: 'scaling_score',
      category: 'Composite Scores',
      label: 'Scaling Score',
      value: Math.min(100, scalingScore),
      previousValue: 0,
      format: 'raw',
      benchmark: 60,
      benchmarkLabel: '60+ (ready to scale)',
      status: scalingScore >= 75 ? 'excellent' : scalingScore >= 55 ? 'good' : scalingScore >= 40 ? 'average' : 'poor',
      formula: 'Composite of ROAS, Frequency, Spend Velocity, and ATC Rate',
      explanation: 'How ready the account is to scale budget aggressively. Considers ROAS stability, creative headroom, and funnel efficiency.',
      recommendation: scalingScore < 50
        ? 'Not ready to scale. Fix CPA and creative fatigue issues first.'
        : 'Account shows scaling readiness. Prioritize DPA and retargeting budget increases.',
      higherIsBetter: true,
    },
    {
      id: 'profitability_score',
      category: 'Composite Scores',
      label: 'Profitability Score',
      value: profitabilityScore,
      previousValue: 0,
      format: 'raw',
      benchmark: 65,
      benchmarkLabel: '65+ (profitable)',
      status: profitabilityScore >= 75 ? 'excellent' : profitabilityScore >= 60 ? 'good' : profitabilityScore >= 45 ? 'average' : 'poor',
      formula: '(ROAS ÷ 4.0 × 60) + ((1 - CPA ÷ 50) × 40)',
      explanation: 'Composite profitability score accounting for ROAS quality and CPA efficiency. Scores above 65 indicate a sustainably profitable account.',
      recommendation: profitabilityScore < 60
        ? 'Profitability at risk. Pause campaigns under 2x ROAS and reallocate to retargeting.'
        : 'Account is profitable. Look for ways to expand margins via AOV optimization.',
      higherIsBetter: true,
    },
    {
      id: 'opportunity_score',
      category: 'Composite Scores',
      label: 'Opportunity Score',
      value: Math.min(100, opportunityScore),
      previousValue: 0,
      format: 'raw',
      benchmark: 50,
      benchmarkLabel: '50+ (significant opportunity)',
      status: opportunityScore >= 70 ? 'excellent' : opportunityScore >= 55 ? 'good' : opportunityScore >= 40 ? 'average' : 'poor',
      formula: 'Composite of headroom vs ROAS target, frequency headroom, spend gap',
      explanation: 'Measures untapped growth potential. High scores indicate room to scale profitably without major structural changes.',
      recommendation: 'Scale retargeting budgets, test new creative formats, and expand to new geo markets.',
      higherIsBetter: true,
    },
    {
      id: 'risk_score',
      category: 'Composite Scores',
      label: 'Risk Score',
      value: Math.min(100, riskScore),
      previousValue: 0,
      format: 'raw',
      benchmark: 30,
      benchmarkLabel: '< 30 (low risk)',
      status: riskScore < 25 ? 'excellent' : riskScore < 40 ? 'good' : riskScore < 60 ? 'average' : 'poor',
      formula: 'Composite of frequency risk, ROAS risk, and revenue velocity risk',
      explanation: 'Overall account risk score. High scores indicate exposure to creative fatigue, ROAS decline, or audience saturation simultaneously.',
      recommendation: riskScore > 50
        ? 'High risk detected. Immediate creative refresh and audience expansion needed.'
        : 'Risk is manageable. Monitor frequency and revenue velocity weekly.',
      higherIsBetter: false,
    },
  ];
  return r;
}

// ─── Account Performance Score ────────────────────────────────────────────────

export function computeAccountScore(days = 30): AccountScore {
  const kpis = getAccountKPIs(days);
  const roas = kpis.roas.value;
  const cpa = kpis.cpa.value;
  const ctr = kpis.ctr.value;
  const cpm = kpis.cpm.value;
  const freq = kpis.frequency.value;
  const spend = kpis.spend.value;
  const revenue = kpis.revenue.value;
  const purchases = kpis.purchases.value;
  const clicks = kpis.clicks.value;
  const lpv = kpis.landingPageViews.value;
  const atc = kpis.addToCart.value;
  const ic = kpis.initiateCheckout.value;

  const recent = timeSeriesData.slice(-days);
  const prev = timeSeriesData.slice(-days * 2, -days);
  const recentRevAvg = revenue / days;
  const prevRevAvg = prev.reduce((s, d) => s + d.revenue, 0) / days;
  const revGrowth = ((recentRevAvg - prevRevAvg) / prevRevAvg) * 100;

  // Score each dimension 0-100
  const dims: ScoreDimension[] = [
    {
      label: 'ROAS',
      score: Math.round(Math.min(100, Math.max(0, (roas / 4.0) * 100))),
      weight: 20,
      status: roas >= 3.5 ? 'excellent' : roas >= 2.5 ? 'good' : roas >= 1.8 ? 'average' : 'poor',
      insight: `Blended ROAS of ${roas.toFixed(2)}x. Target is 2.5x. ${roas >= 2.5 ? 'Above target.' : 'Below target — focus on retargeting campaigns.'}`,
    },
    {
      label: 'CPA',
      score: Math.round(Math.min(100, Math.max(0, (1 - cpa / 60) * 100))),
      weight: 15,
      status: cpa < 20 ? 'excellent' : cpa < 30 ? 'good' : cpa < 45 ? 'average' : 'poor',
      insight: `CPA of $${cpa.toFixed(2)}. ${cpa < 30 ? 'Below $30 target.' : `Above $${CPA_TARGET} target by $${(cpa - CPA_TARGET).toFixed(2)}.`}`,
    },
    {
      label: 'CTR',
      score: Math.round(Math.min(100, Math.max(0, (ctr / 4.0) * 100))),
      weight: 10,
      status: ctr >= 3.0 ? 'excellent' : ctr >= 2.0 ? 'good' : ctr >= 1.0 ? 'average' : 'poor',
      insight: `CTR of ${ctr.toFixed(2)}%. ${ctr >= 2.0 ? 'Above the 2% benchmark.' : 'Below 2% — test new creative hooks.'}`,
    },
    {
      label: 'CPM',
      score: Math.round(Math.min(100, Math.max(0, (1 - cpm / 20) * 100))),
      weight: 8,
      status: cpm < 8 ? 'excellent' : cpm < 12 ? 'good' : cpm < 16 ? 'average' : 'poor',
      insight: `CPM of $${cpm.toFixed(2)}. ${cpm < 12 ? 'Efficient delivery cost.' : 'High CPM — consider audience expansion.'}`,
    },
    {
      label: 'Purchase Rate',
      score: Math.round(Math.min(100, Math.max(0, ((purchases / clicks) * 100 / 5) * 100))),
      weight: 10,
      status: (purchases / clicks) >= 0.04 ? 'excellent' : (purchases / clicks) >= 0.025 ? 'good' : (purchases / clicks) >= 0.015 ? 'average' : 'poor',
      insight: `${((purchases / clicks) * 100).toFixed(2)}% of clicks convert to purchase. ${(purchases / clicks) >= 0.025 ? 'Above average.' : 'Below average — optimize landing page.'}`,
    },
    {
      label: 'Frequency',
      score: Math.round(Math.min(100, Math.max(0, (1 - Math.max(0, freq - 1.5) / 3) * 100))),
      weight: 8,
      status: freq < 2.0 ? 'excellent' : freq < 2.5 ? 'good' : freq < 3.5 ? 'average' : 'poor',
      insight: `Account avg frequency of ${freq.toFixed(2)}. ${freq < 2.5 ? 'Healthy — audiences fresh.' : 'Elevated — creative refresh needed.'}`,
    },
    {
      label: 'Revenue Growth',
      score: Math.round(Math.min(100, Math.max(0, 50 + revGrowth * 2))),
      weight: 10,
      status: revGrowth >= 15 ? 'excellent' : revGrowth >= 5 ? 'good' : revGrowth >= 0 ? 'average' : 'poor',
      insight: `Revenue ${revGrowth >= 0 ? 'grew' : 'declined'} ${Math.abs(revGrowth).toFixed(1)}% vs prior period. ${revGrowth >= 5 ? 'Positive growth trajectory.' : 'Growth stalled — re-evaluate strategy.'}`,
    },
    {
      label: 'Budget Efficiency',
      score: Math.round(Math.min(100, Math.max(0, (spend > 0 && revenue / spend > 2 ? 75 : revenue / spend > 1.5 ? 55 : 35)))),
      weight: 8,
      status: revenue / spend > 3 ? 'excellent' : revenue / spend > 2 ? 'good' : revenue / spend > 1.5 ? 'average' : 'poor',
      insight: `Generating $${(revenue / spend).toFixed(2)} revenue per $1 spend. ${revenue / spend > 2 ? 'Efficient allocation.' : 'Room for improvement via budget reallocation.'}`,
    },
    {
      label: 'Scaling Opportunities',
      score: Math.round(Math.min(100, Math.max(0,
        (campaigns.filter(c => c.roas >= 3.5 && c.trend > 0).length / campaigns.length) * 100))),
      weight: 8,
      status: campaigns.filter(c => c.roas >= 3.5).length >= 3 ? 'excellent' :
               campaigns.filter(c => c.roas >= 3.5).length >= 2 ? 'good' : 'average',
      insight: `${campaigns.filter(c => c.roas >= 3.5).length} of ${campaigns.length} campaigns qualify for scaling (ROAS ≥3.5x).`,
    },
    {
      label: 'Creative Performance',
      score: Math.round(Math.min(100, Math.max(0,
        (ads.filter(a => a.qualityRanking === 'ABOVE_AVERAGE').length / ads.length) * 100))),
      weight: 8,
      status: ads.filter(a => a.qualityRanking === 'ABOVE_AVERAGE').length >= 6 ? 'excellent' :
               ads.filter(a => a.qualityRanking === 'ABOVE_AVERAGE').length >= 4 ? 'good' : 'average',
      insight: `${ads.filter(a => a.qualityRanking === 'ABOVE_AVERAGE').length}/${ads.length} ads have above-average quality ranking.`,
    },
    {
      label: 'Funnel Health',
      score: Math.round(Math.min(100, Math.max(0,
        ((lpv / clicks) * 0.3 + (atc / lpv) * 2 + (purchases / ic) * 0.5) * 100))),
      weight: 8,
      status: (atc / lpv) >= 0.15 && (purchases / ic) >= 0.5 ? 'excellent' :
               (atc / lpv) >= 0.10 ? 'good' : 'average',
      insight: `ATC rate ${((atc / lpv) * 100).toFixed(1)}%, checkout-to-purchase ${((purchases / ic) * 100).toFixed(1)}%. ${(atc / lpv) >= 0.12 ? 'Funnel is healthy.' : 'Mid-funnel leakage detected.'}`,
    },
  ];

  const overall = Math.round(
    dims.reduce((sum, d) => sum + d.score * d.weight, 0) / dims.reduce((sum, d) => sum + d.weight, 0)
  );

  const grade = overall >= 85 ? 'A' : overall >= 75 ? 'B+' : overall >= 65 ? 'B' : overall >= 55 ? 'C+' : overall >= 45 ? 'C' : 'D';

  const poorDims = dims.filter(d => d.score < 55).sort((a, b) => a.score - b.score);
  const priorities = poorDims.slice(0, 3).map(d => d.label);
  if (priorities.length === 0) priorities.push('Scale Winning Campaigns', 'Test New Creative Formats', 'Expand to New Audiences');

  const summary = `Pharmescence's Meta Ads account scores ${overall}/100 (Grade: ${grade}). ` +
    (overall >= 70
      ? `The account is performing well above industry average, driven by strong retargeting ROAS (4.45–5.28x) and healthy creative rankings. `
      : `The account has meaningful optimization opportunities that, once addressed, could unlock significant revenue growth. `) +
    `Key strengths: retargeting efficiency and audience segmentation. ` +
    `Top priorities to improve score: ${poorDims.slice(0, 3).map(d => `${d.label} (${d.score}/100)`).join(', ')}.`;

  return { overall, grade, summary, priorities, dimensions: dims };
}
