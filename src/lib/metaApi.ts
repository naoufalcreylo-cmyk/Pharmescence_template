/**
 * Meta Marketing API client (browser side).
 *
 * Talks only to our own /api/meta function, never to graph.facebook.com — the
 * access token lives on the server and must never reach this file.
 *
 * Everything here exists because the Insights API does not return the shapes a
 * dashboard wants:
 *   - every numeric field arrives as a *string* ("1234.56", not 1234.56)
 *   - conversions are buried in an `actions` array keyed by event name
 *   - budgets are in minor units (cents), so 5000 means $50.00
 *   - a metric with no events is simply absent rather than zero
 * Parsing all of that in one place keeps the quirks from leaking into the pages.
 */

// --- Raw API shapes ----------------------------------------------------------

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  inline_link_click_ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: MetaAction[];
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  video_play_actions?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
  video_avg_time_watched_actions?: MetaAction[];
  outbound_clicks?: MetaAction[];
  outbound_clicks_ctr?: MetaAction[];
  [breakdown: string]: unknown;
}

export interface MetaEntity {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  campaign_id?: string;
  adset_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
  creative?: {
    id?: string;
    thumbnail_url?: string;
    object_type?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
  };
}

export interface AccountProbe {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent?: string;
}

export type ConnectionState =
  | { status: 'checking' }
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string; metaCode?: number; fbtrace_id?: string; accountId?: string }
  | { status: 'connected'; account: AccountProbe; apiVersion: string };

// --- Parsing helpers ---------------------------------------------------------

/** Insight numbers arrive as strings; missing means zero, not undefined. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Budgets come back in minor units — 5000 is $50.00, not $5,000. */
export function minorUnitsToMajor(v: unknown): number {
  return num(v) / 100;
}

/**
 * Pull one conversion count out of the `actions` array.
 *
 * Meta exposes the same conversion under several names depending on how it was
 * tracked, and which ones are present varies by account setup. The candidates
 * are tried in order of specificity: the web pixel event first, then the
 * cross-channel rollups. Returns 0 when the event never fired.
 */
export function actionValue(actions: MetaAction[] | undefined, candidates: string[]): number {
  if (!actions?.length) return 0;
  for (const type of candidates) {
    const hit = actions.find(a => a.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
}

/**
 * Event-name candidates, most specific first.
 *
 * `offsite_conversion.fb_pixel_*` is the website pixel. `omni_*` rolls up web,
 * app and offline. The bare names are the legacy aggregates. Pharmescence's
 * primary event is a website Purchase, so the pixel name leads.
 */
export const PURCHASE_ACTIONS = ['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase'];
export const ATC_ACTIONS = ['offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart', 'add_to_cart'];
export const CHECKOUT_ACTIONS = [
  'offsite_conversion.fb_pixel_initiate_checkout',
  'omni_initiated_checkout',
  'initiate_checkout',
];
export const LPV_ACTIONS = ['landing_page_view'];
export const LINK_CLICK_ACTIONS = ['link_click'];

/** The counters a dashboard row is built from, with every ratio re-derived. */
export interface NormalizedRow {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
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
  date?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  // Ad-level only
  qualityRanking?: string;
  engagementRanking?: string;
  conversionRanking?: string;
  videoPlays?: number;
  videoWatchTime?: number;
  thruPlays?: number;
  outboundClicks?: number;
  outboundCtr?: number;
}

/**
 * Turn one raw insight row into dashboard counters.
 *
 * Ratios are recomputed from the counters rather than read from Meta's `ctr` /
 * `cpc` fields. Meta's versions are correct for a single row but cannot be
 * summed later, and the dashboard aggregates constantly — deriving them here
 * keeps one rule everywhere. `link_click` is preferred over raw `clicks`
 * because `clicks` counts likes and profile taps that never reached the site.
 */
export function normalizeRow(r: MetaInsightRow): NormalizedRow {
  const spend = num(r.spend);
  const impressions = num(r.impressions);
  const reach = num(r.reach);
  const clicks = num(r.clicks);
  const linkClicks = num(r.inline_link_clicks) || actionValue(r.actions, LINK_CLICK_ACTIONS);
  const purchases = actionValue(r.actions, PURCHASE_ACTIONS);
  const revenue = actionValue(r.action_values, PURCHASE_ACTIONS);

  return {
    spend,
    impressions,
    reach,
    clicks,
    linkClicks,
    landingPageViews: actionValue(r.actions, LPV_ACTIONS),
    addToCart: actionValue(r.actions, ATC_ACTIONS),
    initiateCheckout: actionValue(r.actions, CHECKOUT_ACTIONS),
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: linkClicks > 0 ? spend / linkClicks : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    purchaseRate: linkClicks > 0 ? (purchases / linkClicks) * 100 : 0,
    date: r.date_start,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    adSetId: r.adset_id,
    adSetName: r.adset_name,
    adId: r.ad_id,
    adName: r.ad_name,
    // Ad-level extras. These arrive as single-entry action arrays rather than
    // plain fields, so the same `actions` unwrapping applies.
    qualityRanking: r.quality_ranking,
    engagementRanking: r.engagement_rate_ranking,
    conversionRanking: r.conversion_rate_ranking,
    videoPlays: firstActionValue(r.video_play_actions),
    thruPlays: firstActionValue(r.video_thruplay_watched_actions),
    videoWatchTime: firstActionValue(r.video_avg_time_watched_actions),
    outboundClicks: firstActionValue(r.outbound_clicks),
    outboundCtr: firstActionValue(r.outbound_clicks_ctr),
  };
}

/** Several ad metrics come back as a one-element array rather than a scalar. */
function firstActionValue(actions: MetaAction[] | undefined): number {
  return actions?.length ? num(actions[0].value) : 0;
}

// --- Transport ---------------------------------------------------------------

interface ApiEnvelope<T> {
  configured?: boolean;
  connected?: boolean;
  data?: T;
  error?: string;
  metaCode?: number;
  fbtrace_id?: string;
  account?: AccountProbe;
  accountId?: string;
  apiVersion?: string;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly metaCode?: number,
    readonly fbtrace_id?: string,
    readonly notConfigured = false,
    /** Which ad account the server actually queried, for diagnosing a #200. */
    readonly accountId?: string,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

async function call<T>(params: Record<string, string>): Promise<ApiEnvelope<T>> {
  const qs = new URLSearchParams(params).toString();
  let response: Response;

  try {
    response = await fetch(`/api/meta?${qs}`);
  } catch {
    // No function at this origin at all — the normal case on GitHub Pages.
    throw new MetaApiError(
      'No backend found at /api/meta. This build is running as a static site, which cannot reach the Meta API.',
      undefined,
      undefined,
      true,
    );
  }

  // A static host answers /api/* with its 404 page, which is HTML, not JSON.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new MetaApiError(
      'No backend found at /api/meta. Deploy to Vercel to enable live data.',
      undefined,
      undefined,
      true,
    );
  }

  const body = (await response.json()) as ApiEnvelope<T>;

  if (body.configured === false) {
    throw new MetaApiError(body.error ?? 'Live data is not configured.', undefined, undefined, true);
  }
  if (!response.ok || body.error) {
    throw new MetaApiError(body.error ?? `Request failed (${response.status})`, body.metaCode, body.fbtrace_id, false, body.accountId);
  }

  return body;
}

/** Credential check. Cheap, and the first thing to run when something is wrong. */
export async function checkConnection(): Promise<ConnectionState> {
  try {
    const body = await call<never>({ resource: 'ping' });
    if (body.connected && body.account) {
      return { status: 'connected', account: body.account, apiVersion: body.apiVersion ?? 'unknown' };
    }
    return { status: 'error', message: body.error ?? 'Unexpected response from the API.', accountId: body.accountId };
  } catch (err) {
    const e = err as MetaApiError;
    if (e.notConfigured) return { status: 'not-configured', message: e.message };
    return { status: 'error', message: e.message, metaCode: e.metaCode, fbtrace_id: e.fbtrace_id, accountId: e.accountId };
  }
}

export interface InsightQuery {
  /** Explicit window. Preferred — presets like Today are not "N days back". */
  since?: string;
  until?: string;
  days?: number;
  daily?: boolean;
  breakdowns?: string;
  previous?: boolean;
}

function queryParams(level: string, opts: InsightQuery): Record<string, string> {
  const params: Record<string, string> = { resource: 'insights', level };
  if (opts.since && opts.until) {
    params.since = opts.since;
    params.until = opts.until;
  } else {
    params.days = String(opts.days ?? 30);
    if (opts.previous) params.prev = '1';
  }
  if (opts.daily) params.daily = '1';
  if (opts.breakdowns) params.breakdowns = opts.breakdowns;
  return params;
}

export async function fetchInsights(
  level: 'account' | 'campaign' | 'adset' | 'ad',
  opts: InsightQuery = {},
): Promise<NormalizedRow[]> {
  const body = await call<MetaInsightRow[]>(queryParams(level, opts));
  return (body.data ?? []).map(normalizeRow);
}

/**
 * Raw insight rows, keeping the breakdown keys.
 *
 * A breakdown response carries its segment as an extra top-level property named
 * after the breakdown (`age`, `country`, `publisher_platform`...), which
 * `normalizeRow` drops. Breakdown callers need both, so they get the raw row
 * and normalize it themselves.
 */
export async function fetchInsightsRaw(
  level: 'account' | 'campaign' | 'adset' | 'ad',
  opts: InsightQuery = {},
): Promise<MetaInsightRow[]> {
  const body = await call<MetaInsightRow[]>(queryParams(level, opts));
  return body.data ?? [];
}

export interface ReachableAdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  currency: string;
}

/**
 * Ad accounts this token can actually read.
 *
 * Used to diagnose a (#200): if the configured account is missing from this
 * list the ID is wrong or was never granted, and if the list is empty the token
 * has no ads access at all. Either way it turns a dead end into a fix.
 */
export async function fetchAdAccounts(): Promise<ReachableAdAccount[]> {
  const body = await call<ReachableAdAccount[]>({ resource: 'adaccounts' });
  return body.data ?? [];
}

export async function fetchEntities(resource: 'campaigns' | 'adsets' | 'ads'): Promise<MetaEntity[]> {
  const body = await call<MetaEntity[]>({ resource });
  return body.data ?? [];
}

/** Ads Manager shows effective_status; plain `status` ignores parent pausing. */
export function displayStatus(e: MetaEntity): string {
  const s = (e.effective_status ?? e.status ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s.includes('PAUSED')) return 'PAUSED';
  if (s === 'ARCHIVED') return 'ARCHIVED';
  if (s === 'DELETED') return 'DELETED';
  return 'PAUSED';
}

/** Daily budget if set, otherwise the lifetime budget, both in major units. */
export function entityBudget(e: MetaEntity): { amount: number; type: 'DAILY' | 'LIFETIME' } {
  if (e.daily_budget && num(e.daily_budget) > 0) {
    return { amount: minorUnitsToMajor(e.daily_budget), type: 'DAILY' };
  }
  return { amount: minorUnitsToMajor(e.lifetime_budget), type: 'LIFETIME' };
}
