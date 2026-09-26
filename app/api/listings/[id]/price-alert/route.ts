// app/api/listings/[id]/price-alert/route.ts — POST.
// Llama al motor de valuación sobre un listing existente.
import { prisma } from '@/lib/db';
import { checkPrice } from '@/lib/priceAlert';
import { PriceAlertSchema } from '@/lib/schemas';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Aceptamos title/type/price del body O del listing existente (id en URL).
    const url = new URL(req.url);
    const id = url.pathname.split('/').slice(-2, -1)[0] ?? null;

    let title: string | undefined;
    let priceCents: number | undefined;
    let type: ReturnType<typeof PriceAlertSchema.parse>['type'] | undefined;

    if (id) {
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return Response.json({ error: 'not_found' }, { status: 404 });
      title = listing.title;
      priceCents = listing.priceXlm;
      type = listing.type as typeof type;
    }

    try {
      const body = PriceAlertSchema.parse(await req.json());
      title = title ?? body.title;
      priceCents = priceCents ?? body.price;
      type = type ?? body.type;
    } catch {
      // body opcional — si no vino, usamos el del listing (de arriba).
    }

    if (!title || !type || priceCents == null) {
      return Response.json({ error: 'missing_input' }, { status: 422 });
    }
    return Response.json(checkPrice({ title, type, priceCents }));
  } catch (e) {
    return handleApiError(e);
  }
}
