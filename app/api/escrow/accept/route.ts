// app/api/escrow/accept/route.ts — Rama A: release firmado.
//
// MODO DEMO (`process.env.DEMO_FUNDING_BYPASS === 'true'` + `force: true`):
//   Igual que /api/escrow/fund — el server marca el escrow como `released`
//   sin firmar la tx Stellar. NODE_ENV=production siempre rechaza aunque
//   el flag esté puesto.

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AcceptSchema } from '@/lib/schemas';
import { EscrowService } from '@/lib/escrow.service';
import { ApiError, handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { escrowId } = AcceptSchema.parse(body);
    const forceDemo =
      Boolean((body as { force?: boolean }).force) &&
      process.env.DEMO_FUNDING_BYPASS === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (forceDemo) {
      // Bypass: marca `released` sin firma Stellar. updateMany idempotente.
      const escrow = await prisma.escrow.findUnique({
        where: { id: escrowId },
        select: { buyerId: true, status: true },
      });
      if (!escrow) throw new ApiError(404, 'escrow_not_found', 'No existe.');
      if (escrow.buyerId !== user.id) throw new ApiError(403, 'not_buyer', 'Solo el buyer puede aceptar.');
      if (escrow.status !== 'exchange-recorded') {
        throw new ApiError(409, 'invalid_transition', `Cannot accept from ${escrow.status}.`);
      }
      const lock = await prisma.escrow.updateMany({
        where: { id: escrowId, status: 'exchange-recorded' },
        data: { status: 'released', acceptedAt: new Date() },
      });
      if (lock.count === 1) {
        await prisma.transactionLog.create({
          data: { escrowId, actorId: user.id, action: 'accepted-demo' },
        });
        await prisma.listing.update({
          where: { id: (await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } })).listingId },
          data: { status: 'sold' },
        });
        await prisma.offer.update({
          where: { id: (await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } })).offerId },
          data: { status: 'completed' },
        });
      }
      const updated = await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } });
      return Response.json({ escrow: updated, demoBypass: true });
    }

    const escrow = await EscrowService.accept(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
