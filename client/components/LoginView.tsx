'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Icon } from '@/components/icons';

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      // The shell swaps to the app as soon as `user` is set — no redirect needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink-950 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 14px)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="scissors" className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-white">Tailor POS</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
              All in one
            </p>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            Job cards, measurements and billing in one place.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            Every advance, part payment and VAT line is calculated on the server, so your books
            never drift from the counter.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          <span>VAT 5% · UAE</span>
          <span className="h-1 w-1 rounded-full bg-ink-700" />
          <span>AED</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 lg:w-[54%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="scissors" className="h-[22px] w-[22px]" strokeWidth={2} />
            </div>
            <p className="text-base font-bold tracking-tight text-ink-950">Tailor POS</p>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink-950">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Use the account your shop administrator gave you.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="input pr-16"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full !py-2.5" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-400">
            Tailor POS · VAT 5% (UAE) · All amounts in AED
          </p>
        </div>
      </div>
    </div>
  );
}
