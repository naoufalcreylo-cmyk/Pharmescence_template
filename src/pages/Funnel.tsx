import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowDown, TrendingDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { computeFunnel } from '../data/derive';
import { formatNumber, formatCurrency, formatPercent } from '../utils/formatters';

interface FunnelProps {
  selectedDays: number;
}

const FUNNEL_COLORS = ['#7C3AED', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#10B981'];
const GRADIENT_IDS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'];

export function Funnel({ selectedDays }: FunnelProps) {
  const { timeSeries } = useData();
  const steps = computeFunnel(timeSeries, selectedDays);
  const maxVal = steps[0].value;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Funnel */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-white mb-6">Conversion Funnel</h2>
          <div className="space-y-2">
            {steps.map((step, i) => {
              const widthPct = (step.value / maxVal) * 100;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.name}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-medium text-slate-400 w-32 shrink-0">{step.name}</span>
                    <div className="flex-1 h-10 relative rounded-lg overflow-hidden bg-bg-elevated">
                      <div
                        className="h-full rounded-lg flex items-center px-3 transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          background: `linear-gradient(90deg, ${FUNNEL_COLORS[i]}, ${FUNNEL_COLORS[i]}99)`,
                          minWidth: '60px',
                        }}
                      >
                        <span className="text-xs font-bold text-white whitespace-nowrap">
                          {formatNumber(step.value, true)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-400 w-16 text-right shrink-0">
                      {formatCurrency(step.cost, i === 0)}
                    </span>
                  </div>
                  {!isLast && (
                    <div className="flex items-center gap-3 my-1 ml-32">
                      <div className="flex items-center gap-1.5 ml-3">
                        <ArrowDown size={12} className="text-rose-400" />
                        <span className="text-xs text-rose-400 font-medium">
                          {steps[i + 1].dropOff.toFixed(1)}% drop-off
                        </span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-emerald-400 font-medium">
                          {steps[i + 1].conversionRate.toFixed(1)}% converted
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Funnel Metrics Table */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Stage Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Volume</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conv Rate</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drop-off</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost/Step</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={step.name} className="border-b border-bg-border/50 hover:bg-bg-hover transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: FUNNEL_COLORS[i] }} />
                        <span className="text-sm text-slate-300 font-medium">{step.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-sm font-semibold text-white tabular-nums">
                      {formatNumber(step.value, true)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`text-sm font-medium ${i === 0 ? 'text-slate-400' : step.conversionRate > 20 ? 'text-emerald-400' : step.conversionRate > 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {i === 0 ? '—' : formatPercent(step.conversionRate)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {i === 0 ? (
                        <span className="text-slate-500 text-sm">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <TrendingDown size={11} className="text-rose-400" />
                          <span className="text-sm text-rose-400 font-medium">{step.dropOff.toFixed(1)}%</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right text-sm text-slate-300 tabular-nums">
                      {i === 0 ? formatCurrency(step.cost) + '/k' : formatCurrency(step.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Funnel Bar Chart */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Funnel Volume Comparison</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={steps} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              {GRADIENT_IDS.map((id, i) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FUNNEL_COLORS[i]} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={FUNNEL_COLORS[i]} stopOpacity={0.5} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v, true)} />
            <Tooltip
              formatter={(v: any) => [formatNumber(Number(v)), 'Volume']}
              contentStyle={{ background: '#1E1E32', border: '1px solid #2A2A42', borderRadius: '12px' }}
              labelStyle={{ color: '#94A3B8', fontSize: 12 }}
              itemStyle={{ color: '#fff', fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {steps.map((_, i) => (
                <Cell key={i} fill={`url(#${GRADIENT_IDS[i]})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-medium">Biggest Drop-off</p>
          <p className="text-base font-bold text-rose-400">Clicks → Landing Page</p>
          <p className="text-xs text-slate-500 mt-1">~18% of clicks bounce before landing page loads. Check page speed and mobile experience.</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-medium">Checkout Abandonment</p>
          <p className="text-base font-bold text-amber-400">~47% Complete Purchase</p>
          <p className="text-xs text-slate-500 mt-1">Over half of checkout initiations don't purchase. Consider cart abandonment emails and retargeting.</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-medium">Overall CVR</p>
          <p className="text-base font-bold text-emerald-400">{formatPercent(steps[steps.length - 1].conversionRate)} of ATCs</p>
          <p className="text-xs text-slate-500 mt-1">Add-to-cart to purchase conversion. Industry benchmark is 25–35%.</p>
        </div>
      </div>
    </div>
  );
}
