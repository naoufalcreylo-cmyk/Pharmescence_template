import { clsx } from 'clsx';
import { Inbox, SearchX, AlertTriangle, CheckCircle2 } from 'lucide-react';

type EmptyVariant = 'empty' | 'no-results' | 'error' | 'all-clear';

interface EmptyStateProps {
  variant?: EmptyVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  compact?: boolean;
}

const VARIANTS: Record<EmptyVariant, { icon: React.ElementType; tone: string; ring: string }> = {
  empty: { icon: Inbox, tone: 'text-slate-400', ring: 'bg-slate-500/10 border-slate-500/20' },
  'no-results': { icon: SearchX, tone: 'text-brand-400', ring: 'bg-brand-500/10 border-brand-500/20' },
  error: { icon: AlertTriangle, tone: 'text-rose-400', ring: 'bg-rose-500/10 border-rose-500/20' },
  'all-clear': { icon: CheckCircle2, tone: 'text-emerald-400', ring: 'bg-emerald-500/10 border-emerald-500/20' },
};

export function EmptyState({
  variant = 'empty',
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  const { icon: Icon, tone, ring } = VARIANTS[variant];
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className,
      )}
    >
      <div className={clsx('rounded-2xl border flex items-center justify-center mb-4', ring, compact ? 'w-10 h-10' : 'w-14 h-14')}>
        <Icon size={compact ? 18 : 24} className={tone} />
      </div>
      <p className={clsx('font-semibold text-white', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
