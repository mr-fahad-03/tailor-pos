/** Money: always 2 decimals, e.g. 125.00 */
export const fmt = (n: unknown): string => {
  const v = Number(n);
  return (Number.isFinite(v) ? v : 0).toFixed(2);
};

/** Money with AED suffix for hero numbers */
export const fmtAED = (n: unknown): string => `${fmt(n)} AED`;

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

export const addDaysISO = (iso: string, days: number): string => {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

/** '2026-10-03T...' -> '2026-10-03' for <input type="date"> */
export const toISODate = (v?: string | null): string => (v ? String(v).slice(0, 10) : '');

/** '2026-10-03...' -> '03/10/2026' */
export const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
};

export const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
