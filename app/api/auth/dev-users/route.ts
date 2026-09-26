// app/api/auth/dev-users/route.ts — Lista los 5 seed users para el panel de demo.
//
// Devuelve { users: [{ email, displayName, major, balanceXlm }] } cuando el
// dev-login está habilitado; 404 en cualquier otro caso (mismo gate que
// /api/auth/dev-login §12.7 A2). Datos NO sensibles: solo nombres públicos
// del seed (ver lib/seed-data.ts).

import { seedUsers } from '@/lib/seed-data';
import { isDevLoginAvailable } from '@/lib/auth-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevLoginAvailable()) {
    return new Response('Not Found', { status: 404 });
  }
  const users = seedUsers
    .map((u) => ({
      email: u.email,
      displayName: u.displayName,
      major: u.major,
      balanceXlm: u.balanceXlm,
    }))
    .sort((a, b) => b.balanceXlm - a.balanceXlm);
  return Response.json({ users });
}