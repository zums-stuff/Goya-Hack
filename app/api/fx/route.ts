// app/api/fx/route.ts — Endpoint para que el cliente sepa la tasa XLM/MXN actual.
// Devuelve la misma tasa que usa `lib/currency.ts` (CoinGecko + fallback).
//
// GET /api/fx
//   → { rate: number, source: 'coingecko' | 'env' | 'fallback', fetchedAt: ISO }

import { xlmMxnRate } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rate = await xlmMxnRate();
  return Response.json(
    {
      rate,
      source:
        Number(process.env.XLM_MXN_RATE) > 0 ? 'env' : 'coingecko-or-fallback',
      fetchedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
