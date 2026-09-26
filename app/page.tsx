// app/page.tsx — Pantalla de login / selección de identidad.
//
// 3 zonas (NO 7): barra superior · hero · panel de acceso.
// Sujeto: marketplace universitario UNAM. Acento único: oro UNAM en wordmark.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers } from '@/lib/seed-data';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';

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
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
    : [];

  return (
    <main className="min-h-screen bg-white text-[#0f1a2e]">
      {/* ── 1. Barra superior ────────────────────────────────── */}
      <header className="border-b border-black/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold tracking-tight text-[#f4a100]">
              puma
            </span>
            <span className="text-xl font-extrabold tracking-tight">trade</span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-black/45">
            goya-hack · 2026
          </span>
        </div>
      </header>

      {/* ── 2. Hero ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-24 sm:pb-14">
        <h1 className="max-w-4xl text-balance text-[clamp(2.75rem,7vw,5.5rem)] font-black tracking-[-0.04em] leading-[0.95]">
          Vende, cambia o truequea{' '}
          <span className="text-[#f4a100]">en tu comunidad universitaria</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-black/65 sm:text-xl">
          Marketplace P2P entre estudiantes. Tu dinero queda protegido en
          escrow Stellar hasta que recibas el artículo.
        </p>
      </section>

      {/* ── 3. Acceso ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
        {devLogin ? (
          <DemoLoginPanel users={seedRows} />
        ) : (
          !pollar.needsSetup && (
            <div className="border-y border-black/10 py-12 text-center">
              <p className="text-sm text-black/55">
                Para entrar con tu cuenta, abre{' '}
                <Link
                  href="/setup"
                  className="text-black underline decoration-2 underline-offset-4 hover:bg-[#f4a100]"
                >
                  la configuración de Pollar
                </Link>
                .
              </p>
            </div>
          )
        )}

        {/* Pollar path pendiente — solo un enlace small al setup */}
        {devLogin && pollar.needsSetup && (
          <p className="mt-8 text-center text-sm text-black/45">
            ¿Aún no tienes cuenta?{' '}
            <Link
              href="/setup"
              className="text-black underline decoration-2 underline-offset-4 hover:bg-[#f4a100]"
            >
              Crear con Pollar
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  );
}