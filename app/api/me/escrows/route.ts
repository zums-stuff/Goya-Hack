// app/api/me/escrows/route.ts — Lista los escrows donde participo como
// comprador o vendedor, ordenada por updatedAt desc.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const escrows = await prisma.escrow.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
        listing: { select: { id: true, title: true, priceXlm: true } },
      },
    });
    return Response.json({ escrows, meId: user.id }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
