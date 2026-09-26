// prisma.config.ts — Prisma 7 (CLI config)
// Movido del schema al archivo de config: serverless-friendly, sin url inline.
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
