'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown that cannot be clipped by whatever it sits inside.
 *
 * Suggestion lists live inside scrolling containers — the order items table
 * and each person's materials table are both `overflow-x-auto`, which makes
 * them a clipping context. An absolutely positioned panel is then trapped and
 * cut off inside the scroll box. So the panel is rendered through a portal on
 * `document.body` and positioned with `fixed` coordinates taken from the
 * anchor, which no ancestor's overflow can touch.
 */
export function AnchoredDropdown({
  anchorRef,
  open,
  width = 288,
  children,
  panelRef,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  /** Preferred width in px; trimmed to fit narrow screens. */
  width?: number;
  children: React.ReactNode;
  /** So the owner can tell a click on the panel from a click outside it. */
  panelRef?: React.RefObject<HTMLDivElement>;
}) {
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? ownRef;

  // Portals need a DOM; nothing renders during the server pass.
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !mounted) return;

    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gutter = 8;
      const w = Math.min(width, window.innerWidth - gutter * 2);
      // Keep the panel on screen when the field sits near the right edge.
      const left = Math.max(gutter, Math.min(r.left, window.innerWidth - w - gutter));
      const below = window.innerHeight - r.bottom;
      // Flip above when there is more room there than below.
      const top = below < 220 && r.top > below ? r.top - 4 : r.bottom + 4;
      setBox({ top, left, width: w });
    };

    place();
    // `true` catches scrolling of the inner containers, not just the window.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, mounted, anchorRef, width]);

  if (!open || !mounted || !box) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: box.top, left: box.left, width: box.width }}
      className="z-[60] max-h-[min(20rem,60vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-ink-200 bg-white shadow-pop"
    >
      {children}
    </div>,
    document.body,
  );
}
