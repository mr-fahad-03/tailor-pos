'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AppSettings } from '@/lib/types';

const KEY = 'tailor-pos-settings';

const DEFAULTS: AppSettings = {
  taxRate: 5,
  bookNo: 270,
  salesman: 'GENERAL',
  deliveryDays: 7,
  // Left blank on purpose: an invoice must carry the shop's own details, and
  // a plausible-looking placeholder is worse than an obviously empty line.
  company: {
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    trn: '',
    logo: '',
    brandLogo: '',
    brandTagline: '',
  },
  bank: {
    name: '',
    accountType: '',
    accountName: '',
    accountNo: '',
    iban: '',
    swift: '',
    chequeFavour: '',
    note: '',
  },
  invoiceTitle: 'Performa Invoice',
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
      // Merged a level down: a settings object saved before the company and
      // bank blocks existed, or one holding only some of their fields, must
      // still come back whole rather than with holes in it.
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AppSettings>;
        setSettings({
          ...DEFAULTS,
          ...saved,
          company: { ...DEFAULTS.company, ...(saved.company ?? {}) },
          bank: { ...DEFAULTS.bank, ...(saved.bank ?? {}) },
        });
      }
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
