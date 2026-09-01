import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Download, FileSpreadsheet, FileText, Printer, Table2, Check } from 'lucide-react';
import { runExport } from '../../utils/export';
import type { ExportColumn, ExportFormat } from '../../utils/export';

interface ExportMenuProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  name: string;
  title?: string;
  subtitle?: string;
  label?: string;
  className?: string;
}

const OPTIONS: { id: ExportFormat; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'csv', label: 'CSV', hint: 'Raw data, UTF-8', icon: Table2 },
  { id: 'excel', label: 'Excel', hint: 'Formatted .xls workbook', icon: FileSpreadsheet },
  { id: 'pdf', label: 'PDF Report', hint: 'Branded, print-ready', icon: FileText },
  { id: 'print', label: 'Print', hint: 'Current view', icon: Printer },
];

export function ExportMenu<T>({
  rows,
  columns,
  name,
  title,
  subtitle,
  label = 'Export',
  className,
}: ExportMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handle = (format: ExportFormat) => {
    runExport(format, rows, columns, name, {
      title: title ?? name,
      subtitle: subtitle ?? `${rows.length.toLocaleString()} rows — Pharmescence Meta Ads`,
    });
    setOpen(false);
    setDone(format);
    setTimeout(() => setDone(null), 2000);
  };

  return (
    <div className={clsx('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={rows.length === 0}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
          'bg-bg-elevated border-bg-border text-slate-300 hover:text-white hover:border-brand-600/50',
          'disabled:opacity-40 disabled:pointer-events-none',
          open && 'border-brand-600/60 text-white',
        )}
      >
        {done ? <Check size={13} className="text-emerald-400" /> : <Download size={13} />}
        {done ? 'Exported' : label}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-bg-border bg-bg-elevated shadow-card-hover z-40 overflow-hidden animate-fade-in">
          <p className="px-3 pt-2.5 pb-1.5 text-xs text-slate-500">
            {rows.length.toLocaleString()} rows, {columns.length} columns
          </p>
          {OPTIONS.map(o => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={() => handle(o.id)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-bg-hover transition-colors"
              >
                <Icon size={15} className="text-brand-400 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm text-white font-medium">{o.label}</span>
                  <span className="block text-xs text-slate-500 truncate">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
