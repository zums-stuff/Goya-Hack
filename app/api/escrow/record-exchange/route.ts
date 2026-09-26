// app/api/escrow/record-exchange/route.ts — funded → awaiting-exchange.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { RecordExchangeSchema } from '@/lib/schemas';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { escrowId } = RecordExchangeSchema.parse(await req.json());
    const escrow = await EscrowService.recordExchange(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
