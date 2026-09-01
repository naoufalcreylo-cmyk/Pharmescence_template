# Pharmescence — Meta Ads Performance Dashboard

Agency-grade analytics for the Pharmescence Meta Ads account, with **Purchase** as the
primary conversion event.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # typecheck + production bundle into dist/
```

---

## Views

| Section | Route id | What it answers |
| --- | --- | --- |
| Executive Overview | `overview` | Is the account healthy right now? 17 KPI cards with prior-period deltas, sparklines and an account score. |
| Performance Trends | `trends` | Which metrics are improving? 9 metrics, daily / weekly / monthly grain. |
| Funnel | `funnel` | Where do people drop out? Impression → Purchase with per-step CVR, drop-off and cost. |
| Campaigns / Ad Sets / Ads | `campaigns` `adsets` `ads` | Entity tables and creative cards, sortable on every column. |
| Creative Insights | `creative` | Which *creative decision* won — format, headline, primary text, CTA. |
| Breakdowns | `breakdowns` | 12 Meta breakdown dimensions behind one control surface. |
| Geography | `geography` | Country / region / city, on a dot-matrix world map. |
| Placements | `placements` | Per-surface efficiency and publisher-platform split. |
| Time Analysis | `time` | Hour × weekday heatmap, plus hour / weekday / month tables. |
| Top Performers | `top` | Top 10 at each level under five ranking rules. |
| Waste & Worst | `worst` | Six waste detectors with the spend each puts at risk. |
| Scaling | `scaling` | Scale-readiness, saturation and fatigue signals. |
| Budget Engine | `engine` | Per-entity budget recommendation with confidence, risk and projected impact. |
| AI Insights | `insights` | One prioritised action plan merging every signal source. |
| KPI Ratios | `ratios` | 36 professional ratios with formula, benchmark and status. |
| Profitability | `profitability` | Revenue, profit, margin, CAC. |
| Alerts | `alerts` | Threshold breaches. |
| Reports | `reports` | Scheduled and ad-hoc report export. |

---

## Deploying to GitHub Pages

The repo ships with `.github/workflows/deploy.yml`, which rebuilds and republishes
the site on every push to `main`. One-time setup:

This project deploys to
[naoufalcreylo-cmyk/Pharmescence_template](https://github.com/naoufalcreylo-cmyk/Pharmescence_template).

1. **Push the code.** The remote is already configured, so this is just:

   ```bash
   git push -u origin main
   ```

2. **Turn Pages on**: repo → **Settings** → **Pages** → under "Build and deployment",
   set **Source** to **GitHub Actions**. This step is easy to miss and the deploy
   fails without it — the default is "Deploy from a branch", which is the old method
   and does not work with this workflow.

3. Watch the **Actions** tab. The first run takes 1–2 minutes. When it goes green
   the dashboard is live at:

   ```
   https://naoufalcreylo-cmyk.github.io/Pharmescence_template/
   ```

After setup, deploying is just `git push`.

### If the page loads blank

Almost always the sub-path problem. A project site lives at `/<repo-name>/`, not at
the domain root, so the bundle must be built with that prefix or every asset 404s.
The workflow handles this by passing `--base=/${{ github.event.repository.name }}/`
to the build. If you rename the repo it keeps working; if you copy the build step
somewhere else, carry that flag with it. Open the browser console (F12) — 404s on
`/assets/*.js` confirm this is the cause.

---

## Architecture

```
src/
├── types/            One source of truth for every entity and metric shape
├── data/
│   ├── mockData.ts        Entities, time series, alerts (swap for the API layer)
│   ├── breakdownData.ts   Every breakdown dimension + trend rollup
│   ├── performanceData.ts Rankings, waste detectors, creative aggregation
│   └── engineData.ts      Budget engine, KPI ratios, account score
├── lib/selectors.ts   Filter predicates and the summarize() roll-up
├── context/           Global filter store
├── components/
│   ├── ui/            DataTable, ExportMenu, EmptyState, ErrorBoundary, Skeleton, Badge
│   ├── charts/        WorldMap
│   ├── tables/        BreakdownTable
│   ├── filters/       FilterBar
│   ├── kpi/           KPICard, AccountScore
│   └── layout/        Sidebar, Header
├── pages/             One file per view
└── utils/             Formatters, export engine
```

### Three rules the codebase holds to

**1. Ratios are always recomputed from counters.**
A ratio of sums is not the sum of ratios. Aggregating a CTR column by averaging it
gives the wrong answer the moment rows differ in size. Every aggregation point —
`buildRow`, `summarize`, `groupTimeSeries`, `groupCreative` — sums the raw counters
first and derives ROAS, CPA, CTR, CPM, CPC and frequency afterwards.

**2. Column definitions are shared between render and export.**
`DataTable` builds its `ExportColumn[]` from the same `Column[]` it renders, so a CSV
can never drift from the table it came from. Export runs against the filtered and
sorted set, not the visible page.

**3. Filters cascade through the hierarchy.**
Targeting filters (age, gender, placement, country) are evaluated at the ad-set level —
where Meta actually stores targeting — then propagate up to campaigns and down to ads,
so totals reconcile across all three levels.

### Performance

Built for accounts far larger than the sample data:

- Sorting and filtering run inside `useMemo` over the full row set; only one page of
  rows is ever committed to the DOM.
- Table search is wrapped in `useDeferredValue`, so typing never blocks a large sort.
- Filter evaluation is memoised on the filter object identity in `FiltersContext`.
- Recharts and d3 are split into their own chunk (`charts`), which changes far less
  often than dashboard code and stays cached across deploys.

### Resilience

- `ErrorBoundary` is scoped per page and keyed on the active route, so one failing
  view never blanks the dashboard mid-review.
- Every table and gallery has a distinct empty state for "no data" versus "no rows
  match your filters", the second offering a way back.
- Skeletons render through the same code path a live fetch would use.

---

## Live Meta Marketing API data

### How it is wired

A static bundle has nowhere safe to keep an access token — anything the browser can
read, a visitor can read. So live data goes through a serverless function:

```
Browser ──► /api/meta (Vercel function, holds the token) ──► graph.facebook.com
```

- **`api/meta.ts`** — the proxy. Runs on Vercel, never in the browser. Accepts a fixed
  set of named resources rather than forwarding an arbitrary path, so a crafted request
  cannot aim the token at an endpoint it was not meant for. Responses are edge-cached
  for 5 minutes, because Meta rate limits per ad account rather than per visitor.
- **`src/lib/metaApi.ts`** — the client. Absorbs the Insights API's quirks in one place:
  numeric fields arrive as strings, conversions hide in an `actions` array keyed by
  event name, budgets are in minor units, and an absent metric means zero. Ratios are
  recomputed from counters so they survive aggregation.
- **`src/pages/Connection.tsx`** — the Live Data page. Verifies credentials, pulls a
  real 30-day figure to check against Ads Manager, and explains Meta's error codes.

Without a backend the client throws a recognisable "not configured" error and the app
falls back to sample data, so the same build runs on GitHub Pages as a static demo.

### Setup

One secret, set in Vercel → Project → Settings → Environment Variables:

| Key | Value |
| --- | --- |
| `META_ACCESS_TOKEN` | System User token, `ads_read` scope only |

Then **redeploy** — Vercel reads environment variables at build time, so a deployment
created before the variable existed will not see it. This is the single most common
reason setup appears to fail.

The ad account is set in `api/meta.ts` rather than an env var: an account ID is
configuration, not a credential. Override it with `META_AD_ACCOUNT_ID` if needed.

`ads_read` is read-only by design. A leaked token could expose numbers but could not
spend money or change campaigns. Never grant `ads_management`, and never put a token
in source code — this repo is public.

### Extending it to the rest of the dashboard

Live data currently drives the Live Data page. The remaining pages still read the
sample data in `src/data/`, and each one moves across the same way:

1. **Entities** — `fetchEntities('campaigns' | 'adsets' | 'ads')` returns status,
   objective and budget. Join them to `fetchInsights(level)` by id; insights carry
   the metrics, the entity edges carry everything else.
2. **Daily series** — `fetchInsights('account', { daily: true })` returns one row per
   day, which is the shape `TimeSeriesPoint` and the trend charts expect.
3. **Breakdowns** — `breakdownData.ts` maps one-to-one onto the API's `breakdowns`
   parameter (`age`, `gender`, `publisher_platform,platform_position`,
   `impression_device`, `country`, `region`,
   `hourly_stats_aggregated_by_advertiser_time_zone`). Feed each row through
   `normalizeRow`, then `buildRow`, and the derived ratios stay correct.
4. **Comparison periods** — KPI cards need a previous-period value per metric; issue
   the same call with a shifted window.
5. **Volume** — use the async insights job (`POST`, then poll `report_run_id`) for
   long date ranges on large accounts. The derived layers (`performanceData`,
   `engineData`) need no changes at all: they read the entity tables and know nothing
   about the API.

### If purchases come back as zero

Meta reports the same conversion under different event names depending on account
setup. `PURCHASE_ACTIONS` in `src/lib/metaApi.ts` tries
`offsite_conversion.fb_pixel_purchase`, then `omni_purchase`, then `purchase`. If Ads
Manager shows purchases and the dashboard does not, your event uses a name outside
that list — add it. The Live Data page flags this case explicitly.

### Thresholds worth reviewing

Business assumptions are constants rather than magic numbers scattered through the UI:

- `TARGET_ROAS` in `performanceData.ts` — break-even ROAS at your margin, currently `2.5`.
- Waste detector cut-offs in `detectWaste()` — minimum spend before an entity is
  flagged, CPA multiple above account average, frequency ceiling.
- Fatigue weights in `fatigueScore()` — frequency pressure, CTR gap, trend decline.
- Benchmarks and status bands in `engineData.ts` for the KPI ratio grades.
