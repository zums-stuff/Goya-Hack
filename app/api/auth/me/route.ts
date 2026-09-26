// app/api/auth/me/route.ts — Devuelve el usuario actual (o 401 si no hay sesión).
// Útil para el render del cliente en el primer paint.
import { tryGetUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await tryGetUser();
    if (!user) return Response.json({ user: null }, { status: 200 });
    return Response.json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
