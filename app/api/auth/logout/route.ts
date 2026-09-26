// app/api/auth/logout/route.ts — Borra la cookie de sesión.
import { clearSessionCookie } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
