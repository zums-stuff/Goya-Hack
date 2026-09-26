// components/auth/DemoLoginPanel.tsx — Login como uno de los 5 seed users.
//
// Único click por user → POST /api/auth/dev-login → cookie → /home.
// Recibe la lista como prop desde page.tsx (server) para un primer paint
// instantáneo (sin fetch ni flash). El endpoint /api/auth/dev-users sigue
// existiendo para tests y otros consumidores.
//
// Solo se renderiza cuando DEV_LOGIN_ENABLED=true y NODE_ENV !== production.

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type SeedUserRow = {
  email: string;
  displayName: string;
  major: string;
  balanceXlm: number; // centavos
};

function avatarColor(name: string): string {
  const palette = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-fuchsia-500',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length] ?? 'bg-slate-500';
}

function initials(name: string): string {
  const parts = name.replace(/\./g, '').trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
}

export function DemoLoginPanel({ users }: { users: SeedUserRow[] }) {
  const router = useRouter();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function loginAs(email: string) {
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No hay seed users. Corre{' '}
        <code className="rounded bg-amber-100 px-1 font-mono">npm run db:seed</code>{' '}
        primero.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_4px_30px_-12px_rgba(15,23,42,0.18)]">
      <ul className="divide-y divide-slate-100">
        {users.map((u) => {
          const busy = pendingEmail === u.email;
          const disabled = pendingEmail !== null && !busy;
          return (
            <li key={u.email} className="p-2">
              <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <div
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${avatarColor(u.displayName)}`}
                >
                  {initials(u.displayName).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {u.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{u.major}</p>
                </div>
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-mono text-slate-700">
                    {(u.balanceXlm / 100).toLocaleString('es-MX', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    XLM
                  </p>
                  <p className="text-slate-400">saldo inicial</p>
                </div>
                <button
                  onClick={() => loginAs(u.email)}
                  disabled={disabled}
                  className="flex-none rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {busy ? 'Entrando…' : 'Entrar →'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="mt-2 px-3 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}