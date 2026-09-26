// prisma/seed.ts — CLI seed (npm run db:seed).
// Importa los datos desde lib/seed-data.ts (compartido con /api/reset-demo).
//
// ⚠️ createMany no dispara hooks ni resuelve relaciones; los `@@relation`
// deben referenciar por `id` explícito. Esto es OK porque seed-data.ts
// ya tiene ids estables como `usr_maria`, `lst_ti89`, etc.
//
// Los saldos/precios se pasan como Int (centavos), no Float.

import { loadEnvOnce } from '../lib/load-env';
loadEnvOnce();

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  seedUsers,
  seedListings,
  seedOffers,
} from '../lib/seed-data';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no definida — añade .env.local antes de db:seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // ⚠️ Idempotencia: si los IDs ya existen, NO los creamos de nuevo.
  // Esto permite reiniciar el dev sin perder datos entre dos demos.
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`⚠️  Seed detectó ${existing} users — abortando para no duplicar.`);
    console.log('   Si quieres re-sembrar: npm run db:reset primero.');
    return;
  }

  // Override de pollarWalletId si SEED_WALLET_IDS está poblado.
  const walletIds = (() => {
    const raw = process.env.SEED_WALLET_IDS;
    if (!raw || raw === '{}') return {} as Record<string, string>;
    try { return JSON.parse(raw) as Record<string, string>; }
    catch { console.warn('SEED_WALLET_IDS no es JSON válido — usando placeholders.'); return {}; }
  })();

  console.log('👥 Creando 5 users...');
  await prisma.user.createMany({
    data: seedUsers.map((u) => ({
      ...u,
      pollarWalletId: walletIds[u.id] ?? u.pollarWalletId,
    })),
  });

  console.log('📦 Creando 10 listings...');
  await prisma.listing.createMany({ data: seedListings });

  console.log('✋ Creando 4 offers en el tablero de demo...');
  await prisma.offer.createMany({ data: seedOffers });

  console.log('✅ Seed completo: 5 users · 10 listings · 4 offers');
  console.log('');
  console.log('Próximos pasos:');
  console.log('  1. Levanta `npm run dev`.');
  console.log('  2. Loguéate una vez por cada seed user (mail.tm OTP — §13.3).');
  console.log('  3. El dev helper fondea XLM y captura SEED_WALLET_IDS.');
  console.log('  4. Corre `npm run capture:wallets` para verificar.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
