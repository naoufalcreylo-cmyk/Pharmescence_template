export function formatCurrency(value: number, compact = false): string {
  if (compact && value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (compact && value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, compact = false): string {
  if (compact && value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatMultiplier(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}x`;
}

export function formatDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function formatDeltaStr(current: number, previous: number): string {
  const delta = formatDelta(current, previous);
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export function formatValue(
  value: number,
  format: 'currency' | 'number' | 'percent' | 'multiplier' | 'raw',
  compact = false
): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value, compact);
    case 'number':
      return formatNumber(value, compact);
    case 'percent':
      return formatPercent(value);
    case 'multiplier':
      return formatMultiplier(value);
    case 'raw':
      return value.toFixed(2);
    default:
      return String(value);
  }
}

export function getRankingColor(ranking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE'): string {
  switch (ranking) {
    case 'ABOVE_AVERAGE':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'AVERAGE':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'BELOW_AVERAGE':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  }
}

export function getRankingLabel(ranking: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE'): string {
  switch (ranking) {
    case 'ABOVE_AVERAGE':
      return 'Above Avg';
    case 'AVERAGE':
      return 'Average';
    case 'BELOW_AVERAGE':
      return 'Below Avg';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'PAUSED':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'DELETED':
    case 'ARCHIVED':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    default:
      return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  }
}

export function getTrendColor(delta: number, invert = false): string {
  const positive = invert ? delta < 0 : delta > 0;
  if (delta === 0) return 'text-slate-400';
  return positive ? 'text-emerald-400' : 'text-rose-400';
}

export function getTrendBg(delta: number, invert = false): string {
  const positive = invert ? delta < 0 : delta > 0;
  if (delta === 0) return 'bg-slate-500/10';
  return positive ? 'bg-emerald-500/10' : 'bg-rose-500/10';
}
