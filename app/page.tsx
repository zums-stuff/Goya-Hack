// app/page.tsx — Home: si hay sesión → /home; si no → mostrar LoginButton.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { LoginButton } from '@/components/auth/LoginButton';

export default async function HomePage() {
  const user = await tryGetUser();
  if (user) redirect('/home');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold">PumaTrade</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Marketplace P2P estudiantil — Goya-Hack
        </p>
      </header>
      <LoginButton />
    </main>
  );
}
