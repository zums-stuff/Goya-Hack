// app/api/escrow/my/route.ts — Lista los escrows donde soy buyer O seller.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await requireUser();
    const escrows = await prisma.escrow.findMany({
      where: { OR: [{ buyerId: me.id }, { sellerId: me.id }] },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { displayName: true } },
        seller: { select: { displayName: true } },
      },
    });
    return Response.json({ escrows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleApiError(e);
  }
}
