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
  id,
  value,
  onChange,
  onPick,
  ledgerId,
  disabled,
  className = '',
  placeholder = "Person's name — type to find saved measurements",
}: {
  id?: string;
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
  /** What the rows above were fetched for, so a list that has not caught up
      is never mistaken for "nobody on file". */
  const [answered, setAnswered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const term = value.trim();
  const asked = `${ledgerId ?? ''}|${term}`;
  const empty = open && !disabled && answered === asked && results.length === 0;

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
    // An empty box on an order that already names a customer shows that
    // customer's own people straight away — their measurements are what the
    // counter wants nine times out of ten, and nobody should have to guess at
    // a name to find out they are on file. With no customer chosen yet there
    // is nothing to narrow by, so wait for something to be typed.
    if (!term && !ledgerId) {
      setResults([]);
      setAnswered(null);
      return;
    }
    let dropped = false;
    const t = setTimeout(async () => {
      try {
        const r = term
          ? await api.measurements.search(term, 1, 10)
          : await api.measurements.list(ledgerId!);
        if (dropped) return;
        let list = r.items;
        if (term) {
          const tLower = term.toLowerCase();
          list = list.filter((p) => {
            const n = (p.name ?? '').trim().toLowerCase();
            const s = (p.stitchingStyle ?? '').trim().toLowerCase();
            const c = (p.ledgerName ?? '').trim().toLowerCase();
            const phone = (p.ledgerPhone ?? '').trim().toLowerCase();
            return (
              n.startsWith(tLower) ||
              n.split(/\s+/).some((w) => w.startsWith(tLower)) ||
              s.startsWith(tLower) ||
              c.startsWith(tLower) ||
              phone.startsWith(tLower)
            );
          });
        }
        // This order's own customer first; everyone else after.
        const mine = list.filter((p) => ledgerId && p.ledgerId === ledgerId);
        const others = list.filter((p) => !ledgerId || p.ledgerId !== ledgerId);
        setResults([...mine, ...others]);
      } catch {
        if (dropped) return;
        setResults([]);
      } finally {
        if (!dropped) setAnswered(asked);
      }
    }, 250);
    return () => {
      dropped = true;
      clearTimeout(t);
    };
  }, [value, open, disabled, ledgerId, term, asked]);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Person's name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        data-bwignore="true"
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          if (v.trim().length > 0) {
            setOpen(true);
          } else {
            setOpen(false);
          }
        }}
        className={className}
      />
      <AnchoredDropdown
        anchorRef={wrapRef}
        panelRef={panelRef}
        open={open && term.length > 0 && (results.length > 0 || empty)}
        width={415}
      >
        <div className="py-1">
          {/* Table Header Row */}
          {results.length > 0 && (
            <div className="grid grid-cols-[1.35fr_1.65fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-bold text-ink-700 bg-ink-100/80 border-b border-ink-200 sticky top-0 z-10 select-none items-center">
              <div>Measurement Name</div>
              <div>Master Customer Name</div>
              <div>Phone</div>
            </div>
          )}

          {/* Render result list as table rows */}
          {results.map((p) => {
            const sameCustomer = Boolean(ledgerId) && p.ledgerId === ledgerId;
            return (
              <button
                key={p._id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                  setOpen(false);
                }}
                className={`grid grid-cols-[1.35fr_1.65fr_1fr] gap-2 w-full px-3 py-2 text-left text-[12px] border-b border-ink-50 last:border-b-0 transition-colors items-center ${
                  sameCustomer ? 'bg-brand-50/70 hover:bg-brand-100/70' : 'hover:bg-ink-50'
                }`}
              >
                <div className="min-w-0 truncate font-bold text-ink-900 flex items-center gap-1.5">
                  <span className="truncate">{p.name}</span>
                  {p.stitchingStyle ? (
                    <span className="shrink-0 rounded bg-brand-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                      {p.stitchingStyle}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 truncate font-semibold text-ink-700">
                  {p.ledgerName || '—'}
                </div>
                <div className="min-w-0 truncate font-mono text-[11px] text-ink-600">
                  {p.ledgerPhone || '—'}
                </div>
              </button>
            );
          })}

          {empty && (
            <div className="px-3 py-2.5">
              <p className="text-[13px] font-semibold text-ink-600">
                {term ? 'Nobody saved by that name' : 'Nobody saved for this customer yet'}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                Fill the boxes below and they are kept on file when the order is
                saved, ready to pick next time.
              </p>
            </div>
          )}
        </div>
      </AnchoredDropdown>
    </div>
  );
}
