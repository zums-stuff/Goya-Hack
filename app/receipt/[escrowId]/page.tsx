// app/receipt/[escrowId]/page.tsx — Recibo final del intercambio.
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';

export default async function ReceiptPage(props: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = await props.params;
  const me = await tryGetUser();
  if (!me) redirect('/');

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      listing: { select: { title: true } },
    },
  });
  if (!escrow) notFound();
  if (escrow.buyerId !== me.id && escrow.sellerId !== me.id) {
    return <p className="p-6">No autorizado.</p>;
  }
  if (!['released', 'auto-released', 'refunded'].includes(escrow.status)) {
    return <p className="p-6 text-gray-500">El escrow aún no tiene recibo final.</p>;
  }

  const fee = escrow.platformFeeXlm / 100;
  const net = (escrow.amountXlm - escrow.platformFeeXlm) / 100;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Recibo</h1>
        <p className="text-sm text-gray-500 font-mono mt-1">{escrow.id}</p>
        <div className="mt-2">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-semibold">
            {escrow.status}
          </span>
        </div>
      </header>

      <section className="border rounded p-4 space-y-2 bg-gray-50 dark:bg-gray-900">
        <p><strong>Artículo:</strong> {escrow.listing.title}</p>
        <p><strong>Comprador:</strong> {escrow.buyer.displayName}</p>
        <p><strong>Vendedor:</strong> {escrow.seller.displayName}</p>
        <hr className="my-2" />
        <p className="font-mono text-base">Monto total: {escrow.amountXlm / 100} XLM</p>
        {escrow.platformFeeXlm > 0 && (
          <p className="font-mono text-sm text-gray-600">Comisión plataforma ({escrow.platformFeeBps} bps): {fee} XLM</p>
        )}
        {escrow.status !== 'refunded' && (
          <p className="font-mono text-base text-green-700">
            Vendedor recibe: {net} XLM
          </p>
        )}
      </section>

      {escrow.stellarTxHashRelease && (
        <section className="border rounded p-4 text-xs space-y-1 font-mono bg-white dark:bg-black">
          <p><strong>Tx on-chain:</strong></p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${escrow.stellarTxHashRelease}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline break-all"
          >
            {escrow.stellarTxHashRelease}
          </a>
          {escrow.stellarMemoReceipt && (
            <p className="mt-1"><strong>Memo:</strong> {escrow.stellarMemoReceipt}</p>
          )}
        </section>
      )}
    </main>
  );
}
