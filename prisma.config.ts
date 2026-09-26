// prisma.config.ts — Prisma 7 (CLI config).
//
// Prisma 7 mueve la URL del datasource desde `schema.prisma` a este archivo
// (P1012: `datasource.url` removida del schema; vive en runtime config).
//
// ⚠️ Bug Prisma 7.10.0: si `process.env.DATABASE_URL` no está set en el momento
// de la validación, el CLI tira "The datasource.url property is required in your
// Prisma config file when using prisma migrate dev." aunque la URL esté
// presente en .env.local. Solución: leer explícitamente .env.local al startup
// vía lib/load-env.ts (módulo compartido con los scripts de seed/CLI).
import * as path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvOnce } from './lib/load-env';

loadEnvOnce();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL no definida — corre `npm run setup:env` y ajusta la URL ' +
      '(o copia .env.example → .env.local).',
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