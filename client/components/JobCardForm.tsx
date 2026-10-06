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
  type LedgerDue,
  type Product,
  type SavedBank,
  type SavedCard,
} from '@/lib/types';
import { useSettings } from './SettingsContext';
import { useToast } from './Toast';
import { useAuth } from './AuthContext';
import { MeasurementSets, materialsTotal, newSet, type EditableSet } from './MeasurementSets';
import {
  Card,
  DateInput,
  Field,
  NumberInput,
  StatusBadge,
  TextInput,
} from './ui';
import { Modal } from './Modal';
import { LedgerSearchModal } from './LedgerSearchModal';
import {
  SplitTender,
  emptySplit,
  emptyDetails,
  last4,
  type Split,
  type TenderDetails,
  type TenderMode,
} from './SplitTender';
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
  // No longer asked for on the form. Kept so that re-saving an order written
  // before the field was removed does not strip what it was saved with.
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
  // What is being handed over right now, before it is recorded. Held apart
  // from `payments`, which is only ever what the server has already booked.
  const [split, setSplit] = useState<Split>(emptySplit);
  const [tenderDetails, setTenderDetails] = useState<TenderDetails>(emptyDetails);
  const [payingSplit, setPayingSplit] = useState(false);
  // What this customer has paid with before, offered instead of retyped.
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [savedBanks, setSavedBanks] = useState<SavedBank[]>([]);
  // What they owe from before this order, shown under their name.
  const [due, setDue] = useState<LedgerDue | null>(null);
  const [neighbours, setNeighbours] = useState({ prev: false, next: false });
  const [status, setStatus] = useState(initial?.status ?? 'open');

  // ---- ui ----
  const [saving, setSaving] = useState(false);
  /** True once this form has been saved properly — stops a duplicate draft. */
  const settled = useRef(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerMode, setLedgerMode] = useState<'search' | 'newCustomer'>('search');
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
    // What the counter reads out: how many lines were charged and how many
    // pieces that came to. Blank rows are still in `items` as placeholders, so
    // only rows that actually carry a product are counted.
    const charged = rows.filter((r) => r.productName?.trim() || r.amount > 0);
    const itemCount = charged.length;
    const qtyCount = r2(charged.reduce((s, r) => s + r.qty, 0));
    return { rows, total, additionalCharges: extra, discount: d, tax, netAmount, advance, advanceBeforeTax, advanceTax, balance, materialTotal, itemCount, qtyCount };
  }, [items, discount, additionalCharges, payments, sets, taxRate]);

  /**
   * What this customer owed before this order.
   *
   * The server's figure counts every open order they have, which on an edit
   * page includes this one — so its own saved balance comes back off, or the
   * order would appear to be chasing itself. A new order is not saved yet and
   * so is not in the figure at all.
   */
  /**
   * What the order cost the shop to make: the materials booked against each
   * person, plus whatever the stitching itself was costed at. It sits just
   * before the order amount, so the margin reads as the step between them.
   */
  const totalCost = useMemo(() => r2(calc.materialTotal + num(jobCost)), [calc.materialTotal, jobCost]);

  const priorDue = useMemo(() => {
    const all = due?.due ?? 0;
    const mine = mode === 'edit' ? num(initial?.balance) : 0;
    return r2(all - mine);
  }, [due, mode, initial?.balance]);

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

  /**
   * @param andPrint hand over to the order's invoice with the print dialog
   *   opening, rather than staying on the form.
   */
  async function save(andPrint = false) {
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
        router.push(
          andPrint ? `/job-cards/${created._id}/invoice?print=1` : `/job-cards/${created._id}`,
        );
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
        if (andPrint) router.push(`/job-cards/${docId}/invoice?print=1`);
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

  /**
   * What this customer has paid with before. Fetched when the customer
   * changes rather than on every render, and cleared for a walk-in, so the
   * card pad never offers someone else's card.
   */
  useEffect(() => {
    if (!ledgerId) {
      setSavedCards([]);
      setSavedBanks([]);
      setDue(null);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const l = await api.ledgers.get(ledgerId);
        if (!live) return;
        setSavedCards(l.savedCards ?? []);
        setSavedBanks(l.savedBanks ?? []);
      } catch {
        if (live) {
          setSavedCards([]);
          setSavedBanks([]);
        }
      }
      try {
        const d = await api.ledgers.due(ledgerId);
        if (live) setDue(d);
      } catch {
        // Not worth a toast: the order can be written without knowing.
        if (live) setDue(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [ledgerId]);

  /**
   * Whether an order exists either side of this one, so the buttons can say
   * so rather than letting someone press a dead end and get a toast. Asked of
   * the same endpoint the buttons use, so the answer cannot disagree with it.
   */
  useEffect(() => {
    if (mode !== 'edit' || no == null) {
      setNeighbours({ prev: false, next: false });
      return;
    }
    let live = true;
    void (async () => {
      const [prev, next] = await Promise.all(
        (['prev', 'next'] as const).map((dir) =>
          api.jobCards.adjacent(no, dir).then(
            () => true,
            () => false,
          ),
        ),
      );
      if (live) setNeighbours({ prev, next });
    })();
    return () => {
      live = false;
    };
  }, [mode, no]);

  async function navigate(dir: 'prev' | 'next') {
    if (no == null) return;
    try {
      const d = await api.jobCards.adjacent(no, dir);
      router.push(`/job-cards/${d._id}`);
    } catch {
      toast(dir === 'prev' ? 'This is the first stitching order' : 'This is the last stitching order', 'info');
    }
  }


  /**
   * Record the split as one payment per tender used.
   *
   * Each goes through the same endpoint a part payment uses, so nothing about
   * how a payment is booked changes — only how many are sent. Anything handed
   * over above the balance is change, so only the balance is ever recorded.
   */
  async function paySplit() {
    if (!docId) return;
    const due = Math.max(calc.balance, 0);
    const entries = (['cash', 'card', 'bank'] as TenderMode[])
      .map((mode) => ({ mode, amount: num(split[mode]) }))
      .filter((e) => e.amount > 0);
    if (!entries.length) return;

    // Trim the last tender back so the booked total never exceeds the balance.
    let left = due;
    const booked: { mode: TenderMode; amount: number }[] = [];
    for (const e of entries) {
      const take = Math.round(Math.min(e.amount, left) * 100) / 100;
      if (take > 0) booked.push({ mode: e.mode, amount: take });
      left = Math.round((left - take) * 100) / 100;
      if (left <= 0) break;
    }
    if (!booked.length) {
      toast('Nothing left to pay on this order', 'info');
      return;
    }

    setPayingSplit(true);
    try {
      const card = tenderDetails.card;
      const bankT = tenderDetails.bank;
      let latest: JobCard | null = null;
      for (const b of booked) {
        latest = await api.jobCards.addPayment(docId, {
          mode: b.mode,
          amount: b.amount,
          discount: 0,
          // The card number itself is deliberately not sent: the server keeps
          // the last four and nothing else, so there is no reason to put the
          // whole number on the wire. The CVC never leaves this component.
          ...(b.mode === 'card'
            ? {
                cardHolder: card.holder,
                cardLast4: last4(card.number),
                cardExpiry: card.expiry,
              }
            : {}),
          ...(b.mode === 'bank'
            ? {
                bank: bankT.bankName,
                accountName: bankT.accountName,
                iban: bankT.iban,
                swift: bankT.swift,
              }
            : {}),
        });
      }
      if (latest) loadDoc(latest);

      // Remember the details against the customer, so the next order offers
      // them instead of asking again. A failure here must not look like a
      // failed payment — the money is already booked.
      const usedCard = booked.some((b) => b.mode === 'card');
      const usedBank = booked.some((b) => b.mode === 'bank');
      if (ledgerId && (usedCard || usedBank)) {
        try {
          const saved = await api.ledgers.savePaymentDetails(ledgerId, {
            ...(usedCard
              ? { card: { holder: card.holder, last4: last4(card.number), expiry: card.expiry } }
              : {}),
            ...(usedBank
              ? {
                  bank: {
                    bankName: bankT.bankName,
                    accountName: bankT.accountName,
                    iban: bankT.iban,
                    swift: bankT.swift,
                  },
                }
              : {}),
          });
          setSavedCards(saved.savedCards ?? []);
          setSavedBanks(saved.savedBanks ?? []);
        } catch {
          // Nothing to tell the counter: the payment went through either way.
        }
      }

      setSplit(emptySplit());
      setTenderDetails(emptyDetails());
      const total = booked.reduce((t, b) => t + b.amount, 0);
      toast(`Payment of ${fmt(total)} AED recorded`);
      // Taking the money is the moment the invoice is wanted, so the pad hands
      // straight over to it with the print dialog already opening. The payment
      // is saved before this runs, so a cancelled print changes nothing.
      router.push(`/job-cards/${docId}/invoice?print=1`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Payment failed', 'error');
    } finally {
      setPayingSplit(false);
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

      // Rows row-for-person only while nobody has deleted one. Once the counts
      // diverge the positions no longer mean anything, so the reconciliation
      // below keeps its hands off rather than guessing at the wrong row.
      const aligned = out.length === before.length;

      // A person was removed: drop their row so the rest stay aligned.
      if (aligned && next.length < before.length) {
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

      // Deliberately no padding back up to next.length here: rows are freely
      // deletable, and every keystroke in a measurement runs through this
      // function, so topping the list up would resurrect a deleted row the
      // moment someone typed a chest size.

      // Stitching two thobes for someone means two of that line.
      return out.map((r, i) => {
        const person = next[i];
        const was = before[i];
        if (aligned && person && was && person.uid === was.uid && person.qty !== was.qty) {
          return { ...r, qty: String(person.qty ?? 1) };
        }
        return r;
      });
    });
  }

  return (
    <div>
      {mode === 'edit' && (
        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            className="btn-soft"
            onClick={() => navigate('prev')}
            disabled={!neighbours.prev}
            title={neighbours.prev ? 'Go to the previous order' : 'This is the first order'}
          >
            ‹‹ Previous Order
          </button>
          <button
            className="btn-soft"
            onClick={() => navigate('next')}
            disabled={!neighbours.next}
            title={neighbours.next ? 'Go to the next order' : 'This is the last order'}
          >
            Next Order ››
          </button>
        </div>
      )}

      {status === 'draft' && (
        <div className="mb-5 rounded-2xl border border-brass-200 bg-brass-50 px-5 py-3 text-sm font-semibold text-brass-800">
          This is a draft — it was saved automatically when the form was left part-finished.
          Fill in what is missing and press <strong>Save / Update Order</strong> to make it a
          real order. It cannot be converted to a sale until then.
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
            {/* The number the order is called, set over the form rather than
                boxed in beside the fields: it is read out and quoted, never
                typed into, so it reads as a title. */}
            <div className="mb-5 flex items-baseline justify-center gap-3">
              <p className="text-lg font-extrabold tracking-tight text-ink-900">
                {no == null && draftNo != null ? 'Draft NO:' : 'Order NO:'}
              </p>
              <p className="text-3xl font-black leading-none tabular-nums text-ink-900">
                {no ?? (draftNo != null ? draftNo : '…')}
              </p>
            </div>

            {/* One 12-column grid whose spans fill exactly two rows, in the
                order the counter works: who the order is for and what it is
                referenced by, then the book it came out of and its dates. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-12">
              <Field label="Party A/c (Customer)" className="col-span-2 sm:col-span-5">
                <TextInput
                  value={partyName}
                  onChange={(e) => { setPartyName(e.target.value); setLedgerId(''); }}
                  disabled={readOnly}
                  placeholder="Select from ledger…"
                  className="font-semibold"
                />
                {/* What they owed before this order was written, so whoever is
                    at the counter knows to ask for it. It covers their opening
                    balance, unpaid orders and unpaid bills — this order is not
                    in it until it is saved. A negative figure is credit. */}
                {due && priorDue !== 0 && (
                  <p
                    className={`mt-1 text-[11px] font-bold ${
                      priorDue > 0 ? 'text-rose-600' : 'text-brand-700'
                    }`}
                    title={
                      priorDue > 0
                        ? `Opening ${fmt(due.openingBalance)} + unpaid orders ${fmt(due.orderDue)} + unpaid bills ${fmt(due.saleDue)}${
                            mode === 'edit' ? ', less this order' : ''
                          }`
                        : 'This customer has paid ahead'
                    }
                  >
                    {priorDue > 0
                      ? `Due Balance: ${fmt(priorDue)} AED`
                      : `In credit: ${fmt(Math.abs(priorDue))} AED`}
                  </p>
                )}
              </Field>
              {/* Find an existing customer, or add one. Both act on the field
                  beside them, so they sit together rather than either being
                  spelled out in a button wide enough to say so. */}
              <Field label="&nbsp;" className="sm:col-span-2">
                <div className="flex gap-2">
                  <button
                    className="btn-soft shrink-0"
                    onClick={() => { setLedgerMode('search'); setLedgerOpen(true); }}
                    disabled={readOnly}
                    title="Find an existing customer in the ledger"
                    aria-label="Find ledger"
                  >
                    <Icon name="search" className="h-[17px] w-[17px]" />
                  </button>
                  {canAddLedger && (
                    <button
                      className="btn-soft shrink-0"
                      onClick={() => { setLedgerMode('newCustomer'); setLedgerOpen(true); }}
                      disabled={readOnly}
                      title="Add a customer to the ledger and put them on this order"
                      aria-label="New customer"
                    >
                      <Icon name="plus" className="h-[17px] w-[17px]" />
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Ref" className="col-span-2 sm:col-span-5">
                <TextInput value={ref} onChange={(e) => setRef(e.target.value)} disabled={readOnly} className="font-mono" />
              </Field>

              <Field label="Book No" className="sm:col-span-2">
                {/* An identifier, not a figure: it reads left like Ref beside
                    it, rather than right like Qty, Rate and Amount. `!`
                    because NumberInput's own text-right would otherwise win. */}
                <NumberInput value={bookNo} onChange={(e) => setBookNo(e.target.value)} disabled={readOnly} className="!text-left" />
              </Field>
              {/* Opens the search over past orders — it belongs beside Book No
                  because the book number is what people search back by. */}
              <Field label="&nbsp;" className="sm:col-span-2">
                <button
                  className="btn-soft w-full"
                  onClick={() => { setFindOpen(true); setFindQ(''); setFindRows([]); }}
                  title="Find an earlier order"
                >
                  Find
                </button>
              </Field>
              <Field label="Date" className="sm:col-span-4">
                <DateInput value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Delivery Date" className="sm:col-span-4">
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
                    <th className="th">Product</th>
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
                          <div className="flex items-center gap-2">
                            {r.code && (
                              <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-700">
                                {r.code}
                              </span>
                            )}
                            <ProductSearchInput
                              value={r.productName}
                              onChange={(v) => updateItem(i, { productName: v, code: '' })}
                              onPick={(p) => pickProduct(i, p)}
                              disabled={readOnly}
                              usableAs="item"
                              allowCreate
                              placeholder="Type a code or product name…"
                              className=""
                            />
                          </div>
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
          </Card>

          {/* measurements — one block per person on this order */}
          <Card className="p-5">
            <MeasurementSets
              sets={sets}
              onChange={changeSets}
              ledgerId={ledgerId || undefined}
              readOnly={readOnly}
            />

            {/* The cost built up from its parts, then what the order is
                worth: materials, the stitching, the two added, and last what
                the customer pays — so the margin is the step between the
                final two. Ranged left, where the eye lands coming off the
                measurements above. */}
            <div className="mt-6 flex flex-wrap items-end justify-start gap-4 border-t border-ink-100 pt-5">
              <Field label="Material Cost" className="w-40">
                <TextInput
                  value={fmt(calc.materialTotal)}
                  readOnly
                  title="Everything booked under Materials Used, for every person on this order"
                  className="bg-ink-50 text-right font-bold tabular-nums"
                />
              </Field>
              <Field label="Job Cost" className="w-40">
                <NumberInput value={jobCost} onChange={(e) => setJobCost(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Total Cost" className="w-40">
                <TextInput
                  value={fmt(totalCost)}
                  readOnly
                  title="Material Cost + Job Cost"
                  className="bg-ink-50 text-right font-bold tabular-nums"
                />
              </Field>
              <Field label="Total Order Amount" className="w-40">
                <TextInput
                  value={fmt(calc.netAmount)}
                  readOnly
                  title="What the customer pays, tax included"
                  className="bg-ink-50 text-right font-bold tabular-nums"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* right payment panel */}
        <div>
          <Card className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto p-4">
            {/* The chain the counter reads out, in the order the money is
                actually worked out: what the goods come to, what is added or
                taken off, the tax on the result, then the one figure the
                customer hands over. Each row follows from the ones above it,
                so the two that are typed into sit where they take effect. */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-500">Total without Tax</span>
                <span className="font-bold tabular-nums">{fmt(calc.total)} AED</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink-500">Additional Charges</span>
                <NumberInput
                  value={additionalCharges}
                  onChange={(e) => setAdditionalCharges(e.target.value)}
                  disabled={readOnly}
                  className="input-sm !w-28"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink-500">Discount</span>
                <NumberInput
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  disabled={readOnly}
                  className="input-sm !w-28"
                />
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 pt-1.5">
                <span className="font-medium text-ink-500">Tax ({taxRate}% VAT)</span>
                <span className="font-bold tabular-nums">+ {fmt(calc.tax)} AED</span>
              </div>
            </div>

            {/* The count rides on the bar rather than taking a row of its own,
                so the figures above read as one unbroken sum. */}
            <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-brand-700 px-3.5 py-2.5 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                  Total Payable
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-white/60">
                  Items: {calc.itemCount} · Quantity: {fmt(calc.qtyCount)}
                </p>
              </div>
              <p className="shrink-0 text-xl font-black tabular-nums leading-none">
                {fmt(calc.netAmount)}
              </p>
            </div>

            {/* What they already owed, beside the way to go and look at it.
                Shown, not added: Total Payable is this order's own value, and
                folding an earlier debt into it would put the wrong figure on
                this invoice and charge tax on it a second time. */}
            <div className="mt-1.5 flex items-center justify-between gap-3 text-xs font-bold">
              {priorDue > 0 ? (
                <span className="text-rose-600">Due Balance: {fmt(priorDue)}</span>
              ) : (
                <span />
              )}
              <button
                className="text-rose-600 underline-offset-2 hover:underline"
                onClick={() => setHistoryOpen(true)}
              >
                Order History
              </button>
            </div>

            <div className="mb-3 mt-3 border-t border-ink-100" />

            {/* Anything already taken, so the pad below only ever counts what
                is being handed over now. */}
            {calc.advance > 0 && (
              <div className="mb-3 space-y-1.5">
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
                  <span className="label !mb-0">Already Paid</span>
                  <span className="text-[13px] font-extrabold tabular-nums">{fmt(calc.advance)}</span>
                </div>
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-ink-500">Advance Before Tax</span>
                  <span className="font-semibold tabular-nums">{fmt(calc.advanceBeforeTax)}</span>
                </div>
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-ink-500">Advance Tax</span>
                  <span className="font-semibold tabular-nums">{fmt(calc.advanceTax)}</span>
                </div>
              </div>
            )}

            <SplitTender
              due={Math.max(calc.balance, 0)}
              value={split}
              onChange={setSplit}
              details={tenderDetails}
              onDetailsChange={setTenderDetails}
              savedCards={savedCards}
              savedBanks={savedBanks}
              onPay={docId && canPay ? () => void paySplit() : undefined}
              disabled={readOnly}
              busy={payingSplit}
              note={
                !docId
                  ? 'Save the order first — a payment is recorded against a saved order.'
                  : !canPay
                    ? 'You do not have permission to take payments.'
                    : undefined
              }
            />


            {/*
              A new order can only be saved; an existing one can be updated and,
              separately, billed. Both live here so the primary action is beside
              the figures it commits.
            */}
            {canSave && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  className="btn-primary !py-2 text-[13px]"
                  onClick={() => void save(true)}
                  disabled={saving || readOnly}
                >
                  {saving ? 'Saving…' : 'Save & Print'}
                </button>
                <button
                  className="btn-soft !py-2 text-[13px]"
                  onClick={() => void save(false)}
                  disabled={saving || readOnly}
                >
                  {saving ? 'Saving…' : 'Save Only'}
                </button>
              </div>
            )}
            {mode === 'edit' && (
              <p className="mt-2 text-center text-[10px] text-ink-400">
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
                <th className="th">Details</th>
                <th className="th text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {payments.map((p, i) => (
                <tr key={i}>
                  <td className="td">{fmtDate(p.date)}</td>
                  <td className="td capitalize">{p.mode}</td>
                  <td className="td text-right font-bold tabular-nums">{fmt(p.amount)}</td>
                  {/* Whichever details that tender carried — a card is
                      recognised by its last four, a transfer by its bank
                      and reference. */}
                  <td className="td text-xs text-ink-500">
                    {[
                      p.cardLast4 ? `•••• ${p.cardLast4}` : '',
                      p.cardHolder,
                      p.cardExpiry,
                      p.bank,
                      p.iban ? `…${p.iban.slice(-4)}` : '',
                      p.swift,
                      p.reference,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
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
