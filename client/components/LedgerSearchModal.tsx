'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Ledger } from '@/lib/types';
import { Modal } from './Modal';
import { Field, Select, TextInput } from './ui';
import { useToast } from './Toast';
import { useAuth } from './AuthContext';

type LedgerType = 'customer' | 'supplier' | 'wholesaler' | 'general';

export function LedgerSearchModal({
  open,
  onClose,
  onSelect,
  startIn = 'search',
  seedName = '',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ledger: Ledger) => void;
  /** 'newCustomer' skips the search and opens straight on the create form. */
  startIn?: 'search' | 'newCustomer';
  /** Pre-fills the name when opening on the create form. */
  seedName?: string;
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const canManage = can('ledgers.manage');

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Ledger[]>([]);
  const [picked, setPicked] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);

  // The counter often meets a customer who is not on file yet, so a new one
  // can be created here without abandoning the order.
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ name: string; phone: string; type: LedgerType }>({
    name: '',
    phone: '',
    type: 'customer',
  });

  useEffect(() => {
    if (!open) return;
    setQ('');
    setPicked(null);
    setError('');
    if (startIn === 'newCustomer') {
      setForm({ name: seedName.trim(), phone: '', type: 'customer' });
      setCreating(true);
      return;
    }
    setCreating(false);
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load(query: string) {
    setLoading(true);
    try {
      const r = await api.ledgers.list(query, 1, 100);
      setRows(r.items);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load ledgers', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || creating) return;
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, creating]);

  function startCreate(type: LedgerType) {
    // Carry whatever was typed in the search box into the name.
    setForm({ name: q.trim(), phone: '', type });
    setError('');
    setCreating(true);
  }

  async function saveNew() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.ledgers.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        type: form.type,
      });
      toast(`${form.type === 'supplier' ? 'Supplier' : 'Customer'} "${created.name}" added`);
      // Straight onto the order — that is why they opened this.
      onSelect(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={creating ? `New ${form.type === 'supplier' ? 'supplier' : 'customer'}` : 'Find Ledger'}
      sub={
        creating
          ? 'Saved to your ledgers and added to this order'
          : 'Search by name or phone, then press OK'
      }
      wide={!creating}
      footer={
        creating ? (
          <>
            <button className="btn-soft" onClick={() => setCreating(false)} disabled={saving}>
              Back to search
            </button>
            <button className="btn-primary" onClick={saveNew} disabled={saving}>
              {saving ? 'Saving…' : 'Save & use'}
            </button>
          </>
        ) : (
          <>
            <button className="btn-soft" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-success"
              disabled={!picked}
              onClick={() => {
                if (picked) {
                  onSelect(picked);
                  onClose();
                }
              }}
            >
              OK
            </button>
          </>
        )
      }
    >
      {creating ? (
        <div className="space-y-4">
          <Field label="Name">
            <TextInput
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer or company name"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <TextInput
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05xxxxxxxx"
              />
            </Field>
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as LedgerType })}
              >
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="general">General</option>
              </Select>
            </Field>
          </div>
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-ink-500">
            Full details (address, TRN, opening balance) can be filled in later from the
            Ledgers screen.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TextInput
              autoFocus
              placeholder="Type name or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1"
            />
            {canManage && (
              <>
                <button className="btn-soft shrink-0" onClick={() => startCreate('customer')}>
                  ＋ New customer
                </button>
                <button className="btn-soft shrink-0" onClick={() => startCreate('supplier')}>
                  ＋ New supplier
                </button>
              </>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-ink-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="th">Phone</th>
                    <th className="th">Ledger Name</th>
                    <th className="th">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loading && (
                    <tr>
                      <td colSpan={3} className="td text-center text-ink-400">
                        Searching…
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows.map((l) => (
                      <tr
                        key={l._id}
                        onClick={() => setPicked(l)}
                        onDoubleClick={() => {
                          onSelect(l);
                          onClose();
                        }}
                        className={`cursor-pointer transition ${
                          picked?._id === l._id ? 'bg-brand-50' : 'hover:bg-ink-50'
                        }`}
                      >
                        <td className="td font-mono text-[13px]">{l.phone || '—'}</td>
                        <td className="td font-semibold">{l.name}</td>
                        <td className="td">
                          <span className="badge bg-ink-100 text-ink-600">{l.type}</span>
                        </td>
                      </tr>
                    ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="td text-center">
                        <p className="text-ink-500">
                          No ledger matches {q.trim() ? `“${q.trim()}”` : 'that search'}.
                        </p>
                        {canManage && (
                          <button
                            className="btn-primary mt-3 !py-1.5 text-xs"
                            onClick={() => startCreate('customer')}
                          >
                            ＋ Add {q.trim() ? `“${q.trim()}”` : 'a new customer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
