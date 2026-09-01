import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import type { GeoPoint } from '../../data/breakdownData';
import { formatCurrency, formatNumber, formatMultiplier } from '../../utils/formatters';

/**
 * Dot-matrix world map (§13).
 *
 * Land is rasterised on a 5deg x 4deg equirectangular grid rather than shipped as
 * detailed country paths: the whole basemap costs a few hundred bytes, renders as
 * plain SVG circles, and stays legible at dashboard size. Countries carry a
 * proportional bubble positioned by centroid, sized by the selected metric and
 * coloured by ROAS against target.
 */

const COLS = 72;
const ROWS = 35;
const LAT_TOP = 84;
const LAT_BOTTOM = -56;
const W = 720;
const H = 350;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;

/** Inclusive [startCol, endCol] land spans per grid row, north to south. */
const LAND: [number, number][][] = [
  [[22, 28], [28, 32], [39, 39], [52, 58]],
  [[18, 27], [27, 32], [38, 40], [50, 60]],
  [[12, 26], [26, 32], [46, 48], [54, 60], [64, 68]],
  [[5, 26], [27, 31], [38, 70]],
  [[3, 25], [27, 31], [33, 34], [37, 70]],
  [[3, 25], [28, 31], [33, 34], [37, 70]],
  [[4, 25], [30, 31], [34, 70]],
  [[3, 8], [11, 25], [33, 36], [37, 68]],
  [[11, 25], [34, 36], [36, 68]],
  [[11, 23], [34, 66]],
  [[11, 22], [33, 65]],
  [[11, 21], [33, 65]],
  [[12, 20], [34, 43], [43, 64]],
  [[13, 20], [34, 43], [43, 64]],
  [[14, 17], [19, 20], [33, 43], [43, 63]],
  [[15, 17], [19, 21], [33, 43], [44, 62]],
  [[15, 17], [20, 23], [33, 44], [46, 61]],
  [[17, 19], [33, 45], [50, 62]],
  [[20, 24], [33, 46], [51, 62]],
  [[20, 25], [34, 45], [57, 62]],
  [[20, 26], [36, 44], [56, 64]],
  [[21, 27], [37, 44], [56, 64]],
  [[21, 28], [38, 44], [57, 64], [64, 66]],
  [[21, 29], [38, 44], [58, 63], [64, 66]],
  [[21, 28], [38, 44], [45, 46], [59, 66]],
  [[22, 28], [38, 43], [45, 46], [58, 66]],
  [[22, 28], [38, 43], [45, 45], [57, 66]],
  [[22, 26], [39, 42], [57, 66]],
  [[22, 26], [39, 42], [57, 65]],
  [[22, 25], [39, 41], [58, 64]],
  [[22, 25], [59, 62], [69, 71]],
  [[22, 23], [61, 62], [69, 71]],
  [[22, 23], [70, 71]],
  [[22, 22]],
  [[22, 22]],
];

const landCells: { x: number; y: number }[] = [];
for (let r = 0; r < LAND.length; r++) {
  const seen = new Set<number>();
  for (const [a, b] of LAND[r]) {
    for (let c = a; c <= b; c++) {
      if (c < 0 || c >= COLS || seen.has(c)) continue;
      seen.add(c);
      landCells.push({ x: c * CELL_W + CELL_W / 2, y: r * CELL_H + CELL_H / 2 });
    }
  }
}

function project(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * W,
    y: ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H,
  };
}

export type MapMetric = 'spend' | 'purchases' | 'revenue' | 'roas' | 'cpa';

const METRIC_LABEL: Record<MapMetric, string> = {
  spend: 'Spend',
  purchases: 'Purchases',
  revenue: 'Revenue',
  roas: 'ROAS',
  cpa: 'CPA',
};

interface WorldMapProps {
  points: GeoPoint[];
  metric: MapMetric;
  targetRoas?: number;
  onSelect?: (point: GeoPoint) => void;
  selectedCode?: string;
}

/** Bubble fill: green above target, amber near it, rose below. */
function roasColor(roas: number, target: number): string {
  if (roas >= target * 1.2) return '#10B981';
  if (roas >= target) return '#34D399';
  if (roas >= target * 0.8) return '#F59E0B';
  return '#F43F5E';
}

export function WorldMap({ points, metric, targetRoas = 2.5, onSelect, selectedCode }: WorldMapProps) {
  const [hover, setHover] = useState<GeoPoint | null>(null);

  const maxValue = useMemo(
    () => Math.max(...points.map(p => p[metric]), 0) || 1,
    [points, metric],
  );

  // Area-proportional sizing: radius scales with the square root of the value so
  // a country with 4x the spend reads as 4x the ink, not 4x the width.
  const radiusFor = (p: GeoPoint) => 5 + Math.sqrt(p[metric] / maxValue) * 22;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Geographic performance map">
        <defs>
          <radialGradient id="map-bubble-glow">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Basemap */}
        <g>
          {landCells.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={1.7} className="fill-slate-600/40" />
          ))}
        </g>

        {/* Bubbles, largest first so small markers stay clickable on top */}
        <g>
          {[...points]
            .sort((a, b) => b[metric] - a[metric])
            .map(p => {
              const { x, y } = project(p.lat, p.lng);
              const r = radiusFor(p);
              const color = roasColor(p.roas, targetRoas);
              const active = hover?.countryCode === p.countryCode || selectedCode === p.countryCode;
              return (
                <g
                  key={p.countryCode}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(p)}
                  className={clsx(onSelect && 'cursor-pointer')}
                >
                  <circle cx={x} cy={y} r={r * 1.6} fill="url(#map-bubble-glow)" opacity={active ? 0.9 : 0.4} />
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={color}
                    fillOpacity={active ? 0.55 : 0.32}
                    stroke={color}
                    strokeWidth={active ? 2 : 1.25}
                    style={{ transition: 'fill-opacity 150ms ease, stroke-width 150ms ease' }}
                  />
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    className="fill-white font-semibold pointer-events-none"
                    style={{ fontSize: 9 }}
                  >
                    {p.countryCode}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>

      {hover && (
        <div className="absolute top-2 left-2 rounded-xl border border-bg-border bg-bg-elevated/95 backdrop-blur px-3.5 py-3 shadow-card-hover pointer-events-none min-w-[190px]">
          <p className="text-sm font-semibold text-white">{hover.segment}</p>
          <p className="text-xs text-slate-500 mb-2">{hover.countryCode}</p>
          <dl className="space-y-1 text-xs">
            <Row label="Spend" value={formatCurrency(hover.spend)} />
            <Row label="Revenue" value={formatCurrency(hover.revenue)} />
            <Row label="Purchases" value={formatNumber(hover.purchases)} />
            <Row label="ROAS" value={formatMultiplier(hover.roas)} tone={hover.roas >= targetRoas ? 'good' : 'bad'} />
            <Row label="CPA" value={formatCurrency(hover.cpa)} />
          </dl>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 px-1">
        <span className="text-xs text-slate-500">
          Bubble size = {METRIC_LABEL[metric]}
        </span>
        <span className="text-xs text-slate-500">Colour = ROAS vs {targetRoas.toFixed(1)}x target</span>
        <div className="flex items-center gap-3">
          {[
            { c: '#10B981', l: 'Above target' },
            { c: '#F59E0B', l: 'Near target' },
            { c: '#F43F5E', l: 'Below target' },
          ].map(x => (
            <span key={x.l} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.c, opacity: 0.7 }} />
              {x.l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={clsx(
          'font-medium tabular-nums',
          tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-white',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
