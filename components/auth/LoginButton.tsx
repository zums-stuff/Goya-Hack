// components/auth/LoginButton.tsx — Login 100% vía UI nativa de Pollar.
//
// Flujo (§9.4):
//   1. El usuario toca "Iniciar sesión" → abre el MODAL nativo de Pollar
//      (`openLoginModal()`): Google y email-OTP, estilizado desde el
//      dashboard (theme/accentColor/logo personalizados en dashboard.pollar.xyz).
//   2. Pollar autentica → `isAuthenticated` + `wallet` disponibles.
//   3. POST /api/auth/sync { pollarWalletId, email, displayName } → crea/actualiza
//      User + fundea wallet seed + setea cookie de sesión.
//   4. Tras sincronizar, se muestra el `WalletButton` de Pollar (saldo, send,
//      historial, logout) en vez de un botón custom.
//
// NUNCA re-implementamos botones de login a mano — la UI la da Pollar.
// Esta pantalla solo orquesta: abrir el modal y sincronizar al backend.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePollar, WalletButton } from '@pollar/react';

type AuthState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'authenticated'; email: string; address: string }
  | { kind: 'error'; message: string };

/** Una key de Pollar real viene del dashboard (prefijo pub_ y sin xxxx). */
function pollarKeyIsReal(): boolean {
  const k = process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY ?? '';
  return k.startsWith('pub_') && !/xxxx/i.test(k);
}

export function LoginButton() {
  const router = useRouter();
  const { wallet, isAuthenticated, openLoginModal, configStatus, getClient } = usePollar();
  const [state, setState] = useState<AuthState>({ kind: 'idle' });
  const syncedAddress = useRef<string | null>(null);

  const keyIsReal = useMemo(pollarKeyIsReal, []);

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
        syncedAddress.current = null; // permitir reintento si falla
        if (!cancelled) {
          setState({ kind: 'error', message: (e as Error).message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, wallet, router]);

  // ── Keys de Pollar no configuradas ───────────────────────────────────
  if (!keyIsReal) {
    return (
      <div
        data-testid="login-button"
        className="w-full max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900"
      >
        <p className="font-semibold">⚠️ Pollar no está configurado todavía</p>
        <p className="mt-2 leading-relaxed">
          El login usa las wallets de <strong>Pollar</strong>, pero las keys del
          dashboard no están en <code className="rounded bg-amber-100 px-1">.env.local</code>.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>
            Crea las 2 apps en{' '}
            <span className="font-mono">dashboard.pollar.xyz</span> (Usuarios:
            Google + email OTP; Operacional: server-only).
          </li>
          <li>
            Pega en <code className="rounded bg-amber-100 px-1">.env.local</code>:
            <code className="mt-1 block rounded bg-amber-100 px-1 font-mono text-[11px]">
              NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=pub_testnet_users_…
            </code>
            <code className="mt-1 block rounded bg-amber-100 px-1 font-mono text-[11px]">
              POLLAR_USERS_SECRET_KEY=sec_testnet_users_…
            </code>
            <code className="mt-1 block rounded bg-amber-100 px-1 font-mono text-[11px]">
              POLLAR_OPS_SECRET_KEY=sec_testnet_ops_…
            </code>
          </li>
          <li>Reinicia <code className="rounded bg-amber-100 px-1">npm run dev</code>.</li>
        </ol>
      </div>
    );
  }

  // ── Sesión activa: wallet nativa de Pollar ───────────────────────────
  if (state.kind === 'authenticated') {
    return (
      <div data-testid="login-button" className="flex flex-col items-center gap-3 w-full max-w-sm">
        <p className="text-sm text-gray-600">
          Sesión activa — <span className="font-mono text-xs">{state.email}</span>
        </p>
        <WalletButton />
      </div>
    );
  }

  // ── Idle / syncing ───────────────────────────────────────────────────
  const busy = state.kind === 'syncing' || configStatus === 'loading';
  return (
    <div data-testid="login-button" className="flex flex-col items-center gap-2 w-full max-w-sm">
      <button
        onClick={openLoginModal}
        disabled={busy}
        className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-base font-semibold text-[var(--color-primary-foreground)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {state.kind === 'syncing' ? 'Conectando tu wallet…' : configStatus === 'loading' ? 'Cargando Pollar…' : 'Iniciar sesión con Pollar'}
      </button>
      <p className="text-xs text-gray-500">
        Google o código por email · Wallet Stellar segura, sin seed phrases
      </p>

      {state.kind === 'error' && (
        <p className="text-xs text-red-600 text-center">{state.message}</p>
      )}
    </div>
  );
}