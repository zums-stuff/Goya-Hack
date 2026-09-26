// app/api/offers/route.ts — POST: crear oferta (con refine semántico).
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CreateOfferSchema } from '@/lib/schemas';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = CreateOfferSchema.parse(await req.json());

    // El listing debe estar en 'active' (no pending, sold, paused).
    const listing = await prisma.listing.findUnique({
      where: { id: body.listingId },
      select: { id: true, sellerId: true, status: true },
    });
    if (!listing) throw new ApiError(404, 'listing_not_found', 'No existe el listing.');
    if (listing.sellerId === user.id) {
      throw new ApiError(409, 'self_offer', 'No puedes ofertarte a ti mismo.');
    }
    if (listing.status !== 'active') {
      throw new ApiError(
        409,
        'listing_not_available',
        `El listing está: ${listing.status}`,
      );
    }

    const offer = await prisma.offer.create({
      data: {
        listingId: body.listingId,
        offererId: user.id,
        type: body.type,
        offeredItems: body.offeredItems ? JSON.stringify(body.offeredItems) : null,
        xlmAmount: body.xlmAmount ?? null,
        message: body.message ?? null,
      },
    });
    return Response.json({ offer }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
