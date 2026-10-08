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
 * `allowCreate` offers a product that is not in the catalogue yet at the foot
 * of the list, worded with whatever was typed. It opens the same form the
 * Products screen uses, pre-classified for this picker, and the saved product
 * is selected into the row straight away. The offer appears where the missing
 * product was looked for, rather than behind a ＋ that is there whether or not
 * anything is missing.
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
        const r = await api.products.list(value, 1, 25, usableAs);
        setResults(r.items);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [value, open, disabled, usableAs]);

  // Nothing in the catalogue is spelled exactly this way, so it is worth
  // offering to add it. A fuzzy match is not enough: typing "Shirt XL" while
  // "Shirt" exists is still a product the shop has not got.
  const typed = value.trim();
  const known = results.some(
    (p) =>
      p.name.toLowerCase() === typed.toLowerCase() ||
      (p.code ?? '').toLowerCase() === typed.toLowerCase(),
  );
  const offerCreate = canCreate && typed.length > 0 && !known;

  const handleBlur = () => {
    if (typed && results.length > 0) {
      const match = results.find(
        (p) =>
          p.name.toLowerCase() === typed.toLowerCase() ||
          (p.code ?? '').toLowerCase() === typed.toLowerCase(),
      );
      if (match) {
        onPick(match);
      }
    }
  };

  return (
    // `flex-1 min-w-0` so that sitting next to a code chip in a flex row does
    // not shrink the box to an <input>'s intrinsic ~20-character width.
    <div ref={wrapRef} className="relative flex w-full min-w-0 flex-1 items-center gap-1.5">
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'F2') setOpen(true);
          if (e.key === 'Enter' && results.length > 0) {
            onPick(results[0]);
            setOpen(false);
          } else if (e.key === 'Enter' && offerCreate) {
            // Nothing to pick, but something worth adding.
            setCreating(true);
            setOpen(false);
          }
        }}
        className={`input input-sm ${className}`}
      />
      <AnchoredDropdown
        anchorRef={wrapRef}
        panelRef={panelRef}
        open={open && (results.length > 0 || offerCreate)}
        width={288}
      >
        <>
          {results.map((p) => (
            <button
              key={p._id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
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
          {offerCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setCreating(true);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 border-t border-ink-100 px-3 py-2 text-left text-[12px] hover:bg-brand-50"
            >
              <span className="truncate font-semibold text-rose-600">
                “{typed}” Not Available
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors">
                + Add New
              </span>
            </button>
          )}
          {results.length > 0 && (
            <p className="border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
              F2 / Enter to pick first match
            </p>
          )}
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
