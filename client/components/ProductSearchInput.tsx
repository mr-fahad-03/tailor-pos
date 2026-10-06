'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import type { Product, ProductUsagePicker } from '@/lib/types';

/**
 * One box for a product: a code or a name both search it, and picking a row
 * calls onPick(product). `usableAs` narrows the catalogue to what this picker
 * is allowed to offer; left off, everything shows.
 */
export function ProductSearchInput({
  value,
  onChange,
  onPick,
  placeholder = 'Code',
  disabled,
  usableAs,
  /** Codes read better monospaced; a product name does not. */
  className = 'font-mono uppercase',
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  usableAs?: ProductUsagePicker;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
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
        const r = await api.products.list(value, 1, 8, usableAs);
        setResults(r.items);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, open, disabled, usableAs]);

  return (
    // `flex-1 min-w-0` so that sitting next to a code chip in a flex row does
    // not shrink the box to an <input>'s intrinsic ~20-character width.
    <div ref={wrapRef} className="relative w-full min-w-0 flex-1">
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'F2') setOpen(true);
          if (e.key === 'Enter' && results.length > 0) {
            onPick(results[0]);
            setOpen(false);
          }
        }}
        className={`input input-sm ${className}`}
      />
      <AnchoredDropdown anchorRef={wrapRef} panelRef={panelRef} open={open && results.length > 0} width={288}>
        <>
          {results.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => {
                onPick(p);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand-50"
            >
              <span>
                <span className="font-mono font-bold text-brand-700">{p.code}</span>
                <span className="ml-2 font-medium text-ink-700">{p.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-ink-500">{fmt(p.rate)}</span>
            </button>
          ))}
          <p className="border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
            F2 / Enter to pick first match
          </p>
        </>
      </AnchoredDropdown>
    </div>
  );
}
