// app/page.tsx — Pre-login: modal centrada.
// Dos rutas:
//   1. **Pollar** (producción): <LoginButton /> abre el modal social
//      (Google / email / passkey), crea una wallet Stellar embebida,
//      y al volver sincroniza user + cookie vía /api/auth/sync.
//   2. **Dev-login**: cuando NODE_ENV != production y DEV_LOGIN_ENABLED=true,
//      además (o en lugar) mostramos la lista de seed users con un click.
//      Ideal para demos de jueces en laptops sin cuenta de Pollar.
// Sin sidebar porque no hay sesión.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers } from '@/lib/seed-data';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';
import { LoginButton } from '@/components/auth/LoginButton';

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

  const showRealLogin =
    process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY ? true : false;

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

        {/* Camino real (producción): Pollar → sync → /home. */}
        {showRealLogin && <LoginButton />}

        {/* Camino dev (jueces en laptops sin Pollar): 1-click seed user. */}
        {devLogin && <DemoLoginPanel users={seedRows} />}

        {/* Sin dev y sin keys reales: instrucción para configurarlas. */}
        {!showRealLogin && !devLogin && pollar.needsSetup && (
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

        <div className="mt-6 pt-5 border-t border-[var(--line)] text-center text-xs text-[var(--muted)]">
          Demo estudiantil · Stellar testnet
        </div>
      </div>
    </main>
  );
}