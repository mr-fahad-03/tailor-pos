'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmt, fmtDate } from '@/lib/format';
import type { JobCard } from '@/lib/types';
import { Card, EmptyState, Seg, StatusBadge, TextInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

function JobCardsInner() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canManage = can('jobcards.create');
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') ?? '';

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (query: string, st: string) => {
      setLoading(true);
      try {
        const r = await api.jobCards.list(query, st, 1, 50);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load stitching orders', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(initialQ, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q, status), 350);
    return () => clearTimeout(t);
  }, [q, status, load]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Stitching</h1>
          <p className="page-sub">{total} records</p>
        </div>
        {canManage && (
          <Link href="/job-cards/new" className="btn-primary ml-auto">
            ＋ New Stitching
          </Link>
        )}
      </div>

      <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by no, ref, customer, phone…"
          className="max-w-sm"
        />
        <Seg
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
            { value: 'converted', label: 'Converted' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No stitching orders found" sub="Try a different search or create a new one." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">No</th>
                  <th className="th">Ref</th>
                  <th className="th">Customer</th>
                  <th className="th">Phone</th>
                  <th className="th">Date</th>
                  <th className="th">Delivery</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Advance</th>
                  <th className="th text-right">Balance</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((j) => (
                  <tr key={j._id} className="transition hover:bg-brand-50/50">
                    <td className="td">
                      <Link href={`/job-cards/${j._id}`} className="font-extrabold text-brand-700 hover:underline">
                        {j.no}
                      </Link>
                    </td>
                    <td className="td font-mono text-xs text-ink-500">{j.ref}</td>
                    <td className="td font-semibold">{j.partyName || '—'}</td>
                    <td className="td font-mono text-xs">{j.phone || '—'}</td>
                    <td className="td">{fmtDate(j.date)}</td>
                    <td className="td">{fmtDate(j.deliveryDate)}</td>
                    <td className="td text-right font-bold tabular-nums">{fmt(j.netAmount)}</td>
                    <td className="td text-right tabular-nums text-emerald-600">{fmt(j.advance)}</td>
                    <td className="td text-right font-bold tabular-nums text-brass-600">{fmt(j.balance)}</td>
                    <td className="td">
                      <StatusBadge status={j.status} />
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

export default function JobCardsPage() {
  return (
    <Suspense>
      <JobCardsInner />
    </Suspense>
  );
}
