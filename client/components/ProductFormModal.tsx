'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Product, ProductUsage } from '@/lib/types';
import { Field, Select, TextInput } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { CategorySelect } from '@/components/CategorySelect';
import { useToast } from '@/components/Toast';

type Form = {
  code: string;
  name: string;
  rate: string;
  wholesaleRate: string;
  category: string;
  usage: ProductUsage;
  unit: string;
  stockQty: string;
};

const emptyForm: Form = {
  code: '',
  name: '',
  rate: '',
  wholesaleRate: '',
  category: 'stitching',
  usage: 'both',
  unit: 'PCS',
  stockQty: '0',
};

const formFrom = (p: Product): Form => ({
  code: p.code,
  name: p.name,
  rate: String(p.rate),
  wholesaleRate: String(p.wholesaleRate),
  category: p.category,
  usage: p.usage ?? 'both',
  unit: p.unit,
  stockQty: String(p.stockQty),
});

/**
 * The one Add/Edit Product form.
 *
 * It lives here rather than on the Products screen so the ＋ beside a product
 * box on an order opens exactly the same fields — a product added mid-order is
 * a full catalogue entry, not a thinner version of one.
 */
export function ProductFormModal({
  open,
  onClose,
  onSaved,
  editing = null,
  seedName = '',
  defaultUsage = 'both',
}: {
  open: boolean;
  onClose: () => void;
  /** Handed the saved product, so a caller can select it straight away. */
  onSaved: (p: Product) => void;
  editing?: Product | null;
  /** Pre-fills the name, for when the user had already started typing one. */
  seedName?: string;
  /** What the opener needs it for, so the classification starts out right. */
  defaultUsage?: ProductUsage;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Reset on each opening rather than on every render, so typing is not lost.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFrom(editing) : { ...emptyForm, name: seedName, usage: defaultUsage });
  }, [open, editing, seedName, defaultUsage]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }) as Form);

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
        usage: form.usage,
        unit: form.unit,
        stockQty: Number(form.stockQty) || 0,
      };
      const saved = editing
        ? await api.products.update(editing._id, body)
        : await api.products.create(body);
      toast(editing ? 'Product updated' : 'Product created');
      onSaved(saved);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Product' : 'New Product'}
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <TextInput value={form.name} onChange={set('name')} placeholder="e.g. KUWAITI BIG" autoFocus />
        </Field>
        <Field label="Use As">
          <Select value={form.usage} onChange={set('usage')}>
            <option value="item">Item</option>
            <option value="material">Material</option>
            <option value="both">Item / Material</option>
          </Select>
        </Field>
        <Field label="Code *">
          <TextInput value={form.code} onChange={set('code')} placeholder="e.g. 5002" className="font-mono uppercase" />
        </Field>
        <Field label="Category">
          <CategorySelect
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
        </Field>
        <Field label="Rate (AED)">
          <TextInput type="number" value={form.rate} onChange={set('rate')} />
        </Field>
        <Field label="Wholesale Rate">
          <TextInput type="number" value={form.wholesaleRate} onChange={set('wholesaleRate')} />
        </Field>
        <Field label="Unit">
          <TextInput value={form.unit} onChange={set('unit')} placeholder="PCS" />
        </Field>
        <Field label="Stock Qty">
          <TextInput type="number" value={form.stockQty} onChange={set('stockQty')} />
        </Field>
      </div>
    </Modal>
  );
}
