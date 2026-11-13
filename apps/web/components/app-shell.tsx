import { Activity, ArrowLeftRight, BookOpen, Layers3, Radio, WalletCards } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navigation = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/settlements', label: 'Settlements', icon: Layers3 },
];

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="LedgerFlow overview">
          <span className="brand-mark">
            <WalletCards aria-hidden="true" />
          </span>
          <span>
            Ledger<span>Flow</span>
          </span>
        </NavLink>
        <nav aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to={href} key={href}>
              <Icon aria-hidden="true" /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="environment-card">
          <Radio aria-hidden="true" />
          <div>
            <strong>Local sandbox</strong>
            <span>USD · EUR · GBP · EGP</span>
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
        <main>
          <Outlet />
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => (
          <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to={href} key={href}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
