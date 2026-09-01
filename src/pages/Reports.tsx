import { Download, FileText, Table, BarChart3, Printer, Mail, Share2, Calendar, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { useData } from '../context/DataContext';
import { computeAccountKPIs } from '../data/derive';
import { formatCurrency, formatMultiplier, formatPercent, formatNumber } from '../utils/formatters';
import { format } from 'date-fns';

interface ReportsProps {
  selectedDays: number;
}

function exportToCSV(data: Record<string, any>[], filename: string) {
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports({ selectedDays }: ReportsProps) {
  const { campaigns, adSets, ads, timeSeries } = useData();
  const kpis = computeAccountKPIs(timeSeries, selectedDays);
  const today = format(new Date(2026, 5, 29), 'MMMM d, yyyy');

  const exportCampaigns = () => {
    exportToCSV(campaigns.map(c => ({
      Name: c.name,
      Status: c.status,
      Spend: c.spend.toFixed(2),
      Purchases: c.purchases,
      Revenue: c.revenue.toFixed(2),
      ROAS: c.roas.toFixed(2),
      CPA: c.cpa.toFixed(2),
      CTR: c.ctr.toFixed(2),
      CPM: c.cpm.toFixed(2),
    })), 'pharmescence_campaigns');
  };

  const exportAdSets = () => {
    exportToCSV(adSets.map(a => ({
      Name: a.name,
      Campaign: a.campaignName,
      Status: a.status,
      Audience: a.audience,
      Spend: a.spend.toFixed(2),
      Purchases: a.purchases,
      ROAS: a.roas.toFixed(2),
      CPA: a.cpa.toFixed(2),
    })), 'pharmescence_adsets');
  };

  const exportAds = () => {
    exportToCSV(ads.map(a => ({
      Name: a.name,
      Format: a.format,
      Status: a.status,
      Spend: a.spend.toFixed(2),
      Purchases: a.purchases,
      Revenue: a.revenue.toFixed(2),
      ROAS: a.roas.toFixed(2),
      CPA: a.cpa.toFixed(2),
      CTR: a.ctr.toFixed(2),
    })), 'pharmescence_ads');
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Quick Export */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Quick Data Export</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Campaign Report', sub: `${campaigns.length} campaigns`, icon: BarChart3, onClick: exportCampaigns, color: 'text-brand-400', bg: 'bg-brand-500/10' },
            { label: 'Ad Set Report', sub: `${adSets.length} ad sets`, icon: Table, onClick: exportAdSets, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            { label: 'Ad Creative Report', sub: `${ads.length} ads`, icon: FileText, onClick: exportAds, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Print Dashboard', sub: 'Current view', icon: Printer, onClick: handlePrint, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="card p-4 flex items-center gap-3 hover:shadow-card-hover hover:border-brand-600/30 transition-all text-left group"
              >
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', item.bg)}>
                  <Icon size={16} className={item.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.sub} · CSV</p>
                </div>
                <Download size={13} className="text-slate-600 ml-auto group-hover:text-brand-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Preview */}
      <div className="card p-6" id="report-preview">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded bg-gradient-brand flex items-center justify-center">
                <BarChart3 size={12} className="text-white" />
              </div>
              <h1 className="text-lg font-black text-white">Pharmescence</h1>
            </div>
            <p className="text-sm text-slate-400">Meta Ads Performance Report</p>
            <p className="text-xs text-slate-600 mt-0.5">Generated: {today} · Last {selectedDays} Days</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Account</p>
            <p className="text-sm font-semibold text-white">Pharmescence</p>
            <p className="text-xs text-slate-600">act_6182940</p>
          </div>
        </div>

        {/* Executive KPIs */}
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Executive Summary</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Spend', value: formatCurrency(kpis.spend.value, true) },
            { label: 'Revenue', value: formatCurrency(kpis.revenue.value, true) },
            { label: 'Purchases', value: formatNumber(kpis.purchases.value) },
            { label: 'ROAS', value: formatMultiplier(kpis.roas.value) },
            { label: 'CPA', value: formatCurrency(kpis.cpa.value) },
            { label: 'CTR', value: formatPercent(kpis.ctr.value) },
          ].map(k => (
            <div key={k.label} className="bg-bg-elevated rounded-xl p-3 text-center">
              <p className="text-base font-black text-white">{k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Campaign Table in Report */}
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Campaign Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bg-border">
                {['Campaign', 'Status', 'Spend', 'Purchases', 'Revenue', 'ROAS', 'CPA', 'CTR', 'Freq'].map(h => (
                  <th key={h} className={clsx('py-2 px-2 font-semibold text-slate-500 uppercase tracking-wider', h === 'Campaign' ? 'text-left' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={clsx('border-b border-bg-border/50', i % 2 === 0 ? '' : 'bg-bg-surface/20')}>
                  <td className="py-2 px-2 font-medium text-slate-300 max-w-[200px] truncate">{c.name.replace('Pharmescence | ', '')}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={clsx('font-medium', c.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400')}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-300">{formatCurrency(c.spend)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-emerald-400 font-semibold">{c.purchases}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-cyan-400">{formatCurrency(c.revenue)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <span className={c.roas >= 3 ? 'text-emerald-400' : c.roas >= 2 ? 'text-amber-400' : 'text-rose-400'}>
                      {formatMultiplier(c.roas)}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-300">{formatCurrency(c.cpa)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-300">{formatPercent(c.ctr)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <span className={c.frequency > 3 ? 'text-amber-400' : 'text-slate-300'}>{c.frequency.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-4 border-t border-bg-border flex items-center justify-between">
          <p className="text-xs text-slate-600">Generated by Pharmescence Meta Ads Dashboard · Confidential</p>
          <p className="text-xs text-slate-600">{today}</p>
        </div>
      </div>
    </div>
  );
}
