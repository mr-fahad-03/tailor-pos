/** Round to 2 decimals (money-safe-ish). */
export const r2 = (n: number): number =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export interface TotalsInput {
  qty: number;
  rate: number;
  amount?: number;
}

export function lineAmount(qty: number, rate: number): number {
  return r2(num(qty) * num(rate));
}

export interface JobCardTotals {
  total: number;
  discount: number;
  tax: number;
  netAmount: number;
}

export function jobCardTotals(
  items: TotalsInput[],
  discount: number,
  taxRate: number,
): JobCardTotals {
  const total = r2(items.reduce((s, i) => s + lineAmount(i.qty, i.rate), 0));
  const d = r2(num(discount));
  const tax = r2(Math.max(total - d, 0) * (num(taxRate) / 100));
  const netAmount = r2(total - d + tax);
  return { total, discount: d, tax, netAmount };
}

/** Split an advance (tax-inclusive) into before-tax / tax portions. */
export function advanceSplit(advance: number, taxRate: number) {
  const adv = r2(num(advance));
  const beforeTax = r2(adv / (1 + num(taxRate) / 100));
  return { advance: adv, advanceBeforeTax: beforeTax, advanceTax: r2(adv - beforeTax) };
}

export interface SaleLineInput {
  qty: number;
  rate: number;
  discPercent?: number;
  taxPercent?: number;
}

export interface SaleLineComputed {
  discAmt: number;
  grossAmt: number;
  taxAmt: number;
  netAmount: number;
  netRate: number;
}

export function saleLine(l: SaleLineInput): SaleLineComputed {
  const qty = num(l.qty);
  const rate = num(l.rate);
  const discAmt = r2(qty * rate * (num(l.discPercent) / 100));
  const grossAmt = r2(qty * rate - discAmt);
  const taxAmt = r2(grossAmt * (num(l.taxPercent) / 100));
  const netAmount = r2(grossAmt + taxAmt);
  return { discAmt, grossAmt, taxAmt, netAmount, netRate: qty ? r2(netAmount / qty) : 0 };
}
