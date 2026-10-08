'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MEASURE_FIELDS, STITCHING_STYLES, type MaterialLine, type MeasurementProfile, type MeasurementSet, type Product } from '@/lib/types';
import { blurOnWheel, Field, NumberInput, selectOnFocus, TextInput } from '@/components/ui';
import { ProductSearchInput } from '@/components/ProductSearchInput';
import { PersonSearchInput } from '@/components/PersonSearchInput';
import { StitchingStyleSelect } from '@/components/StitchingStyleSelect';
import { CustomerSizeSearchSelect } from '@/components/CustomerSizeSearchSelect';
import { fmt, num } from '@/lib/format';
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
  // Fabric, size and qty are no longer asked for on the person row. They stay
  // on the record so an older order re-saved here keeps what it was saved
  // with — the line quantities live in Order Items.
  qty: 1,
  age: null,
  values: {},
  materials: [blankMaterial()],
  remember: true,
  ...over,
});

/** One empty row, so a person's materials are always typeable straight away. */
export const blankMaterial = (): MaterialLine => ({
  code: '',
  productName: '',
  qty: 1,
  rate: 0,
});

/** What this person's materials come to. */
export const materialsTotal = (m?: MaterialLine[]): number =>
  (m ?? []).reduce((sum, r) => sum + num(r.qty) * num(r.rate), 0);

export function fromProfile(p: MeasurementProfile): EditableSet {
  return newSet({
    profileId: p._id,
    name: p.name,
    stitchingStyle: p.stitchingStyle ?? '',
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
  revealToken = null,
  activeUid = '',
}: {
  sets: EditableSet[];
  onChange: (next: EditableSet[]) => void;
  ledgerId?: string;
  readOnly?: boolean;
  /**
   * Ask for one person's block to be opened and scrolled to. The timestamp is
   * what makes a second request for the same person count — without it,
   * clicking the same order line twice would be the same value and do nothing.
   */
  revealToken?: { uid: string; at: number } | null;
  /** Currently active item's person UID to show ONLY this set's measurements. */
  activeUid?: string;
}) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<MeasurementProfile[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Briefly ringed after being jumped to, so the eye finds it on arrival. */
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (!revealToken) return;
    const { uid } = revealToken;
    setCollapsed((c) => ({ ...c, [uid]: false }));
    setFlash(uid);
    const scroll = setTimeout(() => {
      const container = document.getElementById(`person-${uid}`);
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const nameInput = document.getElementById(`person-name-input-${uid}`) as HTMLInputElement | null;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 60);
    const off = setTimeout(() => setFlash(''), 3000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(off);
    };
  }, [revealToken]);

  // Load the people already on file for this customer.
  const loadProfiles = useCallback(async () => {
    if (!ledgerId) {
      setProfiles([]);
      return;
    }
    try {
      const res = await api.measurements.list(ledgerId);
      setProfiles(res.items);
    } catch {
      setProfiles([]);
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

  /* ---- this person's materials ---------------------------------------- */

  function patchMaterial(uid: string, i: number, change: Partial<MaterialLine>) {
    onChange(
      sets.map((s) => {
        if (s.uid !== uid) return s;
        const current = s.materials && s.materials.length > 0 ? s.materials : [blankMaterial()];
        const updated = current.map((m, idx) => (idx === i ? { ...m, ...change } : m));
        return { ...s, materials: updated };
      }),
    );
  }

  function addMaterial(uid: string) {
    onChange(
      sets.map((s) => {
        if (s.uid !== uid) return s;
        const current = s.materials && s.materials.length > 0 ? s.materials : [blankMaterial()];
        return { ...s, materials: [...current, blankMaterial()] };
      }),
    );
  }

  function removeMaterial(uid: string, i: number) {
    onChange(
      sets.map((s) => {
        if (s.uid !== uid) return s;
        const remaining = (s.materials ?? []).filter((_, idx) => idx !== i);
        return { ...s, materials: remaining.length > 0 ? remaining : [blankMaterial()] };
      }),
    );
  }

  /**
   * Copy a saved person onto this block. The profile is only linked back when
   * it belongs to the customer on this order — otherwise the measurements are
   * copied but left unlinked, so saving cannot overwrite someone else's record.
   */
  function applyProfile(uid: string, p: MeasurementProfile) {
    const sameCustomer = Boolean(ledgerId) && p.ledgerId === ledgerId;
    patch(uid, {
      profileId: sameCustomer ? p._id : undefined,
      name: p.name,
      stitchingStyle: p.stitchingStyle ?? '',
      fabric: p.fabric ?? '',
      size: p.size ?? '',
      values: { ...p.values },
      remember: sameCustomer,
    });
    if (!sameCustomer) {
      toast(`Copied ${p.name}'s measurements from ${p.ledgerName || 'another customer'}`, 'info');
    }
  }

  /** Picking a product fills the code, name and rate in one go. */
  function pickMaterial(uid: string, i: number, p: Product) {
    patchMaterial(uid, i, { code: p.code, productName: p.name, rate: p.rate });
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

  function handleSelectCustomerSize(p: MeasurementProfile) {
    const activeTarget = activeUid || revealToken?.uid || sets[0]?.uid;
    if (activeTarget) {
      applyProfile(activeTarget, p);
    } else {
      onChange([fromProfile(p)]);
    }
  }

  function handleStitchingStyleChange(uid: string, newStyle: string) {
    const setItem = sets.find((s) => s.uid === uid);
    if (setItem && setItem.name.trim() && newStyle) {
      const match = profiles.find(
        (p) =>
          p.name.trim().toLowerCase() === setItem.name.trim().toLowerCase() &&
          p.stitchingStyle?.trim().toLowerCase() === newStyle.trim().toLowerCase(),
      );
      if (match) {
        applyProfile(uid, match);
        toast(`Loaded ${match.name}'s saved measurements for ${newStyle}`, 'info');
        return;
      }
    }
    patch(uid, { stitchingStyle: newStyle });
  }

  const activeTarget = activeUid || revealToken?.uid || sets[0]?.uid || '';
  const activeSet = sets.find((s) => s.uid === activeTarget);
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
        {/* Who this customer has on file sits beside Add person in a searchable dropdown. */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!readOnly && (
            <CustomerSizeSearchSelect
              value={
                activeSet?.name
                  ? activeSet.stitchingStyle
                    ? `${activeSet.name} (${activeSet.stitchingStyle})`
                    : activeSet.name
                  : ''
              }
              ledgerId={ledgerId}
              onSelectProfile={(p) => handleSelectCustomerSize(p)}
              onAddNew={(name) => {
                if (activeTarget) {
                  patch(activeTarget, { name });
                } else {
                  onChange([...sets, newSet({ name })]);
                }
              }}
              disabled={readOnly}
              placeholder="Select Customer Size..."
            />
          )}
          {!readOnly && (
            <button className="btn-soft shrink-0 !py-1.5 text-xs" onClick={() => onChange([...sets, newSet()])}>
              + Add person
            </button>
          )}
        </div>
      </div>

      {(() => {
        const activeTarget = activeUid || revealToken?.uid || sets[0]?.uid || '';
        const matchedSets = sets.filter((s) => s.uid === activeTarget);
        const displaySets = matchedSets.length > 0 ? matchedSets : sets.slice(0, 1);

        if (sets.length === 0) {
          return (
            <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink-700">No measurements yet</p>
              <p className="mt-1 text-xs text-ink-500">
                Press <strong>Add person</strong>, or tick someone saved beside it.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            {displaySets.map((s) => {
              const idx = sets.findIndex((item) => item.uid === s.uid);
              const isShut = collapsed[s.uid];
              const filled = Object.values(s.values).filter(Boolean).length;
              const isHighlighted = Boolean(activeUid && s.uid && activeUid === s.uid) || flash === s.uid;
              return (
                <div
                  key={s.uid}
                  id={`person-${s.uid}`}
                  className={`rounded-lg border bg-white transition-all duration-200 ${
                    isHighlighted
                      ? 'border-emerald-500 ring-2 ring-emerald-400/80 bg-emerald-50/20 shadow-md'
                      : 'border-ink-200'
                  }`}
                >
                  <div className={`flex flex-wrap items-center gap-2 border-b px-3 py-2.5 transition-colors ${
                    isHighlighted
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-ink-100'
                  }`}>
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
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold transition-colors ${
                      isHighlighted
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-ink-100 text-ink-600'
                    }`}>
                      {idx + 1}
                    </span>
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <div className="w-1/2 min-w-[140px]">
                      <PersonSearchInput
                        id={`person-name-input-${s.uid}`}
                        value={s.name}
                        onChange={(v) => patch(s.uid, { name: v })}
                        onPick={(p) => applyProfile(s.uid, p)}
                        ledgerId={ledgerId}
                        disabled={readOnly}
                        placeholder="Person's name — type to find saved measurements"
                        className="input input-sm w-full font-semibold text-xs text-ink-800 bg-white border border-ink-300 hover:border-brand-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg shadow-sm"
                      />
                    </div>
                    <div className="w-1/2 min-w-[150px]">
                      <StitchingStyleSelect
                        value={s.stitchingStyle ?? ''}
                        onChange={(val) => handleStitchingStyleChange(s.uid, val)}
                        disabled={readOnly}
                        placeholder="Select Stitching Style..."
                      />
                    </div>
                  </div>
                  <span className="hidden text-[11px] font-medium text-ink-400 sm:inline">
                    {filled}/{MEASURE_FIELDS.length}
                  </span>
                  {/* Blank unless someone is asked: a child's thobe is cut
                      differently, and 0 would read as an answer. */}
                  <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink-500">
                    Age
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={s.age ?? ''}
                      onChange={(e) =>
                        patch(s.uid, { age: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      disabled={readOnly}
                      onFocus={selectOnFocus}
                      onWheel={blurOnWheel}
                      aria-label={`Age of ${s.name || 'this person'}`}
                      className="input input-sm w-20 text-left tabular-nums"
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
                    {/* Fabric and size are no longer asked for here. The
                        fields stay on the record so older orders keep what
                        they were saved with. */}
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
                    {/* materials for this person, costed here rather than at the end */}
                    <div className="mt-4 border-t border-ink-100 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          Materials Used
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold text-ink-500">
                            Total{' '}
                            <span className="tabular-nums text-ink-800">
                              {fmt(materialsTotal(s.materials))}
                            </span>
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => addMaterial(s.uid)}
                              className="btn-soft !px-2 !py-1 text-[11px]"
                            >
                              ＋ Add row
                            </button>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const materialsList = (s.materials && s.materials.length > 0) ? s.materials : [blankMaterial()];
                        return (
                          <div className="overflow-x-auto rounded-lg border border-ink-200">
                            <table className="w-full min-w-[480px]">
                              <thead className="bg-ink-50">
                                <tr>
                                  <th className="th w-8">Sl</th>
                                  <th className="th">Product</th>
                                  <th className="th w-20 text-right">Qty</th>
                                  <th className="th w-24 text-right">Rate</th>
                                  <th className="th w-24 text-right">Amount</th>
                                  {!readOnly && <th className="th w-8" />}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-100">
                                {materialsList.map((m, i) => (
                                  <tr key={i}>
                                    <td className="td !px-2 !py-1.5 text-ink-400">{i + 1}</td>
                                    <td className="td !px-2 !py-1.5">
                                      <div className="flex items-center gap-2">
                                        {m.code && (
                                          <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-700">
                                            {m.code}
                                          </span>
                                        )}
                                        <ProductSearchInput
                                          value={m.productName ?? ''}
                                          onChange={(v) => patchMaterial(s.uid, i, { productName: v, code: '' })}
                                          onPick={(pr) => pickMaterial(s.uid, i, pr)}
                                          disabled={readOnly}
                                          usableAs="material"
                                          allowCreate
                                          placeholder="Type a code or material name…"
                                          className=""
                                        />
                                      </div>
                                    </td>
                                    <td className="td !px-2 !py-1.5">
                                      <NumberInput
                                        value={String(m.qty ?? '')}
                                        onChange={(e) =>
                                          patchMaterial(s.uid, i, { qty: Number(e.target.value) })
                                        }
                                        disabled={readOnly}
                                        className="input-sm"
                                      />
                                    </td>
                                    <td className="td !px-2 !py-1.5">
                                      <NumberInput
                                        value={String(m.rate ?? '')}
                                        onChange={(e) =>
                                          patchMaterial(s.uid, i, { rate: Number(e.target.value) })
                                        }
                                        disabled={readOnly}
                                        className="input-sm"
                                      />
                                    </td>
                                    <td className="td !px-2 !py-1.5 text-right font-semibold tabular-nums">
                                      {fmt(num(m.qty) * num(m.rate))}
                                    </td>
                                    {!readOnly && (
                                      <td className="td !px-2 !py-1.5">
                                        <button
                                          type="button"
                                          onClick={() => removeMaterial(s.uid, i)}
                                          aria-label="Remove material row"
                                          className="text-rose-500 transition hover:text-rose-700"
                                        >
                                          ✕
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-2.5">
                        {ledgerId && !readOnly ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-600 hover:text-ink-900">
                            <input
                              type="checkbox"
                              checked={s.remember !== false}
                              onChange={(e) => patch(s.uid, { remember: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            />
                            Keep {s.name.trim() || 'this person'} on file for next time
                          </label>
                        ) : (
                          <div />
                        )}

                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          Material Used Cost: <span className="tabular-nums font-black text-emerald-900">{fmt(materialsTotal(s.materials))} AED</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    })()}
    </div>
  );
}
