// app/setup/page.tsx — Guía paso a paso para configurar Pollar (modo dev/prod).
//
// Alojado en su propia ruta, NO en el home: el login del demo no debe
// cargarla. ARCHITECTURE §5.2 es la fuente de verdad del dashboard setup.
import Link from 'next/link';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { PollarSetupGuide } from '@/components/auth/PollarSetupGuide';

export default async function SetupPage() {
  const pollar = computePollarSetupStatus(process.env);

  return (
    <main className="min-h-screen bg-white text-[#0f1a2e]">
      <header className="border-b border-black/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-baseline gap-2 hover:opacity-80"
          >
            <span className="text-xl font-extrabold tracking-tight text-[#f4a100]">
              puma
            </span>
            <span className="text-xl font-extrabold tracking-tight">trade</span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-wider text-black/45">
            setup · pollar
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
        <p className="text-sm font-medium uppercase tracking-wider text-black/45">
          Configuración
        </p>
        <h1 className="mt-2 text-[clamp(2rem,5vw,3.25rem)] font-black tracking-[-0.03em] leading-[1.05]">
          Pegar las keys de{' '}
          <span className="text-[#f4a100]">Pollar</span>
          {' '}en <code className="font-mono">.env.local</code>.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-black/65">
          PumaTrade usa las wallets embebidas de Pollar. Para que el
          login funcione en un navegador de usuario real (no en el modo
          dev-login), hay que crear dos apps en su dashboard y pegar
          las keys aquí.
        </p>

        <div className="mt-10">
          <PollarSetupGuide status={pollar} />
        </div>

        <div className="mt-12 border-t border-black/10 pt-6 text-sm text-black/55">
          <Link
            href="/"
            className="text-[#0f1a2e] underline decoration-2 underline-offset-4 hover:bg-[#f4a100]"
          >
            ← Volver al login
          </Link>
        </div>
      </section>
    </main>
  );
}