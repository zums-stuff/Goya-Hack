// vitest.config.ts — Vitest setup para tests del state machine + API.
// Aliases explícitos por path. Vitest no procesa tsconfig paths automáticamente.

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@/generated/prisma/client': path.resolve(__dirname, 'src/generated/prisma/client.ts'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/app': path.resolve(__dirname, 'app'),
      '@/stores': path.resolve(__dirname, 'stores'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./lib/__tests__/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    include: [
      'lib/**/*.test.ts',
      'lib/__tests__/**/*.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { hooks: 'list' },
    globals: false,
  },
});
