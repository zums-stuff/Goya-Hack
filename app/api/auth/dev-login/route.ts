// app/api/auth/dev-login/route.ts — Login de demo para celular (sin Pollar).
//
// Doble guarda (§8.3 / §12.7 A2):
//   404 si NODE_ENV === 'production' (para no exponer el endpoint en prod)
//   404 si DEV_LOGIN_ENABLED !== 'true' (la flag debe estar explícita en .env.local)
//
// ⚠️ En prod, una mala config (DEV_LOGIN_ENABLED=true en Vercel) sigue bloqueada
// por el NODE_ENV check. La config.ts (lib/config.ts) además falla al arrancar
// si ve ambas combinaciones en producción — defensa en profundidad.
//
// **Por qué `runtime = 'nodejs'`?** Esta ruta importa `@/lib/db` -> Prisma ->
// módulo node:* (crypto, fs). Si Next 16 la intentara compilar para Edge
// runtime, fallaría. Lo declaramos explícito para evitar ambigüedad.
//
// **Por qué `isDevLoginAvailable()` en vez de `process.env.NODE_ENV`
// directo?** Antes teníamos una asimetría endiablada entre esta ruta y
// /api/auth/dev-users — una devolvía 200, la otra 404, con env idéntico.
// Turbopack re-evalúa módulos por ruta bajo `output: 'standalone'` y
// `process.env.NODE_ENV` se podía snapshot-ear a 'production' en esta
// ruta aunque el flag global del proceso dijera 'development'. La
// solución: el flag global sembrado por `instrumentation.ts` vive en
// `globalThis`, es estable a lo largo del proceso, y todas las rutas
// lo leen. Ver lib/dev-login-flag.ts para el racional completo.

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { isDevLoginAvailable } from '@/lib/auth-env';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    if (!isDevLoginAvailable()) {
      return new Response('Not Found', { status: 404 });
    }

    const { email } = Schema.parse(await req.json());

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && email.toLowerCase().includes('gremium')) {
      const fallbackEmail = email.replace(/gremium/gi, 'pumatrade');
      user = await prisma.user.findUnique({ where: { email: fallbackEmail } });
    }
    if (!user && email.toLowerCase().includes('pumatrade')) {
      const fallbackEmail = email.replace(/pumatrade/gi, 'gremium');
      user = await prisma.user.findUnique({ where: { email: fallbackEmail } });
    }
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
