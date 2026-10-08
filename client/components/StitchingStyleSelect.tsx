'use client';

import { useEffect, useRef, useState } from 'react';
import { STITCHING_STYLES } from '@/lib/types';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';

const CUSTOM_STYLES_KEY = 'tailor_custom_stitching_styles';

export function getCustomStitchingStyles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_STYLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomStitchingStyle(style: string) {
  if (typeof window === 'undefined' || !style.trim()) return;
  const cleaned = style.trim();
  const existing = getCustomStitchingStyles();
  if (!existing.includes(cleaned) && !(STITCHING_STYLES as readonly string[]).includes(cleaned)) {
    const next = [...existing, cleaned];
    localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(next));
  }
}

export function StitchingStyleSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select Stitching Style...',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomStyles(getCustomStitchingStyles());
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const allAvailable = Array.from(
    new Set([...STITCHING_STYLES, ...customStyles, ...(value ? [value] : [])])
  );

  const trimmedQuery = query.trim();
  const filtered = allAvailable.filter((s) =>
    s.toLowerCase().includes(trimmedQuery.toLowerCase())
  );

  const exactMatch = allAvailable.some(
    (s) => s.toLowerCase() === trimmedQuery.toLowerCase()
  );

  const showAddCustom = trimmedQuery.length > 0 && !exactMatch;

  const handleSelect = (selected: string) => {
    if (showAddCustom && selected === trimmedQuery) {
      saveCustomStitchingStyle(selected);
      setCustomStyles(getCustomStitchingStyles());
    }
    onChange(selected);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setQuery(value || '');
              setOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showAddCustom && trimmedQuery) {
                handleSelect(trimmedQuery);
              } else if (filtered.length > 0) {
                handleSelect(filtered[0]);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Select Customer Stitching Style"
          className={
            className ||
            'input input-sm w-full font-semibold text-xs text-ink-700 bg-brand-50/50 border-brand-200 hover:border-brand-400 focus:border-brand-500 focus:bg-white pr-7'
          }
        />
        {value && !open && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
            className="absolute right-2 text-ink-400 hover:text-ink-700 text-xs"
            title="Clear stitching style"
          >
            ✕
          </button>
        )}
        {(!value || open) && (
          <div className="pointer-events-none absolute right-2 text-ink-400 text-[10px]">
            ▼
          </div>
        )}
      </div>

      <AnchoredDropdown anchorRef={wrapRef} open={open} width={280} panelRef={panelRef}>
        <div className="py-1">
          {showAddCustom && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-ink-100 hover:bg-emerald-50/40 transition-colors">
              <span className="truncate text-[12px] font-semibold text-rose-600">
                “{trimmedQuery}” Not Available
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(trimmedQuery);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm transition-colors"
              >
                + Add New
              </button>
            </div>
          )}

          {filtered.length === 0 && !showAddCustom && (
            <div className="px-3 py-2 text-xs text-ink-400 text-center italic">
              No styles found
            </div>
          )}

          {filtered.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => handleSelect(style)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                value === style
                  ? 'bg-brand-100 text-brand-900 font-bold'
                  : 'text-ink-800 hover:bg-ink-50 font-medium'
              }`}
            >
              <span>{style}</span>
              {value === style && <span className="text-brand-600 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </AnchoredDropdown>
    </div>
  );
}
