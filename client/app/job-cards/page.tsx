'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmt, fmtDate, orderNo } from '@/lib/format';
import type { JobCard } from '@/lib/types';
import { Card, EmptyState, Seg, StatusBadge, TextInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';
import { useSettings } from '@/components/SettingsContext';
import { ChangeLog } from '@/components/ChangeLog';

function JobCardsInner() {
  const { toast } = useToast();
  const { can, user } = useAuth();
  const { settings } = useSettings();
  const canManage = can('jobcards.create');
  const canConvert = can('jobcards.convert');
  // The log is the owner's view of who touched what — role, not a permission.
  const isSuperAdmin = user?.role === 'super_admin';
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') ?? '';

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);

  const load = useCallback(
    async (query: string, st: string) => {
      setLoading(true);
      try {
        const r = await api.jobCards.list(query, st, 1, 50);
        setRows(r.items);
        setTotal(r.total);
        // A tick means nothing once the rows underneath it have changed.
        setSelected([]);
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

  /** Only an open order can be billed — the rest are done or already invoiced. */
  const convertible = rows.filter((j) => j.status === 'open');
  const allPicked = convertible.length > 0 && selected.length === convertible.length;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function convert(ids: string[]) {
    if (ids.length === 0) return;
    setConverting(true);
    try {
      const r = await api.jobCards.convertBulk(ids, {
        salesman: settings.salesman,
        taxRate: settings.taxRate,
      });
      if (r.converted.length === 1 && r.skipped.length === 0) {
        toast(`Order ${r.converted[0].no} converted to bill B-${r.converted[0].billNo}`);
      } else if (r.converted.length > 0) {
        toast(
          `${r.converted.length} order${r.converted.length === 1 ? '' : 's'} converted to sales` +
            (r.skipped.length ? ` · ${r.skipped.length} skipped` : ''),
          r.skipped.length ? 'info' : 'success',
        );
      }
      // Say why anything was left behind rather than silently dropping it.
      if (r.converted.length === 0 && r.skipped.length > 0) {
        toast(r.skipped[0].reason, 'error');
      }
      await load(q, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Convert failed', 'error');
    } finally {
      setConverting(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">All Order</h1>
          <p className="page-sub">{total} records</p>
        </div>
        {canManage && (
          <Link href="/job-cards/new" className="btn-primary ml-auto">
            ＋ New Order
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
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
            { value: 'converted', label: 'Converted' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </Card>

      {canConvert && selected.length > 0 && (
        <Card className="mb-5 flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-bold text-brand-800">
            {selected.length} order{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button className="btn-soft !py-1.5 text-xs" onClick={() => setSelected([])} disabled={converting}>
              Clear
            </button>
            <button
              className="btn-success !py-1.5 text-xs"
              onClick={() => void convert(selected)}
              disabled={converting}
            >
              {converting ? 'Converting…' : `Convert ${selected.length} to Sales →`}
            </button>
          </div>
        </Card>
      )}

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
                  {canConvert && (
                    <th className="th w-10">
                      <input
                        type="checkbox"
                        checked={allPicked}
                        disabled={convertible.length === 0}
                        onChange={(e) => setSelected(e.target.checked ? convertible.map((j) => j._id) : [])}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        aria-label="Select all open orders"
                      />
                    </th>
                  )}
                  <th className="th">Invoice No</th>
                  <th className="th">Ref</th>
                  <th className="th">Customer</th>
                  <th className="th">Phone</th>
                  <th className="th">Date</th>
                  <th className="th">Delivery</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Advance</th>
                  <th className="th text-right">Balance</th>
                  <th className="th">Status</th>
                  {canConvert && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((j) => (
                  <tr key={j._id} className="transition hover:bg-brand-50/50">
                    {canConvert && (
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={selected.includes(j._id)}
                          disabled={j.status !== 'open'}
                          onChange={() => toggle(j._id)}
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                          aria-label={`Select order ${orderNo(j)}`}
                        />
                      </td>
                    )}
                    <td className="td">
                      <Link href={`/job-cards/${j._id}`} className="font-extrabold text-brand-700 hover:underline">
                        {orderNo(j)}
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
                    {canConvert && (
                      <td className="td text-right">
                        {j.status === 'open' && (
                          <button
                            className="btn-success !py-1 !px-2.5 text-[11px]"
                            onClick={() => void convert([j._id])}
                            disabled={converting}
                            title={`Convert order ${orderNo(j)} to a sales bill`}
                          >
                            Convert →
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isSuperAdmin && <ChangeLog />}
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
