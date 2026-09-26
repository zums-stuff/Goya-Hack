// app/api/escrow/accept/route.ts — Rama A: release firmado.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AcceptSchema } from '@/lib/schemas';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { escrowId } = AcceptSchema.parse(await req.json());
    const escrow = await EscrowService.accept(escrowId, user.id);
    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
