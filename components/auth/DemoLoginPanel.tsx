// components/auth/DemoLoginPanel.tsx — Login de seed users al estilo Wallapop.
//
// Cada fila: indicador numerado amarillo (común en marketplaces), nombre +
// carrera, saldo a la derecha, botón amarillo negro de "Entrar".

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type SeedUserRow = {
  email: string;
  displayName: string;
  major: string;
  balanceXlm: number; // centavos
};

export function DemoLoginPanel({ users }: { users: SeedUserRow[] }) {
  const router = useRouter();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function loginAs(email: string) {
    if (pendingEmail) return;
    setError(null);
    setPendingEmail(email);
    (async () => {
      try {
        const res = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status}`);
        }
        startTransition(() => router.push('/home'));
      } catch (e) {
        setError((e as Error).message);
        setPendingEmail(null);
      }
    })();
  }

  if (users.length === 0) {
    return (
      <div className="border-2 border-black bg-[#FAFAFA] p-6 text-center">
        <p className="text-sm text-black/70">
          No hay seed users. Corre{' '}
          <code className="rounded bg-black px-2 py-0.5 font-mono text-xs text-white">
            npm run db:seed
          </code>{' '}
          primero.
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black bg-white">
      <div className="border-b-2 border-black bg-[#FFE600] px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-black/70">
          Demo de la UNAM
        </p>
        <p className="mt-1 text-xl font-extrabold leading-tight sm:text-2xl">
          Entra como uno de los 5 estudiantes.
        </p>
      </div>
      <ul>
        {users.map((u, i) => {
          const busy = pendingEmail === u.email;
          const label = String(i + 1).padStart(2, '0');
          return (
            <li
              key={u.email}
              className="border-b border-black/10 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => loginAs(u.email)}
                disabled={pendingEmail !== null && !busy}
                className="group flex w-full items-center gap-4 px-4 py-4 text-left transition disabled:opacity-40 enabled:hover:bg-[#FFF8C5]"
              >
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-md bg-[#FFE600] text-2xl font-black text-black ring-1 ring-black/15">
                  {label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-tight text-black">
                    {u.displayName}
                  </span>
                  <span className="block truncate text-sm text-black/60">
                    {u.major}
                  </span>
                </span>
                <span className="hidden text-right font-mono text-xs text-black/60 sm:block">
                  <span className="block text-base font-bold text-black">
                    {(u.balanceXlm / 100).toLocaleString('es-MX', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="block">XLM</span>
                </span>
                <span
                  className={`flex-none rounded-md px-4 py-2 text-sm font-bold transition ${
                    busy
                      ? 'bg-black/10 text-black/60'
                      : 'bg-black text-[#FFE600] group-hover:bg-[#FFE600] group-hover:text-black'
                  }`}
                >
                  {busy ? 'Entrando…' : 'Entrar'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="border-t-2 border-black bg-[#FFE6E6] px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}