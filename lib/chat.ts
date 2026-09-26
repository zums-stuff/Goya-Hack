// lib/chat.ts — Helper para resolver scope y verificar acceso al chat.
//
// Una sola tabla `Message` con scope polimórfico. Esta función traduce
// scope + scopeId en la entidad real (Listing o Escrow) y verifica que
// el actor sea participante legítimo:
//
// - scope='listing': solo el `seller` del listing y los `offerer` que tienen
//   alguna oferta sobre ese listing pueden leer/escribir. Esto cubre
//   chat pre-oferta para regatear (offerer hace pregunta → seller responde).
// - scope='escrow': solo el `buyer` y el `seller` del escrow.
//
// Devuelve un objeto con el `meId`, el `otherUserId`, y la `entity` para
// que el route handler no tenga que duplicar la lógica.
//
// Doc: §11 (trade flow) + chat fuera-de-escrow para regateo.

import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';

type AccessSuccess = {
  ok: true;
  meId: string;
  otherUserId: string | null;
  kind: 'listing' | 'escrow';
  label: string;
};
type AccessFailure = {
  ok: false;
  status: number;
  error: string;
  message: string;
};
type Access = AccessSuccess | AccessFailure;

export async function resolveChatAccess(params: {
  scope: 'listing' | 'escrow';
  scopeId: string;
  userId: string;
}): Promise<Access> {
  const { scope, scopeId, userId } = params;

  if (scope === 'listing') {
    const listing = await prisma.listing.findUnique({
      where: { id: scopeId },
      select: { id: true, sellerId: true, title: true },
    });
    if (!listing) {
      return {
        ok: false,
        status: 404,
        error: 'listing_not_found',
        message: 'Listing no existe.',
      };
    }
    if (listing.sellerId === userId) {
      return {
        ok: true,
        meId: userId,
        otherUserId: null, // múltiples offerers posibles
        kind: 'listing',
        label: listing.title,
      };
    }
    // Soy offerer? reviso si tengo una oferta (cualquier estado).
    const offer = await prisma.offer.findFirst({
      where: { listingId: scopeId, offererId: userId },
      select: { id: true },
    });
    if (!offer) {
      return {
        ok: false,
        status: 403,
        error: 'not_a_participant',
        message: 'Solo el vendedor y los offerers pueden leer el chat de este listing.',
      };
    }
    return {
      ok: true,
      meId: userId,
      otherUserId: listing.sellerId,
      kind: 'listing',
      label: listing.title,
    };
  }

  // scope === 'escrow'
  const escrow = await prisma.escrow.findUnique({
    where: { id: scopeId },
    select: { id: true, buyerId: true, sellerId: true, listing: { select: { title: true } } },
  });
  if (!escrow) {
    return {
      ok: false,
      status: 404,
      error: 'escrow_not_found',
      message: 'Escrow no existe.',
    };
  }
  if (escrow.buyerId !== userId && escrow.sellerId !== userId) {
    return {
      ok: false,
      status: 403,
      error: 'not_a_participant',
      message: 'Solo el comprador y el vendedor pueden leer el chat del escrow.',
    };
  }
  return {
    ok: true,
    meId: userId,
    otherUserId: escrow.buyerId === userId ? escrow.sellerId : escrow.buyerId,
    kind: 'escrow',
    label: escrow.listing.title,
  };
}

export function handleChatAccessFailure(acc: AccessFailure): Response {
  return new Response(JSON.stringify({ error: acc.error, message: acc.message }), {
    status: acc.status,
    headers: { 'content-type': 'application/json' },
  });
}

// Tirar ApiError si no participante (para usar dentro de route handlers que
// pasan por handleApiError).
export function assertChatAccess(acc: Access): asserts acc is AccessSuccess {
  if (!acc.ok) {
    throw new ApiError(acc.status, acc.error, acc.message);
  }
}
