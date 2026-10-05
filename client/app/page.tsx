'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmt, fmtAED, fmtDate } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { Card, SectionTitle, EmptyState, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/Toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.dashboard.summary());
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not load dashboard', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">A live overview of your tailoring business.</p>

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-ink-200" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Today's Sales"
              value={fmtAED(data.todaySales)}
              sub={`${data.todayBills} bills today`}
              icon="coins"
              tone="brand"
            />
            <StatCard
              title="Month Sales"
              value={fmtAED(data.monthSales)}
              sub={`${data.monthBills} bills this month`}
              icon="trending"
              tone="ink"
            />
            <StatCard
              title="Open Stitching"
              value={String(data.openJobCards)}
              sub="awaiting stitching / delivery"
              icon="scissors"
              tone="brass"
            />
            <StatCard
              title="Customers"
              value={String(data.totalCustomers)}
              sub="ledgers on file"
              icon="users"
              tone="ink"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <SectionTitle
                title="Recent Stitching"
                sub="Latest orders in the workshop"
                right={
                  <Link href="/job-cards" className="btn-soft !py-1.5 text-xs">
                    View all →
                  </Link>
                }
              />
              {data.recentJobCards.length === 0 ? (
                <EmptyState title="No stitching orders yet" sub="Create your first stitching order to get started." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink-100">
                        <th className="th">No</th>
                        <th className="th">Ref</th>
                        <th className="th">Customer</th>
                        <th className="th">Delivery</th>
                        <th className="th text-right">Net Amt</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {data.recentJobCards.map((j) => (
                        <tr key={j._id} className="hover:bg-ink-50/70">
                          <td className="td font-bold text-brand-700">
                            <Link href={`/job-cards/${j._id}`}>{j.no}</Link>
                          </td>
                          <td className="td font-mono text-xs">{j.ref}</td>
                          <td className="td font-medium">{j.partyName || '—'}</td>
                          <td className="td">{fmtDate(j.deliveryDate)}</td>
                          <td className="td text-right font-bold tabular-nums">{fmt(j.netAmount)}</td>
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

            <Card className="p-5">
              <SectionTitle
                title="Low Stock"
                sub="Products below 10 units"
                right={
                  <Link href="/products" className="btn-soft !py-1.5 text-xs">
                    Inventory →
                  </Link>
                }
              />
              {data.lowStock.length === 0 ? (
                <EmptyState title="Stock looks healthy" sub="Nothing is running low right now." />
              ) : (
                <ul className="space-y-2.5">
                  {data.lowStock.map((p) => (
                    <li
                      key={p._id}
                      className="flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-ink-800">
                          <span className="mr-2 font-mono text-xs text-brand-600">{p.code}</span>
                          {p.name}
                        </p>
                        <p className="text-[11px] text-ink-500 capitalize">{p.category}</p>
                      </div>
                      <span
                        className={`badge ${p.stockQty <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-brass-100 text-brass-700'}`}
                      >
                        {p.stockQty} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Could not reach the API"
            sub="Make sure the server is running (npm run dev in server/) and MongoDB is up."
          />
        </div>
      )}
    </div>
  );
}
