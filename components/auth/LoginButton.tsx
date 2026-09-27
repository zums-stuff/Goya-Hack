// components/auth/LoginButton.tsx — Botón de login real con Pollar.
//
// Por qué este componente existía solo en ARCHITECTURE:
//   - El provider Pollar maneja el modal (Google / email OTP / passkey).
//   - Cuando la sesión Pollar queda `verified=true`, tenemos una wallet
//     Stellar con un G-address estable por usuario. Ese G-address + email
//     + displayName llegan a `/api/auth/sync`, que binding-wallet-once
//     con nuestro modelo `User` y setea el cookie HMAC.
//
// ⚠️ El botón solo debe renderizarse cuando `!needsSetup` (keys reales del
// dashboard de Pollar). Si las keys son placeholders, el SDK de Pollar hace
// fetch sobre api.pollar.xyz → 403 API_KEY_TYPE_NOT_ALLOWED → modal mostrando
// "Could not load sign-in options". El gating vive en app/page.tsx.
//
// UI: hereda `.sell-button` (coral pill, hover a `--primary-dark`,
// box-shadow coral sutil) — el mismo lenguaje que el resto del app shell.

'use client';

import { useEffect, useRef, useState } from 'react';
import { LogIn, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { usePollar } from '@pollar/react';

type Status =
  | 'idle'
  | 'authenticating' // modal abierto
  | 'syncing'        // post-login, llamando /api/auth/sync
  | 'error';

export function LoginButton() {
  const {
    openLoginModal,
    isAuthenticated,
    verified,
    wallet,
    wallets,
    getClient,
    logout,
  } = usePollar();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  // Run the sync side-effect exactly once per verified session; reset on
  // error so a transient failure retries without spamming.
  const fired = useRef(false);

  // Pick the Stellar wallet specifically — Pollar supports multi-chain and
  // Gremium is Stellar-only. /api/auth/sync validates the address as
  // /^G[A-Z0-9]{55}$/, so a non-Stellar would 422.
  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ??
    wallet?.address ??
    null;

  useEffect(() => {
    if (fired.current) return;
    if (!isAuthenticated || !verified) return;
    if (!stellarAddress || !stellarAddress.startsWith('G')) return;
    fired.current = true;
    void runSync(stellarAddress);
  }, [isAuthenticated, verified, stellarAddress, getClient]);

  async function runSync(address: string) {
    setStatus('syncing');
    try {
      const client = getClient();
      let mail: string | undefined;
      let displayName: string;
      try {
        const profile = client.getUserProfile();
        mail = profile?.mail;
        const fn = profile?.first_name?.trim() ?? '';
        const ln = profile?.last_name?.trim() ?? '';
        displayName = [fn, ln].filter(Boolean).join(' ');
        if (!displayName)
          displayName = mail?.split('@')[0] ?? `user_${address.slice(0, 6)}`;
      } catch {
        mail = undefined;
        displayName = `user_${address.slice(0, 6)}`;
      }

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollarWalletId: address,
          email: mail ?? `${address.slice(0, 12)}@stellar.local`,
          displayName,
        }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      // Cookie set by server; reload so server-rendered pages read it.
      window.location.assign('/home');
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
      fired.current = false; // allow retry on next verify event
    }
  }

  // Verified wallet bound — render a quiet "vinculando…" pill in the same
  // slot (so the layout doesn't jump). The reload to /home takes over from
  // here once /api/auth/sync succeeds.
  if (isAuthenticated && wallet?.address && status !== 'error') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          padding: '12px 17px',
          background: 'var(--mint)',
          border: '1px solid #b9e2d0',
          borderRadius: 8,
          color: '#2c6b56',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <ShieldCheck style={{ width: 14, height: 14, color: '#49a98d' }} />
        <span
          style={{
            fontFamily:
              'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 12,
          }}
        >
          {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
        </span>
        {status === 'syncing' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.75 }}>
            vinculando…
          </span>
        )}
      </div>
    );
  }

  // Pre-click, error, or just-verified-but-error: the primary CTA.
  const label =
    status === 'authenticating'
      ? 'Abriendo Pollar…'
      : 'Continuar con Pollar';

  return (
    <>
      <button
        type="button"
        className="sell-button prelogin-cta"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={status === 'authenticating'}
        onClick={() => {
          setStatus('authenticating');
          setError(null);
          try {
            openLoginModal();
          } catch (e) {
            setStatus('error');
            setError((e as Error).message);
          }
        }}
      >
        {status === 'authenticating' ? (
          <Sparkles style={{ width: 16, height: 16 }} />
        ) : (
          <LogIn style={{ width: 16, height: 16 }} />
        )}
        {label}
      </button>
      {status === 'error' && (
        <div
          className="form-error prelogin-cta"
          style={{ marginTop: 10 }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setError(null);
              logout();
            }}
            style={{
              border: 0,
              background: 'transparent',
              color: '#c45f4e',
              fontWeight: 700,
              fontSize: 10,
              cursor: 'pointer',
              padding: '4px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw style={{ width: 11, height: 11 }} />
            reintentar
          </button>
        </div>
      )}
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 11,
          color: '#94a0b0',
          textAlign: 'center',
          letterSpacing: 0.2,
        }}
      >
        Google · email · passkey &middot; wallet Stellar embebida
      </p>
    </>
  );
}
