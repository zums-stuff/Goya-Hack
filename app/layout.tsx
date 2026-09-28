// app/layout.tsx -- Root layout: PollarProvider + Inter Tight + globals.
//
// Reglas 5.3 / 5.4 del ARCHITECTURE:
//   - `client={{ apiKey: ... }}` SIN `network` (la red se fija en dashboard Pollar).
//   - Verificado contra pollar-xyz/template-nextjs 2026-09-25.
//
// Fuente: Inter Tight variable (python-like clarity, sans con personalidad).
// Aplica a toda la app, no solo a /, para que el sistema visual sea coherente.
//
// Pollar configuration:
//
//   - We pass `appConfig` so PollarProvider uses our LOCAL application + styles
//     and skips the `/applications/config` fetch that runs on every mount.
//     Without `appConfig`, the SDK fetches the dashboard config and on
//     placeholder keys falls into an error state that renders the modal as
//     a degraded "LoginModalStatus" instead of the full OAuth UI.
//   - `application.name` = Gremium.
//   - `application.network` = testnet (we fund with friendbot).
//   - `application.chains` = [STELLAR] only (we are Stellar-only).
//   - `styles.theme` = light (matches pollar.xyz/interactive-demo default).
//   - `styles.accentColor` = #005DB4 (matches the demo's primary button).
//   - `styles.logoUrl` = /Logo_Gremium.png so the modal still carries
//     Gremium brand into the man-in-the-loop auth screen.
//   - `styles.providers` keep google/discord/x/github/apple enabled so the
//     demo's full OAuth UI is visible (the callbacks still need to be
//     configured in the Pollar dashboard for the actual flow to complete).
import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import { PollarProvider } from '@pollar/react';
import { env } from '@/lib/config';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Gremium - marketplace P2P estudiantil',
  description: 'Marketplace de intercambio flexible entre estudiantes con escrow Stellar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={interTight.variable}>
      <body className="font-sans antialiased">
        <PollarProvider
          client={{ apiKey: env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY }}
          appConfig={{
            application: {
              name: 'Gremium',
              network: 'testnet',
              chains: ['STELLAR'],
            },
            styles: {
              theme: 'light',
              accentColor: '#005DB4',
              modalTitle: 'Gremium',
              logoUrl: '/Logo_Gremium.png',
              emailEnabled: true,
              embeddedWallets: true,
              smartWallet: false,
              providers: {
                google: true,
                discord: true,
                x: true,
                github: true,
                apple: true,
              },
            },
          }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
