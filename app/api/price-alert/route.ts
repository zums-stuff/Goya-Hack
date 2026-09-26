// app/api/price-alert/route.ts — POST: valuación sin estado (motor §5 PRD).
// Input: { title, type, price }. Output: PriceAlertResult.

import { z } from 'zod';
import { PriceAlertSchema } from '@/lib/schemas';
import { checkPrice } from '@/lib/priceAlert';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = PriceAlertSchema.parse(await req.json());
    // Schema field `price` (lo que viene del cliente) → engine espera `priceCents`.
    const result = checkPrice({ title: body.title, type: body.type, priceCents: body.price });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleApiError(e);
  }
}
