'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Ledger } from '@/lib/types';
import { Card, EmptyState, Field, Select, TextInput } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

const emptyForm: {
  name: string;
  phone: string;
  address: string;
  trn: string;
  openingBalance: string;
  type: 'customer' | 'supplier' | 'general';
} = { name: '', phone: '', address: '', trn: '', openingBalance: '0', type: 'customer' };

export default function LedgersPage() {
  const { can } = useAuth();
  const canManage = can('ledgers.manage');
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Ledger[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ledger | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const r = await api.ledgers.list(query, 1, 100);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load ledgers', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  function openNew(type: 'customer' | 'supplier' = 'customer') {
    setEditing(null);
    setForm({ ...emptyForm, type });
    setModalOpen(true);
  }

  function openEdit(l: Ledger) {
    setEditing(l);
    setForm({
      name: l.name,
      phone: l.phone ?? '',
      address: l.address ?? '',
      trn: l.trn ?? '',
      openingBalance: String(l.openingBalance ?? 0),
      type: l.type,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.ledgers.update(editing._id, { ...form, openingBalance: Number(form.openingBalance) || 0 });
        toast('Ledger updated');
      } else {
        await api.ledgers.create({ ...form, openingBalance: Number(form.openingBalance) || 0 });
        toast('Ledger created');
      }
      setModalOpen(false);
      void load(q);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: Ledger) {
    if (!confirm(`Delete ledger "${l.name}"?`)) return;
    try {
      await api.ledgers.remove(l._id);
      toast('Ledger deleted');
      void load(q);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title">Ledgers</h1>
          <p className="page-sub">{total} customers, suppliers & accounts</p>
        </div>
        {canManage && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-soft" onClick={() => openNew('supplier')}>
              ＋ New Supplier
            </button>
            <button className="btn-primary" onClick={() => openNew('customer')}>
              ＋ New Customer
            </button>
          </div>
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
            <EmptyState title="No ledgers found" sub="Add your first customer or supplier." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Type</th>
                  <th className="th">TRN</th>
                  <th className="th text-right">Opening Bal.</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((l) => (
                  <tr key={l._id} className="hover:bg-ink-50/70">
                    <td className="td font-bold">{l.name}</td>
                    <td className="td font-mono text-xs">{l.phone || '—'}</td>
                    <td className="td">
                      <span className="badge bg-ink-100 text-ink-600">{l.type}</span>
                    </td>
                    <td className="td font-mono text-xs">{l.trn || '—'}</td>
                    <td className="td text-right tabular-nums">{Number(l.openingBalance || 0).toFixed(2)}</td>
                    <td className="td text-right">
                      {canManage ? (
                        <>
                          <button className="mr-3 text-xs font-bold text-brand-600 hover:underline" onClick={() => openEdit(l)}>
                            Edit
                          </button>
                          <button className="text-xs font-bold text-rose-600 hover:underline" onClick={() => remove(l)}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-ink-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing
            ? 'Edit Ledger'
            : form.type === 'supplier'
              ? 'New Supplier'
              : form.type === 'general'
                ? 'New Ledger'
                : 'New Customer'
        }
        footer={
          <>
            <button className="btn-soft" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name *" className="col-span-2">
            <TextInput value={form.name} onChange={set('name')} placeholder="e.g. ALI AWOD" autoFocus />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={set('phone')} placeholder="05xxxxxxxx" className="font-mono" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={set('type')}>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="general">General</option>
            </Select>
          </Field>
          <Field label="Address" className="col-span-2">
            <TextInput value={form.address} onChange={set('address')} placeholder="Address" />
          </Field>
          <Field label="TRN">
            <TextInput value={form.trn} onChange={set('trn')} className="font-mono" />
          </Field>
          <Field label="Opening Balance">
            <TextInput type="number" value={form.openingBalance} onChange={set('openingBalance')} className="text-right" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
