import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { DollarSign, TrendingUp, TrendingDown, Target, ShoppingBag } from 'lucide-react';
import { clsx } from 'clsx';
import { timeSeriesData } from '../data/mockData';
import { formatCurrency, formatPercent, formatMultiplier, formatNumber } from '../utils/formatters';

interface ProfitabilityProps {
  selectedDays: number;
}

export function Profitability({ selectedDays }: ProfitabilityProps) {
  const recent = timeSeriesData.slice(-selectedDays);

  const totalSpend = recent.reduce((s, d) => s + d.spend, 0);
  const totalRevenue = recent.reduce((s, d) => s + d.revenue, 0);
  const totalPurchases = recent.reduce((s, d) => s + d.purchases, 0);
  const totalProfit = totalRevenue - totalSpend;
  const profitMargin = (totalProfit / totalRevenue) * 100;
  const blendedROAS = totalRevenue / totalSpend;
  const avgAOV = totalRevenue / totalPurchases;
  const cac = totalSpend / totalPurchases;

  // COGS assumption: 35% of revenue
  const cogs = totalRevenue * 0.35;
  const grossProfit = totalRevenue - totalSpend - cogs;
  const grossMargin = (grossProfit / totalRevenue) * 100;

  const chartData = recent.map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    Revenue: parseFloat(d.revenue.toFixed(0)),
    AdSpend: parseFloat(d.spend.toFixed(0)),
    Profit: parseFloat((d.revenue - d.spend).toFixed(0)),
    ROAS: parseFloat(d.roas.toFixed(2)),
    AOV: parseFloat((d.revenue / Math.max(d.purchases, 1)).toFixed(2)),
  }));

  const summaryCards = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue, true), sub: `from ${formatNumber(totalPurchases)} purchases`, icon: DollarSign, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Ad Spend', value: formatCurrency(totalSpend, true), sub: `${formatPercent((totalSpend / totalRevenue) * 100)} of revenue`, icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Net Profit', value: formatCurrency(totalProfit, true), sub: `${formatPercent(profitMargin)} margin`, icon: TrendingUp, color: totalProfit > 0 ? 'text-emerald-400' : 'text-rose-400', bg: totalProfit > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
    { label: 'ROAS', value: formatMultiplier(blendedROAS), sub: `Target: 3.0x`, icon: Target, color: blendedROAS >= 3 ? 'text-emerald-400' : blendedROAS >= 2 ? 'text-amber-400' : 'text-rose-400', bg: 'bg-brand-500/10' },
    { label: 'Avg Order Value', value: formatCurrency(avgAOV), sub: `per purchase`, icon: ShoppingBag, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Customer Acq Cost', value: formatCurrency(cac), sub: `CPA / ad spend`, icon: Target, color: cac < 30 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-3', card.bg)}>
                <Icon size={16} className={card.color} />
              </div>
              <p className={clsx('text-xl font-bold', card.color)}>{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{card.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* P&L Summary */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Profit & Loss Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[
              { label: 'Gross Revenue', value: totalRevenue, color: 'text-cyan-400', bold: false },
              { label: '- Ad Spend (COGS: Ads)', value: -totalSpend, color: 'text-rose-400', bold: false },
              { label: '- Estimated Product COGS (35%)', value: -cogs, color: 'text-rose-400', bold: false },
              { label: '= Gross Profit', value: grossProfit, color: grossProfit > 0 ? 'text-emerald-400' : 'text-rose-400', bold: true },
              { label: 'Gross Margin', value: null, display: formatPercent(grossMargin), color: grossMargin > 0 ? 'text-emerald-400' : 'text-rose-400', bold: false },
            ].map(row => (
              <div key={row.label} className={clsx('flex justify-between items-center', row.bold && 'border-t border-bg-border pt-3 mt-1')}>
                <span className={clsx('text-sm', row.bold ? 'font-bold text-white' : 'text-slate-400')}>{row.label}</span>
                <span className={clsx('text-sm tabular-nums', row.bold ? 'font-bold' : 'font-medium', row.color)}>
                  {row.display ?? formatCurrency(row.value ?? 0)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Breakeven Analysis</h3>
            {[
              { label: 'Breakeven ROAS (with COGS)', value: `${(1 / (1 - 0.35)).toFixed(2)}x`, note: 'Min ROAS to cover product cost' },
              { label: 'Current ROAS', value: formatMultiplier(blendedROAS), note: blendedROAS > 1 / (1 - 0.35) ? '✓ Above breakeven' : '✗ Below breakeven' },
              { label: 'Target ROAS', value: '3.00x', note: '30% net margin target' },
              { label: 'ROAS Gap to Target', value: formatMultiplier(Math.max(0, 3 - blendedROAS)), note: blendedROAS >= 3 ? '✓ On target' : 'Needs improvement' },
            ].map(row => (
              <div key={row.label} className="bg-bg-elevated rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className="text-sm font-bold text-white">{row.value}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue vs Spend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Ad Spend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSpendP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                contentStyle={{ background: '#1E1E32', border: '1px solid #2A2A42', borderRadius: '12px', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="Revenue" stroke="#06B6D4" strokeWidth={2} fill="url(#gradRev)" dot={false} />
              <Area type="monotone" dataKey="AdSpend" stroke="#F43F5E" strokeWidth={2} fill="url(#gradSpendP)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Profit */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Net Profit (Revenue – Spend)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => [formatCurrency(Number(v)), 'Profit']}
                contentStyle={{ background: '#1E1E32', border: '1px solid #2A2A42', borderRadius: '12px', fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" />
              <Bar dataKey="Profit" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <rect key={i} fill={d.Profit >= 0 ? '#10B981' : '#F43F5E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
