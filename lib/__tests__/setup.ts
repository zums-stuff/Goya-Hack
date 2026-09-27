// lib/__tests__/setup.ts — Setup global para Vitest.
//
// ⚠️ ESM hoistea los `import` estáticos: `import { prisma }` en la parte de
// arriba evalúa lib/db.ts ANTES de que corran las asignaciones de env abajo.
// Por eso NUNCA importamos lib/db estáticamente aquí — todo es dinámico,
// después de que loadEnvOnce() + fallbacks hayan poblado process.env.
//
// Estrategia de DB:
//   - DB_AVAILABLE = true si hay un Postgres alcanzable (local Docker via
//     `npm run db:up`, Neon, etc.). Si no, los tests DB-dependent se skipean
//     con describe.skip (no fallan).
//   - cleanDb() trunca todas las tablas en orden FK-seguro entre tests.

import 'dotenv/config';
import { loadEnvOnce } from '@/lib/load-env';
loadEnvOnce();

// Fallbacks para CI/ambientes sin .env.local (solo si la var no existe).
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5433/pumatrade?sslmode=disable';
process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY ??= 'pk_demo';
process.env.POLLAR_USERS_SECRET_KEY ??= 'sk_demo';
process.env.POLLAR_OPS_SECRET_KEY ??= 'sk_demo';
process.env.PLATFORM_PUBLIC_KEY ??= 'G' + 'A'.repeat(55);
process.env.PLATFORM_SECRET_KEY ??= 'S' + 'A'.repeat(55);
process.env.APP_SECRET_KEY ??= '0'.repeat(64);
process.env.ADMIN_EMAILS ??= 'demo@local';
process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ??= '200';

/** True si hay Postgres alcanzable — los tests DB-dependent lo usan para skip. */
export const DB_AVAILABLE = await isDbReachable();

let _prisma: (typeof import('@/lib/db'))['prisma'] | undefined;

async function getPrisma(): Promise<(typeof import('@/lib/db'))['prisma']> {
  if (!_prisma) {
    _prisma = (await import('@/lib/db')).prisma;
  }
  return _prisma;
}

async function isDbReachable(): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch {
    return false;
  }
}

/** Trunca todas las tablas en orden FK-seguro entre tests. */
export async function cleanDb(): Promise<void> {
  if (!DB_AVAILABLE) return;
  const prisma = await getPrisma();
  await prisma.$transaction([
    prisma.transactionLog.deleteMany({}),
    prisma.disputeEvidence.deleteMany({}),
    prisma.escrow.deleteMany({}),
    prisma.offer.deleteMany({}),
    prisma.listing.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}