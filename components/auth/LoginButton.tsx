// components/auth/LoginButton.tsx — CTA que abre el modal nativo de Pollar.
//
// Cuando está deshabilitado (por env faltante), muestra el motivo como texto
// de ayuda. La sesión activa renderiza el WalletButton de Pollar (saldo/send/
// logout). Sin sesión: dispara openLoginModal().

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePollar, WalletButton } from '@pollar/react';

type AuthState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'authenticated'; email: string; address: string }
  | { kind: 'error'; message: string };

type Props = { disabledReason?: string };

export function LoginButton({ disabledReason }: Props) {
  const router = useRouter();
  const { wallet, isAuthenticated, openLoginModal, configStatus, getClient } = usePollar();
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  const syncedAddress = useRef<string | null>(null);
  const disabled = disabledReason != null;

  // Sincroniza al backend cuando Pollar confirma la sesión.
  useEffect(() => {
    if (!isAuthenticated || !wallet) return;
    if (syncedAddress.current === wallet.address) return;
    syncedAddress.current = wallet.address;

    let cancelled = false;
    setState({ kind: 'syncing' });
    (async () => {
      try {
        // ⚠️ @pollar/react 0.11.3: wallet no expone `user`; el perfil se lee
        // con getUserProfile() en el cliente de Pollar.
        const profile = (await getClient().getUserProfile()) as
          | { email?: string; name?: string }
          | null
          | undefined;
        const email = profile?.email ?? '';
        const displayName = profile?.name ?? profile?.email ?? '';

        if (!email) {
          if (!cancelled) setState({ kind: 'idle' });
          return;
        }

        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pollarWalletId: wallet.address,
            email,
            displayName: displayName || email,
          }),
        });
        if (!res.ok) {
          const err: { message?: string } = await res.json().catch(() => ({}));
          throw new Error(err.message ?? 'Sync failed');
        }
        if (!cancelled) {
          setState({ kind: 'authenticated', email, address: wallet.address });
          router.refresh();
        }
      } catch (e) {
        syncedAddress.current = null;
        if (!cancelled) {
          setState({ kind: 'error', message: (e as Error).message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, wallet, router]);

  // ── Sesión activa ───────────────────────────────────────────────────
  if (state.kind === 'authenticated') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-slate-500">
          Sesión activa — <span className="font-mono">{state.email}</span>
        </p>
        <WalletButton />
      </div>
    );
  }

  const busy = state.kind === 'syncing' || configStatus === 'loading';

  // ── Botón principal ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={openLoginModal}
        disabled={disabled || busy}
        className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {state.kind === 'syncing'
          ? 'Conectando…'
          : configStatus === 'loading'
            ? 'Cargando Pollar…'
            : 'Iniciar sesión con Pollar'}
      </button>
      {disabledReason ? (
        <p className="text-[11px] text-slate-500">{disabledReason}</p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Google o email · Wallet Stellar segura, sin seed phrases
        </p>
      )}
      {state.kind === 'error' && (
        <p className="text-[11px] text-rose-600">{state.message}</p>
      )}
    </div>
  );
}