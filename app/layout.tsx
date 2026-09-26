// app/layout.tsx — Root layout: PollarProvider + globals + metadata.
//
// Reglas §5.3 / §5.4 del ARCHITECTURE:
//   - `client={{ apiKey: ... }}` SIN `network` (la red se fija en dashboard Pollar).
//   - Verificado contra pollar-xyz/template-nextjs 2026-09-25.
import type { Metadata } from 'next';
import { PollarProvider } from '@pollar/react';
import { env } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: 'PumaTrade — marketplace P2P estudiantil',
  description: 'Marketplace de intercambio flexible entre estudiantes con escrow Stellar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <PollarProvider
          client={{ apiKey: env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
