'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Stop a half-written form being walked away from by accident.
 *
 * The App Router has no navigation blocker, so this catches the click on its
 * way to the link and holds the destination until the question is answered.
 * A hard tab close cannot be held, so that falls back to the browser's own
 * prompt — the honest option there.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      // A modified click opens elsewhere and leaves this page alone.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.target === '_blank') return;
      if (link.hasAttribute('download')) return;
      // Off to another site, or back to where we already are: not our business.
      if (/^[a-z]+:/i.test(href) && !href.startsWith('/')) return;
      if (href === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(href);
    };

    window.addEventListener('beforeunload', warn);
    // Capture phase, so the link's own handler never gets the chance to run.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const leave = useCallback(() => {
    const href = pending;
    setPending(null);
    if (href) router.push(href);
  }, [pending, router]);

  const stay = useCallback(() => setPending(null), []);

  return { asking: pending !== null, leave, stay };
}
