export type MetricTrend = 'up' | 'down' | 'neutral';

export interface KPIMetric {
  label: string;
  value: number;
  previousValue: number;
  format: 'currency' | 'number' | 'percent' | 'multiplier' | 'raw';
  trend?: MetricTrend;
  sparkline?: number[];
  prefix?: string;
  suffix?: string;
  invertTrend?: boolean;
}

export interface TimeSeriesPoint {
  date: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cpc: number;
  frequency: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  reach: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  budget: number;
  budgetType: 'DAILY' | 'LIFETIME';
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cpc: number;
  frequency: number;
  reach: number;
  impressions: number;
  clicks: number;
  addToCart: number;
  initiateCheckout: number;
  landingPageViews: number;
  purchaseRate: number;
  aov: number;
  conversionRate: number;
  trend: number;
  previousSpend: number;
  previousPurchases: number;
  previousRoas: number;
}

export interface AdSet {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  audience: string;
  location: string;
  ageMin: number;
  ageMax: number;
  gender: 'ALL' | 'MALE' | 'FEMALE';
  placement: string[];
  optimizationGoal: string;
  budget: number;
  budgetType: 'DAILY' | 'LIFETIME';
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  frequency: number;
  cpm: number;
  cpc: number;
  addToCart: number;
  initiateCheckout: number;
  purchaseRate: number;
  reach: number;
  impressions: number;
  trend: number;
}

export interface Ad {
  id: string;
  adSetId: string;
  adSetName: string;
  campaignName: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  format: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'COLLECTION' | 'DYNAMIC';
  thumbnail: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  thumbStopRate: number;
  videoPlays: number;
  videoWatchTime: number;
  hookRate: number;
  outboundCtr: number;
  frequency: number;
  qualityRanking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
  engagementRanking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
  conversionRanking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
  impressions: number;
  reach: number;
  headline: string;
  primaryText: string;
  cta: string;
  trend: number;
}

export interface FunnelStep {
  name: string;
  value: number;
  cost: number;
  conversionRate: number;
  dropOff: number;
}

export interface GeoData {
  country: string;
  countryCode: string;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
}

export interface PlacementData {
  placement: string;
  platform: string;
  spend: number;
  purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  impressions: number;
}

export interface DemographicData {
  segment: string;
  spend: number;
  purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
}

export interface HeatmapCell {
  hour: number;
  day: number;
  dayLabel: string;
  value: number;
  purchases: number;
  roas: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  description: string;
  entity: string;
  entityType: 'campaign' | 'adset' | 'ad' | 'account';
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
  actionable: boolean;
}

export interface Insight {
  id: string;
  type: 'scale' | 'pause' | 'refresh' | 'duplicate' | 'expand' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  entity: string;
  entityType: 'campaign' | 'adset' | 'ad';
  impact: string;
  potentialRevenue?: number;
}

export type NavPage =
  | 'overview'
  | 'trends'
  | 'funnel'
  | 'campaigns'
  | 'adsets'
  | 'ads'
  | 'creative'
  | 'breakdowns'
  | 'geography'
  | 'placements'
  | 'time'
  | 'top'
  | 'worst'
  | 'scaling'
  | 'engine'
  | 'insights'
  | 'ratios'
  | 'profitability'
  | 'alerts'
  | 'reports';

// ─── Budget Engine ────────────────────────────────────────────────────────────
export type RecommendationType =
  | 'INCREASE_BUDGET'
  | 'DECREASE_BUDGET'
  | 'KEEP_STABLE'
  | 'DUPLICATE'
  | 'PAUSE'
  | 'REFRESH_CREATIVE'
  | 'EXPAND_AUDIENCE'
  | 'NARROW_AUDIENCE'
  | 'TEST_NEW_CREATIVE'
  | 'TEST_NEW_AUDIENCE'
  | 'SCALE_HORIZONTAL'
  | 'SCALE_VERTICAL';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface BudgetRecommendation {
  id: string;
  entityId: string;
  entityName: string;
  entityType: 'campaign' | 'adset' | 'ad';
  recommendation: RecommendationType;
  secondaryRecommendation?: RecommendationType;
  confidence: number;
  reason: string;
  signals: string[];
  riskLevel: RiskLevel;
  budgetChangePct: number;
  currentDailyBudget: number;
  suggestedDailyBudget: number;
  estimatedAdditionalPurchases: number;
  estimatedAdditionalRevenue: number;
  estimatedROAS: number;
  expectedImpact: string;
  // Current performance snapshot
  currentROAS: number;
  currentCPA: number;
  currentFrequency: number;
  currentSpend: number;
  performanceTrend: number;
  status: string;
}

// ─── KPI Ratios ───────────────────────────────────────────────────────────────
export type RatioStatus = 'excellent' | 'good' | 'average' | 'poor';

export interface KPIRatio {
  id: string;
  category: string;
  label: string;
  value: number;
  previousValue: number;
  format: 'percent' | 'currency' | 'number' | 'multiplier' | 'raw' | 'index';
  benchmark: number;
  benchmarkLabel: string;
  status: RatioStatus;
  formula: string;
  explanation: string;
  recommendation: string;
  higherIsBetter: boolean;
}

// ─── Account Score ────────────────────────────────────────────────────────────
export interface ScoreDimension {
  label: string;
  score: number;
  weight: number;
  status: RatioStatus;
  insight: string;
}

export interface AccountScore {
  overall: number;
  grade: string;
  summary: string;
  priorities: string[];
  dimensions: ScoreDimension[];
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface DashboardFilters {
  dateRange: DateRange;
  campaigns: string[];
  adSets: string[];
  ads: string[];
  countries: string[];
  placements: string[];
  devices: string[];
  ages: string[];
  genders: string[];
  objectives: string[];
  statuses: string[];
}

// ─── Breakdowns (§7) ──────────────────────────────────────────────────────────
export type BreakdownDimension =
  | 'age'
  | 'gender'
  | 'placement'
  | 'country'
  | 'region'
  | 'city'
  | 'device'
  | 'os'
  | 'platform'
  | 'hour'
  | 'weekday'
  | 'month';

export interface BreakdownRow {
  segment: string;
  meta?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cpc: number;
  frequency: number;
  purchaseRate: number;
}

// ─── Creative Insights (§10) ──────────────────────────────────────────────────
export interface CreativeElementStat {
  value: string;
  kind: 'headline' | 'primaryText' | 'cta' | 'format';
  ads: number;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
}

// ─── Trends (§2) ──────────────────────────────────────────────────────────────
export type TrendGranularity = 'daily' | 'weekly' | 'monthly';

// ─── Global Filters (§18) ─────────────────────────────────────────────────────
export interface GlobalFilters {
  days: number;
  campaigns: string[];
  adSets: string[];
  ads: string[];
  countries: string[];
  placements: string[];
  devices: string[];
  ages: string[];
  genders: string[];
  objectives: string[];
  statuses: string[];
}

export type FilterKey = Exclude<keyof GlobalFilters, 'days'>;
