// app/api/listings/[id]/route.ts — GET detalle (incluye offers solo si eres el seller).
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params; // Next 16: params es Promise.
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { seller: { select: { id: true, displayName: true, major: true } } },
    });
    if (!listing) return Response.json({ error: 'not_found' }, { status: 404 });

    const me = await tryGetUser();
    // ⚠️ Solo el seller ve todas las offers del tablero (M4 §12.7 IDOR);
    //    otros ven "offersCount" sin detalle.
    let offers: unknown[] | { offersCount: number } = { offersCount: 0 };
    if (me?.id === listing.sellerId) {
      offers = await prisma.offer.findMany({
        where: { listingId: id, status: { not: 'withdrawn' } },
        orderBy: { createdAt: 'desc' },
        include: { offerer: { select: { id: true, displayName: true, major: true } } },
      });
    } else if (me) {
      offers = { offersCount: await prisma.offer.count({ where: { listingId: id, status: { not: 'withdrawn' } } }) };
    } else {
      offers = { offersCount: 0 };
    }
    return Response.json({ listing, offers });
  } catch (e) {
    return handleApiError(e);
  }
}
