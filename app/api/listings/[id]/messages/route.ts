// app/api/listings/[id]/messages/route.ts
// GET: lista mensajes del chat listingId. Solo seller del listing y offerers
// que tengan alguna oferta para ese listing pueden leer.
// POST: envía un mensaje. Solo seller y offerers.
//
// Body: { body: string }

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { SendMessageSchema } from '@/lib/schemas';
import { resolveChatAccess, assertChatAccess } from '@/lib/chat';
import type { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const acc = await resolveChatAccess({ scope: 'listing', scopeId: id, userId: user.id });
    assertChatAccess(acc);

    const messages = await prisma.message.findMany({
      where: { scope: 'listing', scopeId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { sender: { select: { id: true, displayName: true } } },
    });

    // Marca como leídos los mensajes que NO me pertenecen y aún no tienen
    // readAt. Best-effort — no bloquea.
    if (messages.length > 0) {
      const unreadIds = messages
        .filter((m) => m.senderId !== user.id && m.readAt == null)
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        await prisma.message.updateMany({
          where: { id: { in: unreadIds } },
          data: { readAt: new Date() },
        });
      }
    }

    return Response.json(
      { messages, meId: user.id, label: acc.label },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const acc = await resolveChatAccess({ scope: 'listing', scopeId: id, userId: user.id });
    assertChatAccess(acc);

    const json = await req.json().catch(() => ({}));
    const parse = SendMessageSchema.safeParse(json);
    if (!parse.success) {
      const field = parse.error.issues[0];
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          message: field?.message ?? 'Validación',
          details: [
            {
              path: field?.path?.[0]?.toString() ?? 'body',
              message: field?.message ?? 'inválido',
            },
          ],
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    const body = parse.data.body;

    const created = await prisma.message.create({
      data: {
        scope: 'listing',
        scopeId: id,
        senderId: user.id,
        body,
      } satisfies Prisma.MessageUncheckedCreateInput,
      include: { sender: { select: { id: true, displayName: true } } },
    });

    return Response.json({ message: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
