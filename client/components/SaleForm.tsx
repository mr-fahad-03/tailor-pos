'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fmt, num, todayISO } from '@/lib/format';
import type { JobCard, Ledger, LedgerDue, Product } from '@/lib/types';
import { useSettings } from './SettingsContext';
import { useToast } from './Toast';
import { useAuth } from './AuthContext';
import { blurOnWheel, NumberInput, Select, selectOnFocus, TextInput } from './ui';
import { Modal } from './Modal';
import { LedgerSearchModal } from './LedgerSearchModal';
import { LedgerSearchInput } from './LedgerSearchInput';
import { ProductSearchInput } from './ProductSearchInput';
import { Icon } from '@/components/icons';

interface SaleRow {
  code: string;
  productName: string;
  unit: string;
  /** What is on the shelf, for the line under the quantity box. */
  stockQty: number;
  qty: string;
  rate: string;
  discType: 'fixed' | 'percent';
  discInput: string;
  warranty: string;
  info: string;
}

const emptyRow = (): SaleRow => ({
  code: '',
  productName: '',
  unit: 'PIECE',
  stockQty: 0,
  qty: '1',
  rate: '',
  discType: 'fixed',
  discInput: '0',
  warranty: '0',
  info: '',
});

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The units a line can be sold in. A product brings its own; this is the list. */
const UNITS = ['PIECE', 'GRAMS', 'KG', 'METER', 'YARD', 'SET'];

/** Today's date and time, the way the mockup's read-only stamps read. */
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ampm}`;
}

/** Small round glyph in front of a field, as on the reference. */
function Lead({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[32px] w-8 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-ink-300 bg-ink-50 text-[11px] text-ink-500">
      {children}
    </span>
  );
}

function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[11px] font-bold text-ink-800">
      {children}
      {required && <span className="text-rose-600">:*</span>}
      {!required && ':'}
    </label>
  );
}

export function SaleForm() {
  const { can } = useAuth();
  const canCreate = can('sales.create');
  const canAddLedger = can('ledgers.manage');
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettings();
  const taxRate = settings.taxRate;

  const [billNo, setBillNo] = useState<number | null>(null);
  const [billDate] = useState(todayISO());
  const [saleStamp] = useState(() => stamp());

  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [ledgerId, setLedgerId] = useState('');
  const [ledgerCode, setLedgerCode] = useState('');
  const [billingLines, setBillingLines] = useState<string[]>([]);
  const [due, setDue] = useState<LedgerDue | null>(null);

  const [bookingNo, setBookingNo] = useState('');
  const [jobCardId, setJobCardId] = useState('');

  const [rows, setRows] = useState<SaleRow[]>([emptyRow()]);

  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountInput, setDiscountInput] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [isReturn, setIsReturn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [infoRow, setInfoRow] = useState(-1);
  const [infoDraft, setInfoDraft] = useState('');
  const [jcOpen, setJcOpen] = useState(false);
  const [jcQ, setJcQ] = useState('');
  const [jcRows, setJcRows] = useState<JobCard[]>([]);

  /* ------------------------------------------------------------- figures */

  const calc = useMemo(() => {
    const lines = rows.map((r) => {
      const qty = num(r.qty);
      const rate = num(r.rate);
      const gross = r2(qty * rate);
      const input = num(r.discInput);
      const discAmt =
        r.discType === 'percent' ? r2((gross * input) / 100) : r2(Math.min(input, gross));
      return { subtotal: r2(gross - discAmt), discAmt, qty };
    });
    const totQty = r2(lines.reduce((s, l) => s + l.qty, 0));
    const total = r2(lines.reduce((s, l) => s + l.subtotal, 0));
    const dIn = num(discountInput);
    const orderDiscount =
      discountType === 'percent' ? r2((total * dIn) / 100) : r2(Math.min(dIn, total));
    const afterDiscount = r2(Math.max(total - orderDiscount, 0));
    const orderTax = r2((afterDiscount * taxRate) / 100);
    const payable = r2(afterDiscount + orderTax);
    const paid = r2(num(amountPaid));
    return {
      lines,
      totQty,
      total,
      orderDiscount,
      afterDiscount,
      orderTax,
      payable,
      paid,
      changeReturn: r2(Math.max(paid - payable, 0)),
      balance: r2(Math.max(payable - paid, 0)),
    };
  }, [rows, discountType, discountInput, amountPaid, taxRate]);

  /* --------------------------------------------------------------- setup */

  useEffect(() => {
    api.sales
      .next()
      .then((r) => setBillNo(r.billNo))
      .catch(() => setBillNo(null));
  }, []);

  // What the bill comes to is the obvious thing to be handed, so the Amount
  // box follows it until the counter types over it.
  const [amountTouched, setAmountTouched] = useState(false);
  useEffect(() => {
    if (!amountTouched) setAmountPaid(calc.payable ? String(calc.payable) : '0');
  }, [calc.payable, amountTouched]);

  const loadDue = useCallback(async () => {
    if (!ledgerId) {
      setDue(null);
      return;
    }
    try {
      setDue(await api.ledgers.due(ledgerId));
    } catch {
      setDue(null);
    }
  }, [ledgerId]);
  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  /* -------------------------------------------------------------- events */

  const updateRow = (i: number, patch: Partial<SaleRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function pickProduct(i: number, p: Product) {
    updateRow(i, {
      code: p.code,
      productName: p.name,
      rate: String(p.rate),
      unit: (p.unit || 'PIECE').toUpperCase(),
      stockQty: p.stockQty ?? 0,
    });
  }

  function pickLedger(l: Ledger) {
    setPartyName(l.name);
    setPhone(l.phone ?? '');
    setLedgerId(l._id);
    // The shop's own reference for this customer, as it is printed.
    setLedgerCode(l.contactId ?? '');
    setBillingLines(
      [
        l.addressLine1,
        l.addressLine2,
        [l.city, l.state, l.zip].filter(Boolean).join(' '),
        l.country,
      ]
        .map((v) => (v ?? '').trim())
        .filter(Boolean),
    );
  }

  function step(i: number, by: number) {
    const next = Math.max(0, num(rows[i].qty) + by);
    updateRow(i, { qty: String(r2(next)) });
  }

  async function searchJobCards() {
    try {
      const r = await api.jobCards.list(jcQ, '', 1, 10);
      setJcRows(r.items.filter((j) => j.status !== 'converted'));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Search failed', 'error');
    }
  }

  function convertFrom(j: JobCard) {
    setBookingNo(j.ref);
    setJobCardId(j._id);
    setPartyName(j.partyName ?? '');
    setPhone(j.phone ?? '');
    setLedgerId(j.ledgerId ?? '');
    setAmountPaid(String(j.advance ?? 0));
    setAmountTouched(true);
    setRows(
      j.items.map((i) => ({
        ...emptyRow(),
        code: i.code ?? '',
        productName: i.productName ?? '',
        qty: String(i.qty),
        rate: String(i.rate),
      })),
    );
    setJcOpen(false);
    toast(`Loaded stitching order ${j.ref} — advance ${fmt(j.advance)} AED applied`, 'info');
  }

  async function save(andPrint: boolean) {
    const filled = rows.filter((r) => r.code || r.productName || num(r.rate));
    if (filled.length === 0) {
      toast('Add at least one item', 'error');
      return;
    }
    if (!partyName.trim()) {
      toast('Customer is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const sale = await api.sales.create({
        billDate,
        saleType: 'retail',
        paymentType: paymentMethod === 'credit' ? 'credit' : 'cash',
        category: 'A',
        bookingNo: bookingNo || undefined,
        jobCardRef: bookingNo || undefined,
        jobCardId: jobCardId || undefined,
        salesman: settings.salesman,
        partyName: partyName.trim(),
        phone: phone.trim(),
        ledgerId: ledgerId || undefined,
        items: filled.map((r) => ({
          code: r.code,
          productName: r.productName,
          unit: r.unit,
          qty: num(r.qty),
          rate: num(r.rate),
          discType: r.discType,
          discInput: num(r.discInput),
          warranty: num(r.warranty),
          info: r.info,
        })),
        discountType,
        discountInput: num(discountInput),
        advanceAmount: calc.paid,
        paymentMethod,
        paymentAccount: paymentAccount.trim(),
        paymentNote: paymentNote.trim(),
        paidOn: new Date().toISOString(),
        isReturn,
        defaultTaxPercent: taxRate,
      });
      toast(`${isReturn ? 'Return' : 'Bill'} ${sale.billNo} saved`);
      router.push(andPrint ? `/sales/${sale._id}?print=1` : '/sales');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const customerDue = due ? r2(due.due) : 0;
  /** Money already with the shop reads as an advance, not a debt. */
  const advanceBalance = customerDue < 0 ? Math.abs(customerDue) : 0;

  return (
    <div className="pb-16 text-[12px] [&_.input]:!px-2 [&_.input]:!py-1.5 [&_.input]:!text-[12px]">
      {/* ------------------------------------------------------- the bill */}
      <div className="px-4 pt-4">
        <div className="mb-5 flex items-baseline justify-center gap-3">
          <p className="text-base font-extrabold tracking-tight text-ink-900">
            {isReturn ? 'Sales Return:' : 'Sale Invoice:'}
          </p>
          <p className="text-2xl font-black leading-none tabular-nums text-ink-900">
            {billNo ?? '…'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Lbl required>Customer</Lbl>
            <div className="flex items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-stretch">
                <Lead>
                  <Icon name="ledgers" className="h-4 w-4" />
                </Lead>
                <div className="min-w-0 flex-1 [&_input]:rounded-l-none">
                  <LedgerSearchInput
                    value={partyName}
                    onChange={(v) => {
                      setPartyName(v);
                      setLedgerId('');
                      setLedgerCode('');
                      setBillingLines([]);
                    }}
                    onPick={pickLedger}
                    onCreate={canAddLedger ? () => setLedgerOpen(true) : undefined}
                    placeholder="Enter Customer name / phone"
                  />
                </div>
              </div>
              {canAddLedger && (
                <button
                  onClick={() => setLedgerOpen(true)}
                  title="Add a customer"
                  aria-label="Add a customer"
                  className="flex h-[32px] w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              )}
            </div>
            {customerDue > 0 && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-600">
                Customer Due: {fmt(customerDue)} AED
              </p>
            )}
          </div>

          <div>
            <Lbl required>Sale Date</Lbl>
            <div className="flex items-stretch">
              <Lead>
                <Icon name="jobcards" className="h-4 w-4" />
              </Lead>
              <input
                value={saleStamp}
                readOnly
                className="input !rounded-l-none bg-ink-100 text-ink-600"
              />
            </div>
          </div>

          <div>
            <Lbl>Booking No</Lbl>
            <div className="flex gap-2">
              <input
                value={bookingNo}
                readOnly
                placeholder="auto come can't change"
                className="input bg-ink-100 font-mono text-ink-600"
              />
              <button
                className="btn-soft shrink-0 !py-1.5"
                onClick={() => {
                  setJcOpen(true);
                  setJcQ('');
                  setJcRows([]);
                }}
              >
                Find
              </button>
            </div>
          </div>

          <div>
            <Lbl>Ref No</Lbl>
            <input
              value={billNo ? `B-${billNo}` : ''}
              readOnly
              placeholder="auto come can't change"
              className="input bg-ink-100 font-mono text-ink-600"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-bold text-ink-800">Billing Address:</p>
          <p className="mt-1.5 text-[12px] text-ink-600">
            {partyName.trim()
              ? `${partyName.trim()}${ledgerCode ? ` (${ledgerCode})` : ''}`
              : '—'}
          </p>
          {billingLines.map((line) => (
            <p key={line} className="text-[12px] text-ink-600">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ the items */}
      <div className="mt-4 px-4">
        <div className="overflow-x-auto rounded-lg border border-ink-300">
          <table className="w-full min-w-[980px]">
            <thead className="bg-ink-50">
              <tr className="text-center">
                <th className="th-s w-[150px]">Product</th>
                <th className="th-s w-[220px]">Quantity</th>
                <th className="th-s w-[180px]">Unit Price</th>
                <th className="th-s w-[180px]">Discount</th>
                <th className="th-s w-[90px]">Warranty</th>
                <th className="th-s w-[170px]">Info</th>
                <th className="th-s w-[110px]">Subtotal</th>
                <th className="th-s w-[52px]">
                  <button
                    onClick={() => setRows([emptyRow()])}
                    title="Clear every line"
                    aria-label="Clear every line"
                    className="text-base font-black text-ink-800 transition hover:text-rose-600"
                  >
                    ✕
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-2 py-2 text-center">
                    {/* Products carry no picture, so the tile stands in for one
                        and the search sits under it where the name goes. */}
                    <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded bg-ink-100 text-ink-400">
                      <Icon name="products" className="h-5 w-5" />
                    </div>
                    <ProductSearchInput
                      value={r.productName}
                      onChange={(v) => updateRow(i, { productName: v, code: '' })}
                      onPick={(p) => pickProduct(i, p)}
                      allowCreate
                      placeholder="Product"
                      className=""
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-stretch">
                      <button
                        onClick={() => step(i, -1)}
                        aria-label="One fewer"
                        className="flex w-7 items-center justify-center rounded-l-lg border border-r-0 border-ink-300 bg-white text-base font-bold text-rose-500 transition hover:bg-rose-50"
                      >
                        −
                      </button>
                      <NumberInput
                        value={r.qty}
                        onChange={(e) => updateRow(i, { qty: e.target.value })}
                        className="!rounded-none text-center"
                      />
                      <button
                        onClick={() => step(i, 1)}
                        aria-label="One more"
                        className="flex w-7 items-center justify-center rounded-r-lg border border-l-0 border-ink-300 bg-white text-base font-bold text-brand-600 transition hover:bg-brand-50"
                      >
                        +
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-ink-500">
                      {r.code ? `${fmt(r.stockQty)} ${r.unit} in stock` : ' '}
                    </p>
                  </td>

                  <td className="px-2 py-2">
                    <NumberInput
                      value={r.rate}
                      onChange={(e) => updateRow(i, { rate: e.target.value })}
                    />
                    <Select
                      value={r.unit}
                      onChange={(e) => updateRow(i, { unit: e.target.value })}
                      className="mt-2"
                    >
                      {(UNITS.includes(r.unit) ? UNITS : [r.unit, ...UNITS]).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </td>

                  <td className="px-2 py-2">
                    <NumberInput
                      value={r.discInput}
                      onChange={(e) => updateRow(i, { discInput: e.target.value })}
                    />
                    <Select
                      value={r.discType}
                      onChange={(e) =>
                        updateRow(i, { discType: e.target.value as SaleRow['discType'] })
                      }
                      className="mt-2"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="percent">Percentage</option>
                    </Select>
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={r.warranty}
                      onChange={(e) => updateRow(i, { warranty: e.target.value })}
                      onFocus={selectOnFocus}
                      onWheel={blurOnWheel}
                      aria-label="Warranty in months"
                      className="input text-left tabular-nums"
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-stretch gap-1.5">
                      <Select
                        value={r.info ? 'set' : ''}
                        onChange={(e) => {
                          if (e.target.value === '') updateRow(i, { info: '' });
                        }}
                        className="min-w-0 flex-1"
                      >
                        <option value="">Please Select</option>
                        {r.info && <option value="set">{r.info}</option>}
                      </Select>
                      <button
                        onClick={() => {
                          setInfoRow(i);
                          setInfoDraft(r.info);
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2 text-[11px] font-bold text-white transition hover:bg-brand-700"
                      >
                        <Icon name="plus" className="h-3 w-3" />
                        Add
                      </button>
                    </div>
                  </td>

                  <td className="px-2 py-2 text-[12px] font-semibold tabular-nums text-ink-800">
                    {fmt(calc.lines[i]?.subtotal ?? 0)} AED
                  </td>

                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                      title="Remove this line"
                      aria-label="Remove this line"
                      className="text-base font-black text-rose-500 transition hover:text-rose-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-end gap-8 rounded-lg bg-ink-50 px-3 py-2 text-[12px] font-bold text-ink-800">
          <span>
            Items: <span className="tabular-nums">{fmt(calc.totQty)}</span>
          </span>
          <span>
            Total: <span className="tabular-nums">{fmt(calc.total)}</span>
          </span>
        </div>

        <button
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="btn-soft mt-2 !py-1.5 text-xs"
        >
          ＋ Add row
        </button>
      </div>

      {/* ----------------------------------------------- discount and tax */}
      <div className="mt-6 px-4">
        <p className="text-lg font-black tracking-tight text-ink-900">
          Advance Balance: <span className="font-bold">{fmt(advanceBalance)} AED</span>
        </p>

        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 xl:grid-cols-[1fr_1fr_auto]">
          <div>
            <Lbl required>Discount Type</Lbl>
            <div className="flex items-stretch">
              <Lead>i</Lead>
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                className="!rounded-l-none"
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed</option>
              </Select>
            </div>
          </div>
          <div>
            <Lbl required>Discount Amount</Lbl>
            <div className="flex items-stretch">
              <Lead>i</Lead>
              <NumberInput
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="!rounded-l-none"
              />
            </div>
          </div>
          <p className="self-end text-[12px] font-bold text-ink-800 xl:text-right">
            Discount Amount:(-) <span className="tabular-nums">{fmt(calc.orderDiscount)}</span>
          </p>

          <div>
            <Lbl required>Order Tax</Lbl>
            <div className="flex items-stretch">
              <Lead>i</Lead>
              <input
                value={`VAT ${fmt(taxRate)}%`}
                readOnly
                title="Set in Settings"
                className="input !rounded-l-none bg-ink-100 text-ink-600"
              />
            </div>
          </div>
          <div />
          <p className="self-end text-[12px] font-bold text-ink-800 xl:text-right">
            Order Tax:(+) <span className="tabular-nums">{fmt(calc.orderTax)}</span>
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------ the money */}
      <div className="mt-6 px-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 xl:grid-cols-3">
          <div>
            <Lbl required>Amount</Lbl>
            <div className="flex items-stretch">
              <Lead>
                <Icon name="banknote" className="h-4 w-4" />
              </Lead>
              <NumberInput
                value={amountPaid}
                onChange={(e) => {
                  setAmountTouched(true);
                  setAmountPaid(e.target.value);
                }}
                className="!rounded-l-none"
              />
            </div>
          </div>
          <div>
            <Lbl required>Paid on</Lbl>
            <div className="flex items-stretch">
              <Lead>
                <Icon name="jobcards" className="h-4 w-4" />
              </Lead>
              <input
                value={saleStamp}
                readOnly
                className="input !rounded-l-none bg-ink-100 text-ink-600"
              />
            </div>
          </div>
          <div>
            <Lbl required>Payment Method</Lbl>
            <div className="flex items-stretch">
              <Lead>
                <Icon name="coins" className="h-4 w-4" />
              </Lead>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="!rounded-l-none"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="credit">Credit (pay later)</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-4 max-w-md">
          <Lbl>Payment Account</Lbl>
          <div className="flex items-stretch">
            <Lead>
              <Icon name="banknote" className="h-4 w-4" />
            </Lead>
            <TextInput
              value={paymentAccount}
              onChange={(e) => setPaymentAccount(e.target.value)}
              placeholder={settings.company?.name ? `Cash ${settings.company.name}` : 'Cash'}
              className="!rounded-l-none"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <Lbl>Payment note</Lbl>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={5}
              className="input resize-y"
            />
          </div>
          <div className="flex flex-col justify-center border-y border-ink-300 py-4">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[12px] font-bold text-ink-800">Change Return:</p>
                <p className="mt-1 text-lg font-black tabular-nums text-ink-900">
                  {fmt(calc.changeReturn)} AED
                </p>
              </div>
              <p className="text-[12px] font-bold text-ink-800">
                Balance: <span className="tabular-nums">{fmt(calc.balance)} AED</span>
              </p>
            </div>
          </div>
        </div>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-rose-600">
          <input
            type="checkbox"
            checked={isReturn}
            onChange={(e) => setIsReturn(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-rose-600 focus:ring-rose-500"
          />
          Record this as a sales return
        </label>
      </div>

      {/* --------------------------------------------------------- actions */}
      <div className="mt-6 flex items-center justify-center gap-3 border-t border-ink-200 bg-ink-50 py-4">
        <button
          className="rounded-md bg-brand-600 px-8 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void save(false)}
          disabled={saving || !canCreate}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="rounded-md bg-brand-600 px-8 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void save(true)}
          disabled={saving || !canCreate}
        >
          {saving ? 'Saving…' : 'Save and print'}
        </button>
      </div>

      {/* ---------------------------------------------------------- modals */}
      <LedgerSearchModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        onSelect={pickLedger}
        startIn="newCustomer"
        seedName={partyName}
      />

      <Modal
        open={infoRow >= 0}
        onClose={() => setInfoRow(-1)}
        title="Line note"
        sub={infoRow >= 0 ? rows[infoRow]?.productName || 'This line' : undefined}
        footer={
          <>
            <button className="btn-soft" onClick={() => setInfoRow(-1)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                updateRow(infoRow, { info: infoDraft.trim() });
                setInfoRow(-1);
              }}
            >
              Save note
            </button>
          </>
        }
      >
        <textarea
          autoFocus
          value={infoDraft}
          onChange={(e) => setInfoDraft(e.target.value)}
          rows={4}
          placeholder="Colour, alteration, anything to print against this line…"
          className="input resize-y"
        />
      </Modal>

      <Modal
        open={jcOpen}
        onClose={() => setJcOpen(false)}
        title="Find a stitching order"
        sub="Open or closed orders that have not been billed yet"
        wide
        footer={
          <button className="btn-soft" onClick={() => setJcOpen(false)}>
            Cancel
          </button>
        }
      >
        <div className="mb-4 flex gap-2">
          <TextInput
            autoFocus
            placeholder="e.g. Ref-13051 or customer name"
            value={jcQ}
            onChange={(e) => setJcQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void searchJobCards()}
          />
          <button className="btn-primary shrink-0" onClick={searchJobCards}>
            Search
          </button>
        </div>
        {jcRows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="th">Ref</th>
                <th className="th">Customer</th>
                <th className="th text-right">Net</th>
                <th className="th text-right">Advance</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {jcRows.map((j) => (
                <tr
                  key={j._id}
                  className="cursor-pointer hover:bg-brand-50"
                  onClick={() => convertFrom(j)}
                >
                  <td className="td font-mono text-xs font-bold text-brand-700">{j.ref}</td>
                  <td className="td">{j.partyName || '—'}</td>
                  <td className="td text-right tabular-nums">{fmt(j.netAmount)}</td>
                  <td className="td text-right tabular-nums text-emerald-600">{fmt(j.advance)}</td>
                  <td className="td capitalize">{j.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
