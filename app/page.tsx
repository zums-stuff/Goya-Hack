// app/page.tsx — Pre-login: Gremium-branded wrapper around a Pollar-styled
// auth card that mirrors https://www.pollar.xyz/interactive-demo.
//
// Layout (top to bottom):
//   1. Gremium brand mark + wordmark           (single, not double-stacked)
//   2. Headline + subcopy                        (Gremium brand voice)
//   3. .pollar-login-card                        (Pollar-styled: email +
//                                                  social OAuth buttons +
//                                                  outlined wallet button)
//   4. Modo demo (only when DEV_LOGIN_ENABLED)
//   5. Prelogin footer                           (Stellar Testnet / Pollar
//                                                  ready badge or Setup
//                                                  link)
//
// Each of the Pollar-styled buttons calls openLoginModal() -- the actual
// auth is delegated to Pollar's widget (which we configured with theme:
// 'light' + accentColor: '#005DB4' so visually it merges with our card).
// Email codes + OAuth both flow through the same modal because Pollar
// owns that authentication surface; what we control is the visual hand-off.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Apple,
  ChevronRight,
  
  Mail,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { tryGetUser } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { seedUsers } from '@/lib/seed-data';
import { LoginButton } from '@/components/auth/LoginButton';
import { PollarLoginActions } from '@/components/auth/PollarLoginActions';
import { DemoLoginPanel, type SeedUserRow } from '@/components/auth/DemoLoginPanel';

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  const devLogin = isDevLoginAvailable();
  const pollar = computePollarSetupStatus(process.env);
  const pollarConfigured = !pollar.needsSetup;

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
        {/* Brand row -- single Logo_Gremium.png wordmark + caption.
            The Pollar-blue login card below this sits inside the same
            Gremium surface, so the surface is "Gremium" + the auth card
            is "Pollar". Two distinct visual zones, on purpose.
            The previous `brand-mark` ("G" letter logo) was redundant
            next to the wordmark image and made the row feel double-stacked;
            only the wordmark + caption remain. */}
        <div className="prelogin-brand">
          <img
            src="/Logo_Gremium.png"
            alt="Gremium"
            width={140}
            height={30}
            style={{ height: 30, width: 'auto', display: 'block' }}
          />
          <small>Gremium · Goya-Hack · UNAM 2026</small>
        </div>

        {/* Headline -- same scale/weight as .welcome-row h1 so the type
            ramp stays continuous with the in-app pages. */}
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

        {/* The Pollar-styled auth card. When Pollar keys are placeholder,
            we show the original .gre-pollar-btn pill + setup hint instead,
            because Pollar's widget refuses to mount with placeholder keys
            (returns APPLICATION_HAS_NO_REDIRECT_URIS-like errors). */}
        {pollarConfigured ? (
          <PollarLoginActions />
        ) : (
          <>
            <div className="prelogin-cta" style={{ marginTop: 28 }}>
              <LoginButton />
            </div>
            <div className="prelogin-hint prelogin-cta">
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
              <Link
                href="/setup"
                className="hint-cta"
              >
                Configurar Pollar
                <ChevronRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          </>
        )}

        {/* Dev-login -- intentionally separate visual block so judges /
            judges-without-Pollar can still enter the app for the demo. */}
        {devLogin && (
          <div className="prelogin-secondary">
            <p className="sec-eyebrow">Modo demo</p>
            <p className="sec-sub">
              Jueces sin Pollar configurado pueden entrar como uno de los
              seis seed users. Las wallets pre-fondeadas son de prueba.
            </p>
            <DemoLoginPanel users={seedRows} />
          </div>
        )}

        {/* Footer -- quiet credit + Pollar status indicator. */}
        <footer className="prelogin-footer">
          <span style={{ textTransform: 'uppercase' }}>Stellar Testnet</span>
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
