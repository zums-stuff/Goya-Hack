// app/setup/page.tsx — Guía de configuración de Pollar.
//
// Mismo lenguaje visual que el resto: modal `.sell-modal` centrada en bg
// `--bg`, con marca y link "Volver al login". El detalle técnico vive
// en el componente PollarSetupGuide.
import Link from 'next/link';
import { ArrowLeft, Wallet } from 'lucide-react';
import { computePollarSetupStatus } from '@/lib/pollar-status';
import { PollarSetupGuide } from '@/components/auth/PollarSetupGuide';

export default async function SetupPage() {
  const pollar = computePollarSetupStatus(process.env);
  return (
    <main
      className="min-h-screen flex items-start sm:items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="sell-modal" style={{ width: 'min(100%, 560px)' }}>
        <div className="modal-spark">
          <Wallet />
        </div>
        <p className="eyebrow">CONFIGURACIÓN · PUMATRADE</p>
        <h2>
          Pegar las keys de <span style={{ color: 'var(--primary)' }}>Pollar</span>
          <br /> en .env.local
        </h2>
        <p>
          PumaTrade usa las wallets embebidas de Pollar. Para que el login
          funcione con un usuario real (no el modo dev), crea dos apps en
          dashboard.pollar.xyz y pega las keys aquí.
        </p>

        <PollarSetupGuide status={pollar} />

        <div className="mt-6 pt-5 border-t border-[var(--line)]">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-[var(--primary)] hover:underline"
          >
            <ArrowLeft className="w-3 h-3" />
            Volver al login
          </Link>
        </div>
      </div>
    </main>
  );
}