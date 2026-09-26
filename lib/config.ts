// lib/config.ts — Validación de variables de entorno al arrancar.
// Fail-fast: si una env crítica falta o es inválida, el proceso tira antes de
// servir cualquier request. Esto evita errores crípticos en runtime.
//
// Plus: guard explícito contra `NODE_ENV=production && ALLOW_RESET_DEMO=true`
// (mitigación M2b de §12.7 — V2 verifier).

import { z } from 'zod';

// 32 bytes hex (64 chars) es el tamaño de un AES-256 key.
const Hex64 = z.string().regex(/^[0-9a-fA-F]{64}$/, 'debe ser hex de 32 bytes (64 chars)');
// Stellar secret: empieza con S, seguido de base32-ish (no validamos estricto).
const StellarSecret = z.string().min(50, 'PLATFORM_SECRET_KEY parece inválida');
// G-address: empieza con G, 56 chars total.
const GAddress = z.string().regex(/^G[A-Z0-9]{55}$/, 'G-address inválido');

const Schema = z.object({
  // Pollar
  NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY: z.string().min(1),
  POLLAR_USERS_SECRET_KEY: z.string().min(1),
  POLLAR_OPS_SECRET_KEY: z.string().min(1),

  // Stellar
  PLATFORM_PUBLIC_KEY: GAddress,
  PLATFORM_SECRET_KEY: StellarSecret,

  // Crypto
  APP_SECRET_KEY: Hex64,

  // DB
  DATABASE_URL: z.string().url(),

  // App
  NEXT_PUBLIC_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000),
  DEMO_TTL_MINUTES: z.coerce.number().int().min(1).optional(),
  CONFIRM_WINDOW_MINUTES: z.coerce.number().int().min(1).default(480),
  HACKATHON_FREE_FEES: z.coerce.boolean().default(false),
  ENABLE_CRON: z.coerce.boolean().default(false),
  ADMIN_EMAILS: z.string().min(1), // CSV; el guard de §12.7 splitea por coma

  // Deploy (opcional en dev)
  CRON_SECRET: z.string().min(16).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Demo
  SEED_WALLET_IDS: z.string().default('{}'),
  ALLOW_RESET_DEMO: z.coerce.boolean().default(false),
  DEV_LOGIN_ENABLED: z.coerce.boolean().default(false),
  // Cuando true, /api/escrow/fund acepta ?force=true y avanza el escrow
  // sin requerir tx Stellar on-chain. Solo dev — el route rechaza NODE_ENV=production.
  DEMO_FUNDING_BYPASS: z.coerce.boolean().default(false),

  // FX (opcional — si falta se usan CoinGecko o el fallback 7.5 en lib/currency.ts).
  XLM_MXN_RATE: z.coerce.number().positive().optional(),
});

export type Env = z.infer<typeof Schema>;

function parseEnv(): Env {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Variables de entorno inválidas — corrige .env.local antes de continuar:\n${issues}\n` +
        `Tip: copia .env.example → .env.local`,
    );
  }
  return parsed.data;
}

export const env = parseEnv();

// ─── Guard de producción (M2b §12.7 — V2 verifier) ────────────────────────────
if (env.NODE_ENV === 'production' && env.ALLOW_RESET_DEMO) {
  throw new Error(
    '[config] NODE_ENV=production y ALLOW_RESET_DEMO=true es incompatible: ' +
      'un atacante con CRON_SECRET podría borrar la DB. ' +
      'Solución: pon ALLOW_RESET_DEMO=false en Vercel.',
  );
}

if (env.NODE_ENV === 'production' && env.DEV_LOGIN_ENABLED) {
  throw new Error(
    '[config] NODE_ENV=production y DEV_LOGIN_ENABLED=true es bypass de auth. ' +
      'DEV_LOGIN_ENABLED debe estar vacía o "false" en producción.',
  );
}

// Email whitelist → Set lookup (O(1)).
export const ADMIN_EMAILS_SET: ReadonlySet<string> = new Set(
  env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS_SET.has(email.trim().toLowerCase());
}
