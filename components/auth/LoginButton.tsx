// components/auth/LoginButton.tsx — Botón de login real con Pollar.
//
// Por qué este componente existía solo en ARCHITECTURE:
//   - El provider Pollar maneja el modal (Google / email OTP / passkey).
//   - Cuando la sesión Pollar queda `verified=true`, tenemos una wallet
//     Stellar con un G-address estable por usuario. Ese G-address + email
//     + displayName llegan a `/api/auth/sync`, que binding-wallet-once
//     con nuestro modelo `User` y setea el cookie HMAC. Sin esto, nadie
//     puede loguearse más allá de dev-login.
//
// El componente está cableado para devolver un error suave cuando las keys
// de Pollar son placeholders (Pollar rechaza la API): el ÚNICO camino
// con placeholders sigue siendo dev-login, pero el botón en sí es visible
// para que el demo muestre dónde va la pieza cuando las keys se rotan.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, CircleAlert } from 'lucide-react';
import { usePollar } from '@pollar/react';

type Status =
  | 'idle'           // pre-login (modal still open or not yet opened)
  | 'authenticating' // Pollar modal working
  | 'syncing'        // post-login, calling /api/auth/sync
  | 'success'        // synced; about to reload
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
  // Run the sync side-effect exactly once per verified session; reset on error
  // so a transient failure (e.g. Horizon) gets a retry without spamming.
  const fired = useRef(false);

  // Pick the Stellar wallet specifically — Pollar supports multi-chain and
  // PumaTrade is Stellar-only. The /api/auth/sync route also validates the
  // address as /^G[A-Z0-9]{55}$/, so a non-Stellar wallet would 422.
  const stellarAddress =
    wallets.find((w) => w.chain === 'STELLAR')?.address ?? wallet?.address ?? null;

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
        const firstName = profile?.first_name?.trim() ?? '';
        const lastName = profile?.last_name?.trim() ?? '';
        displayName = [firstName, lastName].filter(Boolean).join(' ');
        if (!displayName) displayName = mail?.split('@')[0] ?? `user_${address.slice(0, 6)}`;
      } catch {
        // Pollar didn't surface a profile (e.g., external wallet signed in
        // without an associated social account). Fall back to synthetic identifiers.
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
      setStatus('success');
      // Reload so server-rendered pages (and tryGetUser) re-read the new cookie.
      window.location.assign('/home');
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
      fired.current = false; // allow retry on the next verify event
    }
  }

  // Post-login (Pollar done with auth, we are mid-sync or errored)
  if (isAuthenticated && wallet?.address) {
    const short = `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
            <Wallet className="w-3.5 h-3.5" />
            Pollar · {short}
          </span>
          {status === 'syncing' && (
            <span className="text-[var(--primary)] text-[11px] animate-pulse">
              Sincronizando con PumaTrade…
            </span>
          )}
        </div>
        {status === 'error' && (
          <div className="flex items-center gap-2 text-[11px]">
            <CircleAlert className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span className="text-[var(--primary)] truncate">{error}</span>
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setError(null);
                fired.current = false;
                logout();
              }}
              className="underline text-[var(--ink)]"
            >
              reintentar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
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
        className="sell-button"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '14px 18px',
        }}
      >
        <Wallet className="w-4 h-4 mr-1.5" />
        Continuar con Pollar
      </button>
      {status === 'authenticating' && (
        <p className="text-[10px] text-[var(--muted)] text-center animate-pulse">
          Sigue el modal de Pollar …
        </p>
      )}
      {status === 'error' && (
        <p className="text-[10px] text-[var(--primary)] text-center">{error}</p>
      )}
      <p className="text-[10px] text-[var(--muted)] text-center leading-snug">
        Google, email o passkey. Wallet embebida — sin seed phrases.
      </p>
    </div>
  );
}
