// app/home/page.tsx — Home autenticado: feed de listings recientes + saldo + escrow list.
import Link from 'next/link';
import { tryGetUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AuthSyncToStore } from '@/components/auth/AuthSyncToStore';
import type { Listing, Escrow } from '@/generated/prisma/client';

export default async function HomePage() {
  const user = await tryGetUser();
  if (!user) redirect('/');

  const recent: Array<Listing & { seller: { displayName: string; major: string } }> =
    (await prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { seller: { select: { displayName: true, major: true } } },
    })) as Array<Listing & { seller: { displayName: string; major: string } }>;

  const myEscrows: Escrow[] = await prisma.escrow.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <>
      <AuthSyncToStore
        initialMe={{
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          major: user.major,
          pollarWalletId: user.pollarWalletId,
          balanceXlm: user.balanceXlm,
        }}
      />
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Hola, {user.displayName}</h1>
          <div className="text-right">
            <div className="text-sm text-gray-500">Saldo</div>
            <div className="text-xl font-mono">{(user.balanceXlm / 100).toFixed(2)} XLM</div>
          </div>
        </header>

        <nav className="flex gap-3">
          <Link href="/marketplace" className="bg-blue-600 text-white px-4 py-2 rounded">Marketplace</Link>
          <Link href="/create" className="bg-green-600 text-white px-4 py-2 rounded">Publicar</Link>
          <Link href="/settings" className="bg-gray-700 text-white px-4 py-2 rounded">Settings</Link>
        </nav>

        <section>
          <h2 className="text-xl font-semibold mb-4">Listings recientes</h2>
          <ul className="grid grid-cols-2 gap-4">
            {recent.map((l: Listing & { seller: { displayName: string; major: string } }) => (
              <li key={l.id} className="border rounded p-3">
                <Link href={`/marketplace/${l.id}`}>
                  <div className="font-medium">{l.title}</div>
                  <div className="text-sm text-gray-500">{l.seller.displayName}</div>
                  <div className="text-sm font-mono mt-1">{(l.priceXlm / 100).toFixed(2)} XLM</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Mis escrows</h2>
          {myEscrows.length === 0 ? (
            <p className="text-gray-500">Aún no participas en ningún escrow.</p>
          ) : (
            <ul className="space-y-2">
              {myEscrows.map((e: Escrow) => (
                <li key={e.id} className="border rounded p-3 flex justify-between">
                  <Link href={`/escrow/${e.id}`} className="font-mono text-sm underline">
                    {e.id}
                  </Link>
                  <span className="text-sm">{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
