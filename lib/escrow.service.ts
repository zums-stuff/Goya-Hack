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
import {
  buildMemoText,
  releaseEscrowWithBarterGuard,
  refundEscrowWithBarterGuard,
  runReleaseOnTreasury,
  runRefundOnTreasury,
} from './stellar';
import { EscrowForbidden, EscrowInvalidTransition, ApiError } from './errors';
import { addMinutes } from 'date-fns';
import type { Prisma } from '@/generated/prisma/client';
import crypto from 'node:crypto';

export const DEMO_MODE =
  process.env.DEMO_FUNDING_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

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

// Pendiente-saga: el hash real todavía no existe cuando hacemos DB lock.
// PENDING-<random> ocupa stellarTxHashRelease mientras corre Phase 2 (Stellar).
// Phase 3a lo limpia en el rollback. Phase 3b lo reemplaza por el hash real.
// Cualquier fila con hash que empieza por 'PENDING-' indica una operación
// de cadena a medio camino (proceso murió, Horizon timeout, etc.) y debe
// limpiarse manualmente o vía cron de reconciliación (futuro Bloque 8).
const PENDING_PREFIX = 'PENDING-';
function makePendingToken(): string {
  return `${PENDING_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
}
function isPendingToken(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PENDING_PREFIX);
}

// submitReleaseChain / submitRefundChain: encapsulan la llamada real a
// Horizon (o al treasury mock en DEMO_MODE). Se ejecutan FUERA de cualquier
// transacción Prisma — si Horizon rechaza, nunca modificamos DB.
async function submitReleaseChain(
  escrow: {
    stellarEscrowAccount: string;
    arbiterSecretEnc: string | null;
    amountXlm: number;
    seller: { pollarWalletId: string };
  },
  feeCents: number,
  memo: string,
): Promise<{ hash: string }> {
  if (DEMO_MODE) {
    return runReleaseOnTreasury({
      escrowAccount: escrow.stellarEscrowAccount,
      arbiterSecretEnc: escrow.arbiterSecretEnc!,
      amountCents: escrow.amountXlm,
      memo,
    });
  }
  return releaseEscrowWithBarterGuard({
    escrowAccount: escrow.stellarEscrowAccount,
    arbiterSecretEnc: escrow.arbiterSecretEnc!,
    sellerPublic: escrow.seller.pollarWalletId,
    amountCents: escrow.amountXlm,
    feeCents,
    memo,
  });
}
async function submitRefundChain(
  escrow: {
    stellarEscrowAccount: string;
    arbiterSecretEnc: string | null;
    amountXlm: number;
    buyer: { pollarWalletId: string };
  },
  memo: string,
): Promise<{ hash: string }> {
  if (DEMO_MODE) {
    return runRefundOnTreasury({
      escrowAccount: escrow.stellarEscrowAccount,
      arbiterSecretEnc: escrow.arbiterSecretEnc!,
      amountCents: escrow.amountXlm,
      memo,
    });
  }
  return refundEscrowWithBarterGuard({
    escrowAccount: escrow.stellarEscrowAccount,
    arbiterSecretEnc: escrow.arbiterSecretEnc!,
    buyerPublic: escrow.buyer.pollarWalletId,
    amountCents: escrow.amountXlm,
    memo,
  });
}

// ─── Service ──────────────────────────────────────────────────────────────
export class EscrowService {
  // record-exchange: funded → awaiting-exchange (cierra M1/V1 con updateMany).
  static async recordExchange(escrowId: string, actorId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  // accept (Rama A) — multi-phase saga. Keeps DB and Stellar independent:
  //   Phase 1: DB lock to 'released' with hash=PENDING-<token>, listing/offer untouched.
  //   Phase 2: Stellar submit, OUTSIDE any DB tx.
  //   Phase 3a: chain failed → DB rollback to 'exchange-recorded' + clear pending.
  //   Phase 3b: chain success → DB finalize hash + listing/offer + (DEMO) balances.
  static async accept(escrowId: string, buyerId: string) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { buyer: true, seller: true, offer: true, listing: true },
    });
    if (escrow.buyerId !== buyerId) throw new EscrowForbidden('Solo el buyer puede aceptar.');
    if (escrow.status !== 'exchange-recorded') {
      throw new EscrowInvalidTransition(`Cannot accept from status ${escrow.status}.`);
    }

    const fee = feeCents(escrow.amountXlm);
    const memo = buildMemoText({
      escrowId: escrow.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      amountCents: escrow.amountXlm,
    });
    const pendingToken = makePendingToken();

    // Phase 1 — DB lock (regla #2). Exactly-one winner; the loser sees
    // count=0 and throws an invalid-transition. Listing/offer stay in
    // 'pending' until Phase 3b confirms the chain actually moved money.
    const lock1 = await prisma.escrow.updateMany({
      where: {
        id: escrowId,
        status: 'exchange-recorded',
        stellarTxHashRelease: null,
      },
      data: {
        status: 'released',
        acceptedAt: new Date(),
        stellarTxHashRelease: pendingToken,
      },
    });
    if (lock1.count !== 1) {
      throw new EscrowInvalidTransition(
        'Release ya enviada o estado inconsistente (otro request ganó).',
      );
    }

    // Phase 2 — Stellar submit. If Horizon errors or times out, revert in
    // Phase 3a and re-raise so the route handler returns a 5xx and the
    // buyer can retry from the same 'exchange-recorded' state.
    let stellarHash: { hash: string };
    try {
      stellarHash = await submitReleaseChain(escrow, fee, memo);
    } catch (e) {
      await prisma.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: {
          status: 'exchange-recorded',
          acceptedAt: null,
          stellarTxHashRelease: null,
        },
      });
      throw e;
    }

    // Phase 3b — DB finalize. Listing/offer/balances move in one tx so a
    // crash mid-update keeps all dependent rows consistent (Prisma
    // rollback restores them as a unit).
    return prisma.$transaction(async (tx) => {
      const lock3 = await tx.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: {
          stellarTxHashRelease: stellarHash.hash,
          stellarMemoReceipt: memo,
          platformFeeXlm: fee,
        },
      });
      if (lock3.count !== 1) {
        // pendingToken is unique per call. If this lock ever fails the row
        // has been mutated outside our control — bail loudly so a human
        // reconciles.
        throw new Error(
          `[escrow.service] accept phase-3 lock lost for ${escrowId}; manual reconciliation needed`,
        );
      }
      await tx.listing.update({
        where: { id: escrow.listingId },
        data: { status: 'sold' },
      });
      await tx.offer.update({
        where: { id: escrow.offerId },
        data: { status: 'completed' },
      });
      if (DEMO_MODE) {
        const netToSellerCents = escrow.amountXlm - fee;
        await tx.user.update({
          where: { id: escrow.sellerId },
          data: { balanceXlm: { increment: netToSellerCents } },
        });
        await tx.user.update({
          where: { id: escrow.buyerId },
          data: { balanceXlm: { decrement: escrow.amountXlm } },
        });
      }
      await tx.transactionLog.create({
        data: { escrowId, actorId: buyerId, action: 'accepted' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // auto-resolve (Rama B — cron) — multi-phase saga. Same shape as accept.
  static async autoResolve(escrowId: string) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { seller: true, buyer: true },
    });
    // Pre-check: idempotent if the row already left the exchange-recorded state.
    // Cron already filtered by ttlExpiresAt < now; this is defense in depth.
    if (escrow.status !== 'exchange-recorded') return escrow;

    const fee = feeCents(escrow.amountXlm);
    const memo = buildMemoText({
      escrowId: escrow.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      amountCents: escrow.amountXlm,
    });
    const pendingToken = makePendingToken();

    const lock1 = await prisma.escrow.updateMany({
      where: {
        id: escrowId,
        status: 'exchange-recorded',
        stellarTxHashRelease: null,
      },
      data: {
        status: 'auto-released',
        autoReleasedAt: new Date(),
        stellarTxHashRelease: pendingToken,
      },
    });
    if (lock1.count !== 1) return escrow; // another caller / past run won

    let stellarHash: { hash: string };
    try {
      stellarHash = await submitReleaseChain(escrow, fee, memo);
    } catch (e) {
      await prisma.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: {
          status: 'exchange-recorded',
          autoReleasedAt: null,
          stellarTxHashRelease: null,
        },
      });
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const lock3 = await tx.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: {
          stellarTxHashRelease: stellarHash.hash,
          stellarMemoReceipt: memo,
          platformFeeXlm: fee,
        },
      });
      if (lock3.count !== 1) {
        throw new Error(
          `[escrow.service] autoResolve phase-3 lock lost for ${escrowId}; manual reconciliation needed`,
        );
      }
      await tx.listing.update({
        where: { id: escrow.listingId },
        data: { status: 'sold' },
      });
      await tx.offer.update({
        where: { id: escrow.offerId },
        data: { status: 'completed' },
      });
      await tx.transactionLog.create({
        data: { escrowId, actorId: escrow.buyerId, action: 'auto-released' },
      });
      return tx.escrow.findUniqueOrThrow({ where: { id: escrowId } });
    });
  }

  // cancel — manual o auto-cancel (ventana confirmación vencida). Multi-phase.
  static async cancel(escrowId: string, actorId: string | null) {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: escrowId },
      include: { buyer: true, seller: true },
    });
    if (actorId && actorId !== escrow.buyerId && actorId !== escrow.sellerId) {
      throw new EscrowForbidden('Solo buyer o seller pueden cancelar.');
    }
    const cancellableStates = ['awaiting-funding', 'funded', 'awaiting-exchange'];
    if (!cancellableStates.includes(escrow.status)) {
      throw new EscrowInvalidTransition(
        `No se puede cancelar en estado ${escrow.status}.`,
      );
    }

    // Capture the original state so Phase 3a can revert to it on chain failure.
    const originalState = escrow.status as 'awaiting-funding' | 'funded' | 'awaiting-exchange';
    const memo = `PT-REFUND-${escrow.id.slice(0, 7)}-${escrow.amountXlm}`;
    const pendingToken = makePendingToken();

    // Phase 1 — DB lock to 'refunded' with pending token; listing/offer stay.
    const lock1 = await prisma.escrow.updateMany({
      where: {
        id: escrowId,
        status: { in: cancellableStates },
        stellarTxHashRelease: null,
      },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        stellarTxHashRelease: pendingToken,
      },
    });
    if (lock1.count !== 1) {
      throw new EscrowInvalidTransition('Cancel ya procesado (carrera o estado roto).');
    }

    // Phase 2 — Stellar refund, OUTSIDE the DB tx.
    let stellarHash: { hash: string };
    try {
      stellarHash = await submitRefundChain(escrow, memo);
    } catch (e) {
      // Phase 3a — DB revert to originalState. Listing/offer stay so a
      // follow-up offer can pick up the listing.
      await prisma.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: {
          status: originalState,
          refundedAt: null,
          stellarTxHashRelease: null,
        },
      });
      throw e;
    }

    // Phase 3b — DB finalize: revert listing/offer to actionable states,
    // (DEMO) refund the buyer's internal balance, log it.
    return prisma.$transaction(async (tx) => {
      const lock3 = await tx.escrow.updateMany({
        where: { id: escrowId, stellarTxHashRelease: pendingToken },
        data: { stellarTxHashRelease: stellarHash.hash },
      });
      if (lock3.count !== 1) {
        throw new Error(
          `[escrow.service] cancel phase-3 lock lost for ${escrowId}; manual reconciliation needed`,
        );
      }
      await tx.listing.update({
        where: { id: escrow.listingId },
        data: { status: 'active' },
      });
      await tx.offer.update({
        where: { id: escrow.offerId },
        data: { status: 'pending' },
      });
      if (DEMO_MODE) {
        await tx.user.update({
          where: { id: escrow.buyerId },
          data: { balanceXlm: { increment: escrow.amountXlm } },
        });
      }
      await tx.transactionLog.create({
        data: {
          escrowId,
          actorId: actorId ?? escrow.buyerId,
          action: 'refunded',
        },
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
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
// Multi-phase saga with two branches: release or refund.
  static async adminResolve(params: {
    disputeId: string;
    adminId: string;
    decision: 'release' | 'refund';
  }) {
    // Pre-checks (read-only).
    const dispute = await prisma.disputeEvidence.findUniqueOrThrow({
      where: { id: params.disputeId },
      include: {
        escrow: {
          include: { buyer: true, seller: true, offer: true, listing: true },
        },
      },
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

    const newEscrowStatus = params.decision === 'release' ? 'released' : 'refunded';
    const fee = feeCents(dispute.escrow.amountXlm);
    const memo = `PT-ADMIN-${params.decision === 'release' ? 'REL' : 'REF'}-${dispute.escrow.id.slice(0, 7)}`;
    const pendingToken = makePendingToken();

    // Phase 1 — DB lock escrow from 'disputed' → terminal status with pending token.
    const lock1 = await prisma.escrow.updateMany({
      where: {
        id: dispute.escrowId,
        status: 'disputed',
        stellarTxHashRelease: null,
      },
      data: {
        status: newEscrowStatus,
        [params.decision === 'release' ? 'acceptedAt' : 'refundedAt']: new Date(),
        stellarTxHashRelease: pendingToken,
      },
    });
    if (lock1.count !== 1) {
      throw new EscrowInvalidTransition(
        'Admin-resolve ya procesada o estado inconsistente.',
      );
    }

    // Phase 2 — Stellar submit, OUTSIDE the DB tx.
    let stellarHash: { hash: string };
    try {
      stellarHash =
        params.decision === 'release'
          ? await submitReleaseChain(dispute.escrow, fee, memo)
          : await submitRefundChain(dispute.escrow, memo);
    } catch (e) {
      // Phase 3a — revert to 'disputed' so dispute row can be re-resolved.
      await prisma.escrow.updateMany({
        where: { id: dispute.escrowId, stellarTxHashRelease: pendingToken },
        data: {
          status: 'disputed',
          stellarTxHashRelease: null,
          acceptedAt: null,
          refundedAt: null,
        },
      });
      throw e;
    }

    // Phase 3b — DB finalize with hash + dependent rows (listing/offer/dispute).
    return prisma.$transaction(async (tx) => {
      const lock3 = await tx.escrow.updateMany({
        where: { id: dispute.escrowId, stellarTxHashRelease: pendingToken },
        data: {
          stellarTxHashRelease: stellarHash.hash,
          stellarMemoReceipt: memo,
          platformFeeXlm: params.decision === 'release' ? fee : 0,
        },
      });
      if (lock3.count !== 1) {
        throw new Error(
          `[escrow.service] adminResolve phase-3 lock lost for ${dispute.escrowId}; manual reconciliation needed`,
        );
      }
      if (params.decision === 'release') {
        await tx.listing.update({
          where: { id: dispute.escrow.listingId },
          data: { status: 'sold' },
        });
        await tx.offer.update({
          where: { id: dispute.escrow.offerId },
          data: { status: 'completed' },
        });
      } else {
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
        data: {
          status: params.decision === 'release' ? 'resolved' : 'rejected',
        },
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
