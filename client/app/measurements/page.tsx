'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { MEASURE_FIELDS, type MeasurementProfile } from '@/lib/types';
import { Card, EmptyState, TextInput } from '@/components/ui';
import { useToast } from '@/components/Toast';

/**
 * Everyone measured so far, across every customer.
 *
 * Names repeat — two customers can each have an "Ali" — so every row leads
 * with the customer it belongs to, and names shared by more than one customer
 * are flagged so nobody picks the wrong record off this screen.
 */
export default function MeasurementsPage() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<MeasurementProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const r = await api.measurements.search(query, 1, 200);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not load measurements', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  /** Names held by more than one customer in the current list. */
  const shared = useMemo(() => {
    const byName = new Map<string, Set<string>>();
    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, new Set());
      byName.get(key)!.add(r.ledgerId);
    }
    return new Set([...byName.entries()].filter(([, v]) => v.size > 1).map(([k]) => k));
  }, [rows]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Measurements</h1>
          <p className="page-sub">{total} people on file</p>
        </div>
        <Link href="/job-cards/new" className="btn-primary ml-auto">
          ＋ New Order
        </Link>
      </div>

      <Card className="mb-5 p-4">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by person's name…"
          className="max-w-sm"
        />
      </Card>

      {shared.size > 0 && (
        <Card className="mb-5 border-brass-200 bg-brass-50 p-4">
          <p className="text-sm font-bold text-brass-800">
            {shared.size} name{shared.size === 1 ? ' is' : 's are'} used by more than one customer
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brass-800">
            That is expected — different customers really do have people with the same name.
            Each row below shows which customer it belongs to; go by that, not the name alone.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No measurements on file"
              sub="They are saved from an order — tick 'Keep this person on file' when you take them."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">Person</th>
                  <th className="th">Customer</th>
                  <th className="th">Phone</th>
                  <th className="th">Fabric</th>
                  <th className="th">Size</th>
                  <th className="th text-right">Filled</th>
                  <th className="th">Last used</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((p) => {
                  const filled = Object.values(p.values ?? {}).filter(Boolean).length;
                  const isShared = shared.has(p.name.trim().toLowerCase());
                  const isOpen = openId === p._id;
                  return (
                    <Fragment key={p._id}>
                      <tr className="transition hover:bg-brand-50/50">
                        <td className="td font-bold text-ink-900">
                          {p.name}
                          {isShared && (
                            <span className="badge ml-2 bg-brass-100 text-brass-800">
                              shared name
                            </span>
                          )}
                        </td>
                        <td className="td font-semibold">{p.ledgerName || '—'}</td>
                        <td className="td font-mono text-xs">{p.ledgerPhone || '—'}</td>
                        <td className="td">{p.fabric || '—'}</td>
                        <td className="td">{p.size || '—'}</td>
                        <td className="td text-right tabular-nums">
                          {filled}/{MEASURE_FIELDS.length}
                        </td>
                        <td className="td">{p.lastUsedAt ? fmtDate(p.lastUsedAt) : '—'}</td>
                        <td className="td text-right">
                          <button
                            className="btn-soft !py-1 !px-2.5 text-[11px]"
                            onClick={() => setOpenId(isOpen ? null : p._id)}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-ink-50/40">
                          <td className="td" colSpan={8}>
                            <div className="grid grid-cols-3 gap-2.5 py-1 sm:grid-cols-6 lg:grid-cols-8">
                              {MEASURE_FIELDS.map((f) => (
                                <div key={f} className="rounded-lg bg-white px-2.5 py-1.5 text-center">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
                                    {f}
                                  </p>
                                  <p className="text-sm font-bold tabular-nums text-ink-900">
                                    {p.values?.[f] || '—'}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {p.note && (
                              <p className="mt-2 text-xs text-ink-500">Note: {p.note}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
