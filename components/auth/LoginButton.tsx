// components/auth/LoginButton.tsx — Login completo (Google + Email OTP para seeds).
//
// Flujo (§9.4):
//   1. Click "Continuar con Google" o envío de OTP por email.
//   2. Pollar hace login → devuelve wallet.address + (si la sesión lo trae) email/displayName.
//   3. Si falta email (versión sin user en wallet), fallback a client.getUserProfile().
//   4. POST /api/auth/sync { pollarWalletId, email, displayName } → crea/actualiza User
//      + fundea la wallet con saldo seed (solo en primer login del seed) + setea cookie.
//   5. router.refresh() → el server component re-renderiza con sesión activa.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePollar } from '@pollar/react';

type AuthState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'authenticated'; email: string; address: string }
  | { kind: 'error'; message: string };

export function LoginButton() {
  const router = useRouter();
  const { login, logout, isAuthenticated, wallet, getClient } = usePollar();
  const [otpEmail, setOtpEmail] = useState('');
  const [state, setState] = useState<AuthState>({ kind: 'idle' });

  // Logout (cliente limpia; backend debe invalidar cookie via /api/auth/logout).
  useEffect(() => {
    if (isAuthenticated && wallet) {
      void runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, wallet?.address]);

  async function runSync() {
    if (!wallet) return;
    setState({ kind: 'loading' });
    try {
      let email = (wallet.user as { email?: string } | undefined)?.email;
      let displayName =
        (wallet.user as { name?: string; email?: string } | undefined)?.name ?? email;

      // ⚠️ @pollar/react 0.11.3: wallet.user puede venir vacío. Fallback a client.
      if (!email) {
        try {
          const profile = await getClient().getUserProfile();
          email = (profile as { email?: string } | null)?.email;
          displayName =
            (profile as { name?: string; email?: string } | null)?.name ?? email;
        } catch {
          /* Pollar no expone user → reintento en el próximo render */
          setState({ kind: 'idle' });
          return;
        }
      }

      if (!email) {
        setState({ kind: 'idle' });
        return;
      }

      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollarWalletId: wallet.address,
          email,
          displayName: displayName ?? email,
        }),
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Sync failed');
      }
      setState({ kind: 'authenticated', email, address: wallet.address });
      router.refresh();
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  async function handleGoogle() {
    try {
      setState({ kind: 'loading' });
      await login({ provider: 'google' });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  async function handleEmailOtp() {
    if (!otpEmail) return;
    try {
      setState({ kind: 'loading' });
      await login({ provider: 'email', email: otpEmail });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  async function handleLogout() {
    try {
      await logout();
      await fetch('/api/auth/logout', { method: 'POST' });
      setState({ kind: 'idle' });
      router.refresh();
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  if (state.kind === 'authenticated') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-gray-700">
          Sesión activa — <span className="font-mono text-xs">{state.email}</span>
        </p>
        <p className="text-xs text-gray-500 font-mono">
          {state.address.slice(0, 8)}…{state.address.slice(-4)}
        </p>
        <button
          onClick={handleLogout}
          className="bg-gray-700 text-white px-4 py-2 rounded-xl"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm" data-testid="login-button">
      <button
        onClick={handleGoogle}
        disabled={state.kind === 'loading'}
        className="bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
      >
        🔵 Continuar con Google
      </button>

      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-gray-500">¿Eres usuario seed? Entra con tu email:</p>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="maria.pumatrade+seed1@mail.tm"
          value={otpEmail}
          onChange={(e) => setOtpEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <button
          onClick={handleEmailOtp}
          disabled={state.kind === 'loading' || !otpEmail}
          className="w-full bg-gray-700 text-white py-2 rounded disabled:opacity-50"
        >
          ✉️ Enviar código por email
        </button>
      </div>

      {state.kind === 'error' && (
        <p className="text-xs text-red-600 text-center">{state.message}</p>
      )}
    </div>
  );
}
