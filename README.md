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

1. **Create an empty repo** at [github.com/new](https://github.com/new). Name it
   `pharmescence-dashboard`. Leave "Add a README", ".gitignore" and "license"
   **unchecked** — this project already has them, and checking them causes a
   conflict on your first push. It must be **Public** unless you have GitHub Pro,
   because Pages on private repos is a paid feature.

2. **Push the code** (replace `YOUR-USERNAME`):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/pharmescence-dashboard.git
   git push -u origin main
   ```

3. **Turn Pages on**: repo → **Settings** → **Pages** → under "Build and deployment",
   set **Source** to **GitHub Actions**. This step is easy to miss and the deploy
   fails without it — the default is "Deploy from a branch", which is the old method
   and does not work with this workflow.

4. Watch the **Actions** tab. The first run takes 1–2 minutes. When it goes green
   your dashboard is live at:

   ```
   https://YOUR-USERNAME.github.io/pharmescence-dashboard/
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

## Connecting the live Meta Marketing API

The data layer is isolated behind `src/data/`. Everything else consumes typed values
from `src/types/`, so wiring the real account means replacing the module bodies, not
the components.

1. **Entities** — replace the exports in `mockData.ts` with calls to
   `/act_<AD_ACCOUNT_ID>/campaigns`, `/adsets` and `/ads`, requesting `insights{...}`
   inline to avoid one request per entity.
2. **Metrics** — request these fields on the insights edge:
   `spend, impressions, reach, frequency, clicks, inline_link_clicks, ctr,
   inline_link_click_ctr, cpc, cpm, actions, action_values, purchase_roas`.
   Purchase counts live in `actions` under `offsite_conversion.fb_pixel_purchase`;
   revenue lives in the matching `action_values` entry.
3. **Breakdowns** — `breakdownData.ts` maps one-to-one onto the API's `breakdowns`
   parameter (`age`, `gender`, `publisher_platform`, `platform_position`,
   `impression_device`, `country`, `region`, `hourly_stats_aggregated_by_advertiser_time_zone`).
   Feed each response row through `buildRow` and the derived ratios stay correct.
4. **Comparison periods** — the KPI cards expect a previous-period value per metric;
   issue the same insights call with the shifted `time_range`.
5. **Rate limits and volume** — request `time_increment: 1` only where the daily series
   is needed, and use the async insights job (`POST` then poll `report_run_id`) for
   large date ranges. Keep the derived layers (`performanceData`, `engineData`) as they
   are — they read from the entity tables and need no API knowledge.

### Thresholds worth reviewing

Business assumptions are constants rather than magic numbers scattered through the UI:

- `TARGET_ROAS` in `performanceData.ts` — break-even ROAS at your margin, currently `2.5`.
- Waste detector cut-offs in `detectWaste()` — minimum spend before an entity is
  flagged, CPA multiple above account average, frequency ceiling.
- Fatigue weights in `fatigueScore()` — frequency pressure, CTR gap, trend decline.
- Benchmarks and status bands in `engineData.ts` for the KPI ratio grades.
