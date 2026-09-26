// components/auth/DemoLoginPanel.tsx — Login como uno de los 5 seed users.
//
// Sistema visual del frontend example: cada fila es `.profile-row` con
// `.avatar` (32px monograma), `.profile-copy`, saldo alineado y chevron.
// Sin arrows text, sin emojis, sin eyebrow caps — coherente con el resto.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, AlertCircle } from 'lucide-react';

export type SeedUserRow = {
  email: string;
  displayName: string;
  major: string;
  balanceXlm: number; // centavos
};

function initials(name: string): string {
  const parts = name.replace(/\./g, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function fmtMoney(cents: number): string {
  return (cents / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 });
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
      <div className="border border-dashed border-[var(--line)] rounded-xl p-4 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-[var(--muted)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          No hay seed users. Corre{' '}
          <code className="rounded bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[11px]">
            npm run db:seed
          </code>{' '}
          primero.
        </p>
      </div>
    );
  }

  return (
    <ul className="-mx-2 mt-2">
      {users.map((u) => {
        const busy = pendingEmail === u.email;
        const disabled = pendingEmail !== null && !busy;
        return (
          <li key={u.email} className="border-b border-[var(--line)] last:border-b-0">
            <button
              type="button"
              onClick={() => loginAs(u.email)}
              disabled={disabled}
              className="profile-row disabled:opacity-40 enabled:hover:bg-[#fff7f5]"
              style={{ borderTop: 0, paddingTop: 13, paddingBottom: 13 }}
            >
              <div className="avatar">{initials(u.displayName)}</div>
              <div className="profile-copy">
                <strong className={busy ? 'animate-pulse' : ''}>
                  {u.displayName}
                </strong>
                <small>{u.major}</small>
              </div>
              <div
                className="profile-copy"
                style={{ textAlign: 'right', flex: 'none', minWidth: 70 }}
              >
                <strong className="font-mono">
                  P$ {fmtMoney(u.balanceXlm)}
                </strong>
                <small>XLM</small>
              </div>
              <span
                className={
                  busy
                    ? 'text-[var(--primary)]'
                    : 'text-[#a4adba] group-hover:text-[var(--primary)]'
                }
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {busy ? <span style={{ fontSize: 9 }}>…</span> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>
          </li>
        );
      })}
      {error && (
        <li className="border-b border-[var(--line)] border-t-0">
          <p className="text-xs text-[var(--primary)] px-2 py-3">{error}</p>
        </li>
      )}
    </ul>
  );
}