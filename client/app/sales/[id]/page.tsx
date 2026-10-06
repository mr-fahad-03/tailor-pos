'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmt, fmtDate } from '@/lib/format';
import type { Sale } from '@/lib/types';
import { Card, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/icons';

export default function SaleDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get('print') === '1';

  useEffect(() => {
    (async () => {
      try {
        setSale(await api.sales.get(params.id));
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Bill not found', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Arrived here from Save and print: raise the dialog once the bill is on
  // screen, so what prints is the bill rather than an empty page.
  useEffect(() => {
    if (!autoPrint || loading || !sale) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [autoPrint, loading, sale]);

  if (loading) return <div className="h-96 animate-pulse rounded-2xl bg-ink-200" />;
  if (!sale) return <EmptyState title="Bill not found" sub="It may have been deleted." />;

  return (
    <div>
      <div className="no-print mb-3 flex items-center gap-3">
        <Link href="/sales" className="btn-soft">
          ← All bills
        </Link>
        <button className="btn-primary ml-auto" onClick={() => window.print()}>
          🖨 Print / PDF
        </button>
      </div>

      <Card className="mx-auto max-w-4xl p-8">
        {/* invoice header */}
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Icon name="scissors" className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xl font-black tracking-tight text-ink-900">Tailor POS</p>
                <p className="text-xs text-ink-500">Stitching · Alteration · Fabrics — VAT 5% (UAE)</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-ink-900">
              {sale.isReturn ? 'RETURN' : 'TAX INVOICE'}
            </p>
            <p className="mt-1 text-sm font-bold text-brand-700">B-{sale.billNo}</p>
            <p className="text-xs text-ink-500">{fmtDate(sale.billDate)}</p>
          </div>
        </div>

        {/* parties */}
        <div className="grid grid-cols-1 gap-6 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="label">Billed To</p>
            <p className="text-base font-extrabold text-ink-900">{sale.partyName || '—'}</p>
            {sale.phone && <p className="mt-0.5 font-mono text-ink-600">{sale.phone}</p>}
            {sale.trn && <p className="mt-0.5 text-ink-600">TRN: {sale.trn}</p>}
            {sale.landmark && <p className="mt-0.5 text-ink-600">{sale.landmark}</p>}
          </div>
          <div className="text-right">
            <p className="label">Details</p>
            <p className="text-ink-600">Type: <span className="font-semibold capitalize text-ink-800">{sale.saleType} · {sale.paymentType}</span></p>
            <p className="text-ink-600">Salesman: <span className="font-semibold text-ink-800">{sale.salesman}</span></p>
            {sale.jobCardRef && <p className="text-ink-600">Job Ref: <span className="font-mono font-semibold text-ink-800">{sale.jobCardRef}</span></p>}
            {sale.delDate && <p className="text-ink-600">Del Date: <span className="font-semibold text-ink-800">{fmtDate(sale.delDate)}</span></p>}
          </div>
        </div>

        {/* items */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-ink-900 text-white">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Sl</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Product</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Qty</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Rate</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Disc</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Tax</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Net Amt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {sale.items.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5 text-sm text-ink-400">{i + 1}</td>
                <td className="px-3 py-2.5 text-sm">
                  <span className="mr-2 font-mono text-xs text-ink-400">{it.code}</span>
                  <span className="font-semibold">{it.productName}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">{it.qty}</td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmt(it.rate)}</td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmt(it.discAmt)}</td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmt(it.taxAmt)}</td>
                <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">{fmt(it.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Tot Qty</span><span className="font-semibold tabular-nums">{fmt(sale.totQty)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Gross Amount</span><span className="font-semibold tabular-nums">{fmt(sale.grossAmount)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Discount</span><span className="font-semibold tabular-nums">{fmt(sale.discountAmt)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Tax Amt (VAT 5%)</span><span className="font-semibold tabular-nums">{fmt(sale.taxAmt)}</span></div>
            {sale.freight > 0 && <div className="flex justify-between"><span className="text-ink-500">Freight</span><span className="font-semibold tabular-nums">{fmt(sale.freight)}</span></div>}
            {sale.advanceAmount > 0 && <div className="flex justify-between"><span className="text-ink-500">Advance</span><span className="font-semibold tabular-nums text-emerald-600">{fmt(sale.advanceAmount)}</span></div>}
            <div className="flex justify-between border-t-2 border-ink-900 pt-2 text-base">
              <span className="font-extrabold">Net Amount (AED)</span>
              <span className="font-black tabular-nums">{fmt(sale.netAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span className="font-bold">Balance</span>
              <span className="font-black tabular-nums">{fmt(sale.balance)} AED</span>
            </div>
          </div>
        </div>

        <p className="mt-8 border-t border-ink-200 pt-4 text-center text-[11px] text-ink-400">
          Thank you for your business · This is a computer generated invoice
        </p>
      </Card>
    </div>
  );
}
