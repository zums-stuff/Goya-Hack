// lib/__tests__/setup.ts — Setup global para Vitest.
//
// ⚠️ ESM hoistea los `import` estáticos: `import { prisma }` en la parte de
// arriba evalúa lib/db.ts ANTES de que corran las asignaciones de env abajo.
// Por eso NUNCA importamos lib/db estáticamente aquí — todo es dinámico,
// después de que loadEnvOnce() + fallbacks hayan poblado process.env.
//
// ⚠️⚠️ AISLAMIENTO DE DB — NO REVERTIR. Los tests usan SIEMPRE una base
// dedicada con sufijo `_test`. Antes apuntaban a la misma base que la app
// (`pumatrade`) y `cleanDb()` hacía TRUNCATE de todas las tablas, así que
// `npm test` destruía el seed del demo (6 usuarios · 17 listings · 7
// ofertas) y dejaba los fixtures del último test como datos reales — que es
// exactamente lo que rompía el login por Modo demo. La redirección de abajo
// es incondicional: si la base de tests no existe o no tiene schema,
// `DB_AVAILABLE` queda en false y los tests DB se skipean. NUNCA se vuelve
// a la base de la app como fallback — un fallback silencioso volvería a
// destruir el demo. `npm run pretest` crea la base y aplica las migraciones.

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

// Apunta a <db>_test. Hecho aquí (y no en un .env separado) para que sea
// imposible que un test escriba en la base de la app por accidente.
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL);

/** Deriva la URL de la base de tests añadiendo el sufijo `_test`. */
export function testDatabaseUrl(appUrl: string): string {
  try {
    const u = new URL(appUrl);
    const name = u.pathname.replace(/^\//, '') || 'pumatrade';
    if (!name.endsWith('_test')) u.pathname = `/${name}_test`;
    return u.toString();
  } catch {
    // URL no parseable: no la tocamos. `isDbReachable()` fallará y los
    // tests DB se skipean, que es el resultado seguro.
    return appUrl;
  }
}

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
    // `SELECT 1` pasa incluso en una base VACÍA. Si `pretest` no corrió,
    // la base `_test` existe pero sin tablas, y los tests DB fallarían con
    // "relation does not exist" en vez de skipear. Comprobamos que el
    // schema esté realmente aplicado.
    const tables = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('User', 'Listing', 'Offer', 'Escrow')
    `;
    const first = tables[0];
    if (!first || Number(first.n) < 4) return false;
    await prisma.$disconnect();
    return true;
  } catch {
    try {
      const { prisma } = await import('@/lib/db');
      await prisma.$disconnect();
    } catch {
      /* el cliente ni siquiera se pudo construir */
    }
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