import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { SettingsProvider } from '@/components/SettingsContext';
import { AuthProvider } from '@/components/AuthContext';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Tailor POS — All in One',
  description: 'Modern tailor shop point of sale: stitching orders, sales, ledgers, inventory.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>
            <SettingsProvider>
              <AppShell>{children}</AppShell>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
