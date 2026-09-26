// app/api/escrow/cancel/route.ts — Manual cancel. Los estados permitidos son
// awaiting-funding/funded/awaiting-exchange (regla §7.2). Idempotente vía regla #2.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CancelSchema } from '@/lib/schemas';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { escrowId } = CancelSchema.parse(await req.json());
    const escrow = await EscrowService.cancel(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
