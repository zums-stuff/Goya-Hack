// app/escrow/[escrowId]/page.tsx — Detalle del escrow con EscrowActions.
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { EscrowActions } from '@/components/escrow/EscrowActions';
import { CountdownTimer } from '@/components/escrow/CountdownTimer';

export default async function EscrowDetailPage(props: {
  params: Promise<{ escrowId: string }>;
}) {
  const { escrowId } = await props.params;
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      buyer: { select: { id: true, displayName: true, pollarWalletId: true } },
      seller: { select: { id: true, displayName: true, pollarWalletId: true } },
      listing: { select: { id: true, title: true } },
    },
  });
  if (!escrow) notFound();

  const me = await tryGetUser();
  if (!me) redirect('/');

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{escrow.listing.title}</h1>
      <div className="text-sm text-gray-600">
        Comprador: <strong>{escrow.buyer.displayName}</strong>
        <br />
        Vendedor: <strong>{escrow.seller.displayName}</strong>
      </div>

      <div className="border rounded p-4 space-y-1 bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-500">Estado:</div>
        <div className="text-lg font-mono">{escrow.status}</div>
        <div className="text-sm mt-3">Monto:</div>
        <div className="text-xl font-mono">{(escrow.amountXlm / 100).toFixed(2)} XLM</div>
        <CountdownTimer
          targetDate={
            escrow.confirmWindowExpiresAt ??
            escrow.ttlExpiresAt ??
            null
          }
          status={escrow.status}
        />
      </div>

      <EscrowActions
        escrow={{
          id: escrow.id,
          status: escrow.status,
          amountXlm: escrow.amountXlm,
          exchangeInitiatorId: escrow.exchangeInitiatorId,
          buyerId: escrow.buyerId,
          sellerId: escrow.sellerId,
        }}
      />
    </main>
  );
}
