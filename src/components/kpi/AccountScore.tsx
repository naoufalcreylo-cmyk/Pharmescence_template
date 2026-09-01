import { clsx } from 'clsx';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import type { AccountScore, RatioStatus, ScoreDimension } from '../../types';

interface AccountScoreWidgetProps {
  score: AccountScore;
  compact?: boolean;
}

const STATUS_COLOR: Record<RatioStatus, string> = {
  excellent: 'text-emerald-400',
  good:      'text-cyan-400',
  average:   'text-amber-400',
  poor:      'text-rose-400',
};

const STATUS_BG: Record<RatioStatus, string> = {
  excellent: 'bg-emerald-500/10',
  good:      'bg-cyan-500/10',
  average:   'bg-amber-500/10',
  poor:      'bg-rose-500/10',
};

const STATUS_BAR: Record<RatioStatus, string> = {
  excellent: '#10B981',
  good:      '#06B6D4',
  average:   '#F59E0B',
  poor:      '#F43F5E',
};

const STATUS_ICON: Record<RatioStatus, React.ElementType> = {
  excellent: CheckCircle,
  good:      TrendingUp,
  average:   AlertTriangle,
  poor:      XCircle,
};

function GaugeMeter({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  // 75% arc (270deg)
  const arcPct = 0.75;
  const arcLen = circ * arcPct;
  const dashLen = (score / 100) * arcLen;
  const gap = arcLen - dashLen;

  const scoreColor = score >= 80 ? '#10B981' : score >= 65 ? '#06B6D4' : score >= 50 ? '#F59E0B' : '#F43F5E';
  const gradId = 'score-grad';

  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 140 140" className="w-full h-full" style={{ transform: 'rotate(135deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={scoreColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={scoreColor} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx="70" cy="70" r={r}
          fill="none" stroke="#2A2A42" strokeWidth="8"
          strokeDasharray={`${arcLen} ${circ - arcLen}`}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <circle
          cx="70" cy="70" r={r}
          fill="none" stroke={`url(#${gradId})`} strokeWidth="9"
          strokeDasharray={`${dashLen} ${circ - dashLen}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const angle = (pct / 100) * 270 * (Math.PI / 180);
          const x1 = 70 + (r - 12) * Math.cos(angle);
          const y1 = 70 + (r - 12) * Math.sin(angle);
          const x2 = 70 + (r - 6) * Math.cos(angle);
          const y2 = 70 + (r - 6) * Math.sin(angle);
          return (
            <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={pct <= score ? scoreColor : '#3a3a52'} strokeWidth="2" />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 12 }}>
        <span className="text-3xl font-black" style={{ color: scoreColor }}>{score}</span>
        <span className="text-sm font-bold" style={{ color: scoreColor }}>{grade}</span>
        <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function DimensionBar({ dim }: { dim: ScoreDimension }) {
  const barColor = STATUS_BAR[dim.status];
  const Icon = STATUS_ICON[dim.status];
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-28 shrink-0">
        <span className="text-xs text-slate-400 font-medium">{dim.label}</span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${dim.score}%`, background: barColor }}
        />
      </div>
      <div className="w-8 text-right">
        <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>{dim.score}</span>
      </div>
    </div>
  );
}

export function AccountScoreWidget({ score, compact = false }: AccountScoreWidgetProps) {
  if (compact) {
    const scoreColor = score.overall >= 80 ? 'text-emerald-400' : score.overall >= 65 ? 'text-cyan-400' : score.overall >= 50 ? 'text-amber-400' : 'text-rose-400';
    const scoreBg = score.overall >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : score.overall >= 65 ? 'bg-cyan-500/10 border-cyan-500/20' : score.overall >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';
    return (
      <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-xl border', scoreBg)}>
        <span className={clsx('text-lg font-black', scoreColor)}>{score.overall}</span>
        <div>
          <p className="text-xs font-bold text-white leading-tight">Account Score</p>
          <p className="text-xs text-slate-500">Grade: {score.grade}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Gauge + summary */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          <GaugeMeter score={score.overall} grade={score.grade} />
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Performance Score</p>
            <p className="text-xs text-slate-500 mt-1">Pharmescence · Meta Ads</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* AI Summary */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">{score.summary}</p>
          </div>

          {/* Top priorities */}
          {score.priorities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Priorities to Improve Score</p>
              <div className="flex flex-wrap gap-2">
                {score.priorities.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-3 py-1">
                    <span className="text-xs font-black text-rose-500">#{i + 1}</span>
                    <span className="text-xs font-medium">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dimension Bars */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Score Breakdown</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {score.dimensions.map(dim => (
                <DimensionBar key={dim.label} dim={dim} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
