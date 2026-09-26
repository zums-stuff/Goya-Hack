// lib/__tests__/setup.ts — Setup global para Vitest.
// Carga .env.test (o .env.local como fallback), valida conexión, hace
// truncate global entre tests.
//
// Variables mínimas para arrancar (en CI el operator las setea).
// Las DB-dependent tests usan vi.skipIf(!DB_AVAILABLE) para no fallar aquí.

import 'dotenv/config';

// Variables mínimas para arrancar.
process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:5432/pumatrade_test?sslmode=disable';
process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY ??= 'pk_demo';
process.env.POLLAR_USERS_SECRET_KEY ??= 'sk_demo';
process.env.POLLAR_OPS_SECRET_KEY ??= 'sk_demo';
process.env.PLATFORM_PUBLIC_KEY ??= 'G' + 'A'.repeat(55);
process.env.PLATFORM_SECRET_KEY ??= 'S' + 'A'.repeat(55);
process.env.APP_SECRET_KEY ??= '0'.repeat(64);
process.env.ADMIN_EMAILS ??= 'demo@local';
process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ??= '200';

// DB_AVAILABLE: true si DATABASE_URL apunta a un Postgres alcanzable.
// Por defecto false — tests DB-dependent skipean en este caso.
export const DB_AVAILABLE = await isDbReachable();

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

import { beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

export async function cleanDb(): Promise<void> {
  if (!DB_AVAILABLE) return;
  await prisma.$transaction([
    prisma.transactionLog.deleteMany({}),
    prisma.disputeEvidence.deleteMany({}),
    prisma.escrow.deleteMany({}),
    prisma.offer.deleteMany({}),
    prisma.listing.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}

beforeEach(async () => {
  // No-op global hook — los tests llaman cleanDb() explícitamente en su beforeEach.
});
