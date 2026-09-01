import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { KPICard } from '../components/kpi/KPICard';
import { AccountScoreWidget } from '../components/kpi/AccountScore';
import { useData } from '../context/DataContext';
import { computeAccountKPIs } from '../data/derive';
import { computeAccountScore } from '../data/engineData';
import { formatCurrency, formatNumber, formatPercent, formatMultiplier, formatValue } from '../utils/formatters';
import type { KPIMetric } from '../types';

interface OverviewProps {
  selectedDays: number;
}

const CHART_COLORS = {
  spend: '#7C3AED',
  revenue: '#06B6D4',
  purchases: '#10B981',
  roas: '#FBBF24',
  cpa: '#F43F5E',
  ctr: '#8B5CF6',
  cpm: '#F59E0B',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl p-3 shadow-card text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value?.toLocaleString?.() ?? p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function Overview({ selectedDays }: OverviewProps) {
  const { timeSeries } = useData();
  const kpis = computeAccountKPIs(timeSeries, selectedDays);
  const recent = timeSeries.slice(-selectedDays);
  const accountScore = computeAccountScore(selectedDays);

  const sparkline = (key: keyof typeof recent[0]) =>
    recent.map(d => d[key] as number);

  const metrics: KPIMetric[] = [
    {
      label: 'Total Spend',
      value: kpis.spend.value,
      previousValue: kpis.spend.previous,
      format: 'currency',
      sparkline: sparkline('spend'),
      invertTrend: true,
    },
    {
      label: 'Purchases',
      value: kpis.purchases.value,
      previousValue: kpis.purchases.previous,
      format: 'number',
      sparkline: sparkline('purchases'),
    },
    {
      label: 'Revenue',
      value: kpis.revenue.value,
      previousValue: kpis.revenue.previous,
      format: 'currency',
      sparkline: sparkline('revenue'),
    },
    {
      label: 'ROAS',
      value: kpis.roas.value,
      previousValue: kpis.roas.previous,
      format: 'multiplier',
      sparkline: recent.map(d => d.roas),
    },
    {
      label: 'Cost Per Purchase',
      value: kpis.cpa.value,
      previousValue: kpis.cpa.previous,
      format: 'currency',
      sparkline: recent.map(d => d.cpa),
      invertTrend: true,
    },
    {
      label: 'CPM',
      value: kpis.cpm.value,
      previousValue: kpis.cpm.previous,
      format: 'currency',
      sparkline: recent.map(d => d.cpm),
      invertTrend: true,
    },
    {
      label: 'CTR (Link)',
      value: kpis.ctr.value,
      previousValue: kpis.ctr.previous,
      format: 'percent',
      sparkline: recent.map(d => d.ctr),
    },
    {
      label: 'CPC',
      value: kpis.cpc.value,
      previousValue: kpis.cpc.previous,
      format: 'currency',
      sparkline: recent.map(d => d.cpc),
      invertTrend: true,
    },
    {
      label: 'Link Clicks',
      value: kpis.clicks.value,
      previousValue: kpis.clicks.previous,
      format: 'number',
      sparkline: sparkline('clicks'),
    },
    {
      label: 'Landing Page Views',
      value: kpis.landingPageViews.value,
      previousValue: 0,
      format: 'number',
      sparkline: sparkline('landingPageViews'),
    },
    {
      label: 'Add to Cart',
      value: kpis.addToCart.value,
      previousValue: 0,
      format: 'number',
      sparkline: sparkline('addToCart'),
    },
    {
      label: 'Initiate Checkout',
      value: kpis.initiateCheckout.value,
      previousValue: 0,
      format: 'number',
      sparkline: sparkline('initiateCheckout'),
    },
    {
      label: 'Cost per ATC',
      value: kpis.costPerATC.value,
      previousValue: 0,
      format: 'currency',
      invertTrend: true,
    },
    {
      label: 'Cost per Checkout',
      value: kpis.costPerCheckout.value,
      previousValue: 0,
      format: 'currency',
      invertTrend: true,
    },
    {
      label: 'Avg Frequency',
      value: kpis.frequency.value,
      previousValue: 0,
      format: 'raw',
      invertTrend: true,
    },
    {
      label: 'Reach',
      value: kpis.reach.value,
      previousValue: 0,
      format: 'number',
    },
    {
      label: 'Impressions',
      value: kpis.impressions.value,
      previousValue: kpis.impressions.previous,
      format: 'number',
      sparkline: sparkline('impressions'),
    },
  ];

  const chartData = recent.map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    Spend: parseFloat(d.spend.toFixed(0)),
    Revenue: parseFloat(d.revenue.toFixed(0)),
    Purchases: d.purchases,
    ROAS: parseFloat(d.roas.toFixed(2)),
    CPA: parseFloat(d.cpa.toFixed(2)),
    CTR: parseFloat(d.ctr.toFixed(2)),
    CPM: parseFloat(d.cpm.toFixed(2)),
    Frequency: parseFloat(d.frequency.toFixed(2)),
  }));

  const totalSpend = kpis.spend.value;
  const totalRevenue = kpis.revenue.value;
  const totalProfit = totalRevenue - totalSpend;
  const profitMargin = (totalProfit / totalRevenue) * 100;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Account Health Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-4 md:gap-8">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Account Health</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">Good</span>
        </div>
        <div className="h-4 w-px bg-bg-border hidden md:block" />
        {[
          { label: 'Spend', value: formatCurrency(totalSpend, true), color: 'text-white' },
          { label: 'Revenue', value: formatCurrency(totalRevenue, true), color: 'text-cyan-400' },
          { label: 'Profit', value: formatCurrency(totalProfit, true), color: totalProfit > 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'ROAS', value: formatMultiplier(kpis.roas.value), color: kpis.roas.value >= 2 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Margin', value: formatPercent(profitMargin), color: profitMargin > 0 ? 'text-emerald-400' : 'text-rose-400' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">{item.label}:</span>
            <span className={clsx('text-sm font-bold', item.color)}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Account Performance Score */}
      <AccountScoreWidget score={accountScore} />

      {/* KPI Grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Key Performance Indicators</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {metrics.map((m) => (
            <KPICard key={m.label} metric={m} />
          ))}
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Spend vs Revenue */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Spend vs Revenue</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily performance trend</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-brand-500" />Spend
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />Revenue
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
              <Area type="monotone" dataKey="Spend" stroke="#7C3AED" strokeWidth={2} fill="url(#gradSpend)" dot={false} />
              <Area type="monotone" dataKey="Revenue" stroke="#06B6D4" strokeWidth={2} fill="url(#gradRevenue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ROAS & CPA */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">ROAS & CPA Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Efficiency over time</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />ROAS
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" />CPA
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis yAxisId="roas" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}x`} />
              <YAxis yAxisId="cpa" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine yAxisId="roas" y={2} stroke="#7C3AED" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line yAxisId="roas" type="monotone" dataKey="ROAS" stroke="#FBBF24" strokeWidth={2} dot={false} />
              <Line yAxisId="cpa" type="monotone" dataKey="CPA" stroke="#F43F5E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Purchases */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Purchases</h3>
              <p className="text-xs text-slate-500 mt-0.5">Purchase volume over time</p>
            </div>
            <div className="text-sm font-bold text-emerald-400">{formatNumber(kpis.purchases.value)} total</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPurchases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Purchases" fill="url(#gradPurchases)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CTR & CPM */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">CTR & CPM</h3>
              <p className="text-xs text-slate-500 mt-0.5">Click & cost metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-brand-400" />CTR
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />CPM
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A42" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis yAxisId="ctr" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="cpm" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line yAxisId="ctr" type="monotone" dataKey="CTR" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              <Line yAxisId="cpm" type="monotone" dataKey="CPM" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-2 border-emerald-500">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Winning</p>
              <p className="text-sm font-semibold text-white mt-0.5">Retargeting Campaigns</p>
              <p className="text-xs text-slate-500 mt-1">4.45–5.28x ROAS across all retargeting. Scale budget 30–40%.</p>
            </div>
          </div>
        </div>
        <div className="card p-5 border-l-2 border-rose-500">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Action Required</p>
              <p className="text-sm font-semibold text-white mt-0.5">Awareness Campaign</p>
              <p className="text-xs text-slate-500 mt-1">0.64x ROAS — pause and reallocate $2,860 to retargeting.</p>
            </div>
          </div>
        </div>
        <div className="card p-5 border-l-2 border-brand-500">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Opportunity</p>
              <p className="text-sm font-semibold text-white mt-0.5">Advantage+ Scaling</p>
              <p className="text-xs text-slate-500 mt-1">DPA Advantage+ shows +17.2% trend — increase budget to $400/day.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
