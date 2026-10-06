'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import { USAGE_LABEL, type Product } from '@/lib/types';
import { Card, EmptyState, TextInput } from '@/components/ui';
import { ProductFormModal } from '@/components/ProductFormModal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

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
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setModalOpen(true);
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
                  <th className="th">Use As</th>
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
                    <td className="td">
                      <span className="badge bg-brand-50 text-brand-700">
                        {USAGE_LABEL[p.usage ?? 'both']}
                      </span>
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

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => void load(q)}
      />
    </div>
  );
}
