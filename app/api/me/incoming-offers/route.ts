// app/api/me/incoming-offers/route.ts — Ofertas recibidas EN mis listings.
//
// Esta es la vista del SELLER. Devuelve cada oferta donde el listing
// pertenece al usuario actual, con el perfil del offerer, el monto,
// tipo y estado. Aceptar o rechazar dispara /api/escrow/accept-offer y
// /api/offers/:id (PATCH) en el cliente.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const offers = await prisma.offer.findMany({
      where: { listing: { sellerId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        listing: { select: { id: true, title: true, priceXlm: true, status: true } },
        offerer: { select: { id: true, displayName: true, major: true } },
      },
    });
    return Response.json({ offers, meId: user.id }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
