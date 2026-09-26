// scripts/demo-check.ts — End-to-end sanity check (no es test unitario;
// verifica que la DB tiene los seed users, las listings y las offers, y
// que la cantidad cuadra con los saldos del PRD §1).
//
// Uso: `npm run demo:check`

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { seedUsers } from '../lib/seed-data';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no definida. Configura .env.local primero.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('🔍 Demo check — PumaTrade\n');

  const userCount = await prisma.user.count();
  const listingCount = await prisma.listing.count();
  const offerCount = await prisma.offer.count();
  const escrowCount = await prisma.escrow.count();

  console.log('📊 Totales:');
  console.log(`   users:    ${userCount} (esperado: 5)`);
  console.log(`   listings: ${listingCount} (esperado: 10)`);
  console.log(`   offers:   ${offerCount} (esperado: 4)`);
  console.log(`   escrows:  ${escrowCount} (esperado: 0 al inicio)`);

  if (userCount !== 5) {
    console.log('\n❌ Esperando 5 users seed.');
    process.exit(1);
  }

  console.log('\n👤 Saldos de seed users:');
  for (const u of seedUsers) {
    const live = await prisma.user.findUnique({ where: { email: u.email } });
    if (!live) {
      console.log(`   ❌ ${u.email} NO existe en DB`);
      continue;
    }
    const expected = (u.balanceXlm / 100).toFixed(2);
    const actual = (live.balanceXlm / 100).toFixed(2);
    const ok = expected === actual;
    console.log(`   ${ok ? '✅' : '⚠️ '} ${u.email.padEnd(40)} esperado: ${expected} XLM | real: ${actual} XLM`);
  }

  console.log('\n💸 Listings por status:');
  const grouped = await prisma.listing.groupBy({
    by: ['status'],
    _count: true,
  });
  grouped.forEach((g) => {
    console.log(`   ${g.status.padEnd(15)} ${g._count}`);
  });

  console.log('\n✋  Offers en tablero (pendientes) por tipo:');
  const offGroup = await prisma.offer.groupBy({
    by: ['type'],
    where: { status: 'pending' },
    _count: true,
  });
  offGroup.forEach((o) => {
    console.log(`   ${o.type.padEnd(15)} ${o._count}`);
  });

  console.log('\n✅ Demo listo (cuando los saldos de seed users son correctos).');
}

main()
  .catch((e) => {
    console.error('❌ Demo check failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
