import { requireUser } from '@/lib/auth';
import { isAdmin } from '@/lib/config';
import { prisma } from '@/lib/db';
import { handleApiError, ApiError } from '@/lib/errors';
import { z } from 'zod';
import { feeCents } from '@/lib/fees';
import {
  releaseEscrowWithBarterGuard,
  refundEscrowWithBarterGuard,
  runReleaseOnTreasury,
  runRefundOnTreasury,
} from '@/lib/stellar';
import { DEMO_MODE } from '@/lib/escrow.service';
import type { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

const ResolveSchema = z.object({
  status: z.enum(['resolved', 'rejected']),
  resolution: z.enum(['release', 'refund']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isAdmin(user.email)) {
      throw new ApiError(403, 'forbidden', 'Acceso denegado: se requiere rol de administrador.');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = ResolveSchema.parse(body);

    const dispute = await prisma.disputeEvidence.findUniqueOrThrow({
      where: { id },
      include: {
        escrow: {
          include: { buyer: true, seller: true, offer: true, listing: true },
        },
      },
    });

    if (dispute.status !== 'pending') {
      throw new ApiError(409, 'dispute_already_resolved', `Dispute status is already ${dispute.status}`);
    }

    const updatedDispute = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Si solo se rechaza
      if (parsed.status === 'rejected') {
        const rejectedDispute = await tx.disputeEvidence.update({
          where: { id },
          data: { status: 'rejected' },
        });
        
        await tx.transactionLog.create({
          data: {
            escrowId: dispute.escrowId,
            actorId: user.id,
            action: 'dispute-rejected',
          },
        });
        
        return rejectedDispute;
      }

      // Si se resuelve (resolved)
      if (parsed.status === 'resolved') {
        if (!parsed.resolution) {
          throw new ApiError(400, 'missing_resolution', 'Se requiere resolution (release o refund) cuando status es resolved');
        }

        const fee = feeCents(dispute.escrow.amountXlm);
        const memo = `PT-ADMIN-${parsed.resolution === 'release' ? 'REL' : 'REF'}-${dispute.escrow.id.slice(0, 7)}`;

        if (parsed.resolution === 'release') {
          let stellarHash;
          if (DEMO_MODE) {
            stellarHash = await runReleaseOnTreasury({
              escrowAccount: dispute.escrow.stellarEscrowAccount,
              arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
              amountCents: dispute.escrow.amountXlm,
              memo,
            });
          } else {
            stellarHash = await releaseEscrowWithBarterGuard({
              escrowAccount: dispute.escrow.stellarEscrowAccount,
              arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
              sellerPublic: dispute.escrow.seller.pollarWalletId,
              amountCents: dispute.escrow.amountXlm,
              feeCents: fee,
              memo,
            });
          }

          await tx.escrow.update({
            where: { id: dispute.escrowId },
            data: {
              status: 'released',
              stellarTxHashRelease: stellarHash.hash,
              stellarMemoReceipt: memo,
              platformFeeXlm: fee,
            },
          });

          await tx.listing.update({
            where: { id: dispute.escrow.listingId },
            data: { status: 'sold' },
          });

          await tx.offer.update({
            where: { id: dispute.escrow.offerId },
            data: { status: 'completed' },
          });

          if (DEMO_MODE) {
            const netToSellerCents = dispute.escrow.amountXlm - fee;
            await tx.user.update({
              where: { id: dispute.escrow.sellerId },
              data: { balanceXlm: { increment: netToSellerCents } },
            });
            await tx.user.update({
              where: { id: dispute.escrow.buyerId },
              data: { balanceXlm: { decrement: dispute.escrow.amountXlm } },
            });
          }
        } else if (parsed.resolution === 'refund') {
          let stellarHash;
          if (DEMO_MODE) {
            stellarHash = await runRefundOnTreasury({
              escrowAccount: dispute.escrow.stellarEscrowAccount,
              arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
              amountCents: dispute.escrow.amountXlm,
              memo,
            });
          } else {
            stellarHash = await refundEscrowWithBarterGuard({
              escrowAccount: dispute.escrow.stellarEscrowAccount,
              arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
              buyerPublic: dispute.escrow.buyer.pollarWalletId,
              amountCents: dispute.escrow.amountXlm,
              memo,
            });
          }

          await tx.escrow.update({
            where: { id: dispute.escrowId },
            data: {
              status: 'refunded',
              refundedAt: new Date(),
              stellarTxHashRelease: stellarHash.hash,
            },
          });

          await tx.listing.update({
            where: { id: dispute.escrow.listingId },
            data: { status: 'active' },
          });

          await tx.offer.update({
            where: { id: dispute.escrow.offerId },
            data: { status: 'pending' },
          });

          if (DEMO_MODE) {
            await tx.user.update({
              where: { id: dispute.escrow.buyerId },
              data: { balanceXlm: { increment: dispute.escrow.amountXlm } },
            });
          }
        }

        const resolvedDispute = await tx.disputeEvidence.update({
          where: { id },
          data: { status: 'resolved' },
        });

        await tx.transactionLog.create({
          data: {
            escrowId: dispute.escrowId,
            actorId: user.id,
            action: 'dispute-resolved',
            metadata: JSON.stringify({ decision: parsed.resolution }),
          },
        });

        return resolvedDispute;
      }
    });

    return Response.json({ dispute: updatedDispute });
  } catch (error) {
    return handleApiError(error);
  }
}
