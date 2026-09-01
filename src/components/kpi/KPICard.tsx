import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { clsx } from 'clsx';
import { formatValue, formatDelta, getTrendColor, getTrendBg } from '../../utils/formatters';
import type { KPIMetric } from '../../types';

interface KPICardProps {
  metric: KPIMetric;
  onClick?: () => void;
  isSelected?: boolean;
}

export function KPICard({ metric, onClick, isSelected }: KPICardProps) {
  const delta = formatDelta(metric.value, metric.previousValue);
  const invertTrend = metric.invertTrend ?? false;
  const isPositive = invertTrend ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  const trendColor = isNeutral ? 'text-slate-400' : isPositive ? 'text-emerald-400' : 'text-rose-400';
  const trendBg = isNeutral ? 'bg-slate-500/10' : isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10';
  const chartColor = isNeutral ? '#64748b' : isPositive ? '#10B981' : '#F43F5E';

  const sparklineData = metric.sparkline?.map((v, i) => ({ i, v })) ?? [];

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card p-5 flex flex-col gap-3 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-brand-600/50 hover:shadow-card-hover',
        isSelected && 'border-brand-600/60 shadow-glow'
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider leading-tight">
          {metric.label}
        </span>
        {!isNeutral && delta !== 0 && (
          <div className={clsx('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', trendBg, trendColor)}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
        {isNeutral && (
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-500/10 text-slate-400">
            <Minus size={11} />0%
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-white tracking-tight leading-none">
            {formatValue(metric.value, metric.format)}
          </p>
          {metric.previousValue > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              vs {formatValue(metric.previousValue, metric.format)} prev
            </p>
          )}
        </div>
      </div>

      {sparklineData.length > 0 && (
        <div className="mt-auto -mx-1">
          <ResponsiveContainer width="100%" height={44}>
            <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`grad-${metric.label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#grad-${metric.label})`}
                dot={false}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
