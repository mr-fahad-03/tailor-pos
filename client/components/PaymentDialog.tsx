'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { DateInput, Field, NumberInput, TextInput } from './ui';
import { fmt, num, todayISO } from '@/lib/format';
import type { PaymentMode } from '@/lib/types';

export interface PaymentPayload {
  date: string;
  mode: PaymentMode;
  amount: number;
  bank?: string;
  reference?: string;
  discount: number;
  note?: string;
}

const MODES: PaymentMode[] = ['cash', 'bank', 'card', 'credit'];

export function PaymentDialog({
  open,
  onClose,
  payable,
  onConfirm,
  confirmLabel = 'Confirm',
  title = 'Part Payment',
}: {
  open: boolean;
  onClose: () => void;
  payable: number;
  onConfirm: (p: PaymentPayload) => Promise<void> | void;
  confirmLabel?: string;
  title?: string;
}) {
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [bank, setBank] = useState('');
  const [reference, setReference] = useState('');
  const [current, setCurrent] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setMode('cash');
      setBank('');
      setReference('');
      setCurrent(fmt(Math.max(payable, 0)));
      setDiscount('0');
      setBusy(false);
    }
  }, [open, payable]);

  const balancePayable = useMemo(
    () => num(payable) - num(current) - num(discount),
    [payable, current, discount],
  );

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm({
        date,
        mode,
        amount: num(current),
        bank: bank || undefined,
        reference: reference || undefined,
        discount: num(discount),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      sub={`Payable: ${fmt(payable)} AED`}
      footer={
        <>
          <button className="btn-danger" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-success" onClick={confirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Mode">
          <div className="flex flex-wrap gap-3 pt-2">
            {MODES.map((m) => (
              <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium capitalize text-ink-700">
                <input
                  type="radio"
                  name="pay-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                {m}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Bank">
          <TextInput value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Bank name" />
        </Field>
        <Field label="Cheque No. / Credit Card No.">
          <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" />
        </Field>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl bg-ink-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-500">Payable</span>
          <span className="text-sm font-extrabold tabular-nums">{fmt(payable)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-ink-500">Current Payments</span>
          <NumberInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="!w-40"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-ink-500">Discounts</span>
          <NumberInput
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="!w-40"
          />
        </div>
        <div className="flex items-center justify-between border-t border-ink-200 pt-3">
          <span className="text-sm font-bold text-ink-700">Balance Payable</span>
          <span
            className={`text-lg font-black tabular-nums ${
              balancePayable < 0 ? 'text-rose-600' : 'text-brand-700'
            }`}
          >
            {fmt(balancePayable)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
