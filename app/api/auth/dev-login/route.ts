// app/api/auth/dev-login/route.ts — Login de demo para celular (sin Pollar).
//
// Doble guarda (§8.3 / §12.7 A2):
//   404 si NODE_ENV === 'production' (para no exponer el endpoint en prod)
//   404 si DEV_LOGIN_ENABLED !== 'true' (la flag debe estar explícita en .env.local)
//
// ⚠️ En prod, una mala config (DEV_LOGIN_ENABLED=true en Vercel) sigue bloqueada
// por el NODE_ENV check. La config.ts (lib/config.ts) además falla al arrancar
// si ve ambas combinaciones en producción — defensa en profundidad.

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.DEV_LOGIN_ENABLED !== 'true'
    ) {
      return new Response('Not Found', { status: 404 });
    }

    const { email } = Schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json(
        {
          error: 'user_not_found',
          message:
            'Este email no existe en la DB seed. Corre `npm run db:seed` primero.',
        },
        { status: 404 },
      );
    }

    await setSessionCookie(user.email);
    return Response.json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
