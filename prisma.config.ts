// prisma.config.ts — Prisma 7 (CLI config)
// Prisma 7 mueve `url` del datasource a este archivo. Usamos el driver adapter
// Neon para serverless.
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  // Prisma 7: la URL viene aquí (adapter se aplica vía lib/db.ts runtime).
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
