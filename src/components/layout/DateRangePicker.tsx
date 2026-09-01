import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { DATE_PRESETS, buildRange, makeCustomRange, daysBetween } from '../../lib/dateRanges';
import type { DateRange, DatePresetId } from '../../lib/dateRanges';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const GROUPS: { title: string; group: 'Quick' | 'Rolling' | 'Calendar' }[] = [
  { title: 'Quick', group: 'Quick' },
  { title: 'Rolling', group: 'Rolling' },
  { title: 'Calendar', group: 'Calendar' },
];

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draftSince, setDraftSince] = useState(value.since);
  const [draftUntil, setDraftUntil] = useState(value.until);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setCustomMode(false); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setCustomMode(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Re-seed the custom inputs whenever the picker opens, so the draft starts
  // from whatever is currently applied rather than a stale earlier edit.
  useEffect(() => {
    if (open) {
      setDraftSince(value.since);
      setDraftUntil(value.until);
    }
  }, [open, value.since, value.until]);

  const pick = (preset: DatePresetId) => {
    onChange(buildRange(preset));
    setOpen(false);
    setCustomMode(false);
  };

  const applyCustom = () => {
    if (!draftSince || !draftUntil) return;
    onChange(makeCustomRange(draftSince, draftUntil));
    setOpen(false);
    setCustomMode(false);
  };

  const draftDays = draftSince && draftUntil ? daysBetween(draftSince, draftUntil) : 0;
  // Meta's Insights API will not return windows older than 37 months.
  // Local calendar date, not toISOString(): the latter is UTC and would bar the
  // user from selecting today whenever local time runs ahead of UTC.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 bg-bg-elevated border rounded-xl px-3 py-2 text-xs font-medium transition-colors',
          open ? 'border-brand-600/60 text-white' : 'border-bg-border text-slate-300 hover:text-white hover:border-brand-600/50',
        )}
      >
        <Calendar size={14} className="text-brand-400" />
        <span className="hidden sm:block">{value.label}</span>
        <span className="hidden md:block text-slate-500">
          {value.since === value.until ? shortDate(value.since) : `${shortDate(value.since)} – ${shortDate(value.until)}`}
        </span>
        <ChevronDown size={12} className="text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-bg-elevated border border-bg-border rounded-2xl shadow-card-hover z-50 overflow-hidden animate-fade-in">
          {!customMode ? (
            <>
              <div className="max-h-80 overflow-y-auto py-1">
                {GROUPS.map(({ title, group }) => (
                  <div key={group} className="pb-1">
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      {title}
                    </p>
                    {DATE_PRESETS.filter(p => p.group === group).map(p => {
                      const active = value.preset === p.id;
                      const preview = buildRange(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => pick(p.id)}
                          className={clsx(
                            'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                            active ? 'bg-brand-600/15 text-brand-400' : 'text-slate-300 hover:bg-bg-hover hover:text-white',
                          )}
                        >
                          <span className="flex-1 text-sm">{p.label}</span>
                          <span className="text-xs text-slate-500">
                            {preview.since === preview.until
                              ? shortDate(preview.since)
                              : `${shortDate(preview.since)} – ${shortDate(preview.until)}`}
                          </span>
                          {active && <Check size={13} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setCustomMode(true)}
                className={clsx(
                  'w-full border-t border-bg-border px-3 py-2.5 text-sm text-left transition-colors',
                  value.preset === 'custom'
                    ? 'bg-brand-600/15 text-brand-400'
                    : 'text-slate-300 hover:bg-bg-hover hover:text-white',
                )}
              >
                Custom range…
                {value.preset === 'custom' && (
                  <span className="block text-xs text-slate-500 mt-0.5">{value.label}</span>
                )}
              </button>
            </>
          ) : (
            <div className="p-3.5 space-y-3">
              <p className="text-sm font-semibold text-white">Custom range</p>

              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">From</span>
                <input
                  type="date"
                  value={draftSince}
                  max={today}
                  onChange={e => setDraftSince(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-600/60"
                />
              </label>

              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">To</span>
                <input
                  type="date"
                  value={draftUntil}
                  max={today}
                  onChange={e => setDraftUntil(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-600/60"
                />
              </label>

              {draftDays > 0 && (
                <p className="text-xs text-slate-500">
                  {draftDays} day{draftDays > 1 ? 's' : ''} selected. The comparison period will be the{' '}
                  {draftDays} day{draftDays > 1 ? 's' : ''} immediately before.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCustomMode(false)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-bg-card border border-bg-border text-slate-400 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={applyCustom}
                  disabled={!draftSince || !draftUntil}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
