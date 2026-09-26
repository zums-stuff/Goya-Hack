// app/api/offers/[id]/route.ts — PATCH (withdraw o rejected).
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { UpdateOfferSchema } from '@/lib/schemas';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const { status } = UpdateOfferSchema.parse(await req.json());

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { listing: { select: { sellerId: true } } },
    });
    if (!offer) throw new ApiError(404, 'offer_not_found', 'No existe la oferta.');

    // Permisos: el ofertante puede withdrew; el seller puede rejected.
    if (status === 'withdrawn' && offer.offererId !== user.id) {
      throw new ApiError(403, 'not_offerer', 'Solo el ofertante puede retirar su oferta.');
    }
    if (status === 'rejected') {
      const isSeller = offer.listing.sellerId === user.id;
      const isOfferer = offer.offererId === user.id;
      if (!isSeller && !isOfferer) {
        throw new ApiError(403, 'not_authorized', 'No autorizado para rechazar.');
      }
    }

    // Solo se puede mover desde 'pending'.
    if (offer.status !== 'pending') {
      throw new ApiError(409, 'offer_not_pending', `Estado actual: ${offer.status}`);
    }

    const updated = await prisma.offer.update({ where: { id }, data: { status } });
    return Response.json({ offer: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
