// app/api/escrow/accept/route.ts — Rama A: release firmado.
//
// MODO DEMO (`process.env.DEMO_FUNDING_BYPASS === 'true'` + `force: true`):
//   En demo, los seed users tienen placeholders `G_PLACEHOLDER_*` así que no
//   pueden firmar el release desde la UI. Esta rama llama directamente
//   `EscrowService.accept` (que firma la tx Stellar REAL con platform +
//   arbiter keypairs) y devuelve el hash que Stellar testnet devolvió.
//   El state machine avanza idénticamente con un on-chain payment de
//   escrow account → seller. En PRODUCCIÓN con keys reales de Pollar, el
//   cliente usaría `runTx` para firmar también las 2 firmas requeridas
//   (PLATFORM + arbiter); mientras la primera firma ya la hace el server,
//   esta rama demo es funcionalmente equivalente.

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
      // Validaciones de transición antes de firmar tx on-chain.
      const pre = await prisma.escrow.findUnique({
        where: { id: escrowId },
        select: { buyerId: true, status: true },
      });
      if (!pre) throw new ApiError(404, 'escrow_not_found', 'No existe.');
      if (pre.buyerId !== user.id) {
        throw new ApiError(403, 'not_buyer', 'Solo el buyer puede aceptar.');
      }
      if (pre.status !== 'exchange-recorded') {
        throw new ApiError(
          409,
          'invalid_transition',
          `Cannot accept from ${pre.status}.`,
        );
      }
      // Llama al service real — firma Stellar on-chain y avanza DB.
      const escrow = await EscrowService.accept(escrowId, user.id);
      return Response.json({ escrow, demoBypass: true });
    }

    const escrow = await EscrowService.accept(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
