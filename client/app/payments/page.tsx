'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, fmtDate } from '@/lib/format';
import type { FlatPayment } from '@/lib/types';
import { Card, EmptyState } from '@/components/ui';
import { StatCard } from '@/components/StatCard';
import { useToast } from '@/components/Toast';

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<FlatPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.jobCards.payments();
        setRows(r.items);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load payments', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const cash = rows.filter((p) => p.mode === 'cash').reduce((s, p) => s + Number(p.amount || 0), 0);
  const card = rows.filter((p) => p.mode === 'card').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div>
      <h1 className="page-title">Payments</h1>
      <p className="page-sub">Advances and part payments collected against stitching orders.</p>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Collected" value={`${fmt(total)} AED`} sub={`${rows.length} payments`} icon="coins" tone="brand" />
        <StatCard title="Cash" value={`${fmt(cash)} AED`} icon="banknote" tone="ink" />
        <StatCard title="Card" value={`${fmt(card)} AED`} icon="card" tone="brass" />
      </div>

      <Card className="mt-3 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No payments yet" sub="Record a part payment from any stitching order." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">Date</th>
                  <th className="th">Stitching</th>
                  <th className="th">Customer</th>
                  <th className="th">Mode</th>
                  <th className="th">Bank / Ref</th>
                  <th className="th text-right">Discount</th>
                  <th className="th text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((p, i) => (
                  <tr key={i} className="hover:bg-ink-50/70">
                    <td className="td">{fmtDate(p.date)}</td>
                    <td className="td">
                      <Link href={`/job-cards/${p.jobCardId}`} className="font-extrabold text-brand-700 hover:underline">
                        {p.jobCardNo}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-ink-400">{p.jobCardRef}</span>
                    </td>
                    <td className="td font-medium">{p.partyName || '—'}</td>
                    <td className="td">
                      <span className="badge bg-ink-100 capitalize text-ink-600">{p.mode}</span>
                    </td>
                    <td className="td text-xs text-ink-500">
                      {[p.bank, p.reference].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="td text-right tabular-nums text-ink-500">{fmt(p.discount)}</td>
                    <td className="td text-right font-extrabold tabular-nums text-emerald-600">
                      {fmt(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
