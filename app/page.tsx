// app/page.tsx — Pre-login (light surface — see app/globals.css .prelogin-*).
//
// Two routes:
//   1. **Pollar** (producción): <LoginButton /> abre el modal social
//      (Google / email OTP / passkey), crea una wallet Stellar embebida,
//      y al volver sincroniza user + cookie vía /api/auth/sync.
//   2. **Dev-login**: cuando NODE_ENV != production y DEV_LOGIN_ENABLED=true,
//      se muestra como bloque secundario debajo de la CTA real.
//
// Pollar gated on `!pollar.needsSetup` — si las keys son marcadores locales
// (setup:env), abrir el modal hace fetch a api.pollar.xyz → 403
// API_KEY_TYPE_NOT_ALLOWED → modal "Could not load sign-in options".
// El gate evita ese callejón sin salida.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Mail, ShieldCheck } from 'lucide-react';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers } from '@/lib/seed-data';
import { LoginButton } from '@/components/auth/LoginButton';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  const devLogin = isDevLoginAvailable();
  const pollar = computePollarSetupStatus(process.env);
  const pollarConfigured = !pollar.needsSetup;

  // DemoLoginPanel is keyed off `SeedUserRow`. Map seed.users → that.
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
    <main className="prelogin-stage">
      <div className="prelogin-card">
        {/* Brand row — reuses the sidebar's `.brand-mark` square (coral)
            + the Gremium wordmark, with the team/student-line as a quiet
            caption beneath. No double-stacked logos. */}
        <div className="prelogin-brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <div>
            <img
              src="/Logo_Gremium.png"
              alt="Gremium"
              width={120}
              height={26}
              style={{ height: 26, width: 'auto', display: 'block' }}
            />
            <small>Goya-Hack · UNAM 2026</small>
          </div>
        </div>

        {/* Headline — same scale and weight as `.welcome-row h1` on the
            dashboard, so the type ramp stays continuous across the app. */}
        <h1 className="prelogin-headline">
          Intercambia en la UNAM
          <br />
          <span className="accent">sin perder un peso.</span>
        </h1>
        <p className="subcopy">
          Tu pago se queda retenido en escrow Stellar hasta que confirmes
          recibir el artículo. Sin seed phrases, sin custodia intermedia —
          solo Stellar testnet firmado por dos partes.
        </p>

        {/* Primary CTA — Pollar real button, or an inline hint when the
            dashboard keys haven't been configured. */}
        <div className="prelogin-cta" style={{ marginTop: 24 }}>
          {pollarConfigured ? (
            <LoginButton />
          ) : (
            <div className="prelogin-hint">
              <div className="hint-row">
                <Mail
                  style={{
                    width: 14,
                    height: 14,
                    color: 'var(--primary)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <span>
                  Las keys de Pollar son marcadores locales. Pega las
                  reales (<code>pub_testnet_users_*</code> +{' '}
                  <code>sec_*</code>) en <code>.env.local</code> o usa el
                  modo dev debajo.
                </span>
              </div>
              <Link href="/setup" className="hint-cta">
                Configurar Pollar
                <ChevronRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          )}
        </div>

        {/* Dev-login: secondary block, quiet separator, same surface as
            the rest of the app. DemoLoginPanel already renders the 5 seed
            users as styled `.profile-row` items, so this stays consistent. */}
        {devLogin && (
          <div className="prelogin-secondary">
            <p className="sec-eyebrow">Modo demo</p>
            <p className="sec-sub">
              Jueces sin Pollar configurado pueden entrar como uno de los
              cinco seed users. Las wallets pre-fondeadas son de prueba.
            </p>
            <DemoLoginPanel users={seedRows} />
          </div>
        )}

        {/* Footer — quiet credit + secondary action. */}
        <footer className="prelogin-footer">
          <span style={{ textTransform: 'uppercase' }}>
            Stellar Testnet
          </span>
          {pollarConfigured ? (
            <span className="ready">
              <ShieldCheck style={{ width: 11, height: 11 }} />
              Pollar listo
            </span>
          ) : (
            <Link
              href="/setup"
              style={{
                color: 'var(--primary)',
                textDecoration: 'none',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              Setup guide
              <ChevronRight style={{ width: 11, height: 11 }} />
            </Link>
          )}
        </footer>
      </div>
    </main>
  );
}
