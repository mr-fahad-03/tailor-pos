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
  placeholder = 'Search customers…',
  disabled,
  autoFocus,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (l: Ledger) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Ledger[]>([]);
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
    const t = setTimeout(async () => {
      try {
        const r = await api.ledgers.list(value, 1, 8);
        setRows(r.items);
      } catch {
        setRows([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, open, disabled]);

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
          if (e.key === 'Enter' && rows.length > 0) {
            e.preventDefault();
            onPick(rows[0]);
            setOpen(false);
          }
        }}
        className={`input ${className}`}
      />
      <AnchoredDropdown anchorRef={wrapRef} panelRef={panelRef} open={open && rows.length > 0} width={320}>
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
          <p className="border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
            Enter to pick first match
          </p>
        </>
      </AnchoredDropdown>
    </div>
  );
}
