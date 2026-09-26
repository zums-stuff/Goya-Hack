// app/page.tsx — Pre-login: modal centrada para elegir seed user.
//
// Cuando el usuario está logueado, redirect a /home. Antes, la misma
// pantalla de siempre pero usando el sistema de diseño del frontend
// example (importado por el usuario) — modal `.sell-modal`, tipografía
// 11–13px densa, color primary coral. Sin sidebar porque no hay sesión.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet, ChevronRight } from 'lucide-react';
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
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="sell-modal">
        <div className="modal-spark">
          <Wallet />
        </div>
        <p className="eyebrow">PUMATRADE · UNAM</p>
        <h2>
          Inicia sesión para <br />
          vender, comprar o truequear.
        </h2>
        <p>
          Marketplace P2P entre estudiantes. Tu dinero queda protegido en
          escrow Stellar hasta que recibas el artículo.
        </p>

        {devLogin && <DemoLoginPanel users={seedRows} />}

        {!devLogin && pollar.needsSetup && (
          <div className="border border-dashed border-[var(--line)] rounded-xl p-4 text-center mb-2">
            <p className="text-xs text-[var(--muted)] mb-2">
              Activa el modo dev o configura Pollar.
            </p>
            <Link
              href="/setup"
              className="text-xs font-bold text-[var(--primary)] underline underline-offset-2"
            >
              Ir a configuración →
            </Link>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Demo estudiantil · Stellar testnet</span>
          <Link
            href="/setup"
            className="font-bold text-[var(--primary)] hover:underline"
          >
            Crear cuenta con Pollar <ChevronRight className="inline w-3 h-3 -mt-0.5" />
          </Link>
        </div>
      </div>
    </main>
  );
}