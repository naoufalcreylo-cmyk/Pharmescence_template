import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Meta Marketing API proxy.
 *
 * This runs on Vercel's server, never in the browser. It is the only place the
 * access token exists at runtime: the browser asks this function for data, this
 * function asks Meta, and the token never crosses back over the wire.
 *
 * Deliberately NOT a general-purpose proxy. It accepts a small set of named
 * resources and rebuilds the upstream request from scratch, so a crafted request
 * cannot point the token at an arbitrary endpoint (for example the one that
 * would hand back the token's own metadata, or a write endpoint).
 */

const API_VERSION = 'v25.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

/**
 * The Pharmescence ad account.
 *
 * An ad account ID is configuration, not a credential — it appears in Ads
 * Manager URLs and is useless to anyone without a token that has been granted
 * access to it. Keeping it here means deployment needs exactly one secret
 * (META_ACCESS_TOKEN) instead of two settings, which removes the most common
 * setup mistake. Override it with META_AD_ACCOUNT_ID to point at another account.
 */
const DEFAULT_AD_ACCOUNT_ID = 'act_1354995341608155';

/** Insight fields the dashboard consumes. All come back as strings. */
const INSIGHT_FIELDS = [
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'inline_link_clicks',
  'ctr',
  'inline_link_click_ctr',
  'cpc',
  'cpm',
  'actions',
  'action_values',
  'purchase_roas',
  'date_start',
  'date_stop',
].join(',');

const LEVEL_FIELDS: Record<string, string> = {
  account: INSIGHT_FIELDS,
  campaign: `${INSIGHT_FIELDS},campaign_id,campaign_name`,
  adset: `${INSIGHT_FIELDS},campaign_id,campaign_name,adset_id,adset_name`,
  ad: `${INSIGHT_FIELDS},campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name`,
};

/** Breakdown combinations Meta actually allows together. */
const ALLOWED_BREAKDOWNS = new Set([
  'age',
  'gender',
  'age,gender',
  'country',
  'region',
  'publisher_platform',
  'publisher_platform,platform_position',
  'impression_device',
  'device_platform',
  'hourly_stats_aggregated_by_advertiser_time_zone',
]);

const VALID_LEVELS = new Set(['account', 'campaign', 'adset', 'ad']);

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MetaError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Fetch one Graph API URL, following `paging.next` so callers get the complete
 * set. Capped: a runaway loop against a large account would blow the function's
 * execution budget and burn rate limit for no benefit.
 */
async function fetchAllPages(url: string, maxPages = 10): Promise<unknown[]> {
  const rows: unknown[] = [];
  let next: string | undefined = url;
  let page = 0;

  while (next && page < maxPages) {
    const response = await fetch(next);
    const body = (await response.json()) as {
      data?: unknown[];
      paging?: { next?: string };
      error?: MetaError;
    };

    if (!response.ok || body.error) {
      const err = body.error;
      throw Object.assign(new Error(err?.message ?? `Meta API returned ${response.status}`), {
        status: response.status,
        metaCode: err?.code,
        metaSubcode: err?.error_subcode,
        fbtrace_id: err?.fbtrace_id,
      });
    }

    rows.push(...(body.data ?? []));
    next = body.paging?.next;
    page += 1;
  }

  return rows;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.META_ACCESS_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID || DEFAULT_AD_ACCOUNT_ID;

  // A missing token is the normal state on GitHub Pages and on a fresh clone,
  // so answer with a recognisable shape the client can fall back from rather
  // than an error that looks like a bug.
  if (!token) {
    return res.status(503).json({
      configured: false,
      error:
        'Live data is not configured. Add META_ACCESS_TOKEN in your Vercel project ' +
        'settings (Settings -> Environment Variables), then redeploy.',
    });
  }

  // Accept "act_123", "123", or a pasted value with stray whitespace.
  const accountId = rawAccountId.trim().startsWith('act_')
    ? rawAccountId.trim()
    : `act_${rawAccountId.trim()}`;

  const q = req.query as Record<string, string | string[] | undefined>;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const resource = one(q.resource) ?? 'ping';
  const days = Math.min(Math.max(parseInt(one(q.days) ?? '30', 10) || 30, 1), 365);

  const timeRange = JSON.stringify({ since: isoDaysAgo(days - 1), until: todayIso() });

  try {
    let url: string;
    let paged = true;

    switch (resource) {
      /** Cheap credential check: proves the token can see the account. */
      case 'ping': {
        const probe = new URL(`${GRAPH}/${accountId}`);
        probe.searchParams.set('fields', 'id,name,account_status,currency,timezone_name,amount_spent');
        probe.searchParams.set('access_token', token);

        const response = await fetch(probe.toString());
        const body = (await response.json()) as Record<string, unknown> & { error?: MetaError };

        if (!response.ok || body.error) {
          return res.status(response.status === 200 ? 502 : response.status).json({
            configured: true,
            connected: false,
            error: body.error?.message ?? `Meta API returned ${response.status}`,
            metaCode: body.error?.code,
            fbtrace_id: body.error?.fbtrace_id,
          });
        }

        return res.status(200).json({
          configured: true,
          connected: true,
          apiVersion: API_VERSION,
          account: body,
        });
      }

      case 'insights': {
        const level = one(q.level) ?? 'account';
        if (!VALID_LEVELS.has(level)) {
          return res.status(400).json({ error: `Unsupported level "${level}".` });
        }

        const insights = new URL(`${GRAPH}/${accountId}/insights`);
        insights.searchParams.set('level', level);
        insights.searchParams.set('fields', LEVEL_FIELDS[level]);
        insights.searchParams.set('time_range', timeRange);
        // Match the attribution Ads Manager shows by default, so the dashboard
        // and the Meta UI do not quietly disagree on purchase counts.
        insights.searchParams.set('action_attribution_windows', JSON.stringify(['7d_click', '1d_view']));
        insights.searchParams.set('limit', '500');

        // time_increment=1 returns one row per day, which is what the trend
        // charts need. Omitted, Meta collapses the window into a single row.
        if (one(q.daily) === '1') insights.searchParams.set('time_increment', '1');

        const breakdowns = one(q.breakdowns);
        if (breakdowns) {
          if (!ALLOWED_BREAKDOWNS.has(breakdowns)) {
            return res.status(400).json({ error: `Unsupported breakdown "${breakdowns}".` });
          }
          insights.searchParams.set('breakdowns', breakdowns);
        }

        insights.searchParams.set('access_token', token);
        url = insights.toString();
        break;
      }

      /**
       * Status, objective and budget live on the entity edges, not on insights —
       * the dashboard joins the two by id.
       */
      case 'campaigns': {
        const u = new URL(`${GRAPH}/${accountId}/campaigns`);
        u.searchParams.set('fields', 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time');
        u.searchParams.set('limit', '200');
        u.searchParams.set('access_token', token);
        url = u.toString();
        break;
      }

      case 'adsets': {
        const u = new URL(`${GRAPH}/${accountId}/adsets`);
        u.searchParams.set('fields', 'id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting');
        u.searchParams.set('limit', '200');
        u.searchParams.set('access_token', token);
        url = u.toString();
        break;
      }

      case 'ads': {
        const u = new URL(`${GRAPH}/${accountId}/ads`);
        u.searchParams.set(
          'fields',
          'id,name,status,effective_status,adset_id,campaign_id,creative{id,thumbnail_url,object_type,title,body,call_to_action_type}',
        );
        u.searchParams.set('limit', '300');
        u.searchParams.set('access_token', token);
        url = u.toString();
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown resource "${resource}".` });
    }

    const data = paged ? await fetchAllPages(url) : [];

    // Cache at the edge so repeated views and date-range toggling do not each
    // cost a Meta API call — the rate limit is per ad account, not per visitor.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ configured: true, connected: true, data });
  } catch (err) {
    const e = err as Error & { status?: number; metaCode?: number; fbtrace_id?: string };
    // Surface Meta's own message: "(#200) Requires ads_read permission" tells the
    // user exactly what to fix, where a generic 500 tells them nothing.
    return res.status(e.status && e.status >= 400 && e.status < 600 ? e.status : 502).json({
      configured: true,
      connected: false,
      error: e.message,
      metaCode: e.metaCode,
      fbtrace_id: e.fbtrace_id,
    });
  }
}
