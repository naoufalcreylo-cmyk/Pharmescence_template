/**
 * Date range presets.
 *
 * Deliberately mirrors Ads Manager's own presets, including the detail that
 * "Last N days" **ends yesterday, not today**. Meta reports that way because
 * today's delivery is still incomplete and conversions keep landing for hours
 * afterwards. Matching it is what lets a media buyer compare this dashboard
 * against Ads Manager and see the same numbers.
 */

export type DatePresetId =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_60d'
  | 'last_90d'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface DateRange {
  preset: DatePresetId;
  /** Inclusive start, YYYY-MM-DD. */
  since: string;
  /** Inclusive end, YYYY-MM-DD. */
  until: string;
  label: string;
  /** Inclusive day count — drives the previous-period comparison. */
  days: number;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shift(base: Date, deltaDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

/** Inclusive day span between two ISO dates. */
export function daysBetween(since: string, until: string): number {
  const a = new Date(`${since}T00:00:00`);
  const b = new Date(`${until}T00:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export function makeCustomRange(since: string, until: string): DateRange {
  // Tolerate a reversed selection rather than returning an empty window.
  const [from, to] = since <= until ? [since, until] : [until, since];
  return {
    preset: 'custom',
    since: from,
    until: to,
    label: from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`,
    days: daysBetween(from, to),
  };
}

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildRange(preset: DatePresetId, now = new Date()): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = shift(today, -1);

  const rolling = (n: number, label: string): DateRange => ({
    preset,
    // Ends yesterday, matching Ads Manager.
    since: iso(shift(yesterday, -(n - 1))),
    until: iso(yesterday),
    label,
    days: n,
  });

  switch (preset) {
    case 'today':
      return { preset, since: iso(today), until: iso(today), label: 'Today', days: 1 };

    case 'yesterday':
      return { preset, since: iso(yesterday), until: iso(yesterday), label: 'Yesterday', days: 1 };

    case 'last_7d': return rolling(7, 'Last 7 days');
    case 'last_14d': return rolling(14, 'Last 14 days');
    case 'last_30d': return rolling(30, 'Last 30 days');
    case 'last_60d': return rolling(60, 'Last 60 days');
    case 'last_90d': return rolling(90, 'Last 90 days');

    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        preset,
        since: iso(start),
        until: iso(today),
        label: 'This month',
        days: daysBetween(iso(start), iso(today)),
      };
    }

    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        preset,
        since: iso(start),
        until: iso(end),
        label: 'Last month',
        days: daysBetween(iso(start), iso(end)),
      };
    }

    case 'custom':
    default:
      return rolling(30, 'Last 30 days');
  }
}

export const DATE_PRESETS: { id: DatePresetId; label: string; group: 'Quick' | 'Rolling' | 'Calendar' }[] = [
  { id: 'today', label: 'Today', group: 'Quick' },
  { id: 'yesterday', label: 'Yesterday', group: 'Quick' },
  { id: 'last_7d', label: 'Last 7 days', group: 'Rolling' },
  { id: 'last_14d', label: 'Last 14 days', group: 'Rolling' },
  { id: 'last_30d', label: 'Last 30 days', group: 'Rolling' },
  { id: 'last_60d', label: 'Last 60 days', group: 'Rolling' },
  { id: 'last_90d', label: 'Last 90 days', group: 'Rolling' },
  { id: 'this_month', label: 'This month', group: 'Calendar' },
  { id: 'last_month', label: 'Last month', group: 'Calendar' },
];

export const DEFAULT_RANGE = buildRange('last_30d');

/** The equally-long window immediately before `range`, for period comparisons. */
export function previousRange(range: DateRange): { since: string; until: string } {
  const start = new Date(`${range.since}T00:00:00`);
  const prevUntil = shift(start, -1);
  const prevSince = shift(prevUntil, -(range.days - 1));
  return { since: iso(prevSince), until: iso(prevUntil) };
}
