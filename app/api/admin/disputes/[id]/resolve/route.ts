// app/api/admin/disputes/[id]/resolve/route.ts — Admin resuelve disputa manualmente
// (cierre A5 §12.7). Sin esta ruta, `disputed` sería frozen forever.
//
// Auth: cookie + email ∈ ADMIN_EMAILS.
//
// Acepta dos Content-Types:
//   - application/json  → clientes fetch (heredado del test-vitest)
//   - application/x-www-form-urlencoded (o multipart) → el <form> del admin UI
//
// Antes solo aceptaba JSON y el <form> urlencoded devolvía 500. Ahora
// distinguimos por Content-Type.
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

/**
 * Parse a POST body regardless of content type. JSON for fetch clients;
 * FormData (covers both urlencoded and multipart) for the HTML <form>.
 */
async function parseBody(req: Request): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return req.json();
  }
  const fd = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // requireUser lanza 401 si no hay sesión.
    const user = await requireUser();
    const email = await getSessionEmail();
    if (!email || !isAdmin(email)) {
      throw new ApiError(403, 'not_admin', 'Solo ADMIN_EMAILS pueden resolver disputas.');
    }
    const { id } = await ctx.params;
    const raw = await parseBody(req);
    const { decision } = Schema.parse(raw);
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
