'use client';

import { useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { fmt, num } from '@/lib/format';
import type { SavedBank, SavedCard } from '@/lib/types';

/** The three ways money comes across the counter. */
export type TenderMode = 'cash' | 'card' | 'bank';

export type Split = Record<TenderMode, string>;

const MODES: { value: TenderMode; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'card', label: 'Card', icon: 'card' },
  { value: 'bank', label: 'Bank Transfer', icon: 'ledgers' },
];

export const emptySplit = (): Split => ({ cash: '', card: '', bank: '' });

export const splitTotal = (s: Split): number =>
  Math.round(MODES.reduce((t, m) => t + num(s[m.value]), 0) * 100) / 100;

/** What the counter keys in for a card tender. */
export interface CardFields {
  holder: string;
  number: string;
  expiry: string;
  cvc: string;
}

/** What the counter keys in for a bank transfer. */
export interface BankFields {
  bankName: string;
  accountName: string;
  iban: string;
  /** The bank's SWIFT/BIC code, e.g. NBADAEAA. */
  swift: string;
}

export interface TenderDetails {
  card: CardFields;
  bank: BankFields;
}

export const emptyDetails = (): TenderDetails => ({
  card: { holder: '', number: '', expiry: '', cvc: '' },
  bank: { bankName: '', accountName: '', iban: '', swift: '' },
});

/** The last four digits, which is the only part of a number worth keeping. */
export const last4 = (cardNumber: string): string => {
  const digits = cardNumber.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
};

/** Grouped in fours while typing, the way the digits are printed on the card. */
const groupDigits = (v: string): string =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();

/** Nudges a bare `1226` into `12/26` so the stored expiry has one shape. */
const asExpiry = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Keeps browsers and password managers out of the card boxes.
 *
 * Chrome decides a form is a payment form by reading the words around each
 * field, and when it decides that on a page served over plain http it shows a
 * red "automatic payment methods filling is disabled" bubble. Nothing on this
 * pad wants autofilling anyway — the details are read off the card in the
 * customer's hand — so the fields say so in every dialect: `autocomplete` for
 * the browser, and the vendor attributes for 1Password, LastPass and Dashlane,
 * which each ignore the standard one.
 */
const noAutofill = {
  autoComplete: 'off' as const,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
  'data-bwignore': 'true',
};

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-ink-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * Settle a bill across more than one tender.
 *
 * A customer hands over a note and puts the rest on a card often enough that
 * one payment mode is not enough. Each mode holds its own figure, the three
 * are always on show so it is obvious what has been counted, and what is
 * still owed — or owed back — is spelled out rather than left to arithmetic.
 *
 * Card and bank each ask for the details that go with them, and only while
 * that mode is the one being counted: the fields are useless for a cash sale
 * and would be four more boxes to look past.
 */
export function SplitTender({
  due,
  value,
  onChange,
  details,
  onDetailsChange,
  savedCards = [],
  savedBanks = [],
  onPay,
  disabled = false,
  busy = false,
  payLabel = 'Advance',
  note,
}: {
  /** What this payment has to cover. */
  due: number;
  value: Split;
  onChange: (s: Split) => void;
  details: TenderDetails;
  onDetailsChange: (d: TenderDetails) => void;
  /** Already on file for this customer, offered rather than retyped. */
  savedCards?: SavedCard[];
  savedBanks?: SavedBank[];
  onPay?: () => void;
  disabled?: boolean;
  busy?: boolean;
  payLabel?: string;
  /** Shown under the button when paying is not possible yet, and why. */
  note?: string;
}) {
  const [mode, setMode] = useState<TenderMode>('cash');

  const taken = useMemo(() => splitTotal(value), [value]);
  const remaining = Math.max(Math.round((due - taken) * 100) / 100, 0);
  const change = Math.max(Math.round((taken - due) * 100) / 100, 0);

  const set = (m: TenderMode, v: string) => onChange({ ...value, [m]: v });
  const setCard = (k: keyof CardFields, v: string) =>
    onDetailsChange({ ...details, card: { ...details.card, [k]: v } });
  const setBank = (k: keyof BankFields, v: string) =>
    onDetailsChange({ ...details, bank: { ...details.bank, [k]: v } });

  return (
    <div>
      {/* What has to be covered is not restated here: the Total Payable bar
          above the pad already carries it, and the green pill below puts the
          outstanding figure one tap from the box that counts it. */}
      <div className="flex flex-wrap justify-center gap-2">
        {MODES.map((m) => {
          const on = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={disabled}
              onClick={() => setMode(m.value)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-bold transition disabled:opacity-50 ${
                on
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:text-brand-700'
              }`}
            >
              <Icon name={m.icon} className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* one tap to put everything still owed on the chosen tender */}
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          disabled={disabled || remaining <= 0}
          onClick={() => set(mode, String(num(value[mode]) + remaining))}
          title={`Put the whole ${fmt(remaining)} AED still owed on ${
            MODES.find((m) => m.value === mode)?.label
          }`}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {fmt(remaining)} AED
        </button>
      </div>

      {/* counting box for the chosen tender, and what is left after it */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value[mode]}
          disabled={disabled}
          onChange={(e) => set(mode, e.target.value)}
          placeholder="0"
          aria-label={`Amount taken by ${MODES.find((m) => m.value === mode)?.label}`}
          className="input input-sm w-28 bg-white text-right font-bold tabular-nums"
        />
        <span
          className={`text-sm font-bold tabular-nums ${
            remaining > 0 ? 'text-brass-700' : 'text-brand-700'
          }`}
        >
          {fmt(remaining)} AED Remaining
        </span>
      </div>

      {/* the details that belong to the tender being counted */}
      {mode === 'card' && (
        <div className="mt-3 rounded-xl border border-ink-200 bg-white p-3">
          {savedCards.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {savedCards.map((c, i) => (
                <button
                  key={c._id ?? i}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onDetailsChange({
                      ...details,
                      // The number is not ours to keep, so a saved card fills
                      // in everything but that and leaves the box to be typed.
                      card: {
                        ...details.card,
                        holder: c.holder ?? '',
                        expiry: c.expiry ?? '',
                      },
                    })
                  }
                  title={`Use ${c.holder || 'this card'} on file`}
                  className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] font-bold text-ink-700 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                >
                  •••• {c.last4 || '????'}
                  {c.holder ? ` · ${c.holder}` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Labelled label="Card Name">
              <input
                {...noAutofill}
                value={details.card.holder}
                disabled={disabled}
                onChange={(e) => setCard('holder', e.target.value)}
                placeholder="Name on card"
                className="input input-sm"
              />
            </Labelled>
            <Labelled label="Expiry Date on card">
              <input
                {...noAutofill}
                value={details.card.expiry}
                disabled={disabled}
                onChange={(e) => setCard('expiry', asExpiry(e.target.value))}
                placeholder="MM/YY"
                inputMode="numeric"
                className="input input-sm tabular-nums"
              />
            </Labelled>
            <Labelled label="Number on card">
              <input
                {...noAutofill}
                value={details.card.number}
                disabled={disabled}
                onChange={(e) => setCard('number', groupDigits(e.target.value))}
                placeholder="•••• •••• •••• ••••"
                inputMode="numeric"
                className="input input-sm tabular-nums"
              />
            </Labelled>
            <Labelled label="Security no">
              <input
                {...noAutofill}
                value={details.card.cvc}
                disabled={disabled}
                onChange={(e) => setCard('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••"
                inputMode="numeric"
                className="input input-sm tabular-nums"
              />
            </Labelled>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-ink-400">
            Saved against the customer: name, expiry and the last four digits
            only. The full number and the CVC are never stored.
          </p>
        </div>
      )}

      {mode === 'bank' && (
        <div className="mt-3 rounded-xl border border-ink-200 bg-white p-3">
          {savedBanks.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {savedBanks.map((b, i) => (
                <button
                  key={b._id ?? i}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onDetailsChange({
                      ...details,
                      bank: {
                        ...details.bank,
                        bankName: b.bankName ?? '',
                        accountName: b.accountName ?? '',
                        iban: b.iban ?? '',
                        swift: b.swift ?? '',
                      },
                    })
                  }
                  title={`Use ${b.bankName || 'this account'} on file`}
                  className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] font-bold text-ink-700 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                >
                  {b.bankName || 'Bank'}
                  {b.iban ? ` · ${b.iban.slice(-4)}` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Labelled label="Bank Name">
              <input
                value={details.bank.bankName}
                disabled={disabled}
                onChange={(e) => setBank('bankName', e.target.value)}
                placeholder="e.g. Emirates NBD"
                className="input input-sm"
              />
            </Labelled>
            <Labelled label="Account Name">
              <input
                value={details.bank.accountName}
                disabled={disabled}
                onChange={(e) => setBank('accountName', e.target.value)}
                placeholder="Name on the account"
                className="input input-sm"
              />
            </Labelled>
            <Labelled label="IBAN / Account No">
              <input
                value={details.bank.iban}
                disabled={disabled}
                onChange={(e) => setBank('iban', e.target.value.toUpperCase())}
                placeholder="AE00 0000 0000 0000 0000 000"
                className="input input-sm font-mono text-xs"
              />
            </Labelled>
            <Labelled label="SWIFT Number">
              <input
                value={details.bank.swift}
                disabled={disabled}
                onChange={(e) => setBank('swift', e.target.value.toUpperCase())}
                placeholder="e.g. NBADAEAA"
                className="input input-sm font-mono"
              />
            </Labelled>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-ink-400">
            Saved against the customer, so the next transfer is one tap away.
          </p>
        </div>
      )}

      {/* every tender at once, so nothing is counted twice or forgotten */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const amt = num(value[m.value]);
          return (
            <div key={m.value} className="text-center">
              <div
                className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold tabular-nums ${
                  amt > 0 ? 'bg-brand-50 text-brand-800' : 'bg-ink-50 text-ink-400'
                }`}
              >
                <span className="truncate">{fmt(amt)}</span>
                <button
                  type="button"
                  disabled={disabled || amt <= 0}
                  onClick={() => set(m.value, '')}
                  title={`Clear the ${m.label} amount`}
                  aria-label={`Clear ${m.label}`}
                  className="shrink-0 text-ink-400 transition hover:text-rose-600 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-[11px] font-medium text-ink-500">{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* commit, with what is being handed over */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink-50 p-2">
        <button
          type="button"
          onClick={onPay}
          disabled={disabled || busy || !onPay || taken <= 0}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Saving…' : payLabel}
        </button>
        <span className="flex-1 text-right text-base font-black tabular-nums text-ink-900">
          {fmt(taken)} <span className="text-xs font-bold text-ink-400">AED</span>
        </span>
      </div>
      {/* Change is only worth a line when there actually is some: handing back
          cash is a real step, and a permanent "0.00 Return" teaches the eye to
          skip the one time it matters. */}
      {change > 0 && (
        <p className="mt-1 text-right text-[13px] font-bold tabular-nums text-brass-700">
          {fmt(change)} AED Return
        </p>
      )}
      {note && <p className="mt-2 text-center text-[11px] text-ink-500">{note}</p>}
    </div>
  );
}
