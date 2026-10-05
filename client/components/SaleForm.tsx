'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fmt, num, todayISO, toISODate } from '@/lib/format';
import type { JobCard, Ledger, Product } from '@/lib/types';
import { useSettings } from './SettingsContext';
import { useToast } from './Toast';
import { useAuth } from './AuthContext';
import {
  Card,
  Checkbox,
  DateInput,
  Field,
  NumberInput,
  Seg,
  TextInput,
} from './ui';
import { Modal } from './Modal';
import { LedgerSearchModal } from './LedgerSearchModal';
import { ProductSearchInput } from './ProductSearchInput';
import { Icon } from '@/components/icons';

interface SaleRow {
  code: string;
  productName: string;
  qty: string;
  rate: string;
  discPercent: string;
  taxPercent: string;
}

const emptyRow = (taxRate: number): SaleRow => ({
  code: '',
  productName: '',
  qty: '1',
  rate: '',
  discPercent: '0',
  taxPercent: String(taxRate),
});

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function SaleForm() {
  const { can } = useAuth();
  const canCreate = can('sales.create');
  const router = useRouter();
  const { toast } = useToast();
  const { settings } = useSettings();
  const taxRate = settings.taxRate;

  const [saleType, setSaleType] = useState<'retail' | 'wholesale' | 'distributor'>('retail');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [category, setCategory] = useState<'A' | 'B'>('A');
  const [isReturn, setIsReturn] = useState(false);
  const [useCreditCard, setUseCreditCard] = useState(false);
  const [creditCardNo, setCreditCardNo] = useState('');

  const [billDate, setBillDate] = useState(todayISO());
  const [salesman, setSalesman] = useState(settings.salesman);
  const [jobCardRef, setJobCardRef] = useState('');
  const [jobCardId, setJobCardId] = useState('');

  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [ledgerId, setLedgerId] = useState('');
  const [delDate, setDelDate] = useState('');
  const [landmark, setLandmark] = useState('');
  const [trn, setTrn] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const [rows, setRows] = useState<SaleRow[]>([emptyRow(taxRate)]);
  const [additionalDiscount, setAdditionalDiscount] = useState('0');
  const [freight, setFreight] = useState('0');
  const [advanceAmount, setAdvanceAmount] = useState('0');

  const [saving, setSaving] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [jcOpen, setJcOpen] = useState(false);
  const [jcQ, setJcQ] = useState('');
  const [jcRows, setJcRows] = useState<JobCard[]>([]);

  const calc = useMemo(() => {
    const lines = rows.map((r) => {
      const qty = num(r.qty);
      const rate = num(r.rate);
      const discAmt = r2((qty * rate * num(r.discPercent)) / 100);
      const grossAmt = r2(qty * rate - discAmt);
      const taxAmt = r2((grossAmt * num(r.taxPercent)) / 100);
      const netAmount = r2(grossAmt + taxAmt);
      return {
        ...r,
        qty,
        rate,
        discAmt,
        grossAmt,
        taxAmt,
        netAmount,
        netRate: qty ? r2(netAmount / qty) : 0,
        discPercent: num(r.discPercent),
        taxPercent: num(r.taxPercent),
      };
    });
    const totQty = r2(lines.reduce((s, l) => s + l.qty, 0));
    const grossAmount = r2(lines.reduce((s, l) => s + l.grossAmt, 0));
    const lineDisc = r2(lines.reduce((s, l) => s + l.discAmt, 0));
    const addDisc = r2(num(additionalDiscount));
    const taxAmt = r2(lines.reduce((s, l) => s + l.taxAmt, 0));
    const fr = r2(num(freight));
    const netAmount = r2(grossAmount - addDisc + taxAmt + fr);
    const adv = r2(num(advanceAmount));
    return {
      lines,
      totQty,
      grossAmount,
      discountAmt: r2(lineDisc + addDisc),
      additionalDiscount: addDisc,
      taxAmt,
      freight: fr,
      advanceAmount: adv,
      netAmount,
      balance: r2(netAmount - adv),
    };
  }, [rows, additionalDiscount, freight, advanceAmount]);

  useEffect(() => {
    setRows((rs) => rs.map((r) => ({ ...r, taxPercent: String(taxRate) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRate]);

  const updateRow = (i: number, patch: Partial<SaleRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function pickProduct(i: number, p: Product) {
    const rate = saleType === 'wholesale' && p.wholesaleRate ? p.wholesaleRate : p.rate;
    updateRow(i, { code: p.code, productName: p.name, rate: String(rate) });
  }

  function pickLedger(l: Ledger) {
    setPartyName(l.name);
    setPhone(l.phone ?? '');
    setLedgerId(l._id);
    if (l.trn) setTrn(l.trn);
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
    setJobCardRef(j.ref);
    setJobCardId(j._id);
    setPartyName(j.partyName ?? '');
    setPhone(j.phone ?? '');
    setLedgerId(j.ledgerId ?? '');
    setAdvanceAmount(String(j.advance ?? 0));
    setRows(
      j.items.map((i) => ({
        code: i.code ?? '',
        productName: i.productName ?? '',
        qty: String(i.qty),
        rate: String(i.rate),
        discPercent: '0',
        taxPercent: String(taxRate),
      })),
    );
    setJcOpen(false);
    toast(`Loaded stitching order ${j.ref} — advance ${fmt(j.advance)} AED applied`, 'info');
  }

  async function save() {
    const valid = calc.lines.filter((l) => l.code || l.productName || l.qty || l.rate);
    if (valid.length === 0) {
      toast('Add at least one item', 'error');
      return;
    }
    if (!partyName.trim()) {
      toast('Customer name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const sale = await api.sales.create({
        billDate,
        saleType,
        paymentType,
        category,
        creditCardNo: useCreditCard ? creditCardNo : undefined,
        jobCardRef: jobCardRef || undefined,
        jobCardId: jobCardId || undefined,
        salesman,
        partyName: partyName.trim(),
        phone: phone.trim(),
        ledgerId: ledgerId || undefined,
        delDate: delDate || undefined,
        landmark,
        trn,
        vehicleNo,
        items: valid.map((l) => ({
          code: l.code,
          productName: l.productName,
          qty: l.qty,
          rate: l.rate,
          discPercent: l.discPercent,
          taxPercent: l.taxPercent,
        })),
        additionalDiscount: calc.additionalDiscount,
        freight: calc.freight,
        advanceAmount: calc.advanceAmount,
        isReturn,
        defaultTaxPercent: taxRate,
      });
      toast(`${isReturn ? 'Return' : 'Bill'} B-${sale.billNo} saved`);
      router.push(`/sales/${sale._id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">{isReturn ? 'Sales Return' : 'Sales / Return'}</h1>
          <p className="page-sub">Create a bill {jobCardRef && `from stitching order ${jobCardRef}`}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-soft" onClick={() => window.print()}>
            🖨 Print
          </button>
          {canCreate && (
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Bill'}
            </button>
          )}
        </div>
      </div>

      {/* toggles */}
      <Card className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <div>
          <span className="label">Sale Type</span>
          <Seg
            options={[
              { value: 'retail' as const, label: 'Retail' },
              { value: 'wholesale' as const, label: 'Wholesale' },
              { value: 'distributor' as const, label: 'Distributor' },
            ]}
            value={saleType}
            onChange={setSaleType}
          />
        </div>
        <div>
          <span className="label">Payment</span>
          <Seg
            options={[
              { value: 'cash' as const, label: 'Cash' },
              { value: 'credit' as const, label: 'Credit' },
            ]}
            value={paymentType}
            onChange={setPaymentType}
          />
        </div>
        <div>
          <span className="label">Category</span>
          <Seg
            options={[
              { value: 'A' as const, label: 'A' },
              { value: 'B' as const, label: 'B' },
            ]}
            value={category}
            onChange={setCategory}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={useCreditCard}
            onChange={(e) => setUseCreditCard(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          Credit Card
        </label>
        {useCreditCard && (
          <Field label="Card No" className="w-48">
            <TextInput value={creditCardNo} onChange={(e) => setCreditCardNo(e.target.value)} className="font-mono" />
          </Field>
        )}
        <div className="ml-auto">
          <Checkbox
            label="Return (sales return mode)"
            checked={isReturn}
            onChange={setIsReturn}
            className="!text-rose-600"
          />
        </div>
      </Card>

      {/* header */}
      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          <Field label="Bill No">
            <TextInput value="Auto" readOnly className="bg-ink-50 font-bold text-brand-700" />
          </Field>
          <Field label="Bill Date">
            <DateInput value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </Field>
          <Field label="Stitching Ref">
            <div className="flex gap-2">
              <TextInput value={jobCardRef} readOnly placeholder="—" className="bg-ink-50 font-mono" />
              <button className="btn-soft shrink-0" onClick={() => { setJcOpen(true); setJcQ(''); setJcRows([]); }}>
                Find
              </button>
            </div>
          </Field>
          <Field label="Sales Man">
            <TextInput value={salesman} onChange={(e) => setSalesman(e.target.value)} />
          </Field>
          <Field label="Del Date">
            <DateInput value={delDate} onChange={(e) => setDelDate(e.target.value)} />
          </Field>
          <Field label="Vehicle No">
            <TextInput value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Party A/c">
            <div className="flex gap-2">
              <TextInput
                value={partyName}
                onChange={(e) => { setPartyName(e.target.value); setLedgerId(''); }}
                placeholder="Customer"
                className="font-semibold"
              />
              <button className="btn-soft shrink-0" onClick={() => setLedgerOpen(true)} title="Find ledger (F2)" aria-label="Find ledger">
                <Icon name="search" className="h-[17px] w-[17px]" />
              </button>
            </div>
          </Field>
          <Field label="Name [F2]">
            <TextInput value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Landmark">
            <TextInput value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </Field>
          <Field label="TRN">
            <TextInput value={trn} onChange={(e) => setTrn(e.target.value)} className="font-mono" />
          </Field>
        </div>
      </Card>

      {/* items */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight text-ink-900">Items</h2>
          <button className="btn-soft !py-1.5 text-xs" onClick={() => setRows((r) => [...r, emptyRow(taxRate)])}>
            ＋ Add row
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-ink-50">
              <tr>
                <th className="th w-10">Sl</th>
                <th className="th w-32">Code</th>
                <th className="th">Product Name</th>
                <th className="th w-24 text-right">Net Rate</th>
                <th className="th w-20 text-right">Qty</th>
                <th className="th w-24 text-right">Rate</th>
                <th className="th w-20 text-right">Disc%</th>
                <th className="th w-24 text-right">Disc Amt</th>
                <th className="th w-24 text-right">Gross Amt</th>
                <th className="th w-20 text-right">Tax%</th>
                <th className="th w-24 text-right">Tax Amt</th>
                <th className="th w-28 text-right">Net Amount</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r, i) => {
                const l = calc.lines[i];
                return (
                  <tr key={i}>
                    <td className="td text-ink-400">{i + 1}</td>
                    <td className="td">
                      <ProductSearchInput value={r.code} onChange={(v) => updateRow(i, { code: v })} onPick={(p) => pickProduct(i, p)} />
                    </td>
                    <td className="td">
                      <TextInput value={r.productName} onChange={(e) => updateRow(i, { productName: e.target.value })} className="input-sm" placeholder="Product" />
                    </td>
                    <td className="td text-right tabular-nums text-ink-500">{fmt(l.netRate)}</td>
                    <td className="td">
                      <NumberInput value={r.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} className="input-sm" />
                    </td>
                    <td className="td">
                      <NumberInput value={r.rate} onChange={(e) => updateRow(i, { rate: e.target.value })} className="input-sm" />
                    </td>
                    <td className="td">
                      <NumberInput value={r.discPercent} onChange={(e) => updateRow(i, { discPercent: e.target.value })} className="input-sm" />
                    </td>
                    <td className="td text-right tabular-nums">{fmt(l.discAmt)}</td>
                    <td className="td text-right font-semibold tabular-nums">{fmt(l.grossAmt)}</td>
                    <td className="td">
                      <NumberInput value={r.taxPercent} onChange={(e) => updateRow(i, { taxPercent: e.target.value })} className="input-sm" />
                    </td>
                    <td className="td text-right tabular-nums">{fmt(l.taxAmt)}</td>
                    <td className="td text-right font-bold tabular-nums text-brand-700">{fmt(l.netAmount)}</td>
                    <td className="td">
                      <button className="text-rose-500 hover:text-rose-700" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer totals */}
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Tot Qty">
            <TextInput value={fmt(calc.totQty)} readOnly className="bg-ink-50 text-right font-bold tabular-nums" />
          </Field>
          <Field label="Gross Amount">
            <TextInput value={fmt(calc.grossAmount)} readOnly className="bg-ink-50 text-right font-bold tabular-nums" />
          </Field>
          <Field label="Disc. Amt">
            <TextInput value={fmt(calc.discountAmt)} readOnly className="bg-ink-50 text-right tabular-nums" />
          </Field>
          <Field label="Add. Disc.">
            <NumberInput value={additionalDiscount} onChange={(e) => setAdditionalDiscount(e.target.value)} />
          </Field>
          <Field label="Tax Amt">
            <TextInput value={fmt(calc.taxAmt)} readOnly className="bg-ink-50 text-right font-bold tabular-nums" />
          </Field>
          <Field label="Freight">
            <NumberInput value={freight} onChange={(e) => setFreight(e.target.value)} />
          </Field>
          <Field label="Advance Amount">
            <NumberInput value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
          </Field>
          <div>
            <span className="label">Net Amount</span>
            <div className="rounded-xl bg-brand-700 px-3 py-2 text-right text-lg font-black tabular-nums text-white">
              {fmt(calc.netAmount)}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-2">
            <span className="text-sm font-bold text-emerald-700">Balance receivable</span>
            <span className="text-lg font-black tabular-nums text-emerald-700">{fmt(calc.balance)} AED</span>
          </div>
        </div>
      </Card>

      {/* modals */}
      <LedgerSearchModal open={ledgerOpen} onClose={() => setLedgerOpen(false)} onSelect={pickLedger} />

      <Modal
        open={jcOpen}
        onClose={() => setJcOpen(false)}
        title="Find Stitching for conversion"
        sub="Open or closed stitching orders (not yet converted)"
        wide
        footer={<button className="btn-soft" onClick={() => setJcOpen(false)}>Cancel</button>}
      >
        <div className="mb-4 flex gap-2">
          <TextInput
            autoFocus
            placeholder="e.g. fm-13051 or customer name"
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
                <tr key={j._id} className="cursor-pointer hover:bg-brand-50" onClick={() => convertFrom(j)}>
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
