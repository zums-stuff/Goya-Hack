// app/escrow/[escrowId]/report/page.tsx — Rama C: form de disputa (multipart).
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { DisputeForm } from '@/components/escrow/DisputeForm';

export default async function DisputePage(props: {
  params: Promise<{ escrowId: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { escrowId } = await props.params;
  const sp = await props.searchParams;
  const me = await tryGetUser();
  if (!me) redirect('/');

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      disputeReason: true,
    },
  });
  if (!escrow) notFound();
  if (escrow.buyerId !== me.id && escrow.sellerId !== me.id) {
    return <p className="p-6">No autorizado.</p>;
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reportar problema</h1>
      <p className="text-sm text-gray-600">
        Estado: <strong>{escrow.status}</strong>
        {escrow.status === 'disputed' && (
          <span className="block text-red-600 mt-2">⚠ Ya hay una disputa abierta para este escrow.</span>
        )}
      </p>
      <DisputeForm escrowId={escrow.id} initialReason={sp.reason} disabled={escrow.status === 'disputed'} />
    </main>
  );
}
