# TEST_RESULTS — PumaTrade v1.3

Resultado de las pasadas de verificación. Cada check es REPRODUCIBLE.

## ✅ Verificado por el agente

### 1. Versiones en registry (`npm view`)
Todas las versiones fijadas en `package.json` existen en npm:
- next 16.2.9, react 19.3.0, @pollar/core+react 0.11.3, @stellar/stellar-sdk 17.1.0
- tailwindcss 4.3.3, prisma 7.10.0, zod 4.6.5, zustand 5.0.15
- RESULTADO: ✅ (corre 2026-09-25)

### 2. Instalación limpia (`npm install`)
- 932 MB node_modules, 0 errores, 0 vulnerabilidades críticas
- Driver adapter: `@prisma/adapter-neon` + `@neondatabase/serverless` **removidos** → `@prisma/adapter-pg` + `pg` (funciona con cualquier Postgres)
- RESULTADO: ✅

### 3. Prisma generate (`npx prisma generate`)
- Cliente generado en `src/generated/prisma/client`
- Schema válido para Prisma 7 (sin adapter en schema; url en prisma.config.ts para Migrate)
- RESULTADO: ✅

### 4. TypeScript strict (`npx tsc --noEmit`)
- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride`
- 0 errores (de 50 reales que tenía)
- RESULTADO: ✅

### 5. Next.js production build (`next build`, Turbopack)
- Compiled successfully en 8.0s; TypeScript en 6.4s
- Las rutas que importan `lib/server-keypair.ts` pasan con secret real de friendbot (checksum Stellar correcto)
- RESULTADO: ✅ (con secret real)

### 6. Postgres local en Docker (`npm run db:up`)
- Contenedor `pumatrade-db` (postgres:16) en `localhost:5433` (evita chocar con un Postgres existente en 5432)
- `npx prisma migrate dev --name init` → migration `20260926035051_init` aplicada ✅
- `npm run db:seed` → 5 users · 10 listings · 4 offers ✅; `npm run demo:check` → saldos exactos (1,250/2,000/800/500/1,800 XLM) ✅
- RESULTADO: ✅ — el seed y el demo-check corren en el Postgres real

### 7. Vitest — suite completa (39/39 passed)
- **21 puros** — `lib/crypto.test.ts` (7): AES-GCM roundtrip + IVs no colisionan + tag manipulación detectada + cookie forgery rechazado; `lib/fees.test.ts` (9): floor + `HACKATHON_FREE_FEES` per-call + edge cases + roundtrip cents↔XLM; `lib/priceAlert.test.ts` (5): fair/overpriced/underpriced/no_reference.
- **18 DB-dependent** (`lib/__tests__/escrow-service.test.ts`) — **ahora corren contra el Postgres real** (`DB_AVAILABLE` = próbe `SELECT 1` contra la DB local):
  - Regla #2: `updateMany` condicional + `count === 1` en TODA transición (aceptar, cancel, recordExchange, confirmExchange, autoResolve, dispute, adminResolve) + carrera doble-solicitud → exactamente 1 gana.
  - Idempotencia M5/V1: release/refund repetidos con `stellarTxHash` ya set → no re-firma en Stellar (spy del stub).
  - Trueque puro (`amountXlm=0`): `accept` no llama a `releaseEscrowWithBarterGuard` (skip ops de pago).
  - B1b: foto de evidencia inmutable tras subir la disputa. A5: admin resolve release/refund con listing → sold/active.
  - Fees: `HACKATHON_FREE_FEES=false` + `FEE_BPS=200` → `platformFeeXlm=600` en 30,000 cents (2%).
- Fixes aplicados durante la pasada: `setup.ts` ya no importa lib/db estáticamente (ESM hoisting rompía el orden de `process.env` — ahora `loadEnvOnce()` + imports dinámicos); tests A5 abren la disputa vía `EscrowService.dispute()` real (antes insertaban DisputeEvidence a mano y el escrow nunca llegaba a `disputed`).
- RESULTADO: ✅ `npm run test` → **39 passed, 0 failed**

### 8. Stellar cycle end-to-end (`npm run test:stellar`)
- Sin CLI de Stellar — usa `@stellar/stellar-sdk 17.1.0` directo + friendbot HTTP.
- 1. `Keypair.random()` → Alice/Bob; 2. `friendbot fund` → 10000 XLM; 3. `loadAccount` balance verificado; 4. `TransactionBuilder` + `Operation.payment` 1 XLM; 5. Deltas: Bob +1, Alice −1.00001.
- RESULTADO: ✅ — mismo patrón que `lib/stellar.ts.releaseEscrow` ejecuta en producción.

### 9. HTTP live (`next dev` + curl con DB real)
- `npm run dev` → Ready in 546ms, carga `.env.local` (incluida `DATABASE_URL` real).
- `POST /api/price-alert` → 200 `{"verdict":"underpriced","fairPriceCents":80000,"actualCents":200,"deltaPct":-100}` (catálogo de referencia real).
- `GET /api/listings` → 200 con los **10 listings del seed** (Bata blanca, TI-89, …) leídos del Postgres local.
- `GET /api/cron/timeout-check` con `Authorization: Bearer $CRON_SECRET` → 200 `{"released":0,"autoCancelled":0}` (cron corrió contra la DB real).
- `GET /api/auth/dev-login` → 405 (POST-only); `POST` → 404 (doble guard: `DEV_LOGIN_ENABLED !== 'true'`); `GET /api/auth/me` sin cookie → 200 `{"user":null}`.
- RESULTADO: ✅

## ⏸️ Diferido (depende del usuario)

### 10. HTTP e2e con auth real (Pollar + cookies)
- Se probó el shape de endpoints puros y DB-backed. El flujo completo de login (mail.tm OTP → wallet Pollar → session cookie) requiere los 5 inboxes de mail.tm + apps en dashboard.pollar.xyz (Usuarios + Operacional).
- Acción del usuario: crear Pollar dashboard + 5 mail.tm inboxes, loguearse, correr `npm run capture:wallets`.

### 11. Bills reales de release/refund en escrow multi-sig 2-de-2
- `lib/stellar.ts:releaseEscrowWithBarterGuard` ejecuta el mismo patrón probado en (8) pero con 2 firmantes multi-sig + cuenta escrow pre-creada. No probado con una cuenta multi-sig real.
- Acción del usuario: tras fondear treasury real (ya fondeada por `npm run setup:env`), correr `npm run test:stellar:escrow` (a crear) que crea una cuenta 2-de-2 con createAccount + setOptions + submitea 2 firmas.

## Comandos que el usuario puede correr

```bash
# 1. Infra DB local (Docker) + semilla
npm run db:up          # levanta pumatrade-db en localhost:5433
npx prisma migrate dev # idempotente una vez aplicado
npm run db:seed        # 5 users + 10 listings + 4 offers

# 2. Verificaciones completas
npm run test           # 39 vitest pasa (21 puros + 18 DB contra Postgres local)
npm run demo:check     # valida seed + saldos exactos
npm run test:stellar   # 1 roundtrip Stellar real
npx tsc --noEmit       # 0 errores TS
npx next build         # 0 errores
```

## Resumen ejecutivo

**Lo que compila y corre sin cuentas externas:**
- TypeScript strict 100% + build Next 16 OK
- Vitest **39/39**: cifrado, fees, valuación + el state machine completo del escrow contra Postgres local en Docker (regla #2, idempotencia M5/V1, trueque puro, disputa A3/A5)
- Stellar testnet: roundtrip 1 XLM verificado on-chain + treasury fondeada
- HTTP live con DB real: listings del seed, price-alert, cron timeout-check
- `npm run setup:env` autogenera `.env.local` (pares checksum-válidos + treasury fondeada + `DATABASE_URL` local)

**Lo que requiere el usuario (dashboard Pollar + mail.tm):**
- Login end-to-end de los 5 seed users (OTP mail.tm) → captura de `SEED_WALLET_IDS`
- Multi-sig 2-de-2 release/refund firmado por platform + árbitro con treasury real