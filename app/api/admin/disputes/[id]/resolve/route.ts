// app/api/admin/disputes/[id]/resolve/route.ts — Admin resuelve disputa manualmente
// (cierre A5 §12.7). Sin esta ruta, `disputed` sería frozen forever.
//
// Auth: cookie + email ∈ ADMIN_EMAILS.
import { prisma } from '@/lib/db';
import { requireUser, getSessionEmail } from '@/lib/auth';
import { isAdmin } from '@/lib/config';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError, ApiError } from '@/lib/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  decision: z.enum(['release', 'refund']),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // requireUser lanza 401 si no hay sesión.
    const user = await requireUser();
    const email = await getSessionEmail();
    if (!email || !isAdmin(email)) {
      throw new ApiError(403, 'not_admin', 'Solo ADMIN_EMAILS pueden resolver disputas.');
    }
    const { id } = await ctx.params;
    const { decision } = Schema.parse(await req.json());
    const dispute = await EscrowService.adminResolve({
      disputeId: id,
      adminId: user.id,
      decision,
    });
    return Response.json({ dispute });
  } catch (e) {
    return handleApiError(e);
  }
}
