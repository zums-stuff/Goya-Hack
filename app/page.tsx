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

  // Pollar's login CTA must NOT render when the keys are placeholders (setup:env
  // markers), because clicking it triggers their SDK to fetch /applications/config
  // on api.pollar.xyz → 403 API_KEY_TYPE_NOT_ALLOWED → the modal shows the
  // generic "Could not load sign-in options" error. Gate on the actual key
  // shape (`!pollar.needsSetup`), not just env-truthiness.
  const pollarConfigured = !pollar.needsSetup;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="sell-modal">
        {/* Espacio para el logo del equipo Genesis */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            marginBottom: '14px',
          }}
        >
          <img
            src="/GenesisPNG.png"
            alt="Equipo Genesis"
            style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '50%' }}
          />
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b21a8' }}>
            Equipo Genesis · Goya-Hack
          </span>
        </div>

        {/* Logos Gremium */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <img
            src="/Logo_Gremium.png"
            alt="Logo Gremium"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
          <img
            src="/Gremium.png"
            alt="Gremium"
            style={{ height: '26px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <p className="eyebrow">GREMIUM · UNAM</p>
        <h2>
          Inicia sesión para <br />
          vender, comprar o truequear.
        </h2>
        <p>
          Marketplace P2P entre estudiantes. Tu dinero queda protegido en
          escrow Stellar hasta que recibas el artículo.
        </p>

        {/* Camino real (producción): Pollar → sync → /home. Renderizado SOLO
            cuando las keys del dashboard de Pollar están configuradas. */}
        {pollarConfigured && <LoginButton />}

        {/* Cuando Pollar NO está configurado (keys placeholders del setup:env),
            mostramos una pista clara en lugar del botón roto. */}
        {!pollarConfigured && (
          <div
            className="rounded-xl p-4 mb-1 text-center"
            style={{
              background: 'var(--bg)',
              border: '1px dashed var(--line)',
            }}
          >
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              <span className="font-bold text-[var(--ink)] block">
                Login con Pollar no está activo
              </span>
              Las keys del dashboard de{' '}
              <a
                href="https://dashboard.pollar.xyz"
                target="_blank"
                rel="noreferrer"
                className="underline text-[var(--ink)] font-bold"
                style={{ color: '#005DB4' }}
              >
                Pollar
              </a>{' '}
              son marcadores locales. Pega las reales en{' '}
              <code className="font-mono text-[10px]">.env.local</code> o usa el
              modo dev debajo.
            </p>
            <Link
              href="/setup"
              className="text-[11px] font-bold text-[var(--primary)] underline underline-offset-2 mt-2 inline-block"
            >
              Ver guía de configuración →
            </Link>
          </div>
        )}

        {/* Camino dev (jueces en laptops sin Pollar): 1-click seed user. */}
        {devLogin && <DemoLoginPanel users={seedRows} />}

        <div className="mt-6 pt-5 border-t border-[var(--line)] text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
          <img
            src="/GenesisPNG.png"
            alt="Equipo Genesis"
            style={{ height: '16px', width: '16px', objectFit: 'contain', borderRadius: '50%' }}
          />
          <span>Desarrollado por <strong>Equipo Genesis</strong> · Stellar Testnet</span>
        </div>
      </div>
    </main>
  );
}