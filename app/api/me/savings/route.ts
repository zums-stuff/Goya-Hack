// app/api/me/savings/route.ts — Ahorros en intercambios completados.
//
// Compara lo que pagaste en cada escrow (amountXlm) con lo que el vendedor
// pedía (listing.priceXlm). "Ahorro" positivo = pagaste menos de lo que el
// vendedor pedía (trueque/saldo real o trueque parcial). Solo cuenta
// escrows completados: status 'released' o 'auto-released'.
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const escrows = await prisma.escrow.findMany({
      where: {
        OR: [{ buyerId: user.id }, { sellerId: user.id }],
        status: { in: ['released', 'auto-released'] },
      },
      include: { listing: { select: { priceXlm: true } } },
    });

    let totalSavingsCents = 0;
    let totalSpentCents = 0;
    for (const e of escrows) {
      const asked = e.listing.priceXlm;
      const paid = e.amountXlm;
      totalSpentCents += paid;
      totalSavingsCents += Math.max(0, asked - paid);
    }

    return Response.json(
      {
        count: escrows.length,
        totalSavingsCents,
        totalSpentCents,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
