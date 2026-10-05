'use client';

export interface DonutSlice {
  label: string;
  value: number;
  /** Hex from the validated chart palette — see VIZ in app/page.tsx. */
  color: string;
}

const SIZE = 100;
const R = 38;
const STROKE = 13;
const C = 2 * Math.PI * R;
/** The 2px surface gap that separates touching segments. */
const GAP = 2;

/**
 * Part-to-whole ring for a handful of segments (<= 6). Segments are separated by
 * a surface-coloured gap rather than a stroke, so identity never rests on hue
 * alone — every slice is also direct-labelled in the legend beside it.
 */
export function Donut({
  data,
  label,
  className = '',
}: {
  data: DonutSlice[];
  /** Describes the whole ring for screen readers. */
  label: string;
  className?: string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  const single = slices.length === 1;

  let cursor = 0;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={
        total > 0
          ? `${label}: ${slices
              .map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`)
              .join(', ')}`
          : `${label}: no activity in this period`
      }
    >
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {/* Track — carries the ring's shape when there is nothing to plot. */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#EFF2F1"
          strokeWidth={STROKE}
        />
        {total > 0 &&
          slices.map((d) => {
            const arc = (d.value / total) * C;
            // A lone slice is a closed ring: a gap there would read as a break.
            const dash = single ? C : Math.max(arc - GAP, 0.75);
            const offset = cursor;
            cursor += arc;
            return (
              <circle
                key={d.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
          })}
      </g>
    </svg>
  );
}

/** The swatch + label + value row that direct-labels a donut segment. */
export function DonutKey({
  slices,
  format,
  className = '',
}: {
  slices: DonutSlice[];
  format: (v: number) => string;
  className?: string;
}) {
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {slices.map((d) => (
        <li key={d.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
            style={{ background: d.color }}
          />
          <span className="text-[15px] font-bold leading-tight text-ink-900">
            {format(d.value)}
          </span>
          <span className="text-xs font-medium text-ink-500">{d.label}</span>
        </li>
      ))}
    </ul>
  );
}
