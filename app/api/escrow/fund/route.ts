// app/api/escrow/fund/route.ts — Devuelve paymentParams para que el buyer
// ejecute `runTx('payment', ...)` (no SendModal, verificado §5.4 / §10.4).
// Es idempotente: si el escrow ya está en `funded` (o más allá), devuelve
// el estado actual. El cliente además hace la tx Stellar y luego vuelve a
// llamar — el server verifica balance en Horizon antes de marcar `funded`.

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { FundSchema } from '@/lib/schemas';
import { horizon } from '@/lib/stellar';
import { centsToXlm } from '@/lib/fees';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { escrowId } = FundSchema.parse(await req.json());

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { buyer: true, seller: true, listing: true },
    });
    if (!escrow) throw new ApiError(404, 'escrow_not_found', 'No existe el escrow.');
    if (escrow.buyerId !== user.id) {
      throw new ApiError(403, 'not_buyer', 'Solo el buyer puede fondear.');
    }
    if (escrow.amountXlm === 0) {
      // Barter puro: nada que fondear, ya nace en 'funded'.
      throw new ApiError(
        409,
        'barter_no_funding_needed',
        'Trueque puro: el escrow no requiere fondeo.',
      );
    }

    // Idempotente: si ya pasó, devolver estado sin tocar nada.
    if (escrow.status !== 'awaiting-funding') {
      return Response.json({ escrow, funded: true, paymentParams: null });
    }

    // Verificar balance en Horizon para confirmar que el pago llegó.
    try {
      const account = await horizon.loadAccount(escrow.stellarEscrowAccount);
      const xlm = account.balances.find((b) => b.asset_type === 'native');
      const currentXlm = xlm ? Number(xlm.balance) : 0;
      const expectedXlm = escrow.amountXlm / 100;
      if (currentXlm >= expectedXlm) {
        // Pago recibido → marcar funded (updateMany condicional).
        const lock = await prisma.escrow.updateMany({
          where: { id: escrowId, status: 'awaiting-funding' },
          data: { status: 'funded' },
        });
        if (lock.count === 1) {
          await prisma.transactionLog.create({
            data: { escrowId, actorId: user.id, action: 'escrow-funded' },
          });
          const updated = await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } });
          return Response.json({ escrow: updated, funded: true, paymentParams: null });
        }
        // Otro request ganó; limpiamos y devolvemos lo actual.
        const reread = await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } });
        return Response.json({ escrow: reread, funded: true, paymentParams: null });
      }
    } catch (e) {
      // Si Horizon no encuentra la cuenta, es porque el pago todavía no llegó.
      // Caemos al return de paymentParams más abajo.
      console.debug('[fund] Horizon account error (continuing):', e);
    }

    // Aún no pagó: devolver params para que el cliente ejecute runTx.
    return Response.json({
      escrow,
      funded: false,
      paymentParams: {
        destination: escrow.stellarEscrowAccount,
        amount: centsToXlm(escrow.amountXlm),
        asset: { type: 'native' }, // XLM nativo (§6.3)
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
