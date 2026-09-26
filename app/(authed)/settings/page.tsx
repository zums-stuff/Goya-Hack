// app/(authed)/settings/page.tsx — Mi cuenta: perfil + wallet + danger zone.
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  WalletCards,
  UserRound,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { tryGetUser } from '@/lib/auth';
import { fmtPrice } from '@/lib/format';

export default async function SettingsPage() {
  const me = await tryGetUser();
  if (!me) return null;

  const ini = (() => {
    const p = me.displayName.replace(/\./g, '').trim().split(/\s+/);
    return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
  })();

  return (
    <section className="account-view">
      <Link href="/home" className="back-button" style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Volver al dashboard
      </Link>

      <p className="eyebrow">MI CUENTA · PUMATRADE</p>
      <h1 style={{ fontSize: 27, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Tu cuenta PumaTrade
      </h1>
      <p className="subcopy">
        Administra tu saldo, tu perfil y tu wallet Stellar.
      </p>

      <div className="account-grid">
        <div className="balance-card">
          <div className="balance-top">
            <span>Saldo disponible</span>
            <WalletCards />
          </div>
          <div className="balance-amount">P$ {fmtPrice(me.balanceXlm)}</div>
          <div className="balance-footer">
            <span className="positive">
              <ShieldCheck />
              Wallet lista
            </span>
            <Link href="/home">
              Volver <ChevronRight />
            </Link>
          </div>
        </div>
        <div
          className="stat-card"
          style={{
            background: 'var(--yellow)',
            color: '#a17a18',
          }}
        >
          <div className="stat-icon yellow-bg">
            <UserRound />
          </div>
          <div>
            <span>Datos públicos</span>
            <strong>{me.displayName}</strong>
            <small>{me.major} · {me.email}</small>
          </div>
        </div>
      </div>

      <div className="profile-panel">
        <span className="avatar large-avatar">{ini}</span>
        <div>
          <h2>{me.displayName}</h2>
          <p>
            {me.major} · UNAM · {me.id}
          </p>
          <span className="account-verified">
            <ShieldCheck />
            Sesión activa
          </span>
        </div>
      </div>

      <div className="wallet-panel">
        <span>
          <WalletCards />
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {(me.pollarWalletId || '').slice(0, 10)}…wallet
          </strong>
          <small>Dirección Stellar (seed user: placeholder hasta primer login)</small>
        </span>
        <a
          href="https://horizon-testnet.stellar.org"
          target="_blank"
          rel="noreferrer"
          className="outline-button"
        >
          Ver en Horizon <ChevronRight />
        </a>
      </div>

      <div
        className="profile-panel"
        style={{ marginTop: 24, borderColor: '#f4c2ba', background: '#fff7f5' }}
      >
        <span className="avatar large-avatar" style={{ background: '#fff0ed', color: 'var(--primary)' }}>
          <AlertTriangle />
        </span>
        <div>
          <h2 style={{ color: 'var(--primary)' }}>Zona de demo</h2>
          <p>
            Reinicia los datos pre-sembrados (5 users · 10 listings · 4 offers).
            Solo funciona en dev y requiere <code className="font-mono">ALLOW_RESET_DEMO=true</code>.
          </p>
          <form
            action="/api/reset-demo"
            method="POST"
            style={{ display: 'inline' }}
          >
            <input type="hidden" name="from_ui" value="1" />
            <button type="submit" className="sell-button" style={{ padding: '9px 14px', fontSize: 11 }}>
              <RefreshCw />
              Resetear datos demo
            </button>
          </form>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="outline-button" style={{ padding: '8px 12px' }}>
            <LogOut />
            Cerrar sesión
          </button>
        </form>
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 24, fontSize: 11, fontFamily: 'var(--font-mono)' }}
      >
        v0.1.0 · Stellar Testnet · Goya-Hack 2026
      </p>
    </section>
  );
}
