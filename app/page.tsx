// app/page.tsx — Home: si hay sesión → /home; si no → login con UI nativa de Pollar.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { LoginButton } from '@/components/auth/LoginButton';

const FEATURES = [
  { icon: '⇄', label: 'Trueque, saldo o híbrido' },
  { icon: '🛡', label: 'Escrow Stellar 2-de-2' },
  { icon: '👛', label: 'Wallet Pollar sin seed phrases' },
];

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      {/* Fondo suave */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, color-mix(in oklch, var(--color-primary) 18%, transparent), transparent 70%), radial-gradient(40rem 30rem at 85% 110%, color-mix(in oklch, var(--color-primary) 10%, transparent), transparent 70%)',
        }}
      />

      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Marca */}
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)] shadow-lg">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-[var(--color-primary-foreground)]" fill="currentColor" aria-hidden>
              <path d="M12 3c-1.7 0-3 1.3-3 3 0 1.8 2.1 3.2 3 4 .9-.8 3-2.2 3-4 0-1.7-1.3-3-3-3ZM7 10c-1.5.9-2.6 2.4-2.6 4.3 0 1.2.9 2.2 2 2.1.4-.1.7-.3 1-.6.6-.5 1.1-1.4 1.1-2.5 0-1.4.3-2.6 1-3.6-.8-.6-1.7-.9-2.5-.7Zm10 0c-.8-.2-1.7.1-2.5.7.7 1 1 2.2 1 3.6 0 1.1.5 2 1.1 2.5.3.3.6.5 1 .6 1.1.1 2-.9 2-2.1 0-1.9-1.1-3.4-2.6-4.3Zm-5 3.5c-1.6 1.4-3.5 1.9-4.9 3.6-.7.9-.9 2.2-.3 3.3.6 1.1 1.7 1.6 2.8 1.2.7-.3 1.2-.9 1.6-1.6.5-.9 1.1-1.4 2.3-1.4s1.8.5 2.3 1.4c.4.7.9 1.3 1.6 1.6 1.1.4 2.2-.1 2.8-1.2.6-1.1.4-2.4-.3-3.3-1.4-1.7-3.3-2.2-4.9-3.6Z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">PumaTrade</h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Marketplace P2P estudiantil — Goya-Hack 2026
            </p>
          </div>
        </header>

        {/* CTA */}
        <LoginButton />

        {/* Features */}
        <ul className="grid w-full grid-cols-3 gap-2 text-center">
          {FEATURES.map((f) => (
            <li
              key={f.label}
              className="rounded-xl border border-black/5 bg-white/60 px-2 py-2.5 text-[11px] leading-tight text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
            >
              <span className="mr-1">{f.icon}</span>
              {f.label}
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-gray-400">
          Wallets embebidas por <span className="font-medium text-gray-500">Pollar</span> · Red Stellar
          testnet · Sin tokens propios
        </p>
      </div>
    </main>
  );
}