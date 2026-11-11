import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-code/500.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '../components/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'LedgerFlow · Financial Operations',
  description: 'A local-first event-driven financial operations simulator.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
