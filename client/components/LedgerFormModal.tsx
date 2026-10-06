'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toISODate } from '@/lib/format';
import type { Ledger } from '@/lib/types';
import {
  Checkbox,
  DateInput,
  Field,
  NumberInput,
  Select,
  TextInput,
} from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

export type PartyType = 'customer' | 'supplier' | 'general';

/** Mirrors the server's cap, so the form stops you before the request does. */
export const NAME_MAX = 120;

/** How the two name boxes read, and which fields apply, per kind of party. */
export interface LedgerFormLabels {
  /**
   * The top-left box, which is the party's identity and has to be unique.
   * A customer is a person, so it is their name; a supplier is a firm, so it
   * is the company's.
   */
  nameLabel: string;
  /**
   * The box under it, naming the other side of the same relationship: a
   * customer's company, or the salesman dealt with at a supplier. Separate
   * fields, because they are separate kinds of thing.
   */
  secondary: { key: 'businessName' | 'contactPerson'; label: string };
  /** Only a customer can ask to be billed under their company's name. */
  showInvoiceOnCompany: boolean;
  showTrn: boolean;
  showOpeningBalance: boolean;
}

/**
 * The single definition of how each kind of party's form reads.
 *
 * It lives here rather than on the Customers and Suppliers screens because
 * the ＋ beside the customer box on an order opens the same form, and a second
 * copy of these labels would drift away from this one.
 */
export const LEDGER_FORM_LABELS: Record<PartyType, LedgerFormLabels> = {
  customer: {
    nameLabel: 'Customer Name',
    secondary: { key: 'businessName', label: 'Business Name' },
    showInvoiceOnCompany: true,
    showTrn: true,
    showOpeningBalance: true,
  },
  supplier: {
    nameLabel: 'Company Name',
    secondary: { key: 'contactPerson', label: 'Salesman Name' },
    showInvoiceOnCompany: false,
    showTrn: true,
    showOpeningBalance: true,
  },
  general: {
    nameLabel: 'Ledger Name',
    secondary: { key: 'businessName', label: 'Business Name' },
    showInvoiceOnCompany: false,
    showTrn: false,
    showOpeningBalance: true,
  },
};

/** Every box on the form, as text — the server does the converting. */
export const blankLedgerForm = {
  name: '',
  phone: '',
  contactId: '',
  customerGroup: '',
  businessName: '',
  contactPerson: '',
  email: '',
  invoiceOnCompanyName: false,
  dob: '',
  altPhone: '',
  landline: '',
  assignedTo: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  zip: '',
  trn: '',
  openingBalance: '0',
  payTerm: '',
  payTermUnit: 'days' as 'days' | 'months',
  creditLimit: '',
};

type Form = typeof blankLedgerForm;

function formFrom(l: Ledger): Form {
  return {
    ...blankLedgerForm,
    name: l.name,
    phone: l.phone ?? '',
    contactId: l.contactId ?? '',
    customerGroup: l.customerGroup ?? '',
    businessName: l.businessName ?? '',
    contactPerson: l.contactPerson ?? '',
    email: l.email ?? '',
    invoiceOnCompanyName: !!l.invoiceOnCompanyName,
    dob: toISODate(l.dob),
    altPhone: l.altPhone ?? '',
    landline: l.landline ?? '',
    assignedTo: l.assignedTo ?? '',
    // A record written before the address was split still has everything in
    // the old single box, so it opens on line 1 rather than vanishing.
    addressLine1: l.addressLine1 ?? l.address ?? '',
    addressLine2: l.addressLine2 ?? '',
    city: l.city ?? '',
    state: l.state ?? '',
    country: l.country ?? '',
    zip: l.zip ?? '',
    trn: l.trn ?? '',
    openingBalance: String(l.openingBalance ?? 0),
    payTerm: l.payTerm == null ? '' : String(l.payTerm),
    payTermUnit: l.payTermUnit === 'months' ? 'months' : 'days',
    creditLimit: l.creditLimit == null ? '' : String(l.creditLimit),
  };
}

/**
 * The one Add/Edit form for a customer or supplier.
 *
 * It lives here rather than on the Customers screen so the ＋ beside the
 * customer box on an order opens exactly the same fields — someone added
 * mid-order is a full record, not a thinner version of one.
 */
export function LedgerFormModal({
  open,
  onClose,
  onSaved,
  type,
  editing = null,
  seedName = '',
  noun,
  sub,
  footerExtra,
}: {
  open: boolean;
  onClose: () => void;
  /** Handed the saved party, so a caller can select it straight away. */
  onSaved: (l: Ledger) => void;
  type: PartyType;
  editing?: Ledger | null;
  /** Pre-fills the name, for when the user had already started typing one. */
  seedName?: string;
  /** Singular, lower case — used inside sentences. */
  noun?: string;
  sub?: string;
  /** An extra button in the footer, e.g. "Back to search". */
  footerExtra?: React.ReactNode;
}) {
  const { toast } = useToast();
  const labels = LEDGER_FORM_LABELS[type];
  const word = noun ?? (type === 'supplier' ? 'supplier' : 'customer');

  const [form, setForm] = useState<Form>(blankLedgerForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset on each opening rather than on every render, so typing is not lost.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFrom(editing) : { ...blankLedgerForm, name: seedName });
    setError('');
  }, [open, editing, seedName]);

  async function save() {
    if (!form.name.trim()) {
      setError(`${labels.nameLabel} is required`);
      return;
    }
    if (form.name.trim().length > NAME_MAX) {
      setError(`${labels.nameLabel} cannot be longer than ${NAME_MAX} characters`);
      return;
    }
    if (!form.phone.trim()) {
      setError('Mobile is required');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('That email address does not look right');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      contactId: form.contactId.trim(),
      customerGroup: form.customerGroup.trim(),
      businessName: form.businessName.trim(),
      contactPerson: form.contactPerson.trim(),
      email: form.email.trim(),
      invoiceOnCompanyName: form.invoiceOnCompanyName,
      dob: form.dob || null,
      altPhone: form.altPhone.trim(),
      landline: form.landline.trim(),
      assignedTo: form.assignedTo.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      zip: form.zip.trim(),
      payTerm: form.payTerm.trim() === '' ? null : Number(form.payTerm) || 0,
      payTermUnit: form.payTermUnit,
      // Blank means no limit at all, which is why it is sent as null rather
      // than coerced to the 0 that would stop every sale.
      creditLimit: form.creditLimit.trim() === '' ? null : Number(form.creditLimit) || 0,
      ...(labels.showTrn ? { trn: form.trn.trim() } : {}),
      ...(labels.showOpeningBalance
        ? { openingBalance: Number(form.openingBalance) || 0 }
        : {}),
      type,
    };
    try {
      const saved = editing
        ? await api.ledgers.update(editing._id, body)
        : await api.ledgers.create(body);
      toast(editing ? `${saved.name} updated` : `${word} "${saved.name}" added`);
      onSaved(saved);
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
      title={editing ? `Edit ${word}` : `Add a new ${word}`}
      sub={sub}
      wide
      footer={
        <>
          {footerExtra}
          <button className="btn-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : `Add ${word}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Who they are. Mobile is the only box beside the name that has to
            be filled: it is how the shop reaches someone about an order. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={`${labels.nameLabel} *`}>
            <TextInput
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={`${labels.nameLabel}…`}
              maxLength={NAME_MAX}
            />
            <p className="mt-1 text-[11px] text-ink-400">
              {labels.showInvoiceOnCompany
                ? 'Invoiced under this name unless the box below says otherwise'
                : 'Invoiced and listed under this name'}
            </p>
          </Field>
          <Field label="Mobile *">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05xxxxxxxx"
              className="font-mono"
            />
          </Field>
          <Field label="Contact ID">
            <TextInput
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              placeholder="Auto"
              className="font-mono"
            />
            <p className="mt-1 text-[11px] text-ink-400">Leave empty to autogenerate</p>
          </Field>
          <Field label={`${type === 'supplier' ? 'Supplier' : 'Customer'} Group`}>
            <TextInput
              value={form.customerGroup}
              onChange={(e) => setForm({ ...form, customerGroup: e.target.value })}
              placeholder="None"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={labels.secondary.label}>
            <TextInput
              value={form[labels.secondary.key]}
              onChange={(e) => setForm({ ...form, [labels.secondary.key]: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
            />
          </Field>
          {labels.showInvoiceOnCompany && (
            <div className="flex items-end pb-2 lg:col-span-2">
              <Checkbox
                label="Invoice on Company Name"
                checked={form.invoiceOnCompanyName}
                onChange={(v) => setForm({ ...form, invoiceOnCompanyName: v })}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date of Birth">
            <DateInput
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </Field>
          <Field label="Alternate Contact Number">
            <TextInput
              value={form.altPhone}
              onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Landline">
            <TextInput
              value={form.landline}
              onChange={(e) => setForm({ ...form, landline: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Assigned To">
            <TextInput
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            />
          </Field>
        </div>

        {/* Where they are. Split into parts rather than one box because an
            invoice has to print them on separate lines. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address Line 1">
            <TextInput
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            />
          </Field>
          <Field label="Address Line 2">
            <TextInput
              value={form.addressLine2}
              onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="City">
            <TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="State">
            <TextInput value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="Country">
            <TextInput value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Zip Code">
            <TextInput value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </Field>
        </div>

        {/* What they are owed and trusted for. */}
        <div className="grid grid-cols-1 gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {labels.showTrn && (
            <Field label="Tax Number">
              <TextInput
                value={form.trn}
                onChange={(e) => setForm({ ...form, trn: e.target.value })}
                placeholder="Tax registration number"
                className="font-mono"
              />
            </Field>
          )}
          {labels.showOpeningBalance && (
            <Field label="Opening Balance (AED)">
              <NumberInput
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              />
            </Field>
          )}
          <Field label="Pay Term">
            <div className="flex gap-2">
              <NumberInput
                value={form.payTerm}
                onChange={(e) => setForm({ ...form, payTerm: e.target.value })}
                placeholder="0"
              />
              <Select
                value={form.payTermUnit}
                onChange={(e) =>
                  setForm({ ...form, payTermUnit: e.target.value as 'days' | 'months' })
                }
                className="shrink-0 !w-28"
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
              </Select>
            </div>
          </Field>
          <Field label="Credit Limit (AED)">
            <NumberInput
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              placeholder="No limit"
            />
            <p className="mt-1 text-[11px] text-ink-400">Keep blank for no limit</p>
          </Field>
        </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      </div>
    </Modal>
  );
}
