// app/admin/disputes/page.tsx — Cola de disputas (admin guard por ADMIN_EMAILS).
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionEmail, tryGetUser } from '@/lib/auth';
import { isAdmin } from '@/lib/config';

export default async function AdminDisputesPage() {
  const me = await tryGetUser();
  if (!me) redirect('/');
  const email = await getSessionEmail();
  if (!email || !isAdmin(email)) {
    return (
      <main className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Acceso denegado</h1>
        <p className="text-sm text-gray-500">
          Esta página requiere email ∈ ADMIN_EMAILS. Tu email: {email ?? '—'}
        </p>
      </main>
    );
  }

  const disputes = await prisma.disputeEvidence.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      escrow: { include: { listing: { select: { title: true } } } },
    },
  });

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Admin · Disputas pendientes</h1>
      {disputes.length === 0 && (
        <p className="text-sm text-gray-500">No hay disputas pendientes. 🎉</p>
      )}
      {disputes.map((d) => (
        <article key={d.id} className="border rounded p-4 space-y-2">
          <header className="flex justify-between">
            <div>
              <div className="font-medium">
                ⚠ {d.reason} · {d.escrow.listing.title}
              </div>
              <div className="text-xs text-gray-500 font-mono">escrow {d.escrowId}</div>
            </div>
            <div className="text-xs text-gray-500">
              {new Date(d.createdAt).toLocaleString()}
            </div>
          </header>
          <p className="text-sm italic">"{d.description}"</p>
          {d.disputePhotoUrl ?? d.photoUrl ? (
            /* The result is the same column but typed differently */
            <a
              className="text-blue-600 text-sm underline"
              href={`/disputes/${d.id}.jpg`}
            >
              Ver evidencia
            </a>
          ) : null}

          <div className="flex gap-2 mt-2">
            <form action={`/api/admin/disputes/${d.id}/resolve`} method="POST">
              <input type="hidden" name="decision" value="release" />
              <button className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                Release al vendedor
              </button>
            </form>
            <form action={`/api/admin/disputes/${d.id}/resolve`} method="POST">
              <input type="hidden" name="decision" value="refund" />
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
                Refund al comprador
              </button>
            </form>
          </div>
        </article>
      ))}
    </main>
  );
}
