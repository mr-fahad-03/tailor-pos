'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AppSettings } from '@/lib/types';

const KEY = 'tailor-pos-settings';

const DEFAULTS: AppSettings = {
  taxRate: 5,
  bookNo: 270,
  salesman: 'GENERAL',
  deliveryDays: 7,
};

const SettingsCtx = createContext<{
  settings: AppSettings;
  save: (s: AppSettings) => void;
}>({ settings: DEFAULTS, save: () => {} });

export const useSettings = () => useContext(SettingsCtx);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const save = (s: AppSettings) => {
    setSettings(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };

  return <SettingsCtx.Provider value={{ settings, save }}>{children}</SettingsCtx.Provider>;
}
