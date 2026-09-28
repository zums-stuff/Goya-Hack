// scripts/test-db-setup.ts — Prepara una base de datos DEDICADA para tests.
//
// ⚠️ Por qué existe esto (ver el fix de `lib/__tests__/setup.ts`):
// los tests antes apuntaban al mismo Postgres que la app (base `pumatrade`
// en :5433) y llamaban `cleanDb()`, que hace TRUNCATE de todas las tablas.
// Consecuencia: `npm test` destruía el seed del demo — 6 usuarios, 17
// listings, 7 ofertas — y dejaba los fixtures del último test como si
// fueran datos reales. Ahora los tests usan `<db>_test` y este script se
// encarga de crearla y aplicar las migraciones.
//
// Uso: `npm run pretest` (lo invoca npm automáticamente antes de `npm test`).
// Idempotente: se puede correr las veces que quieras.
//
// Variables:
//   DATABASE_URL       — la URL de la app (solo para derivar host/credenciales)
//   TEST_DATABASE_URL  — opcional; si no está, se deriva de DATABASE_URL
//                        añadiendo el sufijo `_test` al nombre de la base.

import { Client } from 'pg';

function deriveTestUrl(url: string): URL {
  const u = new URL(url);
  const base = u.pathname.replace(/^\//, '') || 'pumatrade';
  if (base.endsWith('_test')) return u;
  u.pathname = `/${base}_test`;
  return u;
}

async function ensureDatabase(adminUrl: URL, testDb: string): Promise<boolean> {
  const client = new Client({
    host: adminUrl.hostname,
    port: Number(adminUrl.port || 5432),
    user: decodeURIComponent(adminUrl.username || 'postgres'),
    password: decodeURIComponent(adminUrl.password || ''),
    database: 'postgres',
    ssl: adminUrl.searchParams.get('sslmode') === 'disable' ? false : undefined,
  });

  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDb],
    );
    if (rowCount && rowCount > 0) return false;
  } finally {
    await client.end();
  }

  // CREATE DATABASE no admite identifiers parametrizados; el nombre viene
  // de nuestra propia derivación (base + "_test"), nunca de input externo,
  // y lo validamos igual para que un DATABASE_URL raro no rompa esto.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(testDb)) {
    throw new Error(`Nombre de base de datos no válido: ${testDb}`);
  }
  const admin = new Client({
    host: adminUrl.hostname,
    port: Number(adminUrl.port || 5432),
    user: decodeURIComponent(adminUrl.username || 'postgres'),
    password: decodeURIComponent(adminUrl.password || ''),
    database: 'postgres',
    ssl: adminUrl.searchParams.get('sslmode') === 'disable' ? false : undefined,
  });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${testDb}"`);
  } finally {
    await admin.end();
  }
  return true;
}

async function main() {
  const raw =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/pumatrade?sslmode=disable';

  const testUrl = new URL(raw);
  if (!testUrl.pathname.replace(/^\//, '').endsWith('_test')) {
    testUrl.pathname = `/${testUrl.pathname.replace(/^\//, '')}_test`;
  }
  const testDb = testUrl.pathname.replace(/^\//, '');

  let created = false;
  try {
    created = await ensureDatabase(new URL(raw), testDb);
    console.log(
      `[pretest] DB de tests ${created ? 'creada' : 'ya existía'}: ${testDb}`,
    );
  } catch (e) {
    // Sin Postgres no abortamos el test run: los tests que dependen de la
    // DB se skipean solos (DB_AVAILABLE=false). Solo avisamos.
    console.warn(
      `[pretest] No se pudo preparar la DB de tests (${(e as Error).message}). ` +
        `Los tests con DB se van a skipear.`,
    );
    console.warn('[pretest] ¿Está Docker corriendo? `npm run db:up`');
    return;
  }

  // Aplicar el schema. Lo hacemos con el CLI de Prisma en un subprocess
  // porque reutilizar el cliente de la app apuntaría a la base equivocada.
  const { spawnSync } = await import('node:child_process');
  const url = testUrl.toString();
  const res = spawnSync(
    process.execPath,
    ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
      shell: false,
    },
  );

  if (res.status !== 0) {
    console.warn(
      `[pretest] prisma migrate deploy no pudo aplicarse a ${testDb}.\n` +
        `${res.stdout ?? ''}\n${res.stderr ?? ''}\n` +
        `Los tests con DB se van a skipear.`,
    );
    return;
  }
  console.log(`[pretest] Migraciones aplicadas a ${testDb}.`);
}

await main();
