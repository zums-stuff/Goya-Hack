// components/auth/DemoLoginPanel.tsx — 5 seed users, click único = login.
//
// Cada fila ES el botón (full-width clickable). Sin emoji, sin arrows
// a la derecha, sin eyebrow ALL CAPS. Avatar = monograma sólido en
// color silencioso.

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type SeedUserRow = {
  email: string;
  displayName: string;
  major: string;
  balanceXlm: number; // centavos
};

function avatarTone(name: string): string {
  // Paleta muteada — sin rojo chillón, sin verde flúor.
  const palette = [
    'bg-slate-800 text-white',
    'bg-stone-700 text-white',
    'bg-zinc-700 text-white',
    'bg-neutral-800 text-white',
    'bg-slate-900 text-white',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length] ?? palette[0]!;
}

function initials(name: string): string {
  const parts = name.replace(/\./g, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

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
      <div className="border-y border-black/10 py-12 text-center">
        <p className="text-sm text-black/55">
          No hay usuarios seed. Corre{' '}
          <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
            npm run db:seed
          </code>{' '}
          primero.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-black/55">
        Cinco cuentas listas para probar el marketplace. Entra como
        cualquiera y empieza.
      </p>
      <ul className="mt-5 border-y border-black/10">
        {users.map((u) => {
          const busy = pendingEmail === u.email;
          return (
            <li key={u.email} className="border-b border-black/10 last:border-b-0">
              <button
                type="button"
                onClick={() => loginAs(u.email)}
                disabled={pendingEmail !== null && !busy}
                className="group flex w-full items-center gap-5 px-2 py-5 text-left transition disabled:opacity-40 enabled:hover:bg-black/[0.025]"
              >
                <span
                  className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-sm font-bold ${avatarTone(u.displayName)}`}
                >
                  {initials(u.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-[#0f1a2e]">
                    {u.displayName}
                  </span>
                  <span className="block text-sm text-black/55">{u.major}</span>
                </span>
                <span className="hidden text-right font-mono text-[11px] text-black/45 sm:block">
                  <span className="block text-[#0f1a2e]">
                    {(u.balanceXlm / 100).toLocaleString('es-MX', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    XLM
                  </span>
                  <span className="block">saldo</span>
                </span>
                <span
                  className={`flex-none font-medium tracking-tight text-[#f4a100] transition ${busy ? 'animate-pulse' : 'group-hover:translate-x-0.5'}`}
                >
                  {busy ? 'Entrando…' : 'Entrar'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}