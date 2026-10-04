'use client';

import { useState } from 'react';
import { Card, Field, NumberInput, SectionTitle, TextInput } from '@/components/ui';
import { useSettings } from '@/components/SettingsContext';
import { useToast } from '@/components/Toast';
import { num } from '@/lib/format';

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, save } = useSettings();
  const [form, setForm] = useState({ ...settings });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSave() {
    const cleaned = {
      taxRate: num(form.taxRate, 5),
      bookNo: Math.round(num(form.bookNo, 270)),
      salesman: String(form.salesman || 'GENERAL').toUpperCase(),
      deliveryDays: Math.round(num(form.deliveryDays, 7)),
    };
    save(cleaned);
    setForm(cleaned);
    toast('Settings saved');
  }

  return (
    <div className="max-w-2xl">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Defaults used across job cards and bills. Stored on this device.</p>

      <Card className="mt-6 p-6">
        <SectionTitle title="Business Defaults" sub="Applied to new job cards and sales bills" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="VAT / Tax Rate (%)">
            <NumberInput
              value={String(form.taxRate)}
              onChange={(e) => update('taxRate', Number(e.target.value))}
            />
          </Field>
          <Field label="Default Book No">
            <NumberInput
              value={String(form.bookNo)}
              onChange={(e) => update('bookNo', Number(e.target.value))}
            />
          </Field>
          <Field label="Default Salesman">
            <TextInput value={form.salesman} onChange={(e) => update('salesman', e.target.value)} />
          </Field>
          <Field label="Delivery Days (default)">
            <NumberInput
              value={String(form.deliveryDays)}
              onChange={(e) => update('deliveryDays', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="btn-primary" onClick={onSave}>
            Save Settings
          </button>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <SectionTitle title="API Connection" sub="Where the app reads and writes data" />
        <Field label="API Base URL">
          <TextInput
            value={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api (default)'}
            readOnly
            className="bg-ink-50 font-mono text-xs"
          />
        </Field>
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          To point the app at a different server, set <code className="rounded bg-ink-100 px-1 font-mono">NEXT_PUBLIC_API_URL</code> in{' '}
          <code className="rounded bg-ink-100 px-1 font-mono">client/.env.local</code> and restart the dev server.
        </p>
      </Card>
    </div>
  );
}
