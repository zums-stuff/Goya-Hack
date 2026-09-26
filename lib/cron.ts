// lib/cron.ts — runTimeoutCheck: 2 pasadas (TTL + ventana de confirmación).
// Regla #2 (§7.3): las pasadas releen el estado y abortan si cambió.

import { prisma } from './db';
import { EscrowService } from './escrow.service';

export type CronResult = {
  released: number;
  autoCancelled: number;
};

/**
 * Pasada 1: TTL vencido en `exchange-recorded` → auto-resolve (Rama B).
 * Pasada 2: ventana de confirmación vencida en `awaiting-exchange` → auto-cancel.
 *
 * `take: 10` por pasada evita un cron tan agresivo que sature Horizon.
 * Para 100+ escrows en estado live, ajustar y considerar batching paralelo.
 */
export async function runTimeoutCheck(now = new Date()): Promise<CronResult> {
  // Pasada 1: TTL.
  const expired = await prisma.escrow.findMany({
    where: { status: 'exchange-recorded', ttlExpiresAt: { lt: now } },
    select: { id: true },
    take: 10,
  });
  let released = 0;
  for (const { id } of expired) {
    try {
      await EscrowService.autoResolve(id);
      released++;
      console.log(`[cron] auto-resolved escrow ${id}`);
    } catch (e) {
      console.error(`[cron] failed to auto-resolve ${id}:`, e);
    }
  }

  // Pasada 2: ventana de confirmación vencida → auto-cancel (refund al buyer).
  const windowExpired = await prisma.escrow.findMany({
    where: { status: 'awaiting-exchange', confirmWindowExpiresAt: { lt: now } },
    select: { id: true },
    take: 10,
  });
  let autoCancelled = 0;
  for (const { id } of windowExpired) {
    try {
      // autoCancel = cancel(escrowId, actorId=null) — el servicio acepta.
      await EscrowService.cancel(id, null);
      autoCancelled++;
      console.log(`[cron] auto-cancelled escrow ${id} (Ventana de confirmación expirada)`);
    } catch (e) {
      console.error(`[cron] failed to auto-cancel ${id}:`, e);
    }
  }

  return { released, autoCancelled };
}
