'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthContext';
import { ProductFormModal } from '@/components/ProductFormModal';
import { fmt } from '@/lib/format';
import type { Product, ProductUsagePicker } from '@/lib/types';

/**
 * One box for a product: a code or a name both search it, and picking a row
 * calls onPick(product). `usableAs` narrows the catalogue to what this picker
 * is allowed to offer; left off, everything shows.
 *
 * `allowCreate` adds a ＋ beside it for a product that is not in the catalogue
 * yet. It opens the same form the Products screen uses, pre-classified for
 * this picker, and the saved product is selected into the row straight away.
 */
export function ProductSearchInput({
  value,
  onChange,
  onPick,
  placeholder = 'Code',
  disabled,
  usableAs,
  allowCreate = false,
  /** Codes read better monospaced; a product name does not. */
  className = 'font-mono uppercase',
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  usableAs?: ProductUsagePicker;
  allowCreate?: boolean;
  className?: string;
}) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canCreate = allowCreate && !disabled && can('products.manage');

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
    <div ref={wrapRef} className="relative flex w-full min-w-0 flex-1 items-center gap-1.5">
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          // Suggestions follow what is being typed, rather than greeting an
          // empty box with the whole catalogue. Clearing the box shuts them
          // again — F2 is still there to browse everything deliberately.
          setOpen(e.target.value.trim().length > 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'F2') setOpen(true);
          if (e.key === 'Enter' && results.length > 0) {
            onPick(results[0]);
            setOpen(false);
          }
        }}
        className={`input input-sm ${className}`}
      />
      {canCreate && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Add a product that is not in the catalogue yet"
          aria-label="New product"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-300 text-ink-500 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        >
          ＋
        </button>
      )}
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
      {canCreate && (
        <ProductFormModal
          open={creating}
          onClose={() => setCreating(false)}
          // Whatever was typed is almost certainly the name being looked for.
          seedName={value}
          defaultUsage={usableAs ?? 'both'}
          onSaved={(p) => {
            onPick(p);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
