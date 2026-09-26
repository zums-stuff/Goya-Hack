// app/api/assistant/route.ts — Asistente PumaTrade (heurístico, no LLM real).
//
// Recibe { message: string, typeHint?: string } y devuelve:
//   { reply: string, listings: Listing[] }
//
// Búsqueda simple: matching por palabras clave contra title / type / major
// del listing. Sirve para que el chat del Asistente IA no sea solo una
// demo estática con texto hardcoded.

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  message: z.string().min(2).max(280),
});

const TYPES: Array<{ keywords: string[]; type: string }> = [
  { keywords: ['libro', 'libros', 'cálculo', 'fisica', 'física', 'spivak', 'sadiku', 'tipler'], type: 'libros' },
  { keywords: ['calculadora', 'calculadoras', 'ti-89', 'ti89'], type: 'calculadoras' },
  { keywords: ['laptop', 'computadora', 'thinkpad', 'macbook'], type: 'electronica' },
  { keywords: ['arduino', 'raspberry', 'rpi', 'electrón'], type: 'electronica' },
  { keywords: ['bata', 'uniforme', 'batas'], type: 'batas-uniformes' },
  { keywords: ['multímetro', 'multimetro', 'fluke', 'laboratorio'], type: 'laboratorio' },
];

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Schema.parse(await req.json());
    const q = body.message.toLowerCase();

    // 1. Detectar tipo por palabras clave
    let typeHint: string | undefined;
    for (const t of TYPES) {
      if (t.keywords.some((k) => q.includes(k))) {
        typeHint = t.type;
        break;
      }
    }

    // 2. Si el usuario mencionó tipo (calculadoras, libros…), NO aplicamos
    //    búsqueda de "contains" porque el keyword ya es la palabra completa;
    //    un contains extra haría fallar casos como "calculadoras" vs título
    //    "Calculadora TI-89" (singular sin 's'). Si NO hay typeHint,
    //    buscamos el texto libre contra title/description.
    const listings = await prisma.listing.findMany({
      where: {
        status: 'active',
        ...(typeHint
          ? { type: typeHint }
          : q.length >= 3
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { seller: { select: { displayName: true, major: true } } },
    });

    // 3. Comparativa del mercado para el primer listing: cuántas ofertas
    //    pendientes tiene y precio medio. Permite decir "fair/ganga/sobreprecio".
    const marketContext: {
      avgOfferCents: number | null;
      offerCount: number;
      verdict: 'no_reference' | 'fair' | 'cheap' | 'pricey';
    } = { avgOfferCents: null, offerCount: 0, verdict: 'no_reference' };
    if (listings.length > 0 && listings[0]) {
      const lid = listings[0].id;
      const offers = await prisma.offer.findMany({
        where: { listingId: lid, status: 'pending' },
        select: { type: true, xlmAmount: true, offeredItems: true },
      });
      marketContext.offerCount = offers.length;
      if (offers.length > 0) {
        const totals = offers.map((o) => {
          if (o.xlmAmount == null) {
            const items = o.offeredItems
              ? (JSON.parse(o.offeredItems) as Array<{ estimatedValueXlm: number }>)
              : [];
            return items.reduce((a, it) => a + it.estimatedValueXlm, 0);
          }
          return o.xlmAmount;
        });
        const avg = Math.round(
          totals.reduce((a, n) => a + n, 0) / totals.length,
        );
        marketContext.avgOfferCents = avg;
        const delta =
          ((listings[0].priceXlm - avg) / (avg / 100)) | 0;
        if (delta <= -10) marketContext.verdict = 'cheap';
        else if (delta >= 10) marketContext.verdict = 'pricey';
        else marketContext.verdict = 'fair';
      }
    }

    // 3. Componer respuesta natural
    let reply: string;
    if (listings.length === 0) {
      reply =
        'No encontré nada que coincida con tu búsqueda. Probá con menos palabras o usa palabras como "calculadora", "libros", "laptop", "arduino".';
    } else if (typeHint) {
      const labels: Record<string, string> = {
        libros: 'libros',
        calculadoras: 'calculadoras',
        electronica: 'electrónica',
        'batas-uniformes': 'batas o uniformes',
        laboratorio: 'equipo de laboratorio',
      };
      const typeName = labels[typeHint] ?? typeHint;
      reply = `Encontré ${listings.length} ${typeName} disponibles. Te sugiero revisar el primero: ${listings[0]?.title ?? '—'} (P$${
        listings[0] ? ((listings[0].priceXlm / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 })) : '0'
      }, lista para ofertar).`;
    } else {
      reply = `Te sugiero ${listings.length} artículos recientes. El más llamativo: ${
        listings[0]?.title ?? '—'
      } — puedes abrir el listing y ofertar directamente.`;
    }

    // 4. Si detecta "compar" o "mejor", añade comparación básica.
    if (q.includes('mejor') || q.includes('compara')) {
      if (listings.length >= 2) {
        reply += ` Para comparar: ${listings[0]?.title ?? '—'} vs ${listings[1]?.title ?? '—'} — ambas con video verificado y escrow Stellar.`;
      } else {
        reply += ' No tengo suficientes productos para comparar ahora.';
      }
    }

    // 5. Verdict del mercado sobre el primer listing (ganga/fair/sobreprecio).
    if (listings.length > 0 && marketContext.offerCount > 0) {
      const fmt = (c: number) =>
        `P$${(c / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
      if (marketContext.verdict === 'cheap') {
        reply += ` ${listings[0]?.title} está ${
          Math.min(
            Math.round(
              ((listings[0]!.priceXlm - marketContext.avgOfferCents!) /
                (listings[0]!.priceXlm / 100)) *
                -1,
            ),
          ) || 0
        }% por debajo del promedio de otras ofertas (${
          marketContext.avgOfferCents ? fmt(marketContext.avgOfferCents) : ''
        }). Es una ganga.`;
      } else if (marketContext.verdict === 'pricey') {
        reply += ` ${listings[0]?.title} está por encima del promedio de otras ofertas (${
          marketContext.avgOfferCents ? fmt(marketContext.avgOfferCents) : ''
        }). Considera negociar o esperar.`;
      } else {
        reply += ` ${listings[0]?.title} está en precio justo contra el promedio de otras ofertas (${
          marketContext.avgOfferCents ? fmt(marketContext.avgOfferCents) : '—'
        }).`;
      }
    }

    return Response.json(
      { reply, listings, marketContext },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
