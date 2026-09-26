// app/(authed)/settings/page.tsx — Mi cuenta.
//
// Layout denso, sin flourish, todo el sistema de diseño aplicado:
// .account-view, .balance-card, .profile-panel, .wallet-panel,
// .account-row (kv filas) y .sell-button/.outline-button para
// acciones de demo.

import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  WalletCards,
  Mail,
  IdCard,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { tryGetUser } from '@/lib/auth';
import { fmtXlm, mxnFromCents, xlmMxnRate, fmtMxn } from '@/lib/currency';

export default async function SettingsPage() {
  const me = await tryGetUser();
  if (!me) return null;

  const ini = (() => {
    const p = me.displayName.replace(/\./g, '').trim().split(/\s+/);
    return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
  })();

  const minorBalance = me.balanceXlm / 1000; // rough heuristic for "uso del mes"

  const rate = await xlmMxnRate();
  const fmtBalance = await fmtXlm(me.balanceXlm);
  const fmtShort = (c: number) =>
    `${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxn(mxnFromCents(c, rate))}`;

  return (
    <section className="account-view" style={{ maxWidth: 760 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Volver al dashboard
      </Link>

      <p className="eyebrow">MI CUENTA · PUMATRADE</p>
      <h1 style={{ fontSize: 29, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Tu cuenta PumaTrade
      </h1>
      <p className="subcopy">
        Datos personales, wallet Stellar y herramientas de demo.
      </p>

      {/* Tarjeta grande: saldo + acciones rápidas */}
      <div className="balance-card" style={{ marginTop: 18 }}>
        <div className="balance-top">
          <span>Saldo XLM</span>
          <WalletCards />
        </div>
        <div className="balance-amount">{fmtBalance}</div>
        <div className="balance-footer">
          <span className="positive">
            <ShieldCheck />
            Wallet lista
          </span>
          <span>
            ⌛ {minorBalance.toFixed(0)}% del fondo de demo usado este mes
          </span>
        </div>
      </div>

      {/* Fila de "stats" — 2 stat-card balanceados */}
      <div className="balance-grid" style={{ marginTop: 22 }}>
        <div className="balance-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--lavender)', color: '#9a86dc' }}>
              <Sparkles />
            </div>
            <div>
              <span>Intercambios totales</span>
              <strong>0</strong>
              <small>Aún no has completado ninguno</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple-bg">
              <ShieldCheck />
            </div>
            <div>
              <span>Identidad verificada</span>
              <strong>ON</strong>
              <small>Stellar testnet · cuenta seed</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow-bg">
              <RotateCw />
            </div>
            <div>
              <span>Sesiones activas</span>
              <strong>1</strong>
              <small>Esta ventana del navegador</small>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de perfil */}
      <div className="profile-panel" style={{ marginTop: 24 }}>
        <span className="avatar large-avatar">{ini}</span>
        <div>
          <h2>{me.displayName}</h2>
          <p>
            <IdCard className="lucide-inline" /> {me.major} · UNAM ·
            <code className="font-mono" style={{ marginLeft: 4 }}>
              {me.id}
            </code>
          </p>
          <span className="account-verified">
            <ShieldCheck />
            Sesión activa
          </span>
        </div>
        <button type="button" className="outline-button" disabled>
          Editar perfil
        </button>
      </div>

      {/* K/V rows detallados */}
      <div
        style={{
          marginTop: 24,
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '8px 18px',
        }}
      >
        <p
          className="eyebrow"
          style={{ paddingTop: 12, paddingBottom: 6 }}
        >
          DETALLES DE LA CUENTA
        </p>
        <div className="account-row">
          <span className="kv-key">
            <Mail
              className="lucide-inline"
              style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'text-bottom' }}
            />
            Correo
          </span>
          <span className="kv-val">{me.email}</span>
        </div>
        <div className="account-row">
          <span className="kv-key">Carrera</span>
          <span className="kv-val">{me.major}</span>
        </div>
        <div className="account-row">
          <span className="kv-key">Saldo actual</span>
          <span className="kv-val">
            {fmtShort(me.balanceXlm)}
          </span>
        </div>
        <div className="account-row">
          <span className="kv-key">ID de usuario</span>
          <code
            className="kv-val font-mono"
            style={{ fontSize: 11 }}
          >
            {me.id}
          </code>
        </div>
      </div>

      {/* Wallet */}
      <div className="wallet-panel" style={{ marginTop: 18 }}>
        <span>
          <WalletCards />
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {(me.pollarWalletId || 'G_PLACEHOLDER…').slice(0, 12)}…
          </strong>
          <small>
            Dirección Stellar (placeholder hasta primer login real con
            Pollar)
          </small>
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

      {/* Demo reset */}
      <div
        className="profile-panel"
        style={{
          marginTop: 24,
          borderColor: '#f4c2ba',
          background: '#fff7f5',
        }}
      >
        <span
          className="avatar large-avatar"
          style={{ background: '#fff0ed', color: 'var(--primary)' }}
        >
          <RotateCw />
        </span>
        <div>
          <h2 style={{ color: 'var(--primary)' }}>Zona de demo</h2>
          <p>
            Resetar a 5 users · 10 listings · 4 offers (seed). Solo
            funciona en dev con <code className="font-mono">ALLOW_RESET_DEMO=true</code>.
          </p>
          <form action="/api/reset-demo" method="POST" style={{ display: 'inline' }}>
            <input type="hidden" name="from_ui" value="1" />
            <button
              type="submit"
              className="sell-button"
              style={{ padding: '9px 14px', fontSize: 11 }}
            >
              <RotateCw />
              Resetear datos demo
            </button>
          </form>
        </div>
      </div>

      {/* Logout */}
      <div style={{ marginTop: 24 }}>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="outline-button"
            style={{ padding: '8px 14px' }}
          >
            <LogOut />
            Cerrar sesión
          </button>
        </form>
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 24, fontSize: 10, fontFamily: 'var(--font-mono)' }}
      >
        PumaTrade · v0.1.0 · Stellar Testnet · Goya-Hack 2026
      </p>
    </section>
  );
}
