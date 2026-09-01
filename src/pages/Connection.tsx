import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  PlugZap, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink, Loader2,
} from 'lucide-react';
import {
  checkConnection, fetchInsights, MetaApiError,
} from '../lib/metaApi';
import type { ConnectionState, NormalizedRow } from '../lib/metaApi';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier } from '../utils/formatters';
import { Badge } from '../components/ui/Badge';

/**
 * Live data setup and diagnostics.
 *
 * The rest of the dashboard falls back to sample data silently when no backend
 * is present, which is the right behaviour for a demo but a terrible way to
 * debug credentials. This page is the opposite: it says exactly what is wrong
 * and what to do about it, and pulls a real 30-day figure to check against Ads
 * Manager before any of the numbers get trusted.
 */

/** Meta's error codes are terse; these are the ones a first-time setup hits. */
function explainMetaError(message: string, code?: number): { cause: string; fix: string } {
  if (code === 190 || /access token/i.test(message)) {
    return {
      cause: 'The access token is invalid, expired, or was revoked.',
      fix: 'Tokens from the Graph API Explorer expire in about an hour. Generate a System User token in Business Settings instead — those do not expire — then update META_ACCESS_TOKEN in Vercel and redeploy.',
    };
  }
  if (code === 200 || code === 10 || /permission/i.test(message)) {
    return {
      cause: 'The token is valid but lacks permission to read this ad account.',
      fix: 'The token needs the ads_read scope, and the System User must be assigned to this ad account with at least "View performance" access in Business Settings.',
    };
  }
  if (code === 803 || /does not exist|cannot be loaded/i.test(message)) {
    return {
      cause: 'The ad account ID was not found, or this token cannot see it.',
      fix: 'Check META_AD_ACCOUNT_ID. It is the numeric ID from Ads Manager, in the form act_123456789. A Business Manager ID or Page ID will produce this error.',
    };
  }
  if (code === 17 || code === 4 || /rate limit|too many calls/i.test(message)) {
    return {
      cause: 'Meta is rate limiting this ad account.',
      fix: 'Rate limits are per ad account and reset on a rolling window. Wait a few minutes. Responses are edge-cached for 5 minutes to keep this rare.',
    };
  }
  if (code === 100) {
    return {
      cause: 'Meta rejected a parameter in the request.',
      fix: 'Usually a malformed account ID or an unsupported field for this account type. The exact message above names the parameter.',
    };
  }
  return {
    cause: 'Meta rejected the request.',
    fix: 'The message above is returned verbatim by Meta and usually names the problem directly.',
  };
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-bg-border/60 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-white font-medium text-right">{value}</span>
    </div>
  );
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: 'Active',
  2: 'Disabled',
  3: 'Unsettled',
  7: 'Pending review',
  9: 'In grace period',
  100: 'Pending closure',
  101: 'Closed',
};

export function Connection() {
  const [state, setState] = useState<ConnectionState>({ status: 'checking' });
  const [sample, setSample] = useState<NormalizedRow | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const run = useCallback(async () => {
    setState({ status: 'checking' });
    setSample(null);
    setSampleError(null);

    const result = await checkConnection();
    setState(result);

    // Reaching the account proves the credentials work; pulling real insights
    // proves the data path works, which is a different failure mode.
    if (result.status === 'connected') {
      setLoadingSample(true);
      try {
        const rows = await fetchInsights('account', { days: 30 });
        setSample(rows[0] ?? null);
      } catch (err) {
        setSampleError((err as MetaApiError).message);
      } finally {
        setLoadingSample(false);
      }
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  return (
    <div className="space-y-5 animate-slide-up max-w-4xl">
      {/* Status header */}
      <div
        className={clsx(
          'card p-5',
          state.status === 'connected' && 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.07] to-transparent',
          state.status === 'error' && 'border-rose-500/30 bg-gradient-to-br from-rose-500/[0.07] to-transparent',
          state.status === 'not-configured' && 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] to-transparent',
        )}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div
            className={clsx(
              'w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0',
              state.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20'
              : state.status === 'error' ? 'bg-rose-500/10 border-rose-500/20'
              : state.status === 'not-configured' ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-brand-500/10 border-brand-500/20',
            )}
          >
            {state.status === 'checking' && <Loader2 size={22} className="text-brand-400 animate-spin" />}
            {state.status === 'connected' && <CheckCircle2 size={22} className="text-emerald-400" />}
            {state.status === 'error' && <XCircle size={22} className="text-rose-400" />}
            {state.status === 'not-configured' && <AlertTriangle size={22} className="text-amber-400" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Meta Marketing API</p>
            <p className="text-2xl font-bold text-white leading-tight mb-1.5">
              {state.status === 'checking' && 'Checking connection...'}
              {state.status === 'connected' && `Connected to ${state.account.name}`}
              {state.status === 'error' && 'Connection failed'}
              {state.status === 'not-configured' && 'Running on sample data'}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              {state.status === 'connected' &&
                'Live data is flowing. Compare the 30-day figures below against Ads Manager before relying on the dashboard.'}
              {state.status === 'not-configured' && state.message}
              {state.status === 'error' && state.message}
              {state.status === 'checking' && 'Asking the backend whether it can reach your ad account.'}
            </p>
          </div>

          <button
            onClick={() => void run()}
            disabled={state.status === 'checking'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-bg-elevated border border-bg-border text-slate-300 hover:text-white hover:border-brand-600/50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={clsx(state.status === 'checking' && 'animate-spin')} />
            Retest
          </button>
        </div>
      </div>

      {/* Connected: account facts + a real number to verify */}
      {state.status === 'connected' && (
        <>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Ad Account</h2>
            <StatusRow label="Name" value={state.account.name} />
            <StatusRow label="Account ID" value={<span className="font-mono text-xs">{state.account.id}</span>} />
            <StatusRow
              label="Status"
              value={
                <Badge variant={state.account.account_status === 1 ? 'success' : 'warning'}>
                  {ACCOUNT_STATUS[state.account.account_status] ?? `Code ${state.account.account_status}`}
                </Badge>
              }
            />
            <StatusRow label="Currency" value={state.account.currency} />
            <StatusRow label="Timezone" value={state.account.timezone_name} />
            <StatusRow label="API version" value={state.apiVersion} />
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Last 30 days, straight from Meta</h2>
            <p className="text-xs text-slate-500 mb-4">
              Attribution is 7-day click / 1-day view, matching the Ads Manager default. Open Ads Manager
              on the same window — these should agree. If they do not, the attribution setting is the first
              thing to check.
            </p>

            {loadingSample ? (
              <p className="text-sm text-slate-500 py-4">Loading account insights...</p>
            ) : sampleError ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                <p className="text-sm text-rose-400 font-medium mb-1">Credentials work, but the insights call failed</p>
                <p className="text-sm text-slate-400">{sampleError}</p>
              </div>
            ) : !sample ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <p className="text-sm text-amber-400 font-medium mb-1">Connected, but no delivery in this window</p>
                <p className="text-sm text-slate-400">
                  Meta returned zero rows for the last 30 days. That is expected on an account with no active
                  campaigns — it is not an error.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Spend', value: formatCurrency(sample.spend) },
                  { label: 'Purchases', value: formatNumber(sample.purchases) },
                  { label: 'Revenue', value: formatCurrency(sample.revenue) },
                  { label: 'ROAS', value: formatMultiplier(sample.roas) },
                  { label: 'Impressions', value: formatNumber(sample.impressions, true) },
                  { label: 'Link clicks', value: formatNumber(sample.linkClicks) },
                  { label: 'CTR', value: formatPercent(sample.ctr) },
                  { label: 'CPA', value: formatCurrency(sample.cpa) },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-bg-border bg-bg-elevated p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-white tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {sample && sample.purchases === 0 && sample.spend > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <p className="text-sm text-amber-400 font-medium mb-1">Spend recorded, but zero purchases</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  If Ads Manager shows purchases for this window, the pixel event is being reported under a
                  different name than expected. Adjust <span className="font-mono text-xs">PURCHASE_ACTIONS</span> in{' '}
                  <span className="font-mono text-xs">src/lib/metaApi.ts</span> to match your event.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Error: what went wrong and what to do */}
      {state.status === 'error' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-3">What this usually means</h2>
          {(() => {
            const { cause, fix } = explainMetaError(state.message, state.metaCode);
            return (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Likely cause</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{cause}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">How to fix it</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{fix}</p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-slate-500">
                  {state.metaCode !== undefined && <span>Meta error code {state.metaCode}</span>}
                  {state.fbtrace_id && <span className="font-mono">trace {state.fbtrace_id}</span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Setup instructions */}
      {state.status !== 'connected' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-1 inline-flex items-center gap-2">
            <PlugZap size={14} className="text-brand-400" />
            Connecting your ad account
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Two environment variables, set once in Vercel. The token never reaches the browser.
          </p>

          <ol className="space-y-4">
            {[
              {
                title: 'Find your ad account ID',
                body: (
                  <>
                    In Ads Manager the account ID sits in the account dropdown. The dashboard wants it as{' '}
                    <span className="font-mono text-xs text-brand-300">act_123456789</span>.
                  </>
                ),
                link: { href: 'https://adsmanager.facebook.com', label: 'Open Ads Manager' },
              },
              {
                title: 'Create a Meta app',
                body: <>Create an app of type <strong className="text-slate-300">Business</strong>, then add the Marketing API product to it.</>,
                link: { href: 'https://developers.facebook.com/apps', label: 'developers.facebook.com/apps' },
              },
              {
                title: 'Generate a System User token',
                body: (
                  <>
                    Business Settings → Users → System Users → add one → assign this ad account with{' '}
                    <strong className="text-slate-300">View performance</strong> → Generate New Token with the{' '}
                    <span className="font-mono text-xs text-brand-300">ads_read</span> scope only. System User
                    tokens do not expire; Graph API Explorer tokens die within the hour.
                  </>
                ),
                link: { href: 'https://business.facebook.com/settings', label: 'Open Business Settings' },
              },
              {
                title: 'Add both values to Vercel',
                body: (
                  <>
                    Project → Settings → Environment Variables. Add{' '}
                    <span className="font-mono text-xs text-brand-300">META_ACCESS_TOKEN</span> and{' '}
                    <span className="font-mono text-xs text-brand-300">META_AD_ACCOUNT_ID</span>, then redeploy —
                    environment variables are read at deploy time, so an existing deployment will not pick them up.
                  </>
                ),
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="w-6 h-6 rounded-lg bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white mb-0.5">{step.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
                  {step.link && (
                    <a
                      href={step.link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      {step.link.label}
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-xs text-slate-500 leading-relaxed border-t border-bg-border pt-4">
            Never commit the token to the repository. It belongs only in Vercel's environment variables —
            this repo is public, and leaked ad-account tokens are found by automated scanners within minutes.
          </p>
        </div>
      )}
    </div>
  );
}
