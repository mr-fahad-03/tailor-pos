'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import type { Ledger } from '@/lib/types';
import { Card, EmptyState, Field, TextInput, NumberInput } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

export type PartyType = 'customer' | 'supplier';

/** Which fields each kind of party actually needs on its form. */
export interface PartyConfig {
  type: PartyType;
  title: string;
  /** Singular, lower case — used inside sentences. */
  noun: string;
  sub: string;
  /** A TRN and an opening balance only matter for people you trade with. */
  showTrn: boolean;
  showOpeningBalance: boolean;
  nameLabel: string;
  addressLabel: string;
}

const blank = { name: '', phone: '', address: '', trn: '', openingBalance: '0' };

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
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setForm(blank);
    setError('');
    setOpen(true);
  }

  function openEdit(l: Ledger) {
    setEditing(l);
    setForm({
      name: l.name,
      phone: l.phone ?? '',
      address: l.address ?? '',
      trn: l.trn ?? '',
      openingBalance: String(l.openingBalance ?? 0),
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError(`${config.nameLabel} is required`);
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      ...(config.showTrn ? { trn: form.trn.trim() } : {}),
      ...(config.showOpeningBalance ? { openingBalance: Number(form.openingBalance) || 0 } : {}),
      type: config.type,
    };
    try {
      if (editing) {
        await api.ledgers.update(editing._id, body);
        toast(`${form.name.trim()} updated`);
      } else {
        await api.ledgers.create(body);
        toast(`${config.noun} "${form.name.trim()}" added`);
      }
      setOpen(false);
      await load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
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
                  <th className="th">{config.nameLabel}</th>
                  <th className="th">Phone</th>
                  <th className="th">{config.addressLabel}</th>
                  {config.showTrn && <th className="th">TRN</th>}
                  {config.showOpeningBalance && <th className="th text-right">Opening</th>}
                  {canManage && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((l) => (
                  <tr key={l._id} className="transition hover:bg-brand-50/50">
                    <td className="td font-bold text-ink-900">{l.name}</td>
                    <td className="td font-mono text-xs">{l.phone || '—'}</td>
                    <td className="td">{l.address || '—'}</td>
                    {config.showTrn && <td className="td font-mono text-xs">{l.trn || '—'}</td>}
                    {config.showOpeningBalance && (
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${config.noun}` : `New ${config.noun}`}
        sub={config.sub}
        footer={
          <>
            <button className="btn-soft" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : `Add ${config.noun}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={config.nameLabel}>
            <TextInput
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={`${config.nameLabel}…`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <TextInput
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05xxxxxxxx"
                className="font-mono"
              />
            </Field>
            {config.showTrn && (
              <Field label="TRN">
                <TextInput
                  value={form.trn}
                  onChange={(e) => setForm({ ...form, trn: e.target.value })}
                  placeholder="Tax registration number"
                  className="font-mono"
                />
              </Field>
            )}
          </div>
          <Field label={config.addressLabel}>
            <TextInput
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          {config.showOpeningBalance && (
            <Field label="Opening Balance (AED)" className="max-w-[12rem]">
              <NumberInput
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              />
            </Field>
          )}
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
