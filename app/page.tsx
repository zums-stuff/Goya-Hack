// app/page.tsx — Placeholder home (Bloque 1 implementa auth + redirect).
import { LoginButton } from '@/components/auth/LoginButton';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold">PumaTrade</h1>
        <p className="text-lg text-gray-600">Marketplace P2P estudiantil — Goya-Hack</p>
      </header>
      <LoginButton />
    </main>
  );
}
