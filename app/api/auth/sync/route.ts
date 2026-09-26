// app/api/auth/sync/route.ts — Sincroniza el usuario Pollar con nuestra DB.
//
// ⚠️ Wallet binding rule (§9.4 + §12.7 + V3 fix A2):
//   Si el user EMail ya tiene una wallet ligada (≠ placeholder) y el nuevo
//   pollarWalletId NO coincide, devuelve 409. Crea ataques de impersonación
//   de email (atacante crea wallet propia + pega email de seed user → se
//   queda con la sesión → drenar payouts de escrows).
//
// ⚠️ Solo actualiza `pollarWalletId` cuando el valor actual es un placeholder
// del seed (`G_PLACEHOLDER_*`). Para usuarios reales, el re-login siempre
// devuelve el mismo G-address (Pollar es estable por usuario).

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

const Schema = z.object({
  pollarWalletId: z.string().regex(/^G[A-Z0-9]{55}$/, 'G-address inválido'),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });

    // Bind one-shot: si ya hay wallet real y difiere → 409.
    if (
      existing?.pollarWalletId &&
      !existing.pollarWalletId.startsWith('G_PLACEHOLDER') &&
      existing.pollarWalletId !== body.pollarWalletId
    ) {
      return Response.json(
        {
          error: 'wallet_mismatch',
          message: 'Esta cuenta ya está vinculada a otra wallet.',
        },
        { status: 409 },
      );
    }

    const user = await prisma.user.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        displayName: body.displayName,
        pollarWalletId: body.pollarWalletId,
        // major + bio defaults — el usuario los actualiza después en /settings.
        major: 'Otra',
        bio: '',
        balanceXlm: 0,
      },
      // Solo re-vincula cuando hay placeholder (primer login real del seed).
      // En re-logins de usuarios reales el field NO cambia (Pollar estable).
      update: existing?.pollarWalletId?.startsWith('G_PLACEHOLDER')
        ? { pollarWalletId: body.pollarWalletId, displayName: body.displayName }
        : { displayName: body.displayName },
    });

    // ⚠️ Demanda el equipo: tras el primer login de un seed user, fundear la
    // wallet con XLM vía Pollar Server API. Solo dispara UNA vez (cuando
    // veníamos del placeholder).
    if (existing?.pollarWalletId?.startsWith('G_PLACEHOLDER')) {
      const { fundUserWallet } = await import('@/lib/pollar');
      const balanceXlmCents = SEED_FUND_CENTS[user.id] ?? 150_000; // 1,500 XLM default
      try {
        await fundUserWallet(body.pollarWalletId, balanceXlmCents);
        await prisma.user.update({
          where: { id: user.id },
          data: { balanceXlm: balanceXlmCents },
        });
      } catch (e) {
        // No romper el login si el fundeo falla (Pruebas pueden fallar la primera vez).
        console.warn('[sync] No pudimo fondear la wallet seed:', e);
      }
    }

    await setSessionCookie(user.email);

    return Response.json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}

// Saldos del seed (PRD §1 — 1,250 / 2,000 / 800 / 500 / 1,800 XLM en centavos).
// Mantenemos sincronizado con lib/seed-data.ts.
const SEED_FUND_CENTS: Record<string, number> = {
  usr_maria: 125_000,
  usr_juan: 200_000,
  usr_andrea: 80_000,
  usr_pablo: 50_000,
  usr_sofia: 180_000,
};
