import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  lines?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'shimmer-bg rounded-lg',
        className
      )}
      style={style}
    />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="card p-5 space-y-3 animate-fade-in">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      <Skeleton className="w-full" style={{ height }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-slate-600 text-sm">Loading chart...</div>
      </div>
    </div>
  );
}

/** Full-page loading state: KPI row, chart block and a table. */
export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="w-full" style={{ height: 280 }} />
      </div>
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
