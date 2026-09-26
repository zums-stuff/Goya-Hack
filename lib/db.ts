// lib/db.ts — Cliente Prisma singleton con driver PostgreSQL estándar.
//
// El adapter es @prisma/adapter-pg (driver `pg`): funciona con CUALQUIER
// Postgres — local (Docker, `npm run db:up`), Neon, Supabase, Railway, etc.
// Solo cambia DATABASE_URL en .env.local; el código es idéntico.
//
// Patrón singleton: Next.js dev (HMR) crea múltiples instancias de Prisma si
// no se cachean en globalThis. Sin esto, el connection pool se desborda.
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida — revisa .env.local');
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;