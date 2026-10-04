'use client';

import { Icon, type IconName } from '@/components/icons';

export type StatTone = 'brand' | 'brass' | 'ink' | 'rose';

const TONES: Record<StatTone, { chip: string; rule: string; value: string }> = {
  brand: { chip: 'bg-brand-50 text-brand-700', rule: 'bg-brand-600', value: 'text-ink-950' },
  brass: { chip: 'bg-brass-50 text-brass-700', rule: 'bg-brass-500', value: 'text-ink-950' },
  ink: { chip: 'bg-ink-100 text-ink-700', rule: 'bg-ink-400', value: 'text-ink-950' },
  rose: { chip: 'bg-rose-50 text-rose-700', rule: 'bg-rose-500', value: 'text-ink-950' },
};

/**
 * A flat stat tile: white card, one coloured rule, one coloured icon chip.
 * The number is the loudest thing on the card — not the background.
 */
export function StatCard({
  title,
  value,
  sub,
  icon,
  tone = 'brand',
}: {
  title: string;
  value: string;
  sub?: string;
  icon: IconName;
  tone?: StatTone;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-white p-5 shadow-card transition hover:shadow-lift">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${t.rule}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">{title}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon name={icon} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <p className={`mt-3 text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums ${t.value}`}>
        {value}
      </p>
      {sub && <p className="mt-2 text-xs font-medium text-ink-500">{sub}</p>}
    </div>
  );
}
