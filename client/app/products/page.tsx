'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import type { Product } from '@/lib/types';
import { Card, EmptyState, Field, Select, TextInput } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

const emptyForm: {
  code: string;
  name: string;
  rate: string;
  wholesaleRate: string;
  category: 'stitching' | 'fabric' | 'material';
  unit: string;
  stockQty: string;
} = {
  code: '',
  name: '',
  rate: '',
  wholesaleRate: '',
  category: 'stitching',
  unit: 'PCS',
  stockQty: '0',
};

export default function ProductsPage() {
  const { can } = useAuth();
  const canManage = can('products.manage');
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const r = await api.products.list(query, 1, 100);
        setRows(r.items);
        setTotal(r.total);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load products', 'error');
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

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      rate: String(p.rate),
      wholesaleRate: String(p.wholesaleRate),
      category: p.category,
      unit: p.unit,
      stockQty: String(p.stockQty),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast('Code and name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        rate: Number(form.rate) || 0,
        wholesaleRate: Number(form.wholesaleRate) || 0,
        category: form.category,
        unit: form.unit,
        stockQty: Number(form.stockQty) || 0,
      };
      if (editing) {
        await api.products.update(editing._id, body);
        toast('Product updated');
      } else {
        await api.products.create(body);
        toast('Product created');
      }
      setModalOpen(false);
      void load(q);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete product "${p.code} — ${p.name}"?`)) return;
    try {
      await api.products.remove(p._id);
      toast('Product deleted');
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
          <h1 className="page-title">Products</h1>
          <p className="page-sub">{total} stitching items, fabrics & materials</p>
        </div>
        {canManage && (
          <button className="btn-primary ml-auto" onClick={openNew}>
            ＋ New Product
          </button>
        )}
      </div>

      <Card className="mb-5 p-4">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code or name…"
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
            <EmptyState title="No products found" sub="Add stitching items, fabrics and materials." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="th">Code</th>
                  <th className="th">Name</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Rate</th>
                  <th className="th text-right">Wholesale</th>
                  <th className="th text-right">Stock</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((p) => (
                  <tr key={p._id} className="hover:bg-ink-50/70">
                    <td className="td font-mono font-bold text-brand-700">{p.code}</td>
                    <td className="td font-semibold">{p.name}</td>
                    <td className="td">
                      <span className="badge bg-ink-100 capitalize text-ink-600">{p.category}</span>
                    </td>
                    <td className="td text-right font-bold tabular-nums">{fmt(p.rate)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{fmt(p.wholesaleRate)}</td>
                    <td className="td text-right">
                      <span className={`badge ${p.stockQty < 10 ? 'bg-brass-100 text-brass-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {p.stockQty} {p.unit}
                      </span>
                    </td>
                    <td className="td text-right">
                      {canManage ? (
                        <>
                          <button className="mr-3 text-xs font-bold text-brand-600 hover:underline" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                          <button className="text-xs font-bold text-rose-600 hover:underline" onClick={() => remove(p)}>
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
        title={editing ? 'Edit Product' : 'New Product'}
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
          <Field label="Code *">
            <TextInput value={form.code} onChange={set('code')} placeholder="e.g. 5002" autoFocus className="font-mono uppercase" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              <option value="stitching">Stitching</option>
              <option value="fabric">Fabric</option>
              <option value="material">Material</option>
            </Select>
          </Field>
          <Field label="Name *" className="col-span-2">
            <TextInput value={form.name} onChange={set('name')} placeholder="e.g. KUWAITI BIG" />
          </Field>
          <Field label="Rate (AED)">
            <TextInput type="number" value={form.rate} onChange={set('rate')} className="text-right" />
          </Field>
          <Field label="Wholesale Rate">
            <TextInput type="number" value={form.wholesaleRate} onChange={set('wholesaleRate')} className="text-right" />
          </Field>
          <Field label="Unit">
            <TextInput value={form.unit} onChange={set('unit')} placeholder="PCS" />
          </Field>
          <Field label="Stock Qty">
            <TextInput type="number" value={form.stockQty} onChange={set('stockQty')} className="text-right" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
