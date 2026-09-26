// app/page.tsx — Pantalla de login: landing oscura premium + CTA nativo de Pollar.
//
// - Si ya hay sesión → /home.
// - Si las keys de Pollar no están configuradas, se muestra debajo una guía
//   con el estado exacto de cada key (✓/⚠/✗) y las líneas .env.local copiables.
//   Así nunca hay una pantalla "rota": o el login funciona, o dice qué falta.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { LoginButton } from '@/components/auth/LoginButton';
import { PollarSetupGuide } from '@/components/auth/PollarSetupGuide';

const FEATURES = [
  { icon: '⇄', label: 'Trueque, saldo o híbrido' },
  { icon: '🛡', label: 'Escrow Stellar 2-de-2' },
  { icon: '👛', label: 'Wallet Pollar sin seed phrases' },
];

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  const pollar = computePollarSetupStatus(process.env);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1120] text-white">
      {/* Decoración de fondo: rejilla sutil + dos glows de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 90% 70% at 50% 0%, black 55%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 0%, black 55%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'oklch(62% 0.14 250)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-violet-500 opacity-10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-10 px-6 py-16">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="flex w-full flex-col items-center gap-8">
          <header className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 shadow-[0_10px_30px_-8px_rgba(59,130,246,0.6)]">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 text-white"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 3c-1.7 0-3 1.3-3 3 0 1.8 2.1 3.2 3 4 .9-.8 3-2.2 3-4 0-1.7-1.3-3-3-3ZM7 10c-1.5.9-2.6 2.4-2.6 4.3 0 1.2.9 2.2 2 2.1.4-.1.7-.3 1-.6.6-.5 1.1-1.4 1.1-2.5 0-1.4.3-2.6 1-3.6-.8-.6-1.7-.9-2.5-.7Zm10 0c-.8-.2-1.7.1-2.5.7.7 1 1 2.2 1 3.6 0 1.1.5 2 1.1 2.5.3.3.6.5 1 .6 1.1.1 2-.9 2-2.1 0-1.9-1.1-3.4-2.6-4.3Zm-5 3.5c-1.6 1.4-3.5 1.9-4.9 3.6-.7.9-.9 2.2-.3 3.3.6 1.1 1.7 1.6 2.8 1.2.7-.3 1.2-.9 1.6-1.6.5-.9 1.1-1.4 2.3-1.4s1.8.5 2.3 1.4c.4.7.9 1.3 1.6 1.6 1.1.4 2.2-.1 2.8-1.2.6-1.1.4-2.4-.3-3.3-1.4-1.7-3.3-2.2-4.9-3.6Z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-4xl font-bold tracking-tight">PumaTrade</h1>
              <p className="text-slate-400">
                Marketplace P2P estudiantil — Goya-Hack 2026
              </p>
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {FEATURES.map((f) => (
              <span
                key={f.label}
                className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300"
              >
                <span className="mr-1.5">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>

          <div className="w-full max-w-sm">
            <LoginButton needsSetup={pollar.needsSetup} />
          </div>

          <p className="text-xs text-slate-500">
            Wallets embebidas por <span className="text-slate-400">Pollar</span> · Red
            Stellar testnet · Sin tokens propios
          </p>
        </section>

        {/* ── Guía de configuración (solo cuando faltan keys) ──── */}
        {pollar.needsSetup && <PollarSetupGuide status={pollar} />}
      </div>
    </main>
  );
}