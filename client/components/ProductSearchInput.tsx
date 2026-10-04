'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';
import type { Product } from '@/lib/types';

/**
 * Code input with a live product search dropdown.
 * Typing searches; picking a row calls onPick(product).
 */
export function ProductSearchInput({
  value,
  onChange,
  onPick,
  placeholder = 'Code',
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Product) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.products.list(value, 1, 8);
        setResults(r.items);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        placeholder={placeholder}
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
        className="input input-sm font-mono uppercase"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
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
        </div>
      )}
    </div>
  );
}
