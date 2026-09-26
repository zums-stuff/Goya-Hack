// app/page.tsx — Landing + login: hero del marketplace + panel de acceso.
//
// Dos caminos según el entorno:
//   • devLogin=true (DEV_LOGIN_ENABLED) → panel con los 5 seed users (1 click c/u).
//   • Pollar real (publishable configurada) → botón nativo de Pollar (modal).
//   • Si ninguno funciona, se muestra paso a paso para configurar Pollar.

import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers } from '@/lib/seed-data';
import { LoginButton } from '@/components/auth/LoginButton';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';
import { PollarSetupGuide } from '@/components/auth/PollarSetupGuide';

const PILLARS = [
  { icon: '⇄', label: 'Trueque, saldo o híbrido' },
  { icon: '🛡', label: 'Escrow Stellar 2-de-2' },
  { icon: '👛', label: 'Wallet Pollar sin seed phrases' },
];

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  const devLogin = isDevLoginAvailable();
  const pollar = computePollarSetupStatus(process.env);

  const seedRows: SeedUserRow[] = devLogin
    ? seedUsers
        .map((u) => ({
          email: u.email,
          displayName: u.displayName,
          major: u.major,
          balanceXlm: u.balanceXlm,
        }))
        .sort((a, b) => b.balanceXlm - a.balanceXlm)
    : [];

  const pollarDisabledReason = pollar.needsSetup
    ? devLogin
      ? 'Configura Pollar abajo si quieres crear una cuenta propia'
      : null
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fefaf3] text-slate-900">
      {/* Fondo: glows suaves + grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(40rem 30rem at 0% 0%, oklch(95% 0.05 70 / 0.6), transparent 60%), radial-gradient(40rem 30rem at 100% 100%, oklch(94% 0.06 270 / 0.55), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, black 50%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, black 50%, transparent 100%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-5 py-12 sm:py-16">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_10px_30px_-8px_rgba(244,114,182,0.5)]">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-white"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 3c-1.7 0-3 1.3-3 3 0 1.8 2.1 3.2 3 4 .9-.8 3-2.2 3-4 0-1.7-1.3-3-3-3ZM7 10c-1.5.9-2.6 2.4-2.6 4.3 0 1.2.9 2.2 2 2.1.4-.1.7-.3 1-.6.6-.5 1.1-1.4 1.1-2.5 0-1.4.3-2.6 1-3.6-.8-.6-1.7-.9-2.5-.7Zm10 0c-.8-.2-1.7.1-2.5.7.7 1 1 2.2 1 3.6 0 1.1.5 2 1.1 2.5.3.3.6.5 1 .6 1.1.1 2-.9 2-2.1 0-1.9-1.1-3.4-2.6-4.3Zm-5 3.5c-1.6 1.4-3.5 1.9-4.9 3.6-.7.9-.9 2.2-.3 3.3.6 1.1 1.7 1.6 2.8 1.2.7-.3 1.2-.9 1.6-1.6.5-.9 1.1-1.4 2.3-1.4s1.8.5 2.3 1.4c.4.7.9 1.3 1.6 1.6 1.1.4 2.2-.1 2.8-1.2.6-1.1.4-2.4-.3-3.3-1.4-1.7-3.3-2.2-4.9-3.6Z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              PumaTrade
            </h1>
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg">
              Vende, cambia o truequea materiales con tu comunidad
              universitaria.{' '}
              <span className="text-slate-500">
                Tu dinero queda protegido hasta que recibas el artículo.
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PILLARS.map((p) => (
              <span
                key={p.label}
                className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur"
              >
                <span className="mr-1.5">{p.icon}</span>
                {p.label}
              </span>
            ))}
          </div>
        </header>

        {/* ── Acceso ────────────────────────────────────────────── */}
        <section className="mt-10 w-full max-w-xl">
          {/* Titulado "Acceder" */}
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Acceder al marketplace
          </p>

          {/* Login principal */}
          {devLogin ? (
            <DemoLoginPanel users={seedRows} />
          ) : (
            pollar.needsSetup ? null : <LoginButton />
          )}

          {/* Cuando no hay devLogin y Pollar tampoco → guía full-width */}
          {!devLogin && pollar.needsSetup && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-2 shadow-sm">
              <PollarSetupGuide status={pollar} />
            </div>
          )}

          {/* Separador + opción Pollar cuando hay demo */}
          {devLogin && (
            <>
              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                o entrar con tu cuenta
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-center shadow-sm">
                <LoginButton disabledReason={pollarDisabledReason ?? undefined} />
              </div>
            </>
          )}
        </section>

        {/* ── Disclosure Pollar (cuando hay demo y Pollar sin configurar) */}
        {devLogin && pollar.needsSetup && (
          <details className="mt-6 w-full max-w-xl rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-600 shadow-sm open:shadow-md">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-slate-500">
              ¿Quieres crear una cuenta propia? Configurar Pollar
            </summary>
            <div className="mt-4">
              <PollarSetupGuide status={pollar} />
            </div>
          </details>
        )}

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="mt-10 text-center text-[11px] text-slate-400">
          Wallets embebidas por{' '}
          <span className="font-medium text-slate-500">Pollar</span> · Red
          Stellar testnet · Sin tokens propios · Goya-Hack 2026
        </footer>
      </div>
    </main>
  );
}