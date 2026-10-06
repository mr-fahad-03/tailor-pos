/**
 * Money spelled out, for the "amount in words" line every invoice carries.
 *
 * The line is not decoration: it is what a bank or a court reads when the
 * figures are disputed or a digit has been tampered with, which is why the
 * fils are spelled out too rather than left as "and 30/100".
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

/** Big enough for any bill this shop will ever write. */
const SCALES = [
  { value: 1_000_000_000, name: 'Billion' },
  { value: 1_000_000, name: 'Million' },
  { value: 1_000, name: 'Thousand' },
];

/** 0–999 in words. */
function underThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return TENS[Math.floor(n / 10)] + (rest ? ` ${ONES[rest]}` : '');
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${underThousand(rest)}` : ''}`;
}

/** A whole number in words. Negatives are the caller's problem to label. */
export function numberToWords(n: number): string {
  const whole = Math.floor(Math.abs(n));
  if (whole === 0) return 'Zero';
  let left = whole;
  const parts: string[] = [];
  for (const scale of SCALES) {
    if (left >= scale.value) {
      parts.push(`${underThousand(Math.floor(left / scale.value))} ${scale.name}`);
      left %= scale.value;
    }
  }
  if (left > 0) parts.push(underThousand(left));
  return parts.join(' ');
}

/**
 * An AED figure in words, fils and all.
 *
 * 13603.30 -> "Thirteen Thousand Six Hundred Three Dirhams and Thirty Fils"
 *
 * The fils are rounded rather than truncated so the words and the figure on
 * the same invoice can never disagree — a line reading 0.295 is printed as
 * 0.30 beside it, and must be spelled "Thirty Fils" to match.
 */
export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  // Worked in fils throughout: 0.1 + 0.2 in floats is not 0.3, and an invoice
  // total is exactly the sort of figure that lands on such a boundary.
  const totalFils = Math.round(safe * 100);
  const dirhams = Math.floor(totalFils / 100);
  const fils = totalFils % 100;

  const dirhamWords = `${numberToWords(dirhams)} ${dirhams === 1 ? 'Dirham' : 'Dirhams'}`;
  if (!fils) return `${dirhamWords} Only`;
  return `${dirhamWords} and ${numberToWords(fils)} ${fils === 1 ? 'Fil' : 'Fils'} Only`;
}
