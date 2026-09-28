// components/dashboard/AppShell.tsx — Shell compartido para páginas autenticadas.
// El top-search navega a /marketplace?search=<q> cuando hay query.
// Sidebar items activos vía usePathname(). Botón Cerrar sesión llama a
// /api/auth/logout.

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
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
import { usePollar } from '@pollar/react';
import { fmtXlmShort } from '@/lib/format';

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

  // Pollar maintains its own authenticated state in IndexedDB. If we
  // only clear our app cookie, the moment we land on / after, Pollar
  // still sees the user as authenticated, PollarLoginActions's useEffect
  // re-runs /api/auth/sync, and the server reissues the cookie -- quietly
  // signing the user back in. We have to chain Pollar's logout() right
  // after our cookie clear for the redirect to stick.
  const { logout: pollarLogout } = usePollar();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server call hangs, we still clear Pollar below;
      // the cookie clear is what makes GET /api/auth/me return null.
    }
    try {
      pollarLogout();
    } catch {
      // Pollar logout occasionally throws in restricted environments;
      // cookie clear above is already enough to prevent reauth.
    }
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
        {/* Brand: single wordmark — no double-stacked logos. */}
        <Link
          href="/home"
          style={{
            padding: '0 10px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
          }}
        >
          <img
            src="/Logo_Gremium.png"
            alt="Gremium"
            width={120}
            height={26}
            style={{ height: 26, width: 'auto', display: 'block' }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.6,
              color: '#9ba7b8',
              textTransform: 'uppercase',
              lineHeight: 1.2,
              borderLeft: '1px solid var(--line)',
              paddingLeft: 9,
            }}
          >
            Goya-Hack
            <br />
            2026
          </span>
        </Link>
        {/* Espacio para el logo del equipo */}
        <div
          className="team-brand-slot"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '8px',
            marginBottom: '14px',
          }}
        >
          <img
            src="/GenesisPNG.png"
            alt="Equipo Genesis"
            style={{ height: '22px', width: '22px', objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b21a8' }}>
              Equipo Genesis
            </span>
            <span style={{ fontSize: '9px', color: '#9333ea' }}>Hackathon UNAM 2026</span>
          </div>
        </div>
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
              <span>{fmtXlmShort(me.balanceXlm)}</span>
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
