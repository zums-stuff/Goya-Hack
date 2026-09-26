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
      reply +=
        listings.length >= 2
          ? ` Para comparar: ${listings[0]?.title ?? '—'} vs ${listings[1]?.title ?? '—'} — ambos video verificados y con escrow Stellar.`
          : ' No tengo suficientes productos para comparar ahora.';
    }

    return Response.json({ reply, listings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleApiError(e);
  }
}
