'use client';

import { useEffect, useRef, useState } from 'react';
import { AnchoredDropdown } from '@/components/AnchoredDropdown';

export interface AttachablePerson {
  uid: string;
  name: string;
}

/** What a person is called in the picker before anyone has typed their name. */
export const personLabel = (p: AttachablePerson, i: number) =>
  p.name.trim() || `Person ${i + 1}`;

/**
 * Says which person's measurements an order line is stitched to, and lets
 * that be changed.
 *
 * Order lines and people used to be bound by position alone — row 1 to the
 * first person, row 2 to the second — which is invisible and wrong the moment
 * a line is an alteration charge rather than a garment. The link is stated
 * here instead, in words, on the row it belongs to: either whose size is
 * attached, or that none is.
 */
export function AttachSizePicker({
  people,
  value,
  onChange,
  onReveal,
  disabled = false,
}: {
  people: AttachablePerson[];
  /** The attached person's uid, or '' for none. */
  value: string;
  onChange: (uid: string) => void;
  /** Go and look at the attached person's measurements. */
  onReveal?: (uid: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // A person who has since been deleted leaves the line unattached rather
  // than naming somebody who is no longer on the order.
  const at = people.findIndex((p) => p.uid === value);
  const attached = at >= 0 ? personLabel(people[at], at) : null;

  return (
    <div ref={anchorRef} className="relative flex items-center justify-center gap-1.5">
      {/* An attached line is read far more often than it is re-pointed, so the
          words themselves go to the measurements they name, and changing the
          attachment sits behind the caret beside them. An unattached line has
          nowhere to go, so the words open the list instead. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (attached && onReveal ? onReveal(value) : setOpen((o) => !o))}
        title={
          disabled
            ? undefined
            : attached
              ? `Go to ${attached}'s measurements`
              : 'Click to attach this line to somebody on the order'
        }
        className={`min-w-0 truncate text-center text-[11px] font-bold transition disabled:cursor-default ${
          attached
            ? 'text-blue-700 hover:text-blue-900 hover:underline'
            : 'text-rose-600 hover:text-rose-800'
        }`}
      >
        {attached ? `${attached} size attached` : 'Order Size Not Attached'}
      </button>
      {attached && !disabled && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Attach this line to somebody else"
          aria-label="Change the attached person"
          aria-haspopup="listbox"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink-200 text-ink-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-2.5 w-2.5"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}

      <AnchoredDropdown anchorRef={anchorRef} panelRef={panelRef} open={open && !disabled} width={240}>
        <>
          {people.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-ink-500">
              Nobody on this order yet — add a person under Measurements.
            </p>
          ) : (
            people.map((p, i) => (
              <button
                key={p.uid}
                type="button"
                onClick={() => {
                  onChange(p.uid);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand-50 ${
                  p.uid === value ? 'font-bold text-brand-700' : 'text-ink-700'
                }`}
              >
                {personLabel(p, i)}
                {p.uid === value && <span aria-hidden>✓</span>}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="w-full border-t border-ink-100 px-3 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50"
          >
            Not attached
          </button>
        </>
      </AnchoredDropdown>
    </div>
  );
}
