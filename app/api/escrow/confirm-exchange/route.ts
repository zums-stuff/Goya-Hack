// app/api/escrow/confirm-exchange/route.ts — awaiting-exchange → exchange-recorded.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ConfirmExchangeSchema } from '@/lib/schemas';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { escrowId } = ConfirmExchangeSchema.parse(await req.json());
    const escrow = await EscrowService.confirmExchange(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
