// app/api/reset-demo/route.ts — Reset a DB + Saldos PRD §1.
//
// Auth (§11.5):
//   - dev: libre (sin auth) — el usuario es local.
//   - prod (NODE_ENV=production): exige `Authorization: Bearer $CRON_SECRET`
//     Y `ALLOW_RESET_DEMO=true` (ya garantizado por lib/config.ts fail-fast
//     en startup — esta flag no llega aquí si NODE_ENV=production).
import { prisma } from '@/lib/db';
import { seedUsers, seedListings, seedOffers } from '@/lib/seed-data';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      const auth = req.headers.get('authorization') ?? '';
      const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
      if (!process.env.CRON_SECRET || auth !== expected) {
        throw new ApiError(401, 'unauthorized', 'Bearer CRON_SECRET requerido');
      }
      if (process.env.ALLOW_RESET_DEMO !== 'true') {
        throw new ApiError(403, 'reset_disabled', 'ALLOW_RESET_DEMO debe ser true');
      }
    }

    const walletIds = (() => {
      const raw = process.env.SEED_WALLET_IDS;
      if (!raw || raw === '{}') return {} as Record<string, string>;
      try { return JSON.parse(raw) as Record<string, string>; }
      catch { return {}; }
    })();

    // ⚠️ Borramos en orden (FK) — disputes/escrows/offeres/listings/users.
    await prisma.$transaction([
      prisma.transactionLog.deleteMany({}),
      prisma.disputeEvidence.deleteMany({}),
      prisma.escrow.deleteMany({}),
      prisma.offer.deleteMany({}),
      prisma.listing.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);

    await prisma.user.createMany({
      data: seedUsers.map((u) => ({
        ...u,
        pollarWalletId: walletIds[u.id] ?? u.pollarWalletId,
      })),
    });
    await prisma.listing.createMany({ data: seedListings });
    await prisma.offer.createMany({ data: seedOffers });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
