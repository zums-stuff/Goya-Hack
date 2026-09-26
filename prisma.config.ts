// prisma.config.ts — Prisma 7 (CLI config).
//
// Prisma 7 mueve la URL del datasource desde `schema.prisma` a este archivo
// (P1012: `datasource.url` removida del schema; vive en runtime config).
//
// ⚠️ Bug Prisma 7.10.0: si `process.env.DATABASE_URL` no está set en el momento
// de la validación, el CLI tira "The datasource.url property is required in your
// Prisma config file when using prisma migrate dev." aunque la URL esté
// presente en .env.local. Solución: leer explícitamente .env.local al startup.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'prisma/config';

function readDotEnvLocal(): void {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    if (process.env[key] !== undefined) continue; // cuenta existente gana
    process.env[key] = valueRaw.trim().replace(/^['"]|['"]$/g, '');
  }
}
readDotEnvLocal();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL no definida — copia .env.example a .env.local y llena la URL.',
  );
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  // ⚠️ Prisma 7 schema migrator: URL STRING required (no acepta el adapter
  // directo aquí para `migrate dev`). El adapter (PrismaNeon) se aplica en
  // runtime via `lib/db.ts`.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
