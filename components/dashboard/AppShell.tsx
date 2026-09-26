// components/dashboard/AppShell.tsx — Shell compartido para páginas autenticadas.
// El top-search navega a /marketplace?search=<q> cuando hay query.
// Sidebar items activos vía usePathname(). Botón Cerrar sesión llama a
// /api/auth/logout.

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  ArrowRightLeft,
  Bell,
  Bot,
  Inbox,
  LogOut,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { fmtPrice } from '@/lib/format';

type Me = {
  id: string;
  displayName: string;
  balanceXlm: number;
};

const NAV = [
  ['/home', 'Inicio', Store] as const,
  ['/marketplace', 'Marketplace', Store] as const,
  ['/procesos', 'Procesos', ArrowRightLeft] as const,
  ['/incoming-offers', 'Recibidas', Inbox] as const,
  ['/assistant', 'Asistente IA', Bot] as const,
  ['/map', 'Mapa', MapPinned] as const,
  ['/settings', 'Mi cuenta', UserRound] as const,
];

function initials(name: string) {
  const p = name.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/marketplace?search=${encodeURIComponent(q)}`);
  }

  const ini = initials(me.displayName);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/home" className="brand">
          <span className="brand-mark">P</span>
          <span>
            Puma<span className="brand-accent">Trade</span>
          </span>
        </Link>
        <div className="campus-pill">
          <span className="status-dot" />
          UNAM · Facultad de Ingeniería
        </div>
        <nav className="side-nav">
          {NAV.map(([href, name, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${
                pathname === href || (href !== '/home' && pathname.startsWith(href))
                  ? 'active'
                  : ''
              }`}
            >
              <Icon />
              {name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <ShieldCheck />
            <span>
              <strong>Intercambios protegidos</strong>
              <span>Escrow Stellar con ventana de prueba.</span>
            </span>
          </div>
          <button type="button" className="profile-row" onClick={logout}>
            <div className="avatar">{ini}</div>
            <div className="profile-copy">
              <strong>{me.displayName}</strong>
              <small>Cerrar sesión</small>
            </div>
            <LogOut />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <form className="top-search" onSubmit={onSearch} role="search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca libros, calculadoras, electrónica..."
              aria-label="Buscar artículos en el marketplace"
            />
          </form>
          <div className="top-actions">
            <div className="balance-chip">
              <WalletCards />
              <span>P$ {fmtPrice(me.balanceXlm)}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Notificaciones"
            >
              <Bell />
              <span className="notification-dot" />
            </button>
            <Link href="/settings" className="top-avatar" aria-label="Mi cuenta">
              {ini}
            </Link>
          </div>
        </header>
        <div className="content-wrap">{children}</div>
      </main>
    </div>
  );
}
