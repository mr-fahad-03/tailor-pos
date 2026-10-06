'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import { formatAddress, type Ledger } from '@/lib/types';
import { Card, EmptyState, TextInput } from '@/components/ui';
import {
  LedgerFormModal,
  LEDGER_FORM_LABELS,
  type PartyType,
} from '@/components/LedgerFormModal';

export type { PartyType };
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

/** Which fields each kind of party actually needs on its form. */
export interface PartyConfig {
  type: PartyType;
  title: string;
  /** Singular, lower case — used inside sentences. */
  noun: string;
  sub: string;
  addressLabel: string;
}

/**
 * One screen per party type. Customers and suppliers are both ledgers
 * underneath, but each gets its own page, its own list and its own add/edit
 * form showing only the fields that kind of party needs.
 */
export function PartyPage({ config }: { config: PartyConfig }) {
  const { can } = useAuth();
  const canManage = can('ledgers.manage');
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Ledger[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ledger | null>(null);
  const labels = LEDGER_FORM_LABELS[config.type];

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const r = await api.ledgers.listByType(query, config.type, 1, 200);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : `Could not load ${config.title}`, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast, config.type, config.title],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(l: Ledger) {
    setEditing(l);
    setOpen(true);
  }

  async function remove(l: Ledger) {
    if (!window.confirm(`Delete ${config.noun} "${l.name}"? This cannot be undone.`)) return;
    try {
      await api.ledgers.remove(l._id);
      toast(`${l.name} deleted`);
      await load(q);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">{config.title}</h1>
          <p className="page-sub">
            {total} on file · {config.sub}
          </p>
        </div>
        {canManage && (
          <button className="btn-primary ml-auto" onClick={openNew}>
            ＋ New {config.noun}
          </button>
        )}
      </div>

      <Card className="mb-5 p-4">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone…"
          className="max-w-sm"
        />
      </Card>

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
              title={`No ${config.title.toLowerCase()} yet`}
              sub={
                canManage
                  ? `Press "New ${config.noun}" to add the first one.`
                  : 'Ask an admin to add one.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">ID</th>
                  <th className="th">{labels.nameLabel}</th>
                  <th className="th">Mobile</th>
                  <th className="th">Email</th>
                  <th className="th">{config.addressLabel}</th>
                  {labels.showTrn && <th className="th">TRN</th>}
                  {labels.showOpeningBalance && <th className="th text-right">Opening</th>}
                  {canManage && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((l) => (
                  <tr key={l._id} className="transition hover:bg-brand-50/50">
                    {/* Names, addresses and TRNs are free text and can run long.
                        `.td` is nowrap, which suits phones and figures but lets
                        one oversized value stretch the table until every other
                        column is pushed off the right-hand edge. The cap goes on
                        an inner block, since max-width on a cell is advisory in
                        auto table layout and browsers may ignore it. */}
                    <td className="td font-mono text-xs text-ink-500">{l.contactId || '—'}</td>
                    <td className="td whitespace-normal font-bold text-ink-900">
                      <div className="max-w-[22rem] break-words">{l.name}</div>
                      {l[labels.secondary.key] && (
                        <div className="max-w-[22rem] break-words text-[11px] font-medium text-ink-500">
                          {l[labels.secondary.key]}
                        </div>
                      )}
                    </td>
                    <td className="td font-mono text-xs">{l.phone || '—'}</td>
                    <td className="td whitespace-normal text-xs">
                      <div className="max-w-[14rem] break-words">{l.email || '—'}</div>
                    </td>
                    <td className="td whitespace-normal">
                      <div className="max-w-[18rem] break-words">{formatAddress(l) || '—'}</div>
                    </td>
                    {labels.showTrn && (
                      <td className="td whitespace-normal font-mono text-xs">
                        <div className="max-w-[12rem] break-words">{l.trn || '—'}</div>
                      </td>
                    )}
                    {labels.showOpeningBalance && (
                      <td className="td text-right font-semibold tabular-nums">
                        {fmt(l.openingBalance)}
                      </td>
                    )}
                    {canManage && (
                      <td className="td text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-soft !py-1 !px-2.5 text-[11px]"
                            onClick={() => openEdit(l)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-soft !py-1 !px-2.5 text-[11px] text-rose-600"
                            onClick={() => void remove(l)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LedgerFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => void load(q)}
        type={config.type}
        editing={editing}
        noun={config.noun}
        sub={config.sub}
      />
    </div>
  );
}
