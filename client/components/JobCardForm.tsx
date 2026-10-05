'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { addDaysISO, fmt, fmtDate, num, orderNo, todayISO, toISODate } from '@/lib/format';
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
import { MeasurementSets, materialsTotal, newSet, type EditableSet } from './MeasurementSets';
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
const emptyItem = (): ItemRow => ({ code: '', productName: '', qty: '1', rate: '' });
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build the per-person blocks from a saved card. Cards written before this
 * feature carry one unnamed set in the legacy fields, so lift that across
 * instead of dropping it.
 */
function setsFromCard(card?: JobCard | null): EditableSet[] {
  // Orders saved before materials moved per-person carry one shared list;
  // hand it to the first person so nothing is lost on the next save.
  const legacyMaterials = (card?.materialsUsed ?? []).map((m) => ({
    code: m.code ?? '',
    productName: m.productName ?? '',
    qty: m.qty ?? 0,
    rate: m.rate ?? 0,
  }));

  if (card?.measurementSets?.length) {
    const anyPerPerson = card.measurementSets.some((m) => (m.materials ?? []).length > 0);
    return card.measurementSets.map((m, i) =>
      newSet({
        profileId: m.profileId,
        name: m.name ?? '',
        fabric: m.fabric ?? '',
        size: m.size ?? '',
        qty: m.qty ?? 1,
        values: { ...m.values },
        materials:
          (m.materials ?? []).length > 0
            ? m.materials!.map((x) => ({ ...x }))
            : !anyPerPerson && i === 0
              ? legacyMaterials
              : [],
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
        materials: legacyMaterials,
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
  /** A draft's own number, shown until it is promoted and takes a real one. */
  const [draftNo, setDraftNo] = useState<number | null>(initial?.draftNo ?? null);
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
  const [additionalCharges, setAdditionalCharges] = useState(
    String(initial?.additionalCharges ?? '0'),
  );
  // One block per person. Old cards carry a single unnamed set, so lift that
  // into the new shape on open rather than losing it.
  const [sets, setSets] = useState<EditableSet[]>(() => {
    const saved = setsFromCard(initial);
    // Every order is stitched for somebody, so a new one starts with the first
    // person's block open rather than an empty state. The server drops a block
    // left wholly blank, so this costs nothing if it goes unused.
    return saved.length === 0 && mode === 'new' ? [newSet()] : saved;
  });
  const [fabricConsumption, setFabricConsumption] = useState(
    initial?.measurements?.FABRIC_CONSUMPTION ?? '',
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
  /** True once this form has been saved properly — stops a duplicate draft. */
  const settled = useRef(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerMode, setLedgerMode] = useState<'search' | 'newCustomer'>('search');
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
  const canAddLedger = can('ledgers.manage');

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
    // Charges join the taxable base beside the items, exactly as the server
    // computes it — the two must never disagree.
    const extra = r2(num(additionalCharges));
    const d = r2(num(discount));
    const taxable = Math.max(total + extra - d, 0);
    const tax = r2(taxable * (taxRate / 100));
    const netAmount = r2(taxable + tax);
    const advance = r2(payments.reduce((s, p) => s + num(p.amount), 0));
    const advanceBeforeTax = r2(advance / (1 + taxRate / 100));
    const advanceTax = r2(advance - advanceBeforeTax);
    const balance = r2(netAmount - advance);
    const materialTotal = r2(sets.reduce((s, p) => s + materialsTotal(p.materials), 0));
    return { rows, total, additionalCharges: extra, discount: d, tax, netAmount, advance, advanceBeforeTax, advanceTax, balance, materialTotal };
  }, [items, discount, additionalCharges, payments, sets, taxRate]);

  function loadDoc(d: JobCard) {
    setNo(d.no ?? null);
    setDraftNo(d.draftNo ?? null);
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
    setAdditionalCharges(String(d.additionalCharges ?? 0));
    setSets(setsFromCard(d));
    setFabricConsumption(d.measurements?.FABRIC_CONSUMPTION ?? '');
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
      additionalCharges: calc.additionalCharges,
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
        materials: (m.materials ?? [])
          .filter((r) => r.code || r.productName || num(r.qty) || num(r.rate))
          .map((r) => ({
            code: r.code,
            productName: r.productName,
            qty: num(r.qty),
            rate: num(r.rate),
          })),
      })),
      // Materials live on each person now; the shared list stays empty.
      materialsUsed: [],
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
        settled.current = true;
        await rememberPeople();
        toast(`Order ${created.no} saved`);
        router.push(`/job-cards/${created._id}`);
      } else if (docId) {
        // Saving a draft in full is what promotes it to a real order.
        const updated = await api.jobCards.update(docId, {
          ...payload(),
          ...(status === 'draft' ? { status: 'open' } : {}),
        });
        settled.current = true;
        await rememberPeople();
        loadDoc(updated);
        toast(
          status === 'draft'
            ? `Draft saved to orders as ${updated.no}`
            : `Order ${updated.no} updated`,
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Has anything actually been typed? An untouched form must not leave a
   * draft behind just because someone opened New Order and changed their mind.
   * The fields the form pre-fills on its own — number, ref, dates, book no —
   * deliberately do not count.
   */
  function hasContent(): boolean {
    if (partyName.trim() || phone.trim()) return true;
    if (fabricConsumption.trim()) return true;
    if (num(discount) || num(additionalCharges) || num(jobCost)) return true;
    if (items.some((r) => r.code.trim() || r.productName.trim() || num(r.rate))) return true;
    return sets.some(
      (p) =>
        p.name.trim() ||
        (p.fabric ?? '').trim() ||
        (p.size ?? '').trim() ||
        Object.values(p.values).some((v) => String(v).trim()) ||
        (p.materials ?? []).some(
          (m) => (m.code ?? '').trim() || (m.productName ?? '').trim() || num(m.rate),
        ),
    );
  }

  /**
   * Leaving a half-filled New Order keeps the work as a draft rather than
   * throwing it away. Fires from the unmount cleanup, which covers the back
   * button and every in-app navigation; `settled` stops it running after the
   * order has already been saved properly.
   */
  async function saveDraft() {
    if (mode !== 'new' || settled.current || !hasContent()) return;
    settled.current = true;
    try {
      await api.jobCards.create({ ...payload(), status: 'draft' });
    } catch {
      /* Leaving the page is not the moment to argue about a failed save. */
    }
  }

  /**
   * The unmount cleanup below runs once, so it would otherwise close over the
   * state as it was on first render — an empty form. Pointing a ref at the
   * current saveDraft on every render keeps it looking at what was typed.
   */
  const draftRef = useRef(saveDraft);
  draftRef.current = saveDraft;
  const draftDirty = useRef(hasContent);
  draftDirty.current = hasContent;

  useEffect(() => {
    // Covers the back button and every in-app navigation away from the form.
    return () => {
      void draftRef.current();
    };
  }, []);

  useEffect(() => {
    // A hard tab close cannot carry the auth header on a beacon, so the
    // browser's own prompt is the honest option there.
    const warn = (e: BeforeUnloadEvent) => {
      if (mode !== 'new' || settled.current || !draftDirty.current()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
      toast(dir === 'prev' ? 'This is the first stitching order' : 'This is the last stitching order', 'info');
    }
  }

  async function closeCard() {
    if (!docId) return;
    try {
      const d = await api.jobCards.close(docId);
      loadDoc(d);
      toast('Stitching order closed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Close failed', 'error');
    }
  }

  async function reopenCard() {
    if (!docId) return;
    try {
      const d = await api.jobCards.reopen(docId);
      loadDoc(d);
      toast('Stitching order reopened');
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

  /**
   * Order items are bound to the people on the order, position by position:
   * row 1 is what is being stitched for person 1, row 2 for person 2, and so
   * on. Adding a person adds their row; removing a person takes their row with
   * them, so the two lists cannot drift out of step. Any rows past the last
   * person are free — that is where an alteration charge or a loose sale goes.
   */
  function changeSets(next: EditableSet[]) {
    const before = sets;
    setSets(next);

    setItems((rows) => {
      let out = [...rows];

      // A person was removed: drop their row so the rest stay aligned.
      if (next.length < before.length) {
        const gone = before
          .map((p, i) => (next.some((n) => n.uid === p.uid) ? -1 : i))
          .filter((i) => i >= 0);
        out = out.filter((_, i) => !gone.includes(i));
      }

      // A person was added: insert a fresh row at the end of the bound block,
      // pushing any free rows below it down. Reusing a free row instead would
      // quietly turn someone's alteration charge into the new person's line.
      if (next.length > before.length) {
        const at = Math.min(before.length, out.length);
        const added = Array.from({ length: next.length - before.length }, emptyItem);
        out = [...out.slice(0, at), ...added, ...out.slice(at)];
      }

      // An order loaded with fewer rows than people still gets one each.
      while (out.length < next.length) out.push(emptyItem());

      // Stitching two thobes for someone means two of that line.
      return out.map((r, i) => {
        const person = next[i];
        const was = before[i];
        if (person && was && person.uid === was.uid && person.qty !== was.qty) {
          return { ...r, qty: String(person.qty ?? 1) };
        }
        return r;
      });
    });
  }

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">{mode === 'new' ? 'New Order' : 'Edit Order'}</h1>
          <p className="page-sub">
            {mode === 'new' ? 'Create a new tailoring order' : `Editing order ${no ?? ''}`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <button className="btn-soft" onClick={resetNew} title="Start a new entry">New</button>
          {canSave && (
            <button className="btn-primary" onClick={save} disabled={saving || readOnly}>
              {saving ? 'Saving…' : mode === 'new' || status === 'draft' ? 'Save to Orders' : 'Update Order'}
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

      {status === 'draft' && (
        <div className="mb-5 rounded-2xl border border-brass-200 bg-brass-50 px-5 py-3 text-sm font-semibold text-brass-800">
          This is a draft — it was saved automatically when the form was left part-finished.
          Fill in what is missing and press <strong>Save to Orders</strong> to make it a real
          order. It cannot be converted to a sale until then.
        </div>
      )}

      {readOnly && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-800">
          This stitching order has been converted to sales{invoiceNo ? ` (Bill ${invoiceNo})` : ''} and is read-only.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* header fields */}
          <Card className="p-5">
            {/* which order this is */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              <Field label={no == null && draftNo != null ? 'Draft No' : 'Invoice No'}>
                <TextInput
                  value={no ?? (draftNo != null ? `DRAFT-${draftNo}` : '…')}
                  readOnly
                  className="bg-ink-50 font-bold text-brand-700"
                />
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
            </div>
            {/* who it is for, and when it is due */}
            {/* The customer needs the room: a name, a lookup and an add button.
                Phone and delivery date are short values, so they give it up. */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <Field label="Party A/c (Customer)" className="md:col-span-6">
                <div className="flex gap-2">
                  <TextInput
                    value={partyName}
                    onChange={(e) => { setPartyName(e.target.value); setLedgerId(''); }}
                    disabled={readOnly}
                    placeholder="Select from ledger…"
                    className="font-semibold"
                  />
                  <button className="btn-soft shrink-0" onClick={() => { setLedgerMode('search'); setLedgerOpen(true); }} disabled={readOnly} title="Find ledger (F2)" aria-label="Find ledger">
                    <Icon name="search" className="h-[17px] w-[17px]" />
                  </button>
                  {canAddLedger && (
                    <button
                      className="btn-soft shrink-0 whitespace-nowrap !px-2.5 !py-1.5 text-xs"
                      onClick={() => { setLedgerMode('newCustomer'); setLedgerOpen(true); }}
                      disabled={readOnly}
                      title="Add a customer to the ledger and put them on this order"
                    >
                      ＋ New customer
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Phone" className="md:col-span-3">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} className="font-mono" />
              </Field>
              <Field label="Delivery Date" className="md:col-span-3">
                <DateInput value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </Card>

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
                        <td className="td align-top text-ink-400">
                          {i + 1}
                          {sets[i] && (
                            <span className="block max-w-[7rem] truncate text-[10px] font-semibold text-brand-700">
                              {sets[i].name.trim() || `Person ${i + 1}`}
                            </span>
                          )}
                        </td>
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
                          <td className="td align-top">
                            {i < sets.length ? (
                              <span
                                className="cursor-help text-ink-300"
                                title={`This row belongs to ${sets[i].name.trim() || `person ${i + 1}`} — remove that person to remove the row`}
                              >
                                🔒
                              </span>
                            ) : (
                              <button
                                className="text-rose-500 hover:text-rose-700"
                                onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                                title="Remove row"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* measurements — one block per person on this order */}
          <Card className="p-5">
            <MeasurementSets
              sets={sets}
              onChange={changeSets}
              ledgerId={ledgerId || undefined}
              readOnly={readOnly}
            />
            <div className="mt-4 max-w-xs border-t border-ink-100 pt-4">
              <Field label="Fabric Consumption">
                <TextInput value={fabricConsumption} onChange={(e) => setFabricConsumption(e.target.value)} disabled={readOnly} />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-end gap-4 border-t border-ink-100 pt-5">
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
          <Card className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
            {/* what the order comes to — the figures the payment below settles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink-500">Total</span>
                <span className="font-bold tabular-nums">{fmt(calc.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink-500">Additional Charges</span>
                <NumberInput
                  value={additionalCharges}
                  onChange={(e) => setAdditionalCharges(e.target.value)}
                  disabled={readOnly}
                  className="input-sm !w-32"
                />
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

            <h2 className="mb-4 mt-5 border-t border-ink-100 pt-5 text-base font-extrabold tracking-tight text-ink-900">
              Payment
            </h2>
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

            {/*
              A new order can only be saved; an existing one can be updated and,
              separately, billed. Both live here so the primary action is beside
              the figures it commits.
            */}
            {mode === 'new'
              ? canSave && (
                  <button
                    className="btn-primary mt-4 w-full"
                    onClick={save}
                    disabled={saving || readOnly}
                  >
                    {saving ? 'Saving…' : 'Save to Orders'}
                  </button>
                )
              : (canSave || canConvert) && (
                  <div className="mt-4 grid gap-2">
                    {canSave && (
                      <button className="btn-primary w-full" onClick={save} disabled={saving || readOnly}>
                        {saving ? 'Saving…' : status === 'draft' ? 'Save to Orders' : 'Update Order'}
                      </button>
                    )}
                    {canConvert && (
                      <button
                        className="btn-success w-full"
                        onClick={() => setConvertOpen(true)}
                        disabled={readOnly || status === 'closed' || status === 'draft'}
                        title={
                          status === 'draft'
                            ? 'Finish the draft and save it to orders before converting'
                            : status === 'closed'
                              ? 'Reopen the order before converting'
                              : 'Convert to sales bill'
                        }
                      >
                        Convert to Sales →
                      </button>
                    )}
                  </div>
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
      <LedgerSearchModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        onSelect={pickLedger}
        startIn={ledgerMode}
        seedName={partyName}
      />

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
        sub={`Stitching order ${no ?? ''} · ${partyName}`}
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
        title="Find Stitching"
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
            placeholder="e.g. 13258 or Ref-13051 or TARAK"
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
                <th className="th">Invoice No</th>
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
                  <td className="td font-bold text-brand-700">{orderNo(j)}</td>
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
