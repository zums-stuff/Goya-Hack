// app/api/escrow/[id]/route.ts — GET detalle del escrow (M4 §12.7 IDOR guard).
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const me = await tryGetUser();

    const escrow = await prisma.escrow.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, displayName: true, pollarWalletId: true } },
        seller: { select: { id: true, displayName: true, pollarWalletId: true } },
        listing: { select: { id: true, title: true, priceXlm: true, type: true } },
      },
    });
    if (!escrow) return Response.json({ error: 'not_found' }, { status: 404 });

    // ⚠️ IDOR guard (§12.7 M4): solo buyer o seller del escrow (403 en otros casos).
    if (!me || (me.id !== escrow.buyerId && me.id !== escrow.sellerId)) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const events = await prisma.transactionLog.findMany({
      where: { escrowId: id },
      orderBy: { createdAt: 'asc' },
    });

    return Response.json({ escrow, events });
  } catch (e) {
    return handleApiError(e);
  }
}
