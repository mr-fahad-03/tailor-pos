'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { api } from '@/lib/api';
import type { Ledger } from '@/lib/types';

/**
 * Type-to-find a ledger, in one box.
 *
 * Unlike LedgerSearchModal this sits inline, so it can be used from inside
 * another dialog without stacking two overlays. Picking a row hands the whole
 * ledger back; typing afterwards clears the pick, because a half-edited name
 * no longer identifies anybody.
 */
export function LedgerSearchInput({
  value,
  onChange,
  onPick,
  onCreate,
  placeholder = 'Search customers…',
  disabled,
  autoFocus,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (l: Ledger) => void;
  /** Offered at the foot of the list when the typed name is on nobody's file. */
  onCreate?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Ledger[]>([]);
  /** The text the rows above were fetched for, so a stale list is never
      mistaken for "nobody by that name". */
  const [answered, setAnswered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const typed = value.trim();
  const empty = open && answered === typed && typed.length > 0 && rows.length === 0;

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
    let dropped = false;
    const t = setTimeout(async () => {
      const asked = value.trim();
      try {
        const r = await api.ledgers.list(value, 1, 8);
        if (dropped) return;
        setRows(r.items);
        setAnswered(asked);
      } catch {
        if (dropped) return;
        setRows([]);
        setAnswered(asked);
      }
    }, 250);
    return () => {
      dropped = true;
      clearTimeout(t);
    };
  }, [value, open, disabled]);

  function create() {
    setOpen(false);
    onCreate?.(typed);
  }

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          // Suggestions follow what is being typed rather than greeting an
          // empty box with the first eight names on file.
          setOpen(e.target.value.trim().length > 0);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (rows.length > 0) {
            e.preventDefault();
            onPick(rows[0]);
            setOpen(false);
          } else if (empty && onCreate) {
            e.preventDefault();
            create();
          }
        }}
        className={`input ${className}`}
      />
      <AnchoredDropdown
        anchorRef={wrapRef}
        panelRef={panelRef}
        open={open && (rows.length > 0 || empty)}
        width={320}
      >
        <>
          {rows.map((l) => (
            <button
              key={l._id}
              type="button"
              onClick={() => {
                onPick(l);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand-50"
            >
              <span className="font-semibold text-ink-800">{l.name}</span>
              <span className="font-mono text-xs text-ink-500">{l.phone || '—'}</span>
            </button>
          ))}
          {/* A name nobody is filed under is usually a new walk-in, not a typo,
              so the way to put them on file is offered right where the search
              failed instead of sending the counter off to find a ＋ button. */}
          {empty && (
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-[12px] font-semibold text-rose-600">
                “{typed}” Not Available
              </span>
              {onCreate && (
                <button
                  type="button"
                  onClick={create}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-brand-600 px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-brand-700"
                >
                  ＋ Add New
                </button>
              )}
            </div>
          )}
          {rows.length > 0 && (
            <p className="border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
              Enter to pick first match
            </p>
          )}
        </>
      </AnchoredDropdown>
    </div>
  );
}
