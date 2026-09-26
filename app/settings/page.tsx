// app/settings/page.tsx — Settings básicos: balance, dirección, danger zone.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import Link from 'next/link';

export default async function SettingsPage() {
  const me = await tryGetUser();
  if (!me) redirect('/');

  return (
    <main className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-gray-500">v0.1.0 · Stellar Testnet</p>

      <ul className="border rounded divide-y">
        <li className="p-4 flex justify-between">
          <span>👤 {me.displayName}</span>
          <span className="text-sm text-gray-500">{me.email}</span>
        </li>
        <li className="p-4 flex justify-between">
          <span>🎓 Carrera</span>
          <span className="text-sm text-gray-500">{me.major}</span>
        </li>
        <li className="p-4 flex justify-between">
          <span>💰 Saldo</span>
          <span className="font-mono">{(me.balanceXlm / 100).toFixed(2)} XLM</span>
        </li>
        <li className="p-4 flex justify-between">
          <span>Dirección Stellar</span>
          <span className="font-mono text-xs">{me.pollarWalletId}</span>
        </li>
      </ul>

      <div className="mt-8 border-t pt-6 space-y-2">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Demo
        </h2>
        <form
          action="/api/reset-demo"
          method="POST"
          onSubmit={(e) => {
            // Client side confirmation via inline script won't run on SSR; rely on user caution.
          }}
        >
          <input type="hidden" name="from_ui" value="1" />
          <button
            type="submit"
            className="bg-orange-600 text-white px-3 py-2 rounded text-sm"
            // The button is inert for SSR; real confirm happens client-side via EscrowActions in modal preferred.
          >
            Resetear datos demo
          </button>
        </form>
        <p className="text-xs text-gray-500">
          Solo disponible en dev (configurada por §11.5 / ALLOW_RESET_DEMO).
        </p>
      </div>

      <p className="mt-10 text-center text-sm">
        <Link href="/home" className="text-blue-600">← Home</Link>
      </p>
    </main>
  );
}
