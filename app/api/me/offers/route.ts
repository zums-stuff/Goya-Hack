// app/api/me/offers/route.ts — Lista las ofertas hechas POR el usuario actual.
// Embedded listing (resumen) para que el dashboard pueda renderizar.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const offers = await prisma.offer.findMany({
      where: { offererId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        listing: {
          select: { id: true, title: true, priceXlm: true, status: true, type: true },
        },
      },
    });
    return Response.json({ offers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleApiError(e);
  }
}
