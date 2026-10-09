'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';
import { api } from '@/lib/api';
import type { MeasurementProfile } from '@/lib/types';

export function CustomerSizeSearchSelect({
  value = '',
  ledgerId,
  onSelectProfile,
  onAddNew,
  disabled = false,
  placeholder = 'Select Customer Size...',
  className = '',
}: {
  value?: string;
  ledgerId?: string;
  onSelectProfile: (profile: MeasurementProfile) => void;
  onAddNew?: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customerProfiles, setCustomerProfiles] = useState<MeasurementProfile[]>([]);
  const [searchResults, setSearchResults] = useState<MeasurementProfile[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load selected customer's saved profiles on mount or ledgerId change
  useEffect(() => {
    if (!ledgerId) {
      setCustomerProfiles([]);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const res = await api.measurements.list(ledgerId);
        if (live) setCustomerProfiles(res.items);
      } catch {
        if (live) setCustomerProfiles([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [ledgerId]);

  // Click outside to close
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Search profiles when query changes
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (!open || !trimmedQuery) {
      setSearchResults([]);
      return;
    }
    let dropped = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.measurements.search(trimmedQuery, 1, 10);
        if (dropped) return;
        setSearchResults(res.items);
      } catch {
        if (dropped) return;
        setSearchResults([]);
      }
    }, 200);
    return () => {
      dropped = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, open]);

  // Which list to show:
  const displayingResults = trimmedQuery ? searchResults : customerProfiles;
  const showAddCustom = trimmedQuery.length > 0 && !displayingResults.some(
    (p) =>
      p.name.toLowerCase() === trimmedQuery.toLowerCase() ||
      (p.ledgerPhone && p.ledgerPhone.includes(trimmedQuery))
  );

  const handlePick = (p: MeasurementProfile) => {
    onSelectProfile(p);
    setQuery('');
    setOpen(false);
  };

  const handleAddCustom = () => {
    if (onAddNew && trimmedQuery) {
      onAddNew(trimmedQuery);
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 sm:w-64">
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
              if (displayingResults.length > 0) {
                handlePick(displayingResults[0]);
              } else if (showAddCustom) {
                handleAddCustom();
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Select Customer Size"
          className={
            className ||
            'input input-sm w-full font-semibold text-xs text-brand-900 bg-brand-50/70 border-brand-200 hover:border-brand-400 focus:border-brand-500 focus:bg-white pr-7'
          }
        />
        {(query || value) && !open && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
            }}
            className="absolute right-2 text-ink-400 hover:text-ink-700 text-xs"
            title="Clear search"
          >
            ✕
          </button>
        )}
        {(!query && !value || open) && (
          <div className="pointer-events-none absolute right-2 text-ink-400 text-[10px]">
            ▼
          </div>
        )}
      </div>

      <AnchoredDropdown anchorRef={wrapRef} open={open} width={415} panelRef={panelRef}>
        <div className="py-1">
          {/* Table Header Row */}
          {displayingResults.length > 0 && (
            <div className="grid grid-cols-[1.35fr_1.65fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-bold text-ink-700 bg-ink-100/80 border-b border-ink-200 sticky top-0 z-10 select-none items-center">
              <div>Measurement Name</div>
              <div>Master Customer Name</div>
              <div>Phone</div>
            </div>
          )}

          {/* Render result list as table rows */}
          {displayingResults.map((p) => {
            const sameCustomer = Boolean(ledgerId) && p.ledgerId === ledgerId;
            return (
              <button
                key={p._id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePick(p);
                }}
                className={`grid grid-cols-[1.35fr_1.65fr_1fr] gap-2 w-full px-3 py-2 text-left text-[12px] border-b border-ink-50 last:border-b-0 transition-colors items-center ${sameCustomer ? 'bg-brand-50/70 hover:bg-brand-100/70' : 'hover:bg-ink-50'
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

          {/* Not available / Add custom option */}
          {showAddCustom && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-ink-100 hover:bg-emerald-50/40 transition-colors">
              <span className="truncate text-[12px] font-semibold text-rose-600">
                “{trimmedQuery}” Not Available
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddCustom();
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm transition-colors"
              >
                + Add New
              </button>
            </div>
          )}

          {/* Empty state when no query and no customer profiles */}
          {!trimmedQuery && customerProfiles.length === 0 && (
            <div className="px-3 py-3 text-center text-[12px] text-ink-500">
              <p className="font-semibold text-ink-700">No Saved Sizes Available</p>
              <p className="mt-0.5 text-[11px] text-ink-400">Type above to search all saved sizes</p>
            </div>
          )}

          {/* Empty state when searching but no results and no onAddNew */}
          {trimmedQuery && displayingResults.length === 0 && !showAddCustom && (
            <div className="px-3 py-2.5 text-center text-[12px] text-ink-500">
              No sizes found matching "{trimmedQuery}"
            </div>
          )}
        </div>
      </AnchoredDropdown>
    </div>
  );
}
