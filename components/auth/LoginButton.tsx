// components/auth/LoginButton.tsx — Placeholder Bloque 1.
// Implementación completa en §9.4 / §8.3 del ARCHITECTURE.
// Esta versión solo confirma el wiring PollarProvider → usePollar().

'use client';

import { usePollar } from '@pollar/react';

export function LoginButton() {
  const { login, isAuthenticated, wallet, logout } = usePollar();

  if (isAuthenticated && wallet) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Sesión activa: <span className="font-mono">{wallet.address.slice(0, 8)}…</span>
        </p>
        <button
          onClick={() => logout()}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <button
        onClick={() => login({ provider: 'google' })}
        className="bg-blue-600 text-white py-3 rounded-xl font-semibold"
      >
        🔵 Continuar con Google
      </button>
      <p className="text-xs text-gray-500 text-center mt-4">
        Implementación completa: <code>ARCHITECTURE.md §9.4</code>
      </p>
    </div>
  );
}
