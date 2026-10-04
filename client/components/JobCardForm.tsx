'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { addDaysISO, fmt, fmtDate, num, todayISO, toISODate } from '@/lib/format';
import {
  MEASURE_FIELDS,
  type JobCard,
  type JobCardPayment,
  type Ledger,
  type Product,
} from '@/lib/types';
import { useSettings } from './SettingsContext';
import { useToast } from './Toast';
import { useAuth } from './AuthContext';
import { MeasurementSets, newSet, type EditableSet } from './MeasurementSets';
import {
  Card,
  Checkbox,
  DateInput,
  Field,
  NumberInput,
  Seg,
  StatusBadge,
  TextInput,
} from './ui';
import { Modal } from './Modal';
import { LedgerSearchModal } from './LedgerSearchModal';
import { PaymentDialog, type PaymentPayload } from './PaymentDialog';
import { ProductSearchInput } from './ProductSearchInput';
import { Icon } from '@/components/icons';

interface ItemRow {
  code: string;
  productName: string;
  qty: string;
  rate: string;
}
interface MaterialRow {
  code: string;
  productName: string;
  qty: string;
  rate: string;
}

const emptyItem = (): ItemRow => ({ code: '', productName: '', qty: '1', rate: '' });
const emptyMaterial = (): MaterialRow => ({ code: '', productName: '', qty: '1', rate: '' });
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build the per-person blocks from a saved card. Cards written before this
 * feature carry one unnamed set in the legacy fields, so lift that across
 * instead of dropping it.
 */
function setsFromCard(card?: JobCard | null): EditableSet[] {
  if (card?.measurementSets?.length) {
    return card.measurementSets.map((m) =>
      newSet({
        profileId: m.profileId,
        name: m.name ?? '',
        fabric: m.fabric ?? '',
        size: m.size ?? '',
        qty: m.qty ?? 1,
        values: { ...m.values },
      }),
    );
  }
  const legacy = { ...(card?.measurements ?? {}) };
  delete legacy.FABRIC_CONSUMPTION;
  if (Object.keys(legacy).length || card?.fabric || card?.size) {
    return [
      newSet({
        name: card?.partyName ?? '',
        fabric: card?.fabric ?? '',
        size: card?.size ?? '',
        values: legacy,
      }),
    ];
  }
  return [];
}

export function JobCardForm({ initial, mode }: { initial?: JobCard | null; mode: 'new' | 'edit' }) {
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettings();
  const taxRate = settings.taxRate;

  // ---- header ----
  const [no, setNo] = useState<number | null>(initial?.no ?? null);
  const [bookNo, setBookNo] = useState(String(initial?.bookNo ?? settings.bookNo));
  const [ref, setRef] = useState(initial?.ref ?? '');
  const [date, setDate] = useState(toISODate(initial?.date) || todayISO());
  const [deliveryDate, setDeliveryDate] = useState(
    toISODate(initial?.deliveryDate) || addDaysISO(todayISO(), settings.deliveryDays),
  );
  const [partyName, setPartyName] = useState(initial?.partyName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [ledgerId, setLedgerId] = useState(initial?.ledgerId ?? '');
  const [isNew, setIsNew] = useState(initial?.isNewCustomer ?? false);
  const [accountsAc, setAccountsAc] = useState(initial?.accountsAc ?? '');
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? '');

  // ---- grids ----
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items?.length
      ? initial.items.map((i) => ({
          code: i.code ?? '',
          productName: i.productName ?? '',
          qty: String(i.qty ?? ''),
          rate: String(i.rate ?? ''),
        }))
      : [emptyItem()],
  );
  const [discount, setDiscount] = useState(String(initial?.discount ?? '0'));
  // One block per person. Old cards carry a single unnamed set, so lift that
  // into the new shape on open rather than losing it.
  const [sets, setSets] = useState<EditableSet[]>(() => setsFromCard(initial));
  const [fabricConsumption, setFabricConsumption] = useState(
    initial?.measurements?.FABRIC_CONSUMPTION ?? '',
  );
  const [materials, setMaterials] = useState<MaterialRow[]>(
    initial?.materialsUsed?.length
      ? initial.materialsUsed.map((m) => ({
          code: m.code ?? '',
          productName: m.productName ?? '',
          qty: String(m.qty ?? ''),
          rate: String(m.rate ?? ''),
        }))
      : [emptyMaterial()],
  );
  const [jobCost, setJobCost] = useState(String(initial?.jobCost ?? '0'));

  // ---- payment panel ----
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank' | 'card'>(
    initial?.paymentMode ?? 'cash',
  );
  const [bank, setBank] = useState(initial?.bank ?? '');
  const [creditCardNo, setCreditCardNo] = useState(initial?.creditCardNo ?? '');
  const [payments, setPayments] = useState<JobCardPayment[]>(initial?.payments ?? []);
  const [status, setStatus] = useState(initial?.status ?? 'open');

  // ---- ui ----
  const [saving, setSaving] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState('');
  const [findRows, setFindRows] = useState<JobCard[]>([]);

  const docId = initial?._id;
  const readOnly = status === 'converted';

  // Hide the actions this user cannot perform; the API enforces the same rules.
  const { can } = useAuth();
  const canSave = mode === 'new' ? can('jobcards.create') : can('jobcards.edit');
  const canPay = can('jobcards.payment');
  const canClose = can('jobcards.close');
  const canConvert = can('jobcards.convert');

  // New mode: fetch next number
  useEffect(() => {
    if (mode !== 'new') return;
    (async () => {
      try {
        const n = await api.jobCards.next();
        setNo(n.no);
        setRef(n.ref);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not get next number', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---- computed ----
  const calc = useMemo(() => {
    const rows = items.map((r) => {
      const q = num(r.qty);
      const rt = num(r.rate);
      return { ...r, qty: q, rate: rt, amount: r2(q * rt) };
    });
    const total = r2(rows.reduce((s, r) => s + r.amount, 0));
    const d = r2(num(discount));
    const tax = r2(Math.max(total - d, 0) * (taxRate / 100));
    const netAmount = r2(total - d + tax);
    const advance = r2(payments.reduce((s, p) => s + num(p.amount), 0));
    const advanceBeforeTax = r2(advance / (1 + taxRate / 100));
    const advanceTax = r2(advance - advanceBeforeTax);
    const balance = r2(netAmount - advance);
    const matRows = materials.map((r) => ({ ...r, qty: num(r.qty), rate: num(r.rate) }));
    const materialTotal = r2(matRows.reduce((s, r) => s + r.qty * r.rate, 0));
    return { rows, total, discount: d, tax, netAmount, advance, advanceBeforeTax, advanceTax, balance, materialTotal };
  }, [items, discount, payments, materials, taxRate]);

  function loadDoc(d: JobCard) {
    setNo(d.no);
    setBookNo(String(d.bookNo));
    setRef(d.ref);
    setDate(toISODate(d.date) || todayISO());
    setDeliveryDate(toISODate(d.deliveryDate) || '');
    setPartyName(d.partyName ?? '');
    setPhone(d.phone ?? '');
    setLedgerId(d.ledgerId ?? '');
    setIsNew(!!d.isNewCustomer);
    setAccountsAc(d.accountsAc ?? '');
    setInvoiceNo(d.invoiceNo ?? '');
    setItems(
      d.items.length
        ? d.items.map((i) => ({ code: i.code ?? '', productName: i.productName ?? '', qty: String(i.qty), rate: String(i.rate) }))
        : [emptyItem()],
    );
    setDiscount(String(d.discount));
    setSets(setsFromCard(d));
    setFabricConsumption(d.measurements?.FABRIC_CONSUMPTION ?? '');
    setMaterials(
      d.materialsUsed.length
        ? d.materialsUsed.map((m) => ({ code: m.code ?? '', productName: m.productName ?? '', qty: String(m.qty), rate: String(m.rate) }))
        : [emptyMaterial()],
    );
    setJobCost(String(d.jobCost));
    setPaymentMode(d.paymentMode ?? 'cash');
    setBank(d.bank ?? '');
    setCreditCardNo(d.creditCardNo ?? '');
    setPayments(d.payments ?? []);
    setStatus(d.status);
  }

  function payload() {
    return {
      bookNo: num(bookNo, settings.bookNo),
      ref: ref.trim(),
      date,
      deliveryDate: deliveryDate || undefined,
      partyName: partyName.trim(),
      phone: phone.trim(),
      ledgerId: ledgerId || undefined,
      isNewCustomer: isNew,
      accountsAc: accountsAc.trim(),
      invoiceNo: invoiceNo.trim(),
      items: calc.rows
        .filter((r) => r.code || r.productName || r.qty || r.rate)
        .map((r) => ({ code: r.code, productName: r.productName, qty: r.qty, rate: r.rate })),
      discount: calc.discount,
      taxRate,
      // The first person also fills the legacy fields, so older prints and any
      // card saved before this feature keep rendering.
      measurements: { ...(sets[0]?.values ?? {}), FABRIC_CONSUMPTION: fabricConsumption },
      fabric: sets[0]?.fabric ?? '',
      size: sets[0]?.size ?? '',
      measurementSets: sets.map((m) => ({
        profileId: m.profileId,
        name: m.name.trim(),
        fabric: m.fabric,
        size: m.size,
        qty: Number(m.qty) || 0,
        values: m.values,
      })),
      materialsUsed: materials
        .filter((r) => r.code || r.productName || num(r.qty) || num(r.rate))
        .map((r) => ({ code: r.code, productName: r.productName, qty: num(r.qty), rate: num(r.rate) })),
      materialTotal: calc.materialTotal,
      jobCost: num(jobCost),
      paymentMode,
      bank,
      creditCardNo,
    };
  }

  /**
   * File each ticked person under the customer so the next order can just
   * tick them again. Never block the order on this — the card is already
   * saved by the time we get here.
   */
  async function rememberPeople() {
    if (!ledgerId) return;
    const keep = sets.filter((m) => m.remember !== false && m.name.trim());
    if (keep.length === 0) return;
    try {
      await Promise.all(
        keep.map((m) =>
          api.measurements.save({
            ledgerId,
            name: m.name.trim(),
            fabric: m.fabric,
            size: m.size,
            values: m.values,
          }),
        ),
      );
    } catch {
      toast('Order saved, but the measurements could not be kept on file', 'error');
    }
  }

  async function save() {
    if (!partyName.trim()) {
      toast('Party A/c (customer) is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'new') {
        const created = await api.jobCards.create(payload());
        await rememberPeople();
        toast(`Job card ${created.no} saved`);
        router.push(`/job-cards/${created._id}`);
      } else if (docId) {
        const updated = await api.jobCards.update(docId, payload());
        await rememberPeople();
        loadDoc(updated);
        toast(`Job card ${updated.no} updated`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function resetNew() {
    if (mode === 'new') {
      window.location.reload();
    } else {
      router.push('/job-cards/new');
    }
  }

  async function navigate(dir: 'prev' | 'next') {
    if (no == null) return;
    try {
      const d = await api.jobCards.adjacent(no, dir);
      router.push(`/job-cards/${d._id}`);
    } catch {
      toast(dir === 'prev' ? 'This is the first job card' : 'This is the last job card', 'info');
    }
  }

  async function closeCard() {
    if (!docId) return;
    try {
      const d = await api.jobCards.close(docId);
      loadDoc(d);
      toast('Job card closed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Close failed', 'error');
    }
  }

  async function reopenCard() {
    if (!docId) return;
    try {
      const d = await api.jobCards.reopen(docId);
      loadDoc(d);
      toast('Job card reopened');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reopen failed', 'error');
    }
  }

  async function confirmPayment(p: PaymentPayload) {
    if (!docId) return;
    try {
      const d = await api.jobCards.addPayment(docId, p);
      loadDoc(d);
      toast(`Payment of ${fmt(p.amount)} AED recorded`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Payment failed', 'error');
      throw e;
    }
  }

  async function confirmConvert(p: PaymentPayload) {
    if (!docId) return;
    try {
      const hasPayment = num(p.amount) > 0 || num(p.discount) > 0;
      const { sale } = await api.jobCards.convert(docId, {
        payment: hasPayment ? p : undefined,
        salesman: settings.salesman,
        taxRate,
      });
      toast(`Converted to bill B-${sale.billNo}`);
      router.push(`/sales/${sale._id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Convert failed', 'error');
      throw e;
    }
  }

  function pickLedger(l: Ledger) {
    setPartyName(l.name);
    setPhone(l.phone ?? '');
    setLedgerId(l._id);
    setIsNew(false);
  }

  function pickProduct(i: number, p: Product) {
    setItems((rows) =>
      rows.map((r, idx) =>
        idx === i ? { ...r, code: p.code, productName: p.name, rate: String(p.rate) } : r,
      ),
    );
  }

  function pickMaterial(i: number, p: Product) {
    setMaterials((rows) =>
      rows.map((r, idx) =>
        idx === i ? { ...r, code: p.code, productName: p.name, rate: String(p.rate) } : r,
      ),
    );
  }

  async function searchFind() {
    try {
      const r = await api.jobCards.list(findQ, '', 1, 10);
      setFindRows(r.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Search failed', 'error');
    }
  }

  const updateItem = (i: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateMaterial = (i: number, patch: Partial<MaterialRow>) =>
    setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Job Card Entry</h1>
          <p className="page-sub">
            {mode === 'new' ? 'Create a new tailoring order' : `Editing job card ${no ?? ''}`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <button className="btn-soft" onClick={resetNew} title="Start a new entry">New</button>
          {canSave && (
            <button className="btn-primary" onClick={save} disabled={saving || readOnly}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {mode === 'edit' && (
            <>
              <button className="btn-soft" onClick={() => navigate('prev')} title="Previous record">‹‹</button>
              <button className="btn-soft" onClick={() => navigate('next')} title="Next record">››</button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-800">
          This job card has been converted to sales{invoiceNo ? ` (Bill ${invoiceNo})` : ''} and is read-only.
        </div>
      )}

      {/* header fields */}
      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Field label="No">
            <TextInput value={no ?? '…'} readOnly className="bg-ink-50 font-bold text-brand-700" />
          </Field>
          <Field label="Book No">
            <NumberInput value={bookNo} onChange={(e) => setBookNo(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Ref">
            <TextInput value={ref} onChange={(e) => setRef(e.target.value)} disabled={readOnly} className="font-mono" />
          </Field>
          <Field label="&nbsp;">
            <button className="btn-soft w-full" onClick={() => { setFindOpen(true); setFindQ(''); setFindRows([]); }}>
              Find
            </button>
          </Field>
          <Field label="Date">
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Delivery Date">
            <DateInput value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Accounts A/c">
            <TextInput value={accountsAc} onChange={(e) => setAccountsAc(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Invoice No">
            <TextInput value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Party A/c (Customer)">
            <div className="flex gap-2">
              <TextInput
                value={partyName}
                onChange={(e) => { setPartyName(e.target.value); setLedgerId(''); }}
                disabled={readOnly}
                placeholder="Select from ledger…"
                className="font-semibold"
              />
              <button className="btn-soft shrink-0" onClick={() => setLedgerOpen(true)} disabled={readOnly} title="Find ledger (F2)" aria-label="Find ledger">
                <Icon name="search" className="h-[17px] w-[17px]" />
              </button>
            </div>
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} className="font-mono" />
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox label="New (walk-in customer)" checked={isNew} onChange={setIsNew} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* order items */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-tight text-ink-900">Order Items</h2>
              {!readOnly && (
                <button className="btn-soft !py-1.5 text-xs" onClick={() => setItems((r) => [...r, emptyItem()])}>
                  ＋ Add row
                </button>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="th w-10">Sl</th>
                    <th className="th w-36">Code</th>
                    <th className="th">Product Name</th>
                    <th className="th w-24 text-right">Qty</th>
                    <th className="th w-28 text-right">Rate</th>
                    <th className="th w-28 text-right">Amount</th>
                    {!readOnly && <th className="th w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.map((r, i) => {
                    const c = calc.rows[i];
                    return (
                      <tr key={i}>
                        <td className="td text-ink-400">{i + 1}</td>
                        <td className="td">
                          <ProductSearchInput
                            value={r.code}
                            onChange={(v) => updateItem(i, { code: v })}
                            onPick={(p) => pickProduct(i, p)}
                          />
                        </td>
                        <td className="td">
                          <TextInput
                            value={r.productName}
                            onChange={(e) => updateItem(i, { productName: e.target.value })}
                            disabled={readOnly}
                            className="input-sm"
                            placeholder="Product name"
                          />
                        </td>
                        <td className="td">
                          <NumberInput value={r.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} disabled={readOnly} className="input-sm" />
                        </td>
                        <td className="td">
                          <NumberInput value={r.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} disabled={readOnly} className="input-sm" />
                        </td>
                        <td className="td text-right font-bold tabular-nums">{fmt(c?.amount ?? 0)}</td>
                        {!readOnly && (
                          <td className="td">
                            <button
                              className="text-rose-500 hover:text-rose-700"
                              onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                              title="Remove row"
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-500">Total</span>
                  <span className="font-bold tabular-nums">{fmt(calc.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-500">Discount</span>
                  <NumberInput value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={readOnly} className="input-sm !w-32" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-500">Tax ({fmt(taxRate)}%)</span>
                  <span className="font-bold tabular-nums">{fmt(calc.tax)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-brand-700 px-4 py-2.5 text-white">
                  <span className="text-sm font-bold">Net Amt</span>
                  <span className="text-lg font-black tabular-nums">{fmt(calc.netAmount)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* measurements — one block per person on this order */}
          <Card className="p-5">
            <MeasurementSets
              sets={sets}
              onChange={setSets}
              ledgerId={ledgerId || undefined}
              readOnly={readOnly}
            />
            <div className="mt-4 max-w-xs border-t border-ink-100 pt-4">
              <Field label="Fabric Consumption">
                <TextInput value={fabricConsumption} onChange={(e) => setFabricConsumption(e.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </Card>

          {/* materials */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-tight text-ink-900">Materials Used</h2>
              {!readOnly && (
                <button className="btn-soft !py-1.5 text-xs" onClick={() => setMaterials((r) => [...r, emptyMaterial()])}>
                  ＋ Add row
                </button>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="th w-10">Sl</th>
                    <th className="th w-36">Code</th>
                    <th className="th">Product Name</th>
                    <th className="th w-24 text-right">Qty</th>
                    <th className="th w-28 text-right">Rate</th>
                    {!readOnly && <th className="th w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {materials.map((r, i) => (
                    <tr key={i}>
                      <td className="td text-ink-400">{i + 1}</td>
                      <td className="td">
                        <ProductSearchInput
                          value={r.code}
                          onChange={(v) => updateMaterial(i, { code: v })}
                          onPick={(p) => pickMaterial(i, p)}
                        />
                      </td>
                      <td className="td">
                        <TextInput
                          value={r.productName}
                          onChange={(e) => updateMaterial(i, { productName: e.target.value })}
                          disabled={readOnly}
                          className="input-sm"
                          placeholder="Material"
                        />
                      </td>
                      <td className="td">
                        <NumberInput value={r.qty} onChange={(e) => updateMaterial(i, { qty: e.target.value })} disabled={readOnly} className="input-sm" />
                      </td>
                      <td className="td">
                        <NumberInput value={r.rate} onChange={(e) => updateMaterial(i, { rate: e.target.value })} disabled={readOnly} className="input-sm" />
                      </td>
                      {!readOnly && (
                        <td className="td">
                          <button
                            className="text-rose-500 hover:text-rose-700"
                            onClick={() => setMaterials((rows) => rows.filter((_, idx) => idx !== i))}
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-end gap-4">
              <Field label="Material Total" className="w-40">
                <TextInput value={fmt(calc.materialTotal)} readOnly className="bg-ink-50 text-right font-bold tabular-nums" />
              </Field>
              <Field label="Job Cost" className="w-40">
                <NumberInput value={jobCost} onChange={(e) => setJobCost(e.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </Card>
        </div>

        {/* right payment panel */}
        <div>
          <Card className="sticky top-24 p-5">
            <h2 className="mb-4 text-base font-extrabold tracking-tight text-ink-900">Payment</h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2.5">
                <span className="label !mb-0">Advance</span>
                <span className="text-sm font-extrabold tabular-nums">{fmt(calc.advance)}</span>
              </div>
              <div className="flex items-center justify-between px-1 text-sm">
                <span className="text-ink-500">Advance Before Tax</span>
                <span className="font-semibold tabular-nums">{fmt(calc.advanceBeforeTax)}</span>
              </div>
              <div className="flex items-center justify-between px-1 text-sm">
                <span className="text-ink-500">Advance Tax</span>
                <span className="font-semibold tabular-nums">{fmt(calc.advanceTax)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-brand-700 px-4 py-3 text-white">
                <span className="text-sm font-bold">BALANCE</span>
                <span className="text-xl font-black tabular-nums">{fmt(calc.balance)}</span>
              </div>
            </div>

            <div className="mt-5">
              <span className="label">Payment Mode</span>
              <Seg
                options={[
                  { value: 'cash' as const, label: 'Cash' },
                  { value: 'bank' as const, label: 'Bank' },
                  { value: 'card' as const, label: 'Card' },
                ]}
                value={paymentMode}
                onChange={setPaymentMode}
              />
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Bank">
                <TextInput value={bank} onChange={(e) => setBank(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Credit Card No">
                <TextInput value={creditCardNo} onChange={(e) => setCreditCardNo(e.target.value)} disabled={readOnly} className="font-mono" />
              </Field>
            </div>

            <div className={`mt-5 grid gap-2 ${canPay ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button className="btn-soft !px-3 text-[13px]" onClick={() => setHistoryOpen(true)}>
                Payment History
              </button>
              {canPay && (
                <button className="btn-primary !px-3 text-[13px]" onClick={() => setPayOpen(true)} disabled={readOnly}>
                  Part Payment
                </button>
              )}
            </div>

            {canClose && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
              <Checkbox
                label="Closed"
                checked={status === 'closed'}
                onChange={(v) => {
                  if (v) void closeCard();
                  else void reopenCard();
                }}
              />
              {status === 'closed' && (
                <button className="btn-soft !py-1.5 text-xs" onClick={reopenCard}>
                  Reopen
                </button>
              )}
            </div>
            )}

            {canConvert && (
              <button
                className="btn-success mt-4 w-full"
                onClick={() => setConvertOpen(true)}
                disabled={readOnly || status === 'closed'}
                title={status === 'closed' ? 'Reopen the card before converting' : 'Convert to sales bill'}
              >
                Convert to Sales →
              </button>
            )}
            {mode === 'edit' && (
              <p className="mt-3 text-center text-[11px] text-ink-400">
                Delivery {fmtDate(deliveryDate)} · Ref {ref}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* modals */}
      <LedgerSearchModal open={ledgerOpen} onClose={() => setLedgerOpen(false)} onSelect={pickLedger} />

      <PaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        payable={calc.balance}
        onConfirm={confirmPayment}
        confirmLabel="Confirm"
        title="Part Payment"
      />

      <PaymentDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        payable={calc.balance}
        onConfirm={confirmConvert}
        confirmLabel="Convert"
        title="Convert to Sales"
      />

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Payment History"
        sub={`Job card ${no ?? ''} · ${partyName}`}
        wide
      >
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No payments recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="th">Date</th>
                <th className="th">Mode</th>
                <th className="th text-right">Amount</th>
                <th className="th">Bank / Ref</th>
                <th className="th text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {payments.map((p, i) => (
                <tr key={i}>
                  <td className="td">{fmtDate(p.date)}</td>
                  <td className="td capitalize">{p.mode}</td>
                  <td className="td text-right font-bold tabular-nums">{fmt(p.amount)}</td>
                  <td className="td text-xs text-ink-500">{[p.bank, p.reference].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="td text-right tabular-nums">{fmt(p.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <Modal
        open={findOpen}
        onClose={() => setFindOpen(false)}
        title="Find Job Card"
        sub="Search by number, ref or customer"
        wide
        footer={
          <button className="btn-soft" onClick={() => setFindOpen(false)}>
            Cancel
          </button>
        }
      >
        <div className="mb-4 flex gap-2">
          <TextInput
            autoFocus
            placeholder="e.g. 13258 or fm-13051 or TARAK"
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void searchFind()}
          />
          <button className="btn-primary shrink-0" onClick={searchFind}>
            Search
          </button>
        </div>
        {findRows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="th">No</th>
                <th className="th">Ref</th>
                <th className="th">Customer</th>
                <th className="th text-right">Net</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {findRows.map((j) => (
                <tr
                  key={j._id}
                  className="cursor-pointer hover:bg-brand-50"
                  onClick={() => router.push(`/job-cards/${j._id}`)}
                >
                  <td className="td font-bold text-brand-700">{j.no}</td>
                  <td className="td font-mono text-xs">{j.ref}</td>
                  <td className="td">{j.partyName || '—'}</td>
                  <td className="td text-right tabular-nums">{fmt(j.netAmount)}</td>
                  <td className="td">
                    <StatusBadge status={j.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
