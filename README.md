# /lib — PumaTrade

Modulos server-side compartidos. **No exponer al cliente** (algunos chequean
`typeof window !== 'undefined'` explícitamente, p.ej. `server-keypair.ts`).

| Archivo | Propósito |
|---|---|
| `config.ts` | Validación de variables de entorno con Zod + fail-fast en prod |
| `db.ts` | Cliente Prisma singleton con driver adapter Neon |
| `crypto.ts` | HKDF subkeys (KEY_ENC / KEY_COOKIE), AES-256-GCM, HMAC cookie, magic-byte file sniffer |
| `server-keypair.ts` | Keypair de plataforma (server-only) |
| `stellar.ts` | Horizon, createEscrowAccount, release/refund con barter-guard |
| `fees.ts` | feeCents en centavos (Int); cents↔XLM helpers |
| `errors.ts` | ApiError + handleApiError + clases de transición |
| `schemas.ts` | Zod schemas de TODOS los inputs (con refine semántica) |
| `auth.ts` | Cookie HMAC + Session helpers + requireUser |
| `pollar.ts` | Server-side Pollar ops (fund wallet, balance) |
| `escrow.service.ts` | Máquina de estados con regla #2 (updateMany condicional) |
| `cron.ts` | runTimeoutCheck (2 pasadas) |
| `cron-dev.ts` | setInterval tick (dev only, gate por ENABLE_CRON) |
| `evidence-storage.ts` | Vercel Blob / disk + validateEvidenceFile |
| `listings.ts` | WHERE clause builder para GET /api/listings |
| `snapshots.ts` | In-Memory store temporal (placeholder Bloque 0) |
| `seed-data.ts` | Modulo compartido (prisma/seed.ts + /api/reset-demo) |
| `priceAlert/reference-prices.ts` | Catalog de precios de referencia |
| `priceAlert/engine.ts` | checkPrice() — motor sin estado |

/components — React components, client y server. Estricto: cuando un componente usa estado/efectos → 'use client' arriba.

/stores — Zustand (auth, escrow, UI). Solo cliente.

Todas las cantidades de dinero en DB y entre funciones son **Int centavos** de XLM (1 XLM = 100 centavos, §4.2). La conversión a XLM (string, 7 decimales) ocurre SOLO en `lib/fees.ts:centsToXlm()` y `lib/stellar.ts` antes de construir operaciones.
