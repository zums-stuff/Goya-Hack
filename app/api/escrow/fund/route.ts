// app/api/escrow/fund/route.ts — Devuelve paymentParams para que el buyer
// ejecute `runTx('payment', ...)` (no SendModal, verificado §5.4 / §10.4).
// Es idempotente: si el escrow ya está en `funded` (o más allá), devuelve
// el estado actual. El cliente además hace la tx Stellar y luego vuelve a
// llamar — el server verifica balance en Horizon antes de marcar `funded`.
//
// MODO DEMO (`process.env.DEMO_FUNDING_BYPASS === 'true'`):
//   Si el usuario tiene un intent explícito (`{ force: true }` en el body)
//   Y el server está en demo mode (env flag), el server marca el escrow
//   como funded SIN pedir paymentParams de Stellar. Usado en demos donde
//   las keys de Pollar son placeholders y la tx on-chain no se puede enviar.
//   El cliente renderiza un banner "DEMO — sin tx on-chain" para que sea
//   explícito al jurado/usuario.

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { FundSchema } from '@/lib/schemas';
import { horizon, fundEscrowFromTreasury } from '@/lib/stellar';
import { centsToXlm } from '@/lib/fees';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { escrowId } = FundSchema.parse(body);
    const forceDemo = Boolean((body as { force?: boolean }).force);
    const demoBypass =
      forceDemo && process.env.DEMO_FUNDING_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

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

    // Demo bypass: en demo, el platform treasury paga al escrow POR el
    // buyer (los seed users tienen placeholders `G_PLACEHOLDER_*`). Esta
    // rama ejecuta una transacción REAL en Stellar testnet, captura el
    // hash en DB, debita el balance interno del buyer, y avanza el state
    // machine a `funded`. No es un no-op: el dinero sale de la tesorería
    // (custodia) y se mueve en testnet, quedando visible en stellar.expert.
    if (demoBypass) {
      // Verificar saldo interno antes de avanzar (en demo, el saldo del
      // buyer vive en nuestra DB; en prod es el balance real en Stellar).
      const buyerRow = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { balanceXlm: true },
      });
      if (buyerRow.balanceXlm < escrow.amountXlm) {
        return handleApiError(
          new ApiError(
            409,
            'insufficient_demo_balance',
            `Saldo insuficiente: tienes ${buyerRow.balanceXlm / 100} XLM, necesitas ${escrow.amountXlm / 100} XLM.`,
          ),
        );
      }

      try {
        const { hash } = await fundEscrowFromTreasury({
          escrowAccount: escrow.stellarEscrowAccount,
          buyerId: user.id,
          amountCents: escrow.amountXlm,
        });
        const lock = await prisma.escrow.updateMany({
          where: { id: escrowId, status: 'awaiting-funding' },
          data: {
            status: 'funded',
            stellarTxHashFunding: hash,
            stellarMemoReceipt: `PT-FUND-${user.id.slice(0, 8)}-${escrow.stellarEscrowAccount.slice(-7)}`,
          },
        });
        if (lock.count === 1) {
          await prisma.transactionLog.create({
            data: {
              escrowId,
              actorId: user.id,
              action: 'escrow-funded-demo-treasury',
              metadata: JSON.stringify({ txHash: hash }),
            },
          });
          // Debita el balance interno del buyer (la tesorería custodia
          // los fondos en nombre de seller/buyer; en producción sería
          // saldo real en la wallet del buyer).
          await prisma.user.update({
            where: { id: user.id },
            data: { balanceXlm: { decrement: escrow.amountXlm } },
          });
        }
        const updated = await prisma.escrow.findUniqueOrThrow({ where: { id: escrowId } });
        return Response.json({
          escrow: updated,
          funded: true,
          paymentParams: null,
          demoBypass: true,
          stellarTxHash: hash,
        });
      } catch (e) {
        // Si Horizon falla (rate-limit, red caída, etc.), devolvemos el
        // error original — NO avanzamos a `funded`. El cliente verá
        // "Error al fondear vía tesorería".
        return handleApiError(e);
      }
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
