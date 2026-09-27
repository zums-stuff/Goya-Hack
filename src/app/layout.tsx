import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PumaPay — Cobros USDC por chat para comercios | GOYA HACK',
  description:
    'Agente IA que permite a cualquier comercio informal de México cobrar en USDC sobre Stellar por chat, sin seed phrases ni conocimiento cripto. GOYA HACK 2026 — Tracks AI + Blockchain.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
