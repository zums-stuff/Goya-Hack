// app/layout.tsx — Root layout: PollarProvider + Inter Tight + globals.
//
// Reglas §5.3 / §5.4 del ARCHITECTURE:
//   - `client={{ apiKey: ... }}` SIN `network` (la red se fija en dashboard Pollar).
//   - Verificado contra pollar-xyz/template-nextjs 2026-09-25.
//
// Fuente: Inter Tight variable (python-like clarity, sans with personality).
// Aplica a toda la app — no solo a / — para que el sistema visual sea coherente.
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
  title: 'PumaTrade — marketplace P2P estudiantil',
  description: 'Marketplace de intercambio flexible entre estudiantes con escrow Stellar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={interTight.variable}>
      <body className="font-sans antialiased">
        <PollarProvider
          client={{ apiKey: env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
