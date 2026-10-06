'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { fmtDate, todayISO } from '@/lib/format';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { api } from '@/lib/api';

const ROLE_TONE: Record<string, string> = {
  super_admin: 'bg-brand-100 text-brand-800',
  admin: 'bg-brass-100 text-brass-800',
  salesman: 'bg-ink-200 text-ink-700',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (next.length < 8) return setError('New password must be at least 8 characters');
    if (next !== confirm) return setError('The two new passwords do not match');
    setBusy(true);
    try {
      await api.auth.changePassword(current, next);
      toast('Password changed');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Change password" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Current password</label>
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-soft" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          aria-controls="app-sidebar"
          className="-ml-1 shrink-0 rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="hidden text-sm font-medium text-ink-500 md:block">
            {fmtDate(todayISO())}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-ink-300 hover:bg-ink-50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white">
                {initials(user?.name || '')}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-[140px] truncate text-left text-[13px] font-semibold text-ink-900">
                  {user?.name}
                </span>
                <span className="block text-left text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                  {user?.roleLabel}
                </span>
              </span>
              <span className="text-[10px] text-ink-400">▾</span>
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop"
              >
                <div className="border-b border-ink-100 px-4 py-3">
                  <p className="truncate text-sm font-bold text-ink-950">{user?.name}</p>
                  <p className="truncate font-mono text-[11px] text-ink-500">@{user?.username}</p>
                  <span
                    className={`badge mt-2 ${ROLE_TONE[user?.role ?? 'salesman'] ?? 'bg-ink-200 text-ink-700'}`}
                  >
                    {user?.roleLabel}
                  </span>
                </div>
                <button
                  role="menuitem"
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition hover:bg-ink-50"
                  onClick={() => {
                    setOpen(false);
                    setPwOpen(true);
                  }}
                >
                  Change password
                </button>
                <button
                  role="menuitem"
                  className="block w-full border-t border-ink-100 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  onClick={() => {
                    setOpen(false);
                    logout();
                    router.push('/');
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </header>
  );
}
