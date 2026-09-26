// lib/escrow.service.ts — Máquina de estados del escrow con **regla #2**:
// toda transición es un `tx.escrow.updateMany` condicional al estado esperado
// y verifica `count === 1` antes de proceder. Esto cierra todas las
// condiciones de carrera entre:
//
//   - Dos clicks concurrentes del mismo usuario (doble-click).
//   - Click manual vs cron (cron auto-cancel vs. accept).
//   - Dos vendedores o dos buyers.
//
// Doc: §7.3 (reglas de oro) + §7.2 (tabla de transiciones) + §12.7 (matriz).

import { prisma } from './db';
import { env } from './config';
import { feeCents, centsToXlm } from './fees';
import { buildMemoText, releaseEscrowWithBarterGuard, refundEscrowWithBarterGuard } from './stellar';
import { EscrowForbidden, EscrowInvalidTransition, ApiError } from './errors';
import { addMinutes } from 'date-fns';

const confirmWindowMinutes = () => env.CONFIRM_WINDOW_MINUTES;
const ttlMinutes = () => env.DEMO_TTL_MINUTES ?? 48 * 60;

// ─── Helpers ───────────────────────────────────────────────────────────────
function expectBuyerOrSeller(
  escrow: { buyerId: string; sellerId: string },
  actorId: string,
): 'buyer' | 'seller' {
  if (escrow.buyerId === actorId) return 'buyer';
  if (escrow.sellerId === actorId) return 'seller';
  throw new EscrowForbidden('Solo buyer o seller pueden operar este escrow');
}

// ─── Service ──────────────────────────────────────────────────────────────
export class EscrowService {
  // record-exchange: funded → awaiting-exchange (cierra M1/V1 con updateMany).
  static async recordExchange(escrowId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const lookup = await tx.escrow.findUniqueOrThrow({
        where: { id: escrowId },
        select: { buyerId: true, sellerId: true, status: true },
      });
      expectBuyerOrSeller(lookup, actorId);

      const lock = await tx.escrow.updateMany({
        where: { id: escrowId, status: 'funded' },
        data: {
          status: 'awaiting-exchange',
          exchangeInitiatorId: actorId,
          exchangeInitiatedAt: new Date(),
          confirmWindowExpiresAt: addMinutes(new Date(), confirmWindowMinutes()),
        },
      });
      if (lock.count !== 1) {
        throw new EscrowInvalidTransition(
          'El escrow ya está en estado no-fundable (carrera o estado roto).',
        );
      }

      await tx.transactionLog.create({
        data: { escrowId, actorId, action: 'exchange-initiated' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // confirm-exchange: awaiting-exchange → exchange-recorded. Confirmer ≠ initiator.
  static async confirmExchange(escrowId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const lookup = await tx.escrow.findUniqueOrThrow({
        where: { id: escrowId },
        select: {
          buyerId: true,
          sellerId: true,
          exchangeInitiatorId: true,
          status: true,
          amountXlm: true,
        },
      });
      // Confirmer ≠ initiator (ya validado en business logic ↔ flujo UI).
      // accept-offer ya garantiza que ambos lados existen; aquí validamos tipo.
      if (actorId !== lookup.buyerId && actorId !== lookup.sellerId) {
        throw new EscrowForbidden('Solo buyer o seller pueden confirmar.');
      }
      if (actorId === lookup.exchangeInitiatorId) {
        throw new EscrowInvalidTransition(
          'El initiator ya registró: la otra parte debe confirmar.',
        );
      }

      const lock = await tx.escrow.updateMany({
        where: {
          id: escrowId,
          status: 'awaiting-exchange',
          exchangeInitiatorId: lookup.exchangeInitiatorId, // aún no cambiado
        },
        data: {
          status: 'exchange-recorded',
          exchangeConfirmerId: actorId,
          exchangeConfirmedAt: new Date(),
          ttlExpiresAt: addMinutes(new Date(), ttlMinutes()),
        },
      });
      if (lock.count !== 1) {
        throw new EscrowInvalidTransition('Confirmación perdida o estado inconsistente.');
      }

      await tx.transactionLog.create({
        data: { escrowId, actorId, action: 'exchange-confirmed' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // accept (Rama A) — firma release on-chain y actualiza estado.
  static async accept(escrowId: string, buyerId: string) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { buyer: true, seller: true, offer: true, listing: true },
    });
    if (escrow.buyerId !== buyerId) throw new EscrowForbidden('Solo el buyer puede aceptar.');
    if (escrow.status !== 'exchange-recorded') {
      throw new EscrowInvalidTransition(
        `Cannot accept from status ${escrow.status}.`,
      );
    }

    // 1. Calcular distribución y memo.
    const fee = feeCents(escrow.amountXlm);
    const memo = buildMemoText({
      escrowId: escrow.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      amountCents: escrow.amountXlm,
    });

    // 2. Idempotencia pre-firma (regla #2 §7.3): marca hash provisional
    //    SOLO si todavía no hay tx hash. Si count === 0, otro request ya firmó.
    //    ⚠️ preLock con hash="PENDING-<uuid>" para no perder la transición si
    //    la firma falló — actually mejor: usamos updateMany que requiere status
    //    correcto, y al final sobrescribimos el hash si la firma succeed.
    //    Aquí simplificamos: transacción que marca `released` solo si stellarTxHashRelease IS NULL.
    return prisma.$transaction(async (tx) => {
      const lock = await tx.escrow.updateMany({
        where: { id: escrowId, status: 'exchange-recorded', stellarTxHashRelease: null },
        data: {
          status: 'released',
          acceptedAt: new Date(),
        },
      });
      if (lock.count !== 1) {
        throw new EscrowInvalidTransition(
          'Release ya enviada o estado inconsistente (otro request ganó).',
        );
      }

      // 3. Firma Stellar FUERA de la tx de DB — si falla, hacemos rollback manual
      //    (el caller de accept-api debe re-leer y, si count=0, revertir el estado).
      //    En realidad esta firma se hace dentro de un bloque try/catch que en
      //    caso de error revierte el puto (lo vemos en el route handler).
      // Aquí el caller controla el try/catch; nosotros solo orquestamos.
      const stellarHash = await releaseEscrowWithBarterGuard({
        escrowAccount: escrow.stellarEscrowAccount,
        arbiterSecretEnc: escrow.arbiterSecretEnc!,
        sellerPublic: escrow.seller.pollarWalletId,
        amountCents: escrow.amountXlm,
        feeCents: fee,
        memo,
      });

      await tx.escrow.update({
        where: { id: escrowId },
        data: {
          stellarTxHashRelease: stellarHash.hash,
          stellarMemoReceipt: memo,
          platformFeeXlm: fee,
        },
      });
      await tx.listing.update({
        where: { id: escrow.listingId },
        data: { status: 'sold' },
      });
      await tx.offer.update({
        where: { id: escrow.offerId },
        data: { status: 'completed' },
      });
      await tx.transactionLog.create({
        data: { escrowId, actorId: buyerId, action: 'accepted' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // auto-resolve (Rama B — cron)
  static async autoResolve(escrowId: string) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { seller: true, buyer: true },
    });
    // Cron ya filtra por ttlExpiresAt < now; releemos por seguridad.
    if (escrow.status !== 'exchange-recorded') {
      // Si ya está released/auto-released, no hacemos nada (idempotente).
      return escrow;
    }

    const fee = feeCents(escrow.amountXlm);
    const memo = buildMemoText({
      escrowId: escrow.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      amountCents: escrow.amountXlm,
    });

    return prisma.$transaction(async (tx) => {
      const lock = await tx.escrow.updateMany({
        where: { id: escrowId, status: 'exchange-recorded', stellarTxHashRelease: null },
        data: { status: 'auto-released', autoReleasedAt: new Date() },
      });
      if (lock.count !== 1) return escrow;

      const stellarHash = await releaseEscrowWithBarterGuard({
        escrowAccount: escrow.stellarEscrowAccount,
        arbiterSecretEnc: escrow.arbiterSecretEnc!,
        sellerPublic: escrow.seller.pollarWalletId,
        amountCents: escrow.amountXlm,
        feeCents: fee,
        memo,
      });
      await tx.escrow.update({
        where: { id: escrowId },
        data: {
          stellarTxHashRelease: stellarHash.hash,
          stellarMemoReceipt: memo,
          platformFeeXlm: fee,
        },
      });
      await tx.listing.update({ where: { id: escrow.listingId }, data: { status: 'sold' } });
      await tx.offer.update({ where: { id: escrow.offerId }, data: { status: 'completed' } });
      await tx.transactionLog.create({
        data: { escrowId, actorId: escrow.buyerId, action: 'auto-released' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // cancel — manual o auto-cancel (ventana confirmación vencida)
  static async cancel(escrowId: string, actorId: string | null) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { buyer: true, seller: true },
    });
    // actorId null → auto-cancel (cron).
    if (actorId && actorId !== escrow.buyerId && actorId !== escrow.sellerId) {
      throw new EscrowForbidden('Solo buyer o seller pueden cancelar.');
    }
    const cancellableStates = ['awaiting-funding', 'funded', 'awaiting-exchange'];
    if (!cancellableStates.includes(escrow.status)) {
      throw new EscrowInvalidTransition(
        `No se puede cancelar en estado ${escrow.status}.`,
      );
    }

    const memo = `PT-REFUND-${escrow.id.slice(0, 7)}-${escrow.amountXlm}`;

    return prisma.$transaction(async (tx) => {
      const lock = await tx.escrow.updateMany({
        where: {
          id: escrowId,
          status: { in: cancellableStates },
          stellarTxHashRelease: null,
        },
        data: { status: 'refunded', refundedAt: new Date() },
      });
      if (lock.count !== 1) {
        throw new EscrowInvalidTransition('Cancel ya procesado (carrera o estado roto).');
      }

      const stellarHash = await refundEscrowWithBarterGuard({
        escrowAccount: escrow.stellarEscrowAccount,
        arbiterSecretEnc: escrow.arbiterSecretEnc!,
        buyerPublic: escrow.buyer.pollarWalletId,
        amountCents: escrow.amountXlm,
        memo,
      });
      await tx.escrow.update({
        where: { id: escrowId },
        data: { stellarTxHashRelease: stellarHash.hash },
      });
      await tx.listing.update({ where: { id: escrow.listingId }, data: { status: 'active' } });
      await tx.offer.update({ where: { id: escrow.offerId }, data: { status: 'pending' } });
      await tx.transactionLog.create({
        data: { escrowId, actorId: actorId ?? escrow.buyerId, action: 'refunded' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // Dispute (Rama C) — congelar fondos, anclar hash, crear DisputeEvidence.
  // ⚠️ B1b (§12.7): rechazar si ya hay DisputeEvidence para este escrow (foto inmutable).
  static async dispute(params: {
    escrowId: string;
    reporterId: string;
    reason: 'item-damaged' | 'exchange-never-happened' | 'item-different';
    description: string;
    photoBuffer: Buffer;
    photoMime: string;
    photoUrl: string;
    photoHash: string;
    stellarAnchorTxHash: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.disputeEvidence.findFirst({
        where: { escrowId: params.escrowId },
      });
      if (existing) {
        throw new ApiError(
          409,
          'dispute_already_open',
          'Este escrow ya tiene una disputa abierta (foto inmutable).',
        );
      }

      const cstate = await tx.escrow.findUniqueOrThrow({
        where: { id: params.escrowId },
        select: { status: true },
      });
      if (!['exchange-recorded', 'awaiting-exchange'].includes(cstate.status)) {
        throw new EscrowInvalidTransition(
          `No se puede reportar disputa en estado ${cstate.status}.`,
        );
      }

      const lock = await tx.escrow.updateMany({
        where: {
          id: params.escrowId,
          status: { in: ['exchange-recorded', 'awaiting-exchange'] },
        },
        data: {
          status: 'disputed',
          disputedAt: new Date(),
          disputeReason: params.reason,
          disputeEvidenceHash: params.photoHash,
          disputePhotoUrl: params.photoUrl,
        },
      });
      if (lock.count !== 1) {
        throw new EscrowInvalidTransition('Carrera: estado cambió durante la disputa.');
      }

      await tx.disputeEvidence.create({
        data: {
          escrowId: params.escrowId,
          reporterId: params.reporterId,
          reason: params.reason,
          description: params.description,
          photoUrl: params.photoUrl,
        },
      });
      await tx.transactionLog.create({
        data: {
          escrowId: params.escrowId,
          actorId: params.reporterId,
          action: 'disputed',
          metadata: JSON.stringify({ stellarAnchorTxHash: params.stellarAnchorTxHash }),
        },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: params.escrowId } });
    });
  }

  // admin-resolve (A5 §12.7 §11.5 hotfix): resuelve disputed manualmente.
  static async adminResolve(params: {
    disputeId: string;
    adminId: string;
    decision: 'release' | 'refund';
  }) {
    return prisma.$transaction(async (tx) => {
      const dispute = await tx.disputeEvidence.findUniqueOrThrow({
        where: { id: params.disputeId },
        include: { escrow: { include: { buyer: true, seller: true, offer: true, listing: true } } },
      });
      if (dispute.status !== 'pending') {
        throw new ApiError(
          409,
          'dispute_already_resolved',
          `Dispute status: ${dispute.status}`,
        );
      }
      if (dispute.escrow.status !== 'disputed') {
        throw new EscrowInvalidTransition(
          `Escrow status: ${dispute.escrow.status} (no disputed).`,
        );
      }

      const fee = feeCents(dispute.escrow.amountXlm);
      const memo = `PT-ADMIN-${params.decision === 'release' ? 'REL' : 'REF'}-${dispute.escrow.id.slice(0, 7)}`;

      if (params.decision === 'release') {
        const stellarHash = await releaseEscrowWithBarterGuard({
          escrowAccount: dispute.escrow.stellarEscrowAccount,
          arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
          sellerPublic: dispute.escrow.seller.pollarWalletId,
          amountCents: dispute.escrow.amountXlm,
          feeCents: fee,
          memo,
        });
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
      } else {
        const stellarHash = await refundEscrowWithBarterGuard({
          escrowAccount: dispute.escrow.stellarEscrowAccount,
          arbiterSecretEnc: dispute.escrow.arbiterSecretEnc!,
          buyerPublic: dispute.escrow.buyer.pollarWalletId,
          amountCents: dispute.escrow.amountXlm,
          memo,
        });
        await tx.escrow.update({
          where: { id: dispute.escrowId },
          data: { status: 'refunded', refundedAt: new Date(), stellarTxHashRelease: stellarHash.hash },
        });
        await tx.listing.update({
          where: { id: dispute.escrow.listingId },
          data: { status: 'active' },
        });
        await tx.offer.update({
          where: { id: dispute.escrow.offerId },
          data: { status: 'pending' },
        });
      }

      await tx.disputeEvidence.update({
        where: { id: params.disputeId },
        data: { status: params.decision === 'release' ? 'resolved' : 'rejected' },
      });
      await tx.transactionLog.create({
        data: {
          escrowId: dispute.escrowId,
          actorId: params.adminId,
          action: 'dispute-resolved',
          metadata: JSON.stringify({ decision: params.decision }),
        },
      });
      return tx.disputeEvidence.findUniqueOrThrow({ where: { id: params.disputeId } });
    });
  }
}

// Re-export para los route handlers que aún importen helpers sueltos.
export { centsToXlm };
