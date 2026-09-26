// app/api/escrow/accept-offer/route.ts — Vendedor acepta una oferta.
//   - Regla #2 §7.3: updateMany condicional dentro del $transaction.
//   - Trueque puro (amountXlm=0) nace en `funded` directamente (§8.4).
//   - La cuenta Stellar se crea FUERA del $transaction (cuesta ~3-5s Horizon);
//     si el tx falla, la cuenta queda huérfana (testnet: gratis, acepted).
//
// ⚠️ Compila el §6.2 con el §7.2 + §7.3 completo.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AcceptOfferSchema } from '@/lib/schemas';
import { createEscrowAccount } from '@/lib/stellar';
import { handleApiError, ApiError } from '@/lib/errors';
import { escrowSnapshotStore } from '@/lib/snapshots';
import type { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
// force-dynamic + session cookie ensure no caching of state-changing routes.

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { offerId } = AcceptOfferSchema.parse(await req.json());

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { listing: true, offerer: true },
    });
    if (!offer) throw new ApiError(404, 'offer_not_found', 'La oferta no existe.');
    if (offer.listing.sellerId !== user.id) {
      throw new ApiError(403, 'not_your_listing', 'Solo el vendedor puede aceptar.');
    }

    // Fast-fail pre-checks (defense in depth). El guard AUTORITATIVO está DENTRO del $transaction.
    if (offer.status !== 'pending') {
      throw new ApiError(409, 'offer_not_pending', `Estado actual: ${offer.status}`);
    }
    if (offer.listing.status !== 'active') {
      throw new ApiError(409, 'listing_not_available', `El listing está: ${offer.listing.status}`);
    }

    // 1. Crear la cuenta Stellar (server-side). ~3-5s con Horizon.
    //    Si el $transaction falla después, queda huérfana (testnet, gratis).
    const { escrowPublicKey, arbiterSecretEnc, txHash } = await createEscrowAccount();
    void txHash; // not stored yet; serves audit trail via Horizon explorer.

    // 2. Transición autoritativa DENTRO del $transaction.
    const initialStatus = (offer.xlmAmount ?? 0) === 0 ? 'funded' : 'awaiting-funding';

    const escrow = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const listingLock = await tx.listing.updateMany({
        where: { id: offer.listingId, status: 'active' },
        data: { status: 'pending' },
      });
      if (listingLock.count !== 1) {
        throw new ApiError(
          409,
          'listing_not_available',
          'Este listing ya tiene un escrow en vuelo (otro buyer aceptó primero).',
        );
      }

      const offerLock = await tx.offer.updateMany({
        where: { id: offer.id, status: 'pending' },
        data: { status: 'accepted' },
      });
      if (offerLock.count !== 1) {
        throw new ApiError(409, 'offer_not_pending', 'Carrera contra otro vendedor.');
      }

      const newEscrow = await tx.escrow.create({
        data: {
          offerId: offer.id,
          listingId: offer.listingId,
          buyerId: offer.offererId,
          sellerId: offer.listing.sellerId,
          amountXlm: offer.xlmAmount ?? 0,
          stellarEscrowAccount: escrowPublicKey,
          arbiterSecretEnc,
          platformFeeBps: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? 200),
          status: initialStatus,
        },
      });

      await tx.transactionLog.create({
        data: { escrowId: newEscrow.id, actorId: user.id, action: 'offer-accepted' },
      });

      return newEscrow;
    });

    // Snapshot ya queda en la DB; nada en memoria.
    escrowSnapshotStore.record(escrow.id);

    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
