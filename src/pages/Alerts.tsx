import { AlertTriangle, CheckCircle, Info, XCircle, Bell, TrendingDown, TrendingUp, Zap, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { alerts, insights } from '../data/mockData';
import { formatCurrency, formatMultiplier, formatPercent } from '../utils/formatters';
import type { Alert } from '../types';

const ALERT_STYLES = {
  danger: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-500/5',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    icon: XCircle,
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: AlertTriangle,
  },
  info: {
    border: 'border-l-cyan-500',
    bg: 'bg-cyan-500/5',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    icon: Info,
  },
  success: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle,
  },
};

function AlertCard({ alert }: { alert: Alert }) {
  const style = ALERT_STYLES[alert.type];
  const Icon = style.icon;

  return (
    <div className={clsx('card border-l-2 p-5 transition-all hover:shadow-card-hover', style.border, style.bg)}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', style.iconBg)}>
          <Icon size={16} className={style.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">{alert.title}</h3>
              <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full border', style.badge)}>
                {alert.type.toUpperCase()}
              </span>
              {alert.actionable && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Actionable
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600 shrink-0 whitespace-nowrap">{alert.timestamp.split(' ')[0]}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">{alert.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Eye size={11} />
              {alert.entity}
            </span>
            {alert.value > 0 && (
              <span className={clsx('text-xs font-bold', style.iconColor)}>
                {alert.metric}: {
                  alert.metric === 'ROAS' ? formatMultiplier(alert.value) :
                  alert.metric === 'CPA' ? formatCurrency(alert.value) :
                  alert.metric === 'CTR' ? formatPercent(alert.value) :
                  alert.value.toFixed(2)
                }
              </span>
            )}
            {alert.threshold > 0 && (
              <span className="text-xs text-slate-600">
                Threshold: {
                  alert.metric === 'ROAS' ? formatMultiplier(alert.threshold) :
                  alert.metric === 'CPA' ? formatCurrency(alert.threshold) :
                  alert.threshold.toFixed(2)
                }
              </span>
            )}
          </div>
        </div>
        {alert.actionable && (
          <button className={clsx('shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors', style.iconBg, style.iconColor, 'border-current/20 hover:opacity-80')}>
            Review
          </button>
        )}
      </div>
    </div>
  );
}

export function Alerts() {
  const critical = alerts.filter(a => a.type === 'danger');
  const warnings = alerts.filter(a => a.type === 'warning');
  const successes = alerts.filter(a => a.type === 'success');
  const infos = alerts.filter(a => a.type === 'info');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: critical.length, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: XCircle },
          { label: 'Warnings', count: warnings.length, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
          { label: 'Opportunities', count: successes.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
          { label: 'Info', count: infos.length, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Info },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={clsx('card p-4 border', s.border)}>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}>
                <Icon size={16} className={s.color} />
              </div>
              <p className={clsx('text-2xl font-black', s.color)}>{s.count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alerts by severity */}
      {critical.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <XCircle size={13} /> Critical Issues — Immediate Action Required
          </h2>
          <div className="space-y-3">
            {critical.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={13} /> Warnings — Monitor Closely
          </h2>
          <div className="space-y-3">
            {warnings.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {successes.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle size={13} /> Opportunities Detected
          </h2>
          <div className="space-y-3">
            {successes.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {infos.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Info size={13} /> Informational
          </h2>
          <div className="space-y-3">
            {infos.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
