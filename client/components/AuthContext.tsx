'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Permission check — super admins always pass. */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
}

const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
  can: () => false,
  canAny: () => false,
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // A 401 from anywhere in the app drops the session.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await api.auth.me();
      setUser(u);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore the session on first paint.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: u } = await api.auth.login(username, password);
    setToken(token);
    setUser(u);
  }, []);

  const value = useMemo<AuthState>(() => {
    const can = (permission: string) => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      return user.permissions.includes(permission);
    };
    return {
      user,
      loading,
      login,
      logout,
      refresh,
      can,
      canAny: (...permissions: string[]) => permissions.some(can),
    };
  }, [user, loading, login, logout, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
