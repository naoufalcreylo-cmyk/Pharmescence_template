import { TrendingUp, Pause, RefreshCw, Copy, Expand, Settings, DollarSign, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { insights, campaigns, ads } from '../data/mockData';
import { formatCurrency, formatMultiplier } from '../utils/formatters';
import type { Insight } from '../types';

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  scale: TrendingUp,
  pause: Pause,
  refresh: RefreshCw,
  duplicate: Copy,
  expand: Expand,
  optimize: Settings,
};

const INSIGHT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  scale: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500' },
  pause: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-l-rose-500' },
  refresh: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-l-amber-500' },
  duplicate: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-l-cyan-500' },
  expand: { bg: 'bg-brand-500/10', text: 'text-brand-400', border: 'border-l-brand-500' },
  optimize: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500' },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = INSIGHT_ICONS[insight.type];
  const colors = INSIGHT_COLORS[insight.type];

  return (
    <div className={clsx('card p-5 border-l-2 transition-all hover:shadow-card-hover', colors.border)}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
          <Icon size={16} className={colors.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', PRIORITY_BADGE[insight.priority])}>
              {insight.priority.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">{insight.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 bg-bg-elevated rounded-lg px-2 py-1 truncate max-w-xs">
              {insight.entity}
            </span>
            {insight.potentialRevenue && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <DollarSign size={11} />
                {insight.impact}
              </span>
            )}
            {!insight.potentialRevenue && (
              <span className="text-xs text-slate-500 italic">{insight.impact}</span>
            )}
          </div>
        </div>
        <button className={clsx('shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors', colors.bg, colors.text, 'border-current/20 hover:opacity-80')}>
          Apply
        </button>
      </div>
    </div>
  );
}

function ScoreCard({ title, score, label, color }: { title: string; score: number; label: string; color: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">{title}</p>
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2A2A42" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${score} ${100 - score}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

export function Scaling() {
  const highPriority = insights.filter(i => i.priority === 'high');
  const mediumPriority = insights.filter(i => i.priority === 'medium');
  const lowPriority = insights.filter(i => i.priority === 'low');

  const potentialRevenue = insights.reduce((s, i) => s + (i.potentialRevenue ?? 0), 0);

  // Fatigue detection
  const highFreqAds = ads.filter(a => a.frequency > 3);
  const lowRoasHighSpend = campaigns.filter(c => c.roas < 2 && c.spend > 2000);
  const readyToScale = campaigns.filter(c => c.roas >= 4 && c.trend > 5);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Account Score Cards */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Account Opportunity Score</h2>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered analysis of your account's scaling potential</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Potential Revenue</p>
            <p className="text-lg font-bold text-emerald-400">+{formatCurrency(potentialRevenue, true)}/mo</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ScoreCard title="Scale Readiness" score={72} label="High opportunity" color="#10B981" />
          <ScoreCard title="Creative Health" score={58} label="Refresh needed" color="#F59E0B" />
          <ScoreCard title="Audience Quality" score={81} label="Strong signals" color="#06B6D4" />
          <ScoreCard title="Budget Efficiency" score={64} label="Waste detected" color="#F43F5E" />
        </div>
      </div>

      {/* Quick Wins */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-400">Ready to Scale</h3>
          </div>
          <p className="text-2xl font-black text-white mb-1">{readyToScale.length}</p>
          <p className="text-xs text-slate-400">campaigns with ROAS ≥ 4x and positive trend</p>
          {readyToScale.map(c => (
            <p key={c.id} className="text-xs text-emerald-400 mt-1 truncate">↑ {c.name.split('|')[1]?.trim()}</p>
          ))}
        </div>
        <div className="card p-4 border border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-rose-400" />
            <h3 className="text-sm font-semibold text-rose-400">Waste Detected</h3>
          </div>
          <p className="text-2xl font-black text-white mb-1">{lowRoasHighSpend.length}</p>
          <p className="text-xs text-slate-400">campaigns with ROAS &lt; 2x and spend &gt; $2k</p>
          {lowRoasHighSpend.map(c => (
            <p key={c.id} className="text-xs text-rose-400 mt-1 truncate">✗ {c.name.split('|')[1]?.trim()}</p>
          ))}
        </div>
        <div className="card p-4 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400">Creative Fatigue</h3>
          </div>
          <p className="text-2xl font-black text-white mb-1">{highFreqAds.length}</p>
          <p className="text-xs text-slate-400">ads with frequency above 3.0 — refresh required</p>
          {highFreqAds.map(a => (
            <p key={a.id} className="text-xs text-amber-400 mt-1 truncate">⚠ {a.name.split('|').pop()?.trim()}</p>
          ))}
        </div>
      </div>

      {/* Insights by Priority */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400" /> High Priority Actions
        </h2>
        <div className="space-y-3">
          {highPriority.map(i => <InsightCard key={i.id} insight={i} />)}
        </div>
      </div>

      {mediumPriority.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium Priority
          </h2>
          <div className="space-y-3">
            {mediumPriority.map(i => <InsightCard key={i.id} insight={i} />)}
          </div>
        </div>
      )}

      {lowPriority.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> Low Priority / Optimization
          </h2>
          <div className="space-y-3">
            {lowPriority.map(i => <InsightCard key={i.id} insight={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}
