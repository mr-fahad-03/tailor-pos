'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { api } from '@/lib/api';
import type { MeasurementProfile } from '@/lib/types';

/**
 * Person's-name field with live suggestions from everyone already measured.
 *
 * Names are not unique across customers — two customers can each have an
 * "Ali", and the same man may be on file under his own ledger and his
 * father's. So a suggestion never shows a bare name: each row carries the
 * customer it belongs to and their phone, and the people belonging to the
 * customer already on this order are listed first and marked, because picking
 * someone else's measurements is nearly always a mistake.
 */
export function PersonSearchInput({
  value,
  onChange,
  onPick,
  ledgerId,
  disabled,
  className = '',
  placeholder = "Person's name",
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: MeasurementProfile) => void;
  /** The customer on this order, if one is chosen yet. */
  ledgerId?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<MeasurementProfile[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!open || disabled) return;
    const term = value.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api.measurements.search(term, 1, 10);
        // This order's own customer first; everyone else after.
        const mine = r.items.filter((p) => ledgerId && p.ledgerId === ledgerId);
        const others = r.items.filter((p) => !ledgerId || p.ledgerId !== ledgerId);
        setResults([...mine, ...others]);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, open, disabled, ledgerId]);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Person's name"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={className}
      />
      <AnchoredDropdown anchorRef={wrapRef} panelRef={panelRef} open={open && results.length > 0} width={352}>
        <>
          {results.map((p) => {
            const sameCustomer = Boolean(ledgerId) && p.ledgerId === ledgerId;
            const filled = Object.values(p.values ?? {}).filter(Boolean).length;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className="flex w-full items-start justify-between gap-3 border-b border-ink-50 px-3 py-2 text-left last:border-b-0 hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-ink-900">
                    {p.name}
                  </span>
                  {/* The owner is the whole point: it is what tells two Alis apart. */}
                  <span className="block truncate text-[11px] text-ink-500">
                    {p.ledgerName || 'Unknown customer'}
                    {p.ledgerPhone ? ` · ${p.ledgerPhone}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] font-semibold text-ink-400">{filled} fields</span>
                  {!sameCustomer && ledgerId && (
                    <span className="badge bg-brass-100 text-brass-800">other customer</span>
                  )}
                  {sameCustomer && <span className="badge bg-brand-100 text-brand-800">this customer</span>}
                </span>
              </button>
            );
          })}
          <p className="border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
            Picking copies their measurements onto this order
          </p>
        </>
      </AnchoredDropdown>
    </div>
  );
}
