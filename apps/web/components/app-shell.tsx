'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowLeftRight, BookOpen, Layers3, Radio, WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/settlements', label: 'Settlements', icon: Layers3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="LedgerFlow overview">
          <span className="brand-mark">
            <WalletCards aria-hidden="true" />
          </span>
          <span>
            Ledger<span>Flow</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link className={pathname === href ? 'active' : ''} href={href} key={href}>
              <Icon aria-hidden="true" /> <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="environment-card">
          <Radio aria-hidden="true" />
          <div>
            <strong>Local sandbox</strong>
            <span>Simulated USD only</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Financial operations</p>
            <h1>{navigation.find((item) => item.href === pathname)?.label ?? 'Overview'}</h1>
          </div>
          <div className="operator-chip">
            <span className="avatar">MK</span>
            <span>
              <strong>Demo operator</strong>
              <small>Full access</small>
            </span>
          </div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link className={pathname === href ? 'active' : ''} href={href} key={href}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
