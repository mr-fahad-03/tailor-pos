'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Select, TextInput } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthContext';

/**
 * Pick a product category, or add one on the spot.
 *
 * Adding swaps the dropdown for a text box rather than opening a dialog: this
 * sits inside the product form, which is itself a dialog, and stacking one on
 * another to type a single word is more ceremony than the job deserves.
 */
export function CategorySelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const canManage = can('products.manage');

  const [options, setOptions] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = await api.products.categories();
        if (live) setOptions(r.items);
      } catch {
        // The box still works: whatever the product already has is offered.
        if (live) setOptions([]);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function create() {
    const name = draft.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    setSaving(true);
    try {
      const r = await api.products.addCategory(name);
      setOptions((o) => (o.includes(r.name) ? o : [...o, r.name].sort()));
      onChange(r.name);
      // Saying so matters: typing "Fabric" when "fabric" exists quietly
      // selects the one already in use rather than making a second.
      toast(r.existed ? `"${r.name}" already exists — selected it` : `Category "${r.name}" added`);
      setAdding(false);
      setDraft('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the category', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <TextInput
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create();
            }
            if (e.key === 'Escape') {
              setAdding(false);
              setDraft('');
            }
          }}
          placeholder="New category name"
          maxLength={60}
          disabled={saving}
        />
        <button
          className="btn-primary shrink-0 !px-3"
          onClick={() => void create()}
          disabled={saving}
          title="Add this category"
        >
          ✓
        </button>
        <button
          className="btn-soft shrink-0 !px-3"
          onClick={() => {
            setAdding(false);
            setDraft('');
          }}
          disabled={saving}
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  // Whatever the product already carries is always offered, even if it is no
  // longer in the list — otherwise opening the form would silently re-file it.
  const all = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div className="flex gap-1.5">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-w-0 flex-1"
      >
        {all.length === 0 && <option value={value}>{value || '—'}</option>}
        {all.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      {canManage && (
        <button
          className="btn-soft shrink-0 !px-3"
          onClick={() => setAdding(true)}
          disabled={disabled}
          title="Add a new category"
          aria-label="Add a new category"
        >
          ＋
        </button>
      )}
    </div>
  );
}
