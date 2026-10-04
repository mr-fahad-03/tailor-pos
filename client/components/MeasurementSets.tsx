'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MEASURE_FIELDS, type MeasurementProfile, type MeasurementSet } from '@/lib/types';
import { Field, TextInput } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/Toast';

/** Client-side only: a stable key for React, and whether to file this person. */
export interface EditableSet extends MeasurementSet {
  uid: string;
  remember?: boolean;
}

let seq = 0;
export const newSet = (over: Partial<EditableSet> = {}): EditableSet => ({
  uid: `s${Date.now().toString(36)}${seq++}`,
  name: '',
  fabric: '',
  size: '',
  qty: 1,
  values: {},
  remember: true,
  ...over,
});

export function fromProfile(p: MeasurementProfile): EditableSet {
  return newSet({
    profileId: p._id,
    name: p.name,
    fabric: p.fabric ?? '',
    size: p.size ?? '',
    values: { ...p.values },
    remember: true,
  });
}

export function MeasurementSets({
  sets,
  onChange,
  ledgerId,
  readOnly,
}: {
  sets: EditableSet[];
  onChange: (next: EditableSet[]) => void;
  ledgerId?: string;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<MeasurementProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Load the people already on file for this customer.
  const loadProfiles = useCallback(async () => {
    if (!ledgerId) {
      setProfiles([]);
      return;
    }
    setLoadingProfiles(true);
    try {
      const res = await api.measurements.list(ledgerId);
      setProfiles(res.items);
    } catch {
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, [ledgerId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function patch(uid: string, change: Partial<EditableSet>) {
    onChange(sets.map((s) => (s.uid === uid ? { ...s, ...change } : s)));
  }

  function setValue(uid: string, field: string, v: string) {
    onChange(
      sets.map((s) => (s.uid === uid ? { ...s, values: { ...s.values, [field]: v } } : s)),
    );
  }

  function remove(uid: string) {
    onChange(sets.filter((s) => s.uid !== uid));
  }

  /**
   * A block counts as "this saved person" when it came from the profile OR
   * just carries the same name — otherwise someone typed in by hand would
   * show as unticked and ticking would add them twice.
   */
  function isOnOrder(p: MeasurementProfile) {
    const target = p.name.trim().toLowerCase();
    return sets.some(
      (s) => s.profileId === p._id || s.name.trim().toLowerCase() === target,
    );
  }

  /** Tick a saved person on or off for this order. */
  function toggleProfile(p: MeasurementProfile) {
    const target = p.name.trim().toLowerCase();
    if (isOnOrder(p)) {
      onChange(
        sets.filter(
          (s) => s.profileId !== p._id && s.name.trim().toLowerCase() !== target,
        ),
      );
    } else {
      onChange([
        ...sets.filter((s) => s.name.trim() || Object.keys(s.values).length),
        fromProfile(p),
      ]);
    }
  }

  async function forgetProfile(p: MeasurementProfile) {
    try {
      await api.measurements.remove(p._id);
      toast(`Removed ${p.name} from this customer`);
      const target = p.name.trim().toLowerCase();
      onChange(
        sets.filter((s) => s.profileId !== p._id && s.name.trim().toLowerCase() !== target),
      );
      void loadProfiles();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove', 'error');
    }
  }

  const totalPieces = sets.reduce((n, s) => n + (Number(s.qty) || 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink-900">Measurements</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {sets.length === 0
              ? 'Add each person this order is being stitched for.'
              : `${sets.length} ${sets.length === 1 ? 'person' : 'people'} · ${totalPieces} ${totalPieces === 1 ? 'piece' : 'pieces'}`}
          </p>
        </div>
        {!readOnly && (
          <button className="btn-soft !py-1.5 text-xs" onClick={() => onChange([...sets, newSet()])}>
            + Add person
          </button>
        )}
      </div>

      {/* people already on file for this customer */}
      {ledgerId && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            Saved for this customer
          </p>
          {loadingProfiles ? (
            <p className="text-xs text-ink-500">Loading…</p>
          ) : profiles.length === 0 ? (
            <p className="text-xs text-ink-500">
              Nobody saved yet. Anyone you add below is kept for next time.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const on = isOnOrder(p);
                return (
                  <span
                    key={p._id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition ${
                      on
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-ink-300 bg-white text-ink-600 hover:border-ink-400'
                    }`}
                  >
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={readOnly}
                        onChange={() => toggleProfile(p)}
                        className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                      {p.name}
                    </label>
                    {!readOnly && (
                      <button
                        onClick={() => forgetProfile(p)}
                        title={`Remove ${p.name} from this customer`}
                        aria-label={`Remove ${p.name}`}
                        className="text-ink-400 transition hover:text-rose-600"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            Tick only the people being stitched for this time. Next visit you can tick fewer.
          </p>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink-700">No measurements yet</p>
          <p className="mt-1 text-xs text-ink-500">
            Press <strong>Add person</strong>, or tick someone saved above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((s, idx) => {
            const isShut = collapsed[s.uid];
            const filled = Object.values(s.values).filter(Boolean).length;
            return (
              <div key={s.uid} className="rounded-lg border border-ink-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2.5">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [s.uid]: !isShut }))}
                    aria-label={isShut ? 'Expand' : 'Collapse'}
                    aria-expanded={!isShut}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-3.5 w-3.5 transition-transform ${isShut ? '-rotate-90' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink-100 font-mono text-[11px] font-bold text-ink-600">
                    {idx + 1}
                  </span>
                  <input
                    value={s.name}
                    onChange={(e) => patch(s.uid, { name: e.target.value })}
                    disabled={readOnly}
                    placeholder="Person's name"
                    aria-label="Person's name"
                    className="input input-sm min-w-0 flex-1 !border-transparent !bg-transparent font-semibold hover:!border-ink-300 focus:!border-brand-500 focus:!bg-white"
                  />
                  <span className="hidden text-[11px] font-medium text-ink-400 sm:inline">
                    {filled}/{MEASURE_FIELDS.length}
                  </span>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    Qty
                    <input
                      type="number"
                      min="0"
                      value={String(s.qty ?? 1)}
                      onChange={(e) => patch(s.uid, { qty: Number(e.target.value) })}
                      disabled={readOnly}
                      aria-label={`Quantity for ${s.name || 'this person'}`}
                      className="input input-sm w-14 text-center tabular-nums"
                    />
                  </label>
                  {!readOnly && (
                    <button
                      onClick={() => remove(s.uid)}
                      title="Remove this person from the order"
                      aria-label="Remove person"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {!isShut && (
                  <div className="p-3">
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Fabric">
                        <TextInput
                          value={s.fabric ?? ''}
                          onChange={(e) => patch(s.uid, { fabric: e.target.value })}
                          disabled={readOnly}
                          className="input-sm"
                        />
                      </Field>
                      <Field label="Size">
                        <TextInput
                          value={s.size ?? ''}
                          onChange={(e) => patch(s.uid, { size: e.target.value })}
                          disabled={readOnly}
                          className="input-sm"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                      {MEASURE_FIELDS.map((f) => (
                        <Field key={f} label={f}>
                          <TextInput
                            value={s.values[f] ?? ''}
                            onChange={(e) => setValue(s.uid, f, e.target.value)}
                            disabled={readOnly}
                            className="input-sm text-center font-semibold"
                          />
                        </Field>
                      ))}
                    </div>
                    {ledgerId && !readOnly && (
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-600">
                        <input
                          type="checkbox"
                          checked={s.remember !== false}
                          onChange={(e) => patch(s.uid, { remember: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        />
                        Keep {s.name.trim() || 'this person'} on file for next time
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
