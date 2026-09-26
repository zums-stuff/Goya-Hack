# ARCHITECTURE — PumaTrade

**Versión:** 1.3 (blueprint de implementación)
**Fecha:** 2026-09-25
**Estado:** Borrador para revisión — no commiteado todavía
**Audiencia:** 1 implementador full-stack
**Relacionado:** [`PRD.md`](PRD.md) v3.4 define QUÉ construimos. Este doc define CÓMO.

**Changelog v1.3 (2026-09-25):**
- **Decisión 9 — escrow 2-de-2 plataforma + árbitro:** verificado en docs.pollar.xyz que la llave del comprador vive en el AWS KMS de Pollar y su SDK solo firma txs que él mismo construye — el comprador NO puede firmar la release/refund del escrow. El escrow pasa a signers = PLATFORM + ÁRBITRO por-escrow (secret encriptada en DB con AES-256-GCM, §6.4). UI/estados no cambian.
- **Decisión 10 — ventana de confirmación:** `awaiting-exchange` expira por cron (`CONFIRM_WINDOW_MINUTES`) → auto-cancel → refund completo al buyer. También se permite `cancel` manual en ese estado. Ya no existe ningún estado congelado para siempre.
- **Decisión 11 — 1 escrow por listing + estado `Pendiente`:** aceptar oferta pone el listing en `pending` (no acepta más ofertas, 409 si intentan); al release → `sold`; al refund → `active` y la oferta vuelve a `pending`.
- **Pasada 3:** `runTimeoutCheck` con 2 pasadas (TTL + ventana de confirmación); cron dev vía `instrumentation.ts`; reset-demo exige `CRON_SECRET` en prod + nota de escrows huérfanos; shape correcto `asset: { type: 'native' }` para XLM; se quitó la tx vestigial "exchange-recorded" on-chain; `APP_SECRET_KEY` nueva env.
- **Pasada 4 (§9-10-12):** cookie de sesión **firmada con HMAC** (`APP_SECRET_KEY`) — el "email plano" era suplantable; `CountdownTimer` ya no pinta `00:00:00` rojo sin ventana activa; botones **Cancelar y reembolsar** en `awaiting-funding` y `awaiting-exchange` (faltaban; §7.2 los permite); `LoginButton` resuelve email vía `getUserProfile()` si `wallet.user` viene vacío; §12.3/§12.5/§14: `APP_SECRET_KEY`, `CRON_SECRET`, `ADMIN_EMAILS` + CORS con IP de LAN para el demo en celulares; página admin documentada (guard por `ADMIN_EMAILS`, no existe columna role en el MVP).
- **Pasada 5 (§13-18):** `dev-login` con guard explícito **404 en prod** (setea cookie firmada → bypass de auth en prod); fila de `reset-demo` alineada con §11.5 (`CRON_SECRET` + `ALLOW_RESET_DEMO`); fix de redacción en el test del Bloque 6 (TTL = `DEMO_TTL_MINUTES` 3 min, el intervalo de cron es 30s/1 min, no el TTL); §18.2 con rutas correctas (`lib/seed-data.ts`, `scripts/capture-wallets.ts` — adiós `seed/seed.json` y `setup-wallets.ts`); footer actualizado a v1.3.
- **Pasada R1 (auditoría Spec/Estándares contra PRD v3.4):** PRD §4.5 firma 2-de-2 (Ramas A/B ahora plataforma+árbitro, no "+comprador"); §4.6 `feeCents` en centavos (floor); §10.3 env vars alineadas con ARCH §14; §10.4 quitado `network:'stellar'`, `SendModal` → `runTx` global; footer v3.4 + bloque de changelog v3.4; nuevo riesgo "suplantación vía sync" en §14 PRD. ARCH §6.4 deriva `KEY_ENC` (AES) y `KEY_COOKIE` (HMAC) del master con **HKDF-SHA256** (modos separados, mismo secret en env); §6.3 con nota de **reserva + residual** (~3 XLM quedan varados por escrow, `accountMerge` post-MVP) y memo `PT-{escrowIdShort}-{hash16}`; §6.5 wording fix (la cuenta "se queda con saldo mínimo", no "se cierra al refund"); §8.4 `accept-offer` con **`updateMany` condicional dentro del `$transaction`** + trueque puro (`amountXlm=0`) **nace en `funded`** (no muestra "Fondear 0 XLM"); §9.4 `/api/auth/sync` rechaza re-bind de wallet (409) si ya hay wallet ligada (cierra toma de cuenta por email); §12.1 tabla añade `pollarWalletId`; §7.2 trueque puro documentado; regla explícita `awaiting-funding` sin TTL (cero riesgo de dinero, cierre manual/reset-demo).
- **Pasada R2 (consistencia interna):** cruces §X.Y todos resuelven (88 secciones); env vars PRD §10.3 vs ARCH §14 mismo set (18 vars); schema §4.1 ↔ código §8.4 fields consistentes; sin paths huérfanos. Cambios: composite indexes (`status, ttlExpiresAt` + `status, confirmWindowExpiresAt`) en `Escrow` para las 2 pasadas del cron §11.1.
- **Pasada R3 (auditoría adversarial de seguridad):** 4 hallazgos Alta y 5 Media. Mitigaciones aplicadas: (1) `accept-offer` ahora re-ordenado — el create Stellar sigue ANTES de la tx con updateMany condicional (la alternativa “dentro de tx” no es posible por la naturaleza de Stellar), documentado como decisión; el reset-demo limpia huérfanos. (2) §12.1 tabla con matriz de vulnerabilidades (mail.tm injection, dev-login guard, cookie revocation, Stellar orphan, rate-limit, MIME server-side, IDOR /api/escrow/[id], idempotencia release, CORS LAN, validación `NEXT_PUBLIC_PLATFORM_FEE_BPS` al arrancar). (3) §12.2 Zod refine — `barter` rechaza `xlmAmount` distinto de `undefined` (cierra `barter con xlmAmount=0` inválido). (4) §12.5 CORS-LAN bajo `if (NODE_ENV !== 'production')`. (5) §12.6 `validateEvidenceFile()` con magic byte sniffing (no `File.type` del cliente). (6) §8.3 dev-login con DOBLE GUARDA: `DEV_LOGIN_ENABLED !== 'true'` **o** `NODE_ENV === 'production'` → 404. (7) §6.3 idempotencia de release con `updateMany({ id, stellarTxHashRelease: null })` antes de firmar. (8) §8.4 ejemplo de código con guards DENTRO del `$transaction` + trueque puro. Razonamientos explícitos: cookie sin revocación server-side y rate-limit son **aceptados como riesgo demo MVP** con nota §12.1 + TODO post-MVP.

**Changelog v1.2 (2026-09-25):**
- **Decisión 8 — el dinero es XLM nativo** (no PumaDolar/USDC): sin emisor, sin trustlines, sin distribución de tokens. En DB todo es `Int` centavos de XLM (1 XLM = 100 centavos), doctrina de dinero en §4.2. Fondeo de seed vía `POST /v1/wallets/fund` con XLM. Enum `pollar-only` → `saldo-only`.
- **Ofertas públicas por listing:** aceptar NO reserva el listing; cancel → oferta vuelve a `pending`. IDs unificados en `cuid()` (adiós nanoid).

**Changelog v1.1 (2026-09-25):**
- **Decisión 6 — pila actualizada:** Next 16 + React 19 + Tailwind 4 + Prisma 7 + Stellar SDK 17 + Zod 4 (TS 5.x). Todos los ejemplos de código re-verificados contra APIs reales (verificadas 2026-09-25 en npm, context7 y docs oficiales).
- **Decisión 7 — deploy a Vercel:** Neon Postgres (adiós SQLite), Vercel Cron (1 min) + setInterval dev, fotos de evidencia en Vercel Blob (+ hash en Stellar).
- **Correcciones:** numeración duplicada §6.4/§6.5; `cookies()` async; `Horizon.Server`; distribución reclamable de Pollar en lugar de fundeo manual; dispute = multipart, no base64.

---

## Cómo leer este documento

- **Sección 1–3:** el panorama. Léelo completo antes de empezar.
- **Sección 4:** el modelo de datos. Es la fuente de verdad — toca todo lo demás.
- **Sección 5–7:** las tres piezas críticas (Pollar, Stellar multi-sig, estado del escrow).
- **Sección 8:** cada endpoint con su contrato exacto. Esto es la "API surface".
- **Sección 9–10:** cómo se arma el frontend.
- **Sección 11–17:** el resto (cron, seguridad, seed, env vars, setup, plan).

Cuando tengas dudas durante la implementación, vuelve a la sección relevante de este doc antes de improvisar.

---

## 1. Visión general del sistema

PumaTrade es una app Next.js con tres roles principales:

| Rol | Quién | Qué hace en Stellar |
|---|---|---|
| **Estudiante (buyer/seller)** | 5 usuarios seed | Tiene una wallet G-address manejada por Pollar. Firma pagos al escrow. |
| **Plataforma (PumaTrade)** | Server-side | Tiene una wallet *sponsor* y una wallet *treasury*. Firma releases + cobra comisión. |
| **Escrow (cuenta multi-sig)** | Una cuenta nueva por transacción | G-address con signers = PLATFORM + ÁRBITRO por-escrow (server-side, encriptado). Threshold = 2. Cada movimiento on-chain lleva 2 firmas. |

**Tres capas físicas:**
1. **Frontend (Next.js + React)** — corre en el teléfono/navegador del estudiante. Usa `@pollar/react` para login, send, history.
2. **Backend (Next.js API routes)** — corre en Node. Usa `@pollar/core` (server-side) + Stellar SDK directo para operaciones que Pollar no expone (crear cuentas multi-sig, multi-sig release, cron de auto-resolve).
3. **Persistencia (Prisma + Postgres serverless / Neon)** — misma DB en dev y prod. Solo guarda el estado de la app (listings, offers, escrows, logs); los fondos viven en Stellar.

**Tres redes:**
- **Stellar testnet** — donde realmente se mueven los fondos: **Lumens (XLM) nativos de testnet**. Sin emisor, sin trustlines.
- **Pollar API** (`sdk.api.pollar.xyz` y `server.api.pollar.xyz`) — capa intermedia que nos abstrae de Stellar.
- **Local** — la base de datos Prisma y los assets estáticos.

---

## 2. Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js client)                                           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌─────────┐ │
│  │  Auth    │  │ Market-  │  │ Offer /  │  │  Escrow  │ │Settings │ │
│  │  flow    │  │ place    │  │ Tablero  │  │  detail  │ │/Wallet  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ └────┬────┘ │
│       │             │             │             │            │       │
│  ┌────▼─────────────▼─────────────▼─────────────▼────────────▼─────┐  │
│  │   Zustand stores (auth, escrows, UI)                            │  │
│  └────────────────────────┬───────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────▼───────────────────────────────────────┐  │
│  │   @pollar/react (PollarProvider, usePollar, modals)            │  │
│  └────────────────────────┬───────────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTP / JSON
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND (Next.js API routes — Node runtime)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /api/auth/*              /api/escrow/*                      │   │
│  │  /api/listings/*          /api/offers/*                      │   │
│  │  /api/price-alert         /api/disputes                     │   │
│  │  /api/reset-demo          /api/cron/timeout-check           │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  Service layer                                                │   │
│  │  ├─ pollar.server.ts     (Pollar API client w/ secret key)    │   │
│  │  ├─ stellar.ts           (Stellar SDK, multi-sig, ops)       │   │
│  │  ├─ escrow.service.ts    (state machine + transitions)       │   │
│  │  ├─ valuation.ts         (price alert engine)                │   │
│  │  └─ cron.ts              (TTL check, runs every 30s)         │   │
│  └─────┬───────────────────────────────┬─────────────────────┘   │
│        │                               │                          │
│  ┌─────▼────────────────┐    ┌─────────▼────────────────────┐    │
│  │  Prisma ORM          │    │  @pollar/core (server-side)   │    │
│  │  (driver adapter)    │    │  + @stellar/stellar-sdk v17  │    │
│  └─────┬────────────────┘    └─────────┬─────────────────────┘    │
└────────┼───────────────────────────────┼──────────────────────────┘
         │                               │
         ▼                               ▼
   ┌──────────────┐             ┌────────────────────────────────┐
   │  Neon        │             │  External services:            │
   │  Postgres    │             │  ├─ Pollar Server API (/v2)    │
   │  (serverless)│             │  ├─ Stellar testnet Horizon    │
   └──────────────┘             │  ├─ Vercel Blob (fotos eviden.) │
                                │  └─ Vercel Cron (timeout, 1min)│
                                └────────────────────────────────┘
```

> **v1.1:** `dev.db (SQLite)` → **Neon Postgres**; el cron pasa de "runs every 30s (in-process)" a dev 30s / prod 1 min (Vercel Cron); se agrega **Vercel Blob** para evidencia en prod.

> **v1.2 (2026-09-25, pasada 2 — decisiones del equipo):** la moneda pasa de **PumaDolar (P$, respaldado por USDC testnet) a Lumens (XLM) nativos de testnet** — sin emisor, sin trustlines, sin token distribution. Todas las cantidades en DB son `Int` **centavos de XLM** (conversión exacta a stroops en la frontera). El tipo de oferta `pollar-only` se renombra a `saldo-only` ("solo saldo"). Se unifica el esquema de IDs en **`cuid()`** (fuera `nanoid`). Las ofertas por listing son **públicas y no reservan el listing**: al cancelar un escrow, la oferta vinculada vuelve a `pending`. El fundeo seed usa la **Server API `POST /v1/wallets/fund`** (XLM) en vez de distribution rules.

---

## 3. Stack tecnológico

> **v1.1 (2026-09-25):** por decisión del equipo se actualizó a la última generación de la pila (Next 16, React 19, Tailwind 4, Prisma 7, Stellar SDK 17) y se aprobó deploy a Vercel (con Railway como alternativa). Todos los ejemplos de código de este doc fueron verificados contra estas versiones el 2026-09-25.

### 3.1 Versiones exactas

Verificadas contra npm registry el 2026-09-25:

```jsonc
{
  "dependencies": {
    // Framework
    "next": "16.2.9",                 // última estable (16.x)
    "react": "19.3.0",
    "react-dom": "19.3.0",

    // Pollar (fijado por el socio — NO tocar)
    "@pollar/core": "0.11.3",
    "@pollar/react": "0.11.3",

    // Stellar
    "@stellar/stellar-sdk": "17.1.0",// última estable (17.x)

    // UI
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",  // plugin PostCSS de Tailwind v4
    "postcss": "8.5.6",

    // Estado + validación + utilidades
    "zustand": "5.0.15",
    "zod": "4.6.5",
    "date-fns": "4.4.0",
    "lucide-react": "1.48.0",

    // DB (Postgres serverless)
    "@prisma/client": "7.10.0",
    "@prisma/adapter-neon": "7.10.0",
    "@neondatabase/serverless": "1.1.0",

    // Almacenamiento de evidencia en prod
    "@vercel/blob": "2.8.0"
  },
  "devDependencies": {
    "prisma": "7.10.0",
    // TypeScript: usar la versión que cree create-next-app (5.x).
    // TS 6/7 existen pero Next 16 aún las soporta con fricción — NO subir.
    "typescript": "^5.9",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tsx": "^4"
  }
}
```

**Notas de compatibilidad que ahorran horas (verificadas hoy):**

| Constraint | Detalle |
|---|---|
| **`next@16.2.9` es la última estable** | `cookies()` y `params` de Route Handlers son **async** (`await cookies()`, `await params`). Nada de Next 14. |
| **React 19 + `@pollar/react@0.11.3`** | Peer dep `react >=18` ✅. No hay conflictos. |
| **Stellar SDK 17** | Las operaciones `Operation.payment/setOptions/manageData/createAccount` **conservan la API** que este doc usa; cambia el namespace: `StellarSdk.Server` → `Horizon.Server`, `loadAccount()` es async, importa `BASE_FEE` y `Networks.TESTNET` (sigue existiendo). |
| **Prisma 7** | Ya no hay `datasource url = "file:..."` en el schema con SQLite-first: ahora `provider = "postgresql"` + `url = env("DATABASE_URL")`, configuración en `prisma.config.ts`, generator `provider = "prisma-client"` con `output` a carpeta local (`src/generated/prisma`), y **driver adapter** (`PrismaNeon`) para serverless. No usar `@prisma/client` directo con engineType Rust si deployas en Vercel. |
| **Tailwind 4** | CSS-first: `@import "tailwindcss"` en `app/globals.css`, **sin** `tailwind.config.js`. `create-next-app` con `--tailwind` ya lo scaffoldea. |
| **Zod 4** | API mayormente compatible con 3.x para lo que usamos. `z.enum`, `z.object`, `z.string()` sin cambios. |
| **TypeScript** | Usar 5.x (la de create-next-app). TS 6/7 existen (7.0.2 hoy) pero no vale el riesgo en 24h. |

### 3.2 Lo que NO usamos (y por qué)

- ❌ **Soroban / smart contracts reales** — para un MVP de 24h no vale la pena. Multi-sig nativo de Stellar cumple el rol con menos código.
- ❌ **SQLite** — con deploy a Vercel usamos **Postgres serverless (Neon)** desde el día 1. Mismo desarrollo local, misma DB en prod: cero migración sorpresa el día del demo.
- ❌ **NextAuth / Clerk** — Pollar ya da auth social via OAuth + email OTP.
- ❌ **TanStack Query / SWR** — Zustand + `refreshBalance()` cubren el caso. El estado es chico.
- ❌ **Storybook / Vitest / Playwright** — fuera del scope de 24h. Tests son nice-to-have, no bloqueantes para el demo.
- ❌ **shadcn / Radix** — Tailwind puro + componentes custom. shadcn añade complejidad que no necesitamos en 24h.
- ❌ **i18n** — UI en español únicamente.
- ❌ **Redis / cola de jobs** — para 24h, un cron de 1 min (Vercel Cron) es suficiente para el TTL de 48h/3 min. Sin infra adicional.

### 3.3 Node y runtime

- **Node 22 LTS** (Next 16 requiere ≥ 20.9; la máquina de dev ya tiene Node 26 y funciona, pero Vercel usa 22 — alinear). `.nvmrc` con `"22"`.
- **Package manager:** npm (Pollar SDK lo publica en npm; sin yarn/pnpm complexities).
- **Entornos:**
  - **Dev local:** `npm run dev` — mismo código que prod, contra la misma Neon DB (rama `dev` de Neon).
  - **Prod:** Vercel (Next standard). DB → Neon Postgres. Cron → Vercel Cron. Fotos → Vercel Blob.
  - **Alternativa Railway:** Railway Postgres + Railway Cron (mismo `DATABASE_URL`, mismo endpoint de cron). El código no cambia.
- **Sistema de archivos:** todo bajo `/home/zum/Documents/GOYAHACK/`. Seed data en módulo compartido `lib/seed-data.ts` (ver §13.1).

---

## 4. Modelo de datos (Prisma)

### 4.1 Schema completo

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  displayName     String
  major           String
  bio             String
  pollarWalletId  String   @unique        // G-address devuelto por Pollar
  balanceXlm      Int      @default(0)    // centavos de XLM (1 XLM = 100). Cache local; refresco con refreshBalance()
  createdAt       DateTime @default(now())

  listings        Listing[]
  offersMade      Offer[]  @relation("OffererOffers")
  escrowsAsBuyer  Escrow[] @relation("BuyerEscrows")
  escrowsAsSeller Escrow[] @relation("SellerEscrows")
  exchangeInitiated Escrow[] @relation("ExchangeInitiator")
  exchangeConfirmed Escrow[] @relation("ExchangeConfirmer")
  txLogs          TransactionLog[]
  disputeReports  DisputeEvidence[]
}

model Listing {
  id              String   @id @default(cuid())
  sellerId        String
  seller          User     @relation(fields: [sellerId], references: [id])
  title           String
  description     String
  priceXlm        Int      // centavos de XLM (ej. 25_000 = 250.00 XLM)
  type            String   // 'libros' | 'calculadoras' | 'electronica' | 'batas-uniformes' | 'laboratorio' | 'otros'
  majors          String   // JSON array serializado: ["Ing. en Computación", "Física"]
  condition       String   // 'nuevo' | 'como-nuevo' | 'bueno' | 'aceptable'
  photoUrl        String
  videoVerified   Boolean  @default(false)
  status          String   @default("active")  // 'active' | 'pending' | 'paused' | 'sold' | 'removed'
                          // 'pending' = hay un escrow en vuelo: no acepta nuevas ofertas (ver §7.2)
  createdAt       DateTime @default(now())

  offers          Offer[]
  escrows         Escrow[]

  @@index([status, type])
  @@index([sellerId])
}

model Offer {
  id              String   @id @default(cuid())
  listingId       String
  listing         Listing  @relation(fields: [listingId], references: [id])
  offererId       String
  offerer         User     @relation("OffererOffers", fields: [offererId], references: [id])
  type            String   // 'saldo-only' | 'barter' | 'hybrid' — "solo saldo" / "trueque puro" / "híbrida"
  offeredItems    String?  // JSON array: [{title, estimatedValueXlm}] — valores en centavos de XLM
  xlmAmount       Int?     // centavos de XLM que el ofertante pone en la mesa ('saldo-only' | 'hybrid')
  message         String?
  status          String   @default("pending")  // 'pending' | 'accepted' | 'completed' | 'rejected' | 'withdrawn'
                          // 'completed' = el escrow llegó a released/auto-released
  createdAt       DateTime @default(now())

  escrow          Escrow?

  @@index([listingId, status])
}

model Escrow {
  id                      String   @id @default(cuid())
  offerId                 String   @unique
  offer                   Offer    @relation(fields: [offerId], references: [id])
  listingId               String
  listing                 Listing  @relation(fields: [listingId], references: [id])
  buyerId                 String
  buyer                   User     @relation("BuyerEscrows", fields: [buyerId], references: [id])
  sellerId                String
  seller                  User     @relation("SellerEscrows", fields: [sellerId], references: [id])
  amountXlm               Int      // centavos de XLM retenidos en el escrow (0 si trueque puro)
  barterValueXlm          Int?     // valor estimado del bien que el ofertante entrega (centavos; para trueques)

  // Cuenta multi-sig en Stellar
  stellarEscrowAccount    String   // G-address del escrow
  arbiterSecretEnc        String?  // llave del ÁRBITRO del escrow, ENCRIPTADA (AES-256-GCM con APP_SECRET_KEY, ver §6.2 + lib/crypto.ts)
                                   // el buyer NO es signer: Pollar custodia su llave en AWS KMS y sin API para firmar txs ajenas (verificado 2026-09-25)
  stellarTxHashFunding    String?
  stellarTxHashRelease    String?
  stellarMemoReceipt      String?

  // Estado
  status                  String   @default("awaiting-funding")
                          // 'awaiting-funding' | 'funded'
                          // | 'awaiting-exchange' | 'exchange-recorded'
                          // | 'released' | 'auto-released' | 'disputed' | 'refunded'

  // Registro del intercambio (evento central)
  exchangeInitiatorId     String?
  exchangeInitiator       User?    @relation("ExchangeInitiator", fields: [exchangeInitiatorId], references: [id])
  exchangeInitiatedAt     DateTime?
  exchangeConfirmerId     String?
  exchangeConfirmer       User?    @relation("ExchangeConfirmer", fields: [exchangeConfirmerId], references: [id])
  exchangeConfirmedAt     DateTime?
  confirmWindowExpiresAt  DateTime? // awaiting-exchange: ventana para confirmar o disputar (CONFIRM_WINDOW_MINUTES).
                                    // Al expirar, el cron auto-cancela → refund completo al buyer (ver §7.2/§11.1)
  ttlExpiresAt            DateTime?

  // Resolución
  acceptedAt              DateTime?
  autoReleasedAt          DateTime?
  refundedAt              DateTime?
  platformFeeXlm           Int      @default(0)  // centavos de XLM cobrados como comisión (0 con HACKATHON_FREE_FEES)

  // Disputa
  disputedAt              DateTime?
  disputeReason           String?  // 'item-damaged' | 'exchange-never-happened' | 'item-different'
  disputeEvidenceHash     String?  // SHA256 hex (64 chars) anclado en Stellar DataEntry
  disputePhotoUrl         String?  // URL (Vercel Blob en prod) o ruta local /public/disputes/ (dev)

  platformFeeBps          Int      @default(200)  // snapshot del fee al crear el escrow

  createdAt               DateTime @default(now())

  txLogs                  TransactionLog[]
  disputes                DisputeEvidence[]

  @@index([status])
  @@index([status, ttlExpiresAt])             // cron Pasada 1: auto-resolve (Rama B)
  @@index([status, confirmWindowExpiresAt])   // cron Pasada 2: auto-cancel ventana
  @@index([buyerId])
  @@index([sellerId])
}

model DisputeEvidence {
  id          String   @id @default(cuid())
  escrowId    String
  escrow      Escrow   @relation(fields: [escrowId], references: [id])
  reporterId  String
  reporter    User     @relation(fields: [reporterId], references: [id])
  reason      String   // 'item-damaged' | 'exchange-never-happened' | 'item-different'
  description String   // ≤500 chars
  photoUrl    String   // URL (Vercel Blob en prod) o ruta local en dev — ver §12.6
  status      String   @default("pending")  // 'pending' | 'resolved' | 'rejected'
  createdAt   DateTime @default(now())

  @@index([escrowId])
}

model TransactionLog {
  id          String   @id @default(cuid())
  escrowId    String
  escrow      Escrow   @relation(fields: [escrowId], references: [id])
  actorId     String
  actor       User     @relation(fields: [actorId], references: [id])
  action      String   // ver enum abajo
  metadata    String?  // JSON
  createdAt   DateTime @default(now())

  @@index([escrowId, createdAt])
}

// Posibles valores del campo `action` en TransactionLog:
// 'offer-accepted'
// 'escrow-funded'
// 'exchange-initiated'
// 'exchange-confirmed'
// 'accepted'         (Rama A)
// 'auto-released'    (Rama B)
// 'disputed'
// 'dispute-resolved' // cuando admin resuelve (fuera del MVP)
// 'refunded'
// 'buyback-accepted' // (fuera del MVP)
// 'reset-demo'       // acción del dev

// ⚠️ NO hay modelo PriceAlert a propósito: la alerta de precios es un motor de
// valuación SIN estado (lib/priceAlert/engine.ts → checkPrice(), ver PRD §5).
// Los endpoints POST /api/price-alert devuelven el resultado calculado, no lo
// persisten. No crear un modelo para esto.
```

### 4.2 Decisiones de modelado

**Por qué `majors` y `offeredItems` son JSON strings y no relaciones:**
- Las majors del catálogo son un set fijo (8 valores). Si fueran relación, añadir una nueva major requeriría migración + seed + UI.
- Los items ofertados en trueques son **títulos libres** ("Mi laptop vieja"), no listings del catálogo. No tiene sentido referenciarlos.
- Postgres (Neon) sí tiene tipo JSON nativo, pero lo mantenemos como **string serializado** para que `createMany` del seed y los helpers sean idénticos en dev/prod y sin conversiones implícitas de Prisma. Si sobra tiempo, migrar a `Json` es trivial.

**Por qué `platformFeeBps` está snapshot en el escrow:**
- Si mañana cambiamos `PLATFORM_FEE_BPS` de 200 a 250, los escrows viejos siguen cobrando el fee original.
- Permite fee dinámico sin renegociar contratos en vuelo.

**Por qué `balanceXlm` está en `User`:**
- Es un cache local del balance real en Stellar (vía Pollar). La fuente de verdad es Stellar.
- Se refresca con `client.refreshBalance()` después de cada acción que afecte fondos.
- En el MVP podríamos saltarnos esto y siempre llamar a Pollar, pero cachear evita una llamada API por render.

**💡 Doctrina de dinero (decisión del equipo, 2026-09-25):**
- **Moneda = Lumens (XLM) nativos de testnet.** No hay PumaDolar, no hay USDC, no hay issuer ni trustlines. Precios, saldos, escrows y comisiones se expresan en XLM.
- **Todas las cantidades en DB son `Int` = centavos de XLM** (1 XLM = 100 centavos). Nunca `Float`.
- **Frontera con Stellar:** XLM acepta hasta 7 decimales (stroops: 1 XLM = 10⁷ stroops). Helpers:
  - `centsToXlm(cents) = (cents / 100).toFixed(7)` → string para `Operation.payment` (exacto: 1 cent = 100,000 stroops).
  - `xlmToCents(xlmString) = Math.round(Number(xlmString) * 100)` → al leer balances/tx desde Stellar.
- **Comisión 2% en enteros:** `feeCents = Math.floor(amountCents * PLATFORM_FEE_BPS / 10000)` (idempotente, sin drift de floats).

---

## 5. Integración Pollar — detalle

### 5.1 Wallets que vamos a crear en el dashboard

Tres wallets distintas para tres roles:

| Wallet | Rol | Cómo se crea |
|---|---|---|
| **Sponsor / gas** | Paga TODAS las transaction fees de la app (incluyendo multi-sig ops). | Auto-creada por Pollar al crear la app. |
| **Funding** | Bloquea ~1.5 XLM reserve por cada usuario nuevo (CAP-33). | Auto-creada por Pollar. |
| **Treasury / platform account** | La cuenta que FIRMA como "plataforma" en el multi-sig del escrow, y RECIBE la comisión al release. | **Manual:** la creamos nosotros (keypair Stellar clásico), fondeamos con XLM testnet (friendbot), y la registramos en `.env` como `PLATFORM_SECRET_KEY` + `PLATFORM_PUBLIC_KEY`. NO se maneja por Pollar. |

**Decisión confirmada: DOS apps separadas de Pollar.**

| App de Pollar | Propósito | Configuración |
|---|---|---|
| `Pollar — Usuarios` | Wallets embebidas para los 5 seed users + usuarios reales | Auth: Google + email OTP. Chains → Stellar testnet (moneda nativa **XLM**, sin tokens). Funding: Immediate. |
| `Pollar — Operacional` | Wallet custodial que RECIBE las comisiones de los releases | Auth: solo server-side con secret key (no UI). Fondeada por la treasury manual cuando necesite XLM (testnet es gratis). |

**Por qué dos apps:** separa el flujo de comisiones (operacional, sensible) del flujo de pagos P2P (usuarios, alto tráfico). Si una se compromete, la otra no se ve afectada. La treasury manual sigue siendo necesaria porque la cuenta que firma el multi-sig del escrow debe estar fuera del control de Pollar.

**¿Cómo se mueven las comisiones al operacional?**
- La treasury manual firma la release → recibe comisión en su cuenta.
- Un job (`/api/cron/sweep-fees`, semanal) hace `payment` desde treasury → Pollar Operacional.
- Documentado pero fuera del MVP; para el hackathon basta con acumular fees en la treasury.

### 5.2 Setup del dashboard (orden exacto)

Antes de codear, una persona del equipo:

**App 1: `Pollar — Usuarios`**

1. Crear app en [dashboard.pollar.xyz](https://dashboard.pollar.xyz) → nombrarla "PumaTrade Usuarios"
2. **Settings → Auth providers:** habilitar Google + email OTP. Google para usuarios reales, email OTP para los 5 seed users (con correos temporales).
3. **Settings → Funding mode:** `Immediate` (cada login activa la wallet al instante; necesario porque el demo necesita que el usuario tenga wallet operativa sin pasos extra)
4. **Settings → Account Funding:** `starting balance = 0` (el fundeo de las wallets seed se hace en T-2h vía Server API `POST /v1/wallets/fund`, ver paso 17)
5. **Chains → Stellar testnet:** la moneda es **XLM nativo** — no hay tokens ni trustlines que configurar
6. **Build → API Keys:** generar publishable key (`pub_testnet_users_…`) y secret key (`sec_testnet_users_…`)
7. **Treasury:** nada pendiente aquí (la moneda es XLM nativo; el fundeo seed va por Server API, ver paso 17)

**App 2: `Pollar — Operacional`**

8. Crear segunda app → nombrarla "PumaTrade Operacional"
9. **Settings → Auth providers:** deshabilitar todo (esta app no tiene UI; solo se usa server-side)
10. **Settings → Funding mode:** `Immediate`
11. **Chains → Stellar testnet:** XLM nativo (igual que la app Usuarios)
12. **Build → API Keys:** generar publishable + secret keys (`pub_testnet_ops_…`, `sec_testnet_ops_…`)
13. Fondear esta wallet operacional con XLM de testnet (friendbot o transferencia de la treasury)

**Treasury manual (fuera de Pollar)**

14. Crear keypair de treasury manual:
    ```bash
    # Opción A: stellar-cli
    stellar keys generate platform-treasury --network testnet --fund
    
    # Opción B: laboratorio.stellar.org
    # - https://laboratory.stellar.org/#account-creator?network=test
    # - Guardar la secret key en .env (NO subirla al repo)
    ```
15. Fondear la treasury con XLM testnet vía friendbot: `https://friendbot.stellar.org/?addr=G...TU_KEY...` (o el botón de fund en laboratorio.stellar.org). Testnet es gratis y otorga ~10,000 XLM.
16. Capturar todos los IDs (4 API keys de Pollar + treasury public/secret) y guardarlos en `.env.local` (NO commitear)

**Wallets seed (T-2h, §13.3 para el detalle)**

17. **Fondeo de las 5 wallets seed con XLM:** el demo app oficial de Pollar usa la **Server API `POST /v1/wallets/fund`** con la secret key (✅ verificado en `pollar-xyz/template-nextjs`) — un route handler nuestro hará exactamente eso después de cada primer login de un seed user, con el **saldo por persona del PRD §1** (María 1,250 / Juan 2,000 / Andrea 800 / Pablo 500 / Sofía 1,800 XLM — multiplicar ×100 al guardarlo en centavos).
18. Para cada seed user (5):
    - Login **una vez** vía email OTP con correo temporal (`maria.pumatrade+seed1@mail.tm`…)
    - Un route handler (solo dev) llama a `POST /v1/wallets/fund` → la wallet queda con saldo XLM sin pasos manuales
    - El mismo dev helper captura `wallet.address` → `SEED_WALLET_IDS` (JSON en `.env.local`)
    - `npm run capture:wallets` verifica en Stellar que las 5 existen y tienen saldo de XLM

> **Realidad verificada de Pollar (2026-09-25):** la creación de wallets arbitrarias server-side **no existe** — las wallets se crean en el login del usuario. Lo que sí existe es el fundeo server-side (`POST /v1/wallets/fund`, secret key), que es justo lo que usamos: cada seed user se loguea **una vez** vía email OTP en la app Usuarios con un email temporal, el backend fondea su wallet con XLM, y un dev helper captura el `wallet.address` resultante y lo guarda en `SEED_WALLET_IDS` (ver §13.3).

### 5.3 El provider en el root layout

```tsx
// app/layout.tsx
import { PollarProvider } from '@pollar/react';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <PollarProvider
          client={{
            apiKey: process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY!,
          }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
```

> El ejemplo oficial (`demo-nextjs`) usa únicamente `client={{ apiKey }}` — **sin** `network`. La red se fija a nivel de app en el dashboard (Chains → Stellar testnet), o con el selector `<ChainSelect />`. No agregar opciones inventadas aquí.

### 5.4 Hooks y modales que vamos a usar

> **API verificada contra `@pollar/react`/`@pollar/core` 0.11.3** (repo oficial + example app, 2026-09-25). Si un método no existe en tu instalación, el demo app oficial `pollar-xyz/template-nextjs` es la referencia de implementación.

| Pieza | Dónde la usamos | Notas |
|---|---|---|
| `usePollar()` | En todos los componentes que necesitan login/balances | Hook principal. Expone `login`, `logout`, `isAuthenticated`, `wallet`, `getClient()` (headless). |
| `usePollar().login({ provider: 'google' })` | Auth para usuarios reales | Crea la wallet embebida automáticamente. |
| `usePollar().login({ provider: 'email' })` | Auth para los 5 seed users con emails temporales (ej. `maria.pumatrade+seed1@mail.tm`) | Email OTP — mismo flujo de creación de wallet. |
| `usePollar().logout()` | Settings | Cierra sesión Pollar. |
| `usePollar().wallet` | Identificar al usuario | `wallet.address` es el **G-address** que guardamos en `User.pollarWalletId`. El email/displayName: usar la sesión de Pollar — en el demo app oficial se lee del objeto de sesión; si `wallet.user` no existe en 0.11.3, usar `client.getUserProfile()` (server/client según disponibilidad). **Verificar en Bloque 1 con el demo app.** |
| `getClient().refreshBalance()` / `getWalletBalance()` | Después de cada acción que afecte saldo | ⚠️ `balance` y `available` son **`string \| null`** — `null` = cadena no legible: renderizar "no disponible", **nunca 0**. Old docs tenían `walletBalance`/`refreshWalletBalance`; el nombre real es `refreshBalance`. |
| `getClient().runTx('payment', { destination, amount, asset })` | **Checkout del escrow (Paso 5)** | ✅ Verificado en docs/repo oficial (`SendPaymentForm.tsx`). destination = cuenta escrow, amount = string XLM (`centsToXlm(amountXlm)`), **asset = `{ type: 'native' }`** (XLM nativo, sin trustline). |
| Fondeo de seed user | Fundear cada wallet seed tras su primer login | ✅ Verificado: Server API `POST /v1/wallets/fund` con secret key (patrón KYC-simulated del demo app). Lo llama un route handler dev; nunca expone la secret al cliente. |
| `openReceiveModal()` | Settings | ✅ Verificado (QR/recibir). Opcional — XLM es demo interno. |
| Historial de transacciones (`txHistory` hook o modal) | Settings | Muestra historial del usuario (lo da Pollar, no construimos). |
| `<ChainSelect />` | Header (red) | Selector de red Stellar/Solana (0.11.1+). En PumaTrade solo Stellar testnet — fijarlo y no exponerlo o mostrarlo deshabilitado. |
| `@pollar/core` (server-side) | API routes | Operaciones privilegiadas con secret key. **Dos clientes Pollar distintos**: `pollarUsers` (secret de la app Usuarios) y `pollarOps` (secret de la app Operacional). |

### 5.4a Servicio server-side de Pollar (`lib/pollar.ts`)

```typescript
// lib/pollar.ts  — SOLO server (las secret keys nunca llegan al cliente)
import { PrismaClient } from '@/generated/prisma/client';

// Cliente operacional — usado por el cron de fees y por la verificación de
// webhooks de Pollar (si los usamos en el futuro).
export const pollarOps = createPollarServerClient(process.env.POLLAR_OPS_SECRET_KEY!);

// Llamadas a la Server API de Pollar (server.api.pollar.xyz) que necesitemos:
// - POST /v1/wallets/fund — fundear wallet con XLM (patrón verificado del demo app)
// - POST /v2/... — resto de endpoints /v2
// El patrón exacto está documentado en el demo app: fetch con header
// 'x-pollar-api-key': process.env.POLLAR_USERS_SECRET_KEY y 'Content-Type'.
```

### 5.5 Lo que NO vamos a usar (por ahora)

- ❌ **Deferred funding** — no tenemos KYC en MVP
- ❌ **Passkeys** — aún `coming soon` según docs de Pollar
- ❌ **Multi-chain (Solana)** — no aplica
- ❌ **Pollar Pay** — fuera de scope
- ❌ **SEP-24 ramps** — fuera del MVP ("La Casa")
- ❌ **External wallet adapters** (Freighter, Albedo, etc.) — los usuarios solo tienen la wallet embebida
- ❌ **Earn / DeFindex / Blend** — fuera de scope
- ❌ **MCP Gateway** — fuera de scope

### 5.6 Riesgos de Pollar

| Riesgo | Mitigación |
|---|---|
| Rate limit de testnet (1,000 req/día) | Cachear balances agresivamente, evitar polling. Plan B: si se acaba, esperar al día siguiente UTC. |
| Testnet reset periódico | No confiar en historial de Pollar como única fuente; los eventos críticos viven en Stellar + nuestra DB. |
| API no disponible | Mostrar error claro; el demo debería tener fallback a modo "preview" (UI sin transacciones reales). |

---

## 6. Stellar — el smart contract multi-sig

### 6.1 Por qué multi-sig y no Soroban

Comparación honesta:

| Aspecto | Multi-sig nativo | Soroban smart contract |
|---|---|---|
| Líneas de código | ~50 ops | ~300+ líneas Rust |
| Auditoría | Probado por SDF desde 2015 | Más nuevo, menos battle-tested |
| Flexibilidad | Limitado a N-de-M signers | Arbitrario |
| Fees | ~0.00001 XLM por op | Más alto |
| Tiempo de setup en MVP | 1 hora | 4-6 horas |

Para 24h de hackathon, multi-sig es la elección correcta. La PRD v3.4 ya está alineada con esta decisión.

### 6.2 Estructura exacta de una cuenta escrow

Cada vez que se crea un escrow, generamos una cuenta Stellar nueva con esta configuración:

```
Cuenta: escrow-{cuid}   (la DB mapea id → G-address; no hay nombre legible on-chain)
Master weight: 0               (master key EFÍMERO — firma la creación y se destruye)
Signer 1: PLATFORM_PUBLIC_KEY  (peso 1)
Signer 2: ARBITER_PUBLIC_KEY   (peso 1 — llave de arbitraje por-escrow, encriptada en la DB)
Moneda: XLM nativo             (sin emisor, sin trustline — el escrow recibe XLM directo)
Low threshold: 2               (necesario para manageData, etc.)
Medium threshold: 2            (necesario para payment)
High threshold: 2              (necesario para account merge, etc.)
```

**Por qué master weight = 0:** el master key del escrow solo sirve para firmar la creación (los `setOptions` de signers/thresholds se autorizan con su peso 1 inicial). Después se destruye: la cuenta queda gobernada únicamente por **platform + árbitro**, con threshold 2 en todos los niveles.

**Quién es el "árbitro" y por qué cambió el diseño (2-de-2 plataforma+comprador → 2-de-2 plataforma+árbitro):** el modelo original ponía al COMPRADOR como segunda llave ("el dinero no se mueve sin su firma"). Verificado 2026-09-25 en docs.pollar.xyz (`llms-full.txt`): la llave de cada usuario vive en el **AWS KMS de Pollar** y su SDK solo firma transacciones que él mismo construye con `source` = wallet del usuario ("*Pollar Server cannot move user funds*"). No existe API documentada para que el comprador firme un payment cuyo source es la cuenta escrow — su llave nunca llega ni al navegador ni a nuestro server. Por eso el escrow se firma con **dos llaves server-side** (plataforma + árbitro por-escrow): el comprador no es signer. La UI no cambia y cada movimiento queda on-chain con 2 firmas verificables en stellar.expert; la protección real del demo es la máquina de estados de la app + el registro on-chain. _(En producción real, la llave de arbitraje iría a un custodio externo o se implementaría con Soroban — ver §17.)_

**Por qué threshold = 2 en todos los niveles:** simplifica el modelo. Para un MVP no necesitamos distintos niveles de autorización.

**💡 XLM nativo = cero trustlines:** como la moneda es **Lumens nativos** (no un asset emitido como USDC), el escrow NO necesita trustline para recibir fondos. La creación sigue siendo atómica en UNA transacción (createAccount + setOptions) firmada por la plataforma (fuente del `createAccount`) y por el master key efímero del escrow (fuente de los `setOptions`), **antes** de desactivar el master. El server destruye la secret del master inmediatamente después (`escrowMaster._secret = ''`) — **la del árbitro SÍ se persiste encriptada** en `Escrow.arbiterSecretEnc` porque sin ella, con threshold 2, ningún release/refund sería posible.

### 6.3 Operaciones Stellar que vamos a ejecutar

> ⚠️ **SDK v17** (verificado 2026-09-25): las operaciones conservan la API clásica (`Operation.payment`, `setOptions`, etc.), pero el namespace cambió. Escribimos con imports explícitos, `Horizon.Server` (antes `StellarSdk.Server`) y `await server.loadAccount()`. No importar `* as StellarSdk` y usar `StellarSdk.Server` — eso ya no existe en v17.

```typescript
// lib/stellar.ts — encabezado
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Networks,
  BASE_FEE,
} from '@stellar/stellar-sdk';

// Moneda nativa: XLM. No hay Asset con emitter — el dinero ES la moneda de la red.
// Asset.native() se usa en los payments; en DB las cantidades van en centavos (Int).
export const horizon = new Horizon.Server('https://horizon-testnet.stellar.org'); // un solo instance por proceso
export const STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;

// ── Conversión entera ↔ XLM (ver doctrina de dinero §4.2) ─────────────────────
export function centsToXlm(cents: number): string {
  return (cents / 100).toFixed(7);       // DB (centavos) → string para Stellar
}
export function xlmToCents(xlm: string): number {
  return Math.round(Number(xlm) * 100);  // Stellar → DB (centavos)
}
export function feeCents(amountCents: number, bps: number): number {
  return Math.floor((amountCents * bps) / 10000);  // 2% = 200bps, sin floats
}
```

```typescript
// lib/stellar.ts — createEscrowAccount (UNA transacción atómica)
// Reservas mínimas (testnet): 1 XLM cuenta + 0.5 signer platform + 0.5 signer árbitro
// = 2 XLM. Usamos startingBalance '3' y el excedente queda como buffer de fees.
const escrowMaster = Keypair.random();            // efímero: firma la creación y se DESTRUYE
const arbiter = Keypair.random();                 // árbitro: se persiste ENCRIPTADO (arbiterSecretEnc)
const escrowPublicKey = escrowMaster.publicKey();

const tx = new TransactionBuilder(platformAccount, {
  fee: await horizon.fetchBaseFee(),
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.createAccount({
    destination: escrowPublicKey,
    startingBalance: '3',                         // XLM nativo: cubre reservas + buffer
  }))
  .addOperation(Operation.setOptions({            // signer: plataforma
    signer: { ed25519PublicKey: platformPublicKey, weight: 1 },
    source: escrowPublicKey,
  }))
  .addOperation(Operation.setOptions({            // signer: árbitro (server-side, encriptado en DB)
    signer: { ed25519PublicKey: arbiter.publicKey(), weight: 1 },
    source: escrowPublicKey,
  }))
  .addOperation(Operation.setOptions({            // desactivar master + thresholds
    masterWeight: 0,
    lowThreshold: 2,
    medThreshold: 2,
    highThreshold: 2,
    source: escrowPublicKey,
  }))
  .setTimeout(30)
  .build();

tx.sign(platformSecret);         // fuente del createAccount
tx.sign(escrowMaster);           // fuente de los setOptions (aún con peso 1)
const res = await horizon.submitTransaction(tx);

// A partir de aquí el master NO sirve: masterWeight = 0. Destruirlo.
escrowMaster._secret = '';       // (en la práctica: no guardarla en memoria persistente)

// El ÁRBITRO SÍ se persiste encriptado — sin él, threshold 2 impide release/refund.
// (el caller lo escribe en Escrow.arbiterSecretEnc dentro del mismo $transaction)
const arbiterSecretEnc = await encryptSecret(arbiter.secret());   // AES-256-GCM, lib/crypto.ts (§6.4)

return { publicKey: escrowPublicKey, txHash: res.hash, arbiterSecretEnc };
```

```typescript
// 3. BUYER FONDEA EL ESCROW
// Cliente: runTx('payment', { destination: escrowPublicKey, amount: centsToXlm(amountXlm), asset: { type: 'native' } })
// (patrón verificado en demo app de Pollar — ver §5.4)
// XLM es nativo: no requiere trustline de ningún tipo.

// 4. RELEASE (Rama A o B)
// Construir + firmar + submit multi-sig con 2 firmas: PLATFORM + ÁRBITRO (ver §6.2)
// El buyer NO firma: su llave vive en el KMS de Pollar (sin API de firma ajena).
// ⚠️ Trueque puro (amountXlm = 0): NO hay ops de pago (un payment de '0.0000000'
//    es inválido en Stellar) — la release solo actualiza estado + logs on-chain si hay
//    evidencia que anclar. Lo mismo aplica al refund (nada que devolver).
const netToSeller = centsToXlm(amountXlmCents - feeXlmCents);   // seller (monto − comisión)
const releaseOp1 = Operation.payment({
  destination: sellerPublicKey,
  asset: Asset.native(),
  amount: netToSeller,
});
const releaseOp2 = Operation.payment({
  destination: platformPublicKey,
  asset: Asset.native(),
  amount: centsToXlm(feeXlmCents),
});

// 5. REFUND (cancelación antes de intercambio confirmado)
// Multi-sig con 2 firmas (platform + árbitro): escrow → buyer (monto completo, centsToXlm(amountXlm))

// 6. ANCLAJE DE EVIDENCIA DE DISPUTA (Rama C)
// Server-side: firman PLATFORM + ÁRBITRO (§6.2) — ya congelado, solo la app decide el desenlace.
// Ancla el SHA256 hash de la foto de evidencia en la cuenta del escrow.
// Stellar DataEntry: key ≤64 bytes, value ≤64 bytes (suficiente para un hash hex de 64 chars).
const anchorEvidenceOp = Operation.manageData({
  name: 'dispute_evidence_hash',
  value: sha256HashHex,  // 64 chars hex
  source: escrowPublicKey,  // la cuenta del escrow es la dueña del data entry
});
```

> **Reserva y residual (cuenta del escrow):** la cuenta se crea con `startingBalance = 3 XLM` (cubre la reserva ≈ 1 XLM — los signers ya no cuentan contra reserve desde Protocol 20 — + buffer de fees). Tras un release o refund la cuenta paga el monto retenido y el residual (~3 XLM) **permanece**: Stellar exige mantener la reserva mínima, así que nunca llega a vaciarse del todo. En testnet ese residual no cuesta; en prod cada escrow ≈ 3 XLM de costo hundido para la plataforma (mitigación post-MVP: `accountMerge` del residual a la treasury al resolver).
>
> **Memo on-chain** de la rama A y B: `PT-{escrowIdShort}-{sha256(escrowId|buyerId|sellerId|amount).slice(0,16)}` (ver PRD §4.7) — Rama A siempre incluye este memo (`Memo.text(memo)`); Rama B (auto-resolve) incluye el mismo memo más el `ttlExpiresAt` como diferenciador visible en stellar.expert. La rama C (dispute) usa `manageData` (no memo) porque la foto debe persistir asociada a la cuenta, no a una tx.

**Construcción multi-sig (2 firmas) en v17:**

```typescript
// lib/stellar.ts — releaseEscrow (esqueleto)
// Entradas SIEMPRE en centavos (Int de la DB); se convierten dentro.
export async function releaseEscrow(params: {
  escrowAccount: string;       // G-address del escrow
  arbiterSecret: string;       // llave del ÁRBITRO (descifrada de Escrow.arbiterSecretEnc, SOLO server)
  sellerPublic: string;
  platformSecret: string;      // la plataforma SIEMPRE firma
  amountCents: number;         // monto total retenido (centavos)
  feeCents: number;            // comisión (0 si HACKATHON_FREE_FEES=true)
  memo?: string;
}) {
  const { escrowAccount, sellerPublic, platformSecret, arbiterSecret, amountCents, feeCents } = params;

  const escrowSrc = await horizon.loadAccount(escrowAccount);   // async en v17
  const baseFee = await horizon.fetchBaseFee();

  const tx = new TransactionBuilder(escrowSrc, {
    fee: baseFee,
    networkPassphrase: Networks.TESTNET,
    memo: memo ? Memo.text(memo) : undefined,
  })
    .addOperation(Operation.payment({
      destination: sellerPublic,
      asset: Asset.native(),                       // XLM
      amount: centsToXlm(amountCents - feeCents),  // seller: monto − comisión
    }))
    .addOperation(Operation.payment({
      destination: PLATFORM_PUBLIC_KEY,
      asset: Asset.native(),
      amount: centsToXlm(feeCents),                // comisión a la treasury
    }))
    .setTimeout(30)
    .build();

  tx.sign(Keypair.fromSecret(platformSecret));
  tx.sign(Keypair.fromSecret(arbiterSecret));   // segunda llave: el árbitro del escrow (threshold 2)

  const response = await horizon.submitTransaction(tx);
  return { hash: response.hash };
}

// ⚠️ **Idempotencia de release (mitigación M5 de §12.7):** antes de firmar, el caller
// DEBE ejecutar `EscrowService` con un `tx.escrow.updateMany({ where: { id, stellarTxHashRelease: null }, data: { stellarTxHashRelease: hash, status: 'released' } })`.
// Si el primer write ya puso el hash (otro request ya firmó), count=0 → abort sin
// firmar Stellar. Sin esta regla, dos clicks concurrentes del boton "Aceptar artículo"
// firmarían dos release y enviarían dos tx a Horizon — la segunda falla con fees perdidos.
// (Regla #2 de §7.3 aplicada al caso concreto del release.)
```

> **Nota de decimales (doctrina de dinero §4.2):** en DB todo es `Int` **centavos de XLM** (nunca Float). En Stellar los montos son strings con hasta 7 decimales (1 centavo = 100,000 stroops, conversión exacta). Los únicos puntos de conversión son `centsToXlm()` (al construir tx) y `xlmToCents()` (al leer balances/historial desde Horizon).

### 6.4 Encriptación de la llave del árbitro (`lib/crypto.ts`)

La única secret que persiste en la DB es la del árbitro de cada escrow. Se encripta con AES-256-GCM usando `APP_SECRET_KEY` (32 bytes, solo server):

```typescript
// lib/crypto.ts — cifrado de la llave del árbitro + firma de cookies
import crypto from 'node:crypto';

// ⚠️ Derivación de sub-llaves (HKDF-SHA256, RFC 5869). NUNCA reusar la misma clave
// para dos modos: de APP_SECRET_KEY (master, 32 bytes hex, solo server) se derivan
// dos sub-llaves con `info` distintos. Si una se compromete, la otra no se puede
// inferir. Un solo secret en env, dos claves con dominios separados en memoria.
const MASTER = Buffer.from(process.env.APP_SECRET_KEY!, 'hex');   // 32 bytes

function subkey(info: string): Buffer {
  // crypto.hkdfSync disponible desde Node 15: hash, ikm, salt (vacío),
  // info (string del dominio), length (32 bytes).
  return crypto.hkdfSync('sha256', MASTER, Buffer.alloc(0), Buffer.from(info), 32);
}
const KEY_ENC = subkey('pumatrade:v1:aes-gcm');       // cifrado simétrico (árbitro)
const KEY_COOKIE = subkey('pumatrade:v1:hmac-cookie'); // firma de sesión

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_ENC, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(blob: string): string {
  const [, , ivHex, tagHex, dataHex] = blob.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_ENC, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

// Firma de sesión (HMAC-SHA256): la cookie guarda `${email}.${sig}` con KEY_COOKIE,
// así el backend detecta emails forjados a mano (ver §8.2/§9.4). Clave NO compartida
// con el cifrado de la llave árbitro (derivadas por HKDF, arriba).
export function signCookie(email: string): string {
  const sig = crypto.createHmac('sha256', KEY_COOKIE).update(email).digest('hex');
  return `${email}.${sig}`;
}

export function verifyCookie(blob: string): string | null {
  const idx = blob.lastIndexOf('.');
  if (idx < 1) return null;
  const email = blob.slice(0, idx);
  const sig = blob.slice(idx + 1);
  const expected = crypto.createHmac('sha256', KEY_COOKIE).update(email).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}
```

> `APP_SECRET_KEY` se genera una vez (`openssl rand -hex 32`) y vive solo en `.env`. Se valida al arrancar (`lib/config.ts`) para que un `.env` incompleto falle rápido. De ella se derivan `KEY_ENC` y `KEY_COOKIE` por **HKDF-SHA256** (arriba) — un solo secret en env, dos claves en memoria con **dominios separados** (cifrado vs. autenticación de sesión). Tanto si una se filtra en logs, el compromiso está acotado al modo correspondiente.

### 6.5 Por qué `manageData` y no memo

- **Memo:** solo disponible en transacciones, no persiste en la cuenta. Para "anclar la evidencia" queremos que sea consultable desde la cuenta del escrow incluso mucho después.
- **`manageData`:** persiste en el ledger mientras la cuenta exista. La cuenta del escrow **nunca llega a vaciarse**: tras release/refund se queda con el saldo residual (~3 XLM, ver §6.3 nota de reserva). El eventual `accountMerge` para limpiar el residual queda post-MVP.
- **Hash, no foto completa:** una foto JPEG base64 ocupa ~50-100 KB; el límite de un DataEntry value es 64 bytes. Solo el hash SHA256 (32 bytes → 64 hex chars) cabe. La foto completa se guarda en **Vercel Blob** (prod) o disco local (dev) — ver §12.6; el hash en Stellar es la prueba criptográfica de que esa foto específica fue la reportada.

```typescript
// lib/evidence.ts
import crypto from 'crypto';

export async function anchorDisputeEvidence(
  escrowPublicKey: string,
  photoBuffer: Buffer
): Promise<{ hash: string; txHash: string }> {
  const hash = crypto.createHash('sha256').update(photoBuffer).digest('hex');
  // Construir y enviar tx con manageData → obtener txHash de Stellar
  const txHash = await anchorDataEntry(escrowPublicKey, 'dispute_evidence_hash', hash);
  return { hash, txHash };
}
```

### 6.6 Moneda: XLM nativo

```typescript
// lib/stellar.ts
export const STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
// No hay asset que configurar: la moneda ES la de la red (Lumens, XLM).
```

En mainnet no cambia ninguna constante (XLM es XLM). Si algún día se emitiera un token (ej. USDC real), se agregaría un `Asset` aquí — fuera de scope del MVP.

### 6.7 Server keypair (la plataforma)

```typescript
// lib/server-keypair.ts
import { Keypair } from '@stellar/stellar-sdk';

// IMPORTANTE: NUNCA importar este módulo desde el cliente.
// El bundler de Next.js debería impedirlo, pero defensivamente verificamos.
if (typeof window !== 'undefined') {
  throw new Error('server-keypair.ts no debe usarse en el cliente');
}

export const platformKeypair = Keypair.fromSecret(
  process.env.PLATFORM_SECRET_KEY!
);
export const PLATFORM_PUBLIC_KEY = platformKeypair.publicKey();
```

---

## 7. Máquina de estados del escrow

### 7.1 Diagrama

```
            ┌─────────────────────────────────────────────────┐
            │                                                 │
   ┌────────▼─────────┐                                      │
   │ awaiting-funding │ ◄── offer accepted (listing → 'pending')│
   └────────┬─────────┘                                      │
            │                                                │
            │ POST /api/escrow/fund                          │
            │ (buyer envía fondos al escrow via Pollar)      │
            ▼                                                │
   ┌────────────────┐                                        │
   │    funded      │ ── POST /api/escrow/cancel ──► refunded│
   └────────┬───────┘                                        │
            │                                                │
            │ Cualquier parte: POST /api/escrow/record-exchange
            │                                                  │
            ▼                                                  │
   ┌─────────────────────┐                                    │
   │ awaiting-exchange   │  ── cancel (cualquiera) ──► refunded
   │ (ConfirmWindow)     │  ── cron: ventana vencida ──► refunded
   └────────┬────────────┘                                     │
            │                                                │
            │ La otra parte: POST /api/escrow/confirm-exchange│
            │ (o POST /api/escrow/dispute con razón          │
            │  'exchange-never-happened')                     │
            ▼                                                │
   ┌────────────────────┐                                    │
   │ exchange-recorded  │ (TTL corriendo)                     │
   └─┬───────┬────────┬─┘                                    │
     │       │        │                                       │
     │       │        └── POST /api/escrow/dispute ──► disputed
     │       │            (item-damaged o item-different)      │
     │       │                                                │
     │       └── cron: TTL expiró ──► auto-released           │
     │                                                        │
     └── POST /api/escrow/accept ──► released                │
         (buyer toca "Aceptar artículo")                      │
                                                              │
   Estados terminales: released, auto-released, disputed, refunded
   (released/auto-released → listing pasa a 'sold'; refunded → listing 'active', oferta vuelve a 'pending')
```

### 7.2 Quién puede hacer cada transición

| Transición | Endpoint | Quién dispara | Validaciones |
|---|---|---|---|
| → `awaiting-funding` | `accept-offer` | vendedor | oferta existe, **listing `active` sin escrow en vuelo (si lo hay → 409, validado DENTRO del `$transaction` con `updateMany` condicional, §8.4)**. El listing pasa a `pending`; las demás ofertas quedan `pending`. **Excepción trueque puro (`amountXlm = 0`):** el escrow **nace directamente en `funded`** — no hay nada que fondear y la UI en §10.4 nunca entra al paso "Fondear 0 XLM" |
| `awaiting-funding` → `funded` | `fund` | comprador | oferta fue aceptada; endpoint verifica el saldo del escrow en Horizon antes de marcar `funded` (idempotente, §8.3) |
| `funded` → `awaiting-exchange` | `record-exchange` | comprador o vendedor | estado = funded; arranca la **ventana de confirmación** (`confirmWindowExpiresAt`) |
| `awaiting-exchange` → `exchange-recorded` | `confirm-exchange` | la OTRA parte | initiator ≠ confirmer; arranca `ttlExpiresAt` (TTL) |
| `awaiting-exchange` → `disputed` | `dispute` (razón: never-happened) | la OTRA parte (la que se niega) | dentro de la ventana de confirmación |
| `awaiting-exchange` → `refunded` | `cancel` | cualquiera | refund completo al buyer; listing → `active`, oferta → `pending` |
| `awaiting-exchange` → `refunded` | `timeout-check` (cron) | server | `confirmWindowExpiresAt` pasó sin confirm ni dispute → auto-cancel; refund completo al buyer; listing → `active` |
| `exchange-recorded` → `released` | `accept` | comprador | TTL no expirado; listing → `sold`, oferta → `completed` |
| `exchange-recorded` → `auto-released` | `timeout-check` (cron) | server | TTL expirado; listing → `sold`, oferta → `completed` |
| `exchange-recorded` → `disputed` | `dispute` | comprador (con evidencia) | TTL no expirado; el listing sigue `pending` hasta resolución admin |
| `awaiting-funding`/`funded` → `refunded` | `cancel` | cualquiera | no se ha registrado intercambio; listing → `active`, oferta → `pending` |

> **Ofertas públicas + 1 escrow por listing (decisión del equipo):** aceptar una oferta crea el escrow y pone el listing en **`pending`** — no acepta más ofertas ni deja aceptar otras mientras haya un escrow en vuelo (estado no terminal). Las demás ofertas quedan en `pending`. Cuando el escrow llega a `released`/`auto-released` el listing pasa a `sold`; si se cancela/refundea, el listing vuelve a `active` y la oferta aceptada **vuelve a `pending`** para que el vendedor acepte cualquiera otra vez.

> **`awaiting-funding` no tiene TTL (decisión consciente):** si el comprador nunca fondea, el escrow **no expira por cron** — **nada de dinero está en juego**, así que el costo es solo una fila en DB + una cuenta Stellar huérfana (testnet, gratis; ver §11.5 nota de escrows huérfanos). Se cierra vía **cancel manual** (cualquiera de las dos partes, §7.2) o **reset-demo**. Un TTL de fondeo con auto-cancel es **post-MVP** — solo lo agregamos si vemos UX grave en producción.

### 7.3 El servicio de transición

Toda transición pasa por `lib/escrow.service.ts` para garantizar atomicidad:

```typescript
// lib/escrow.service.ts (esqueleto)
import { prisma } from './db';

export class EscrowService {
  static async recordExchange(escrowId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUniqueOrThrow({
        where: { id: escrowId },
        include: { buyer: true, seller: true },
      });

      if (escrow.status !== 'funded') {
        throw new EscrowInvalidTransition(
          `Cannot record exchange from status ${escrow.status}`
        );
      }

      const isBuyer = actorId === escrow.buyerId;
      const isSeller = actorId === escrow.sellerId;
      if (!isBuyer && !isSeller) {
        throw new EscrowForbidden('Solo buyer o seller pueden registrar el intercambio');
      }

      const updated = await tx.escrow.update({
        where: { id: escrowId },
        data: {
          status: 'awaiting-exchange',
          exchangeInitiatorId: actorId,
          exchangeInitiatedAt: new Date(),
          // Ventana de confirmación (CONFIRM_WINDOW_MINUTES: demo 10 / prod 8h).
          // Si expira sin confirm ni dispute → cron autoCancela → refund al buyer.
          confirmWindowExpiresAt: addMinutes(new Date(), confirmWindowMinutes()),
        },
      });

      await tx.transactionLog.create({
        data: { escrowId, actorId, action: 'exchange-initiated' },
      });

      return updated;
    });
  }

  static async confirmExchange(escrowId: string, actorId: string) {
    // Similar: valida que actorId ≠ exchangeInitiatorId, estado = awaiting-exchange,
    //          confirmWindowExpiresAt > now
    // Actualiza: exchangeConfirmerId, exchangeConfirmedAt, ttlExpiresAt, status
    // (No hay tx on-chain en este paso: confirmar = estado DB + ttlExpiresAt.
    //  El único on-chain del ciclo es el release/refund, que ocurre después.)
    // Crea log: 'exchange-confirmed'
  }

  static async accept(escrowId: string, buyerId: string) {
    // Valida: actor = buyer, estado = exchange-recorded, ttlExpiresAt > now
    // Llama a stellar.releaseEscrow(escrowId) → construye + firma (platform + árbitro, §6.2) + submit
    // Actualiza: status = released, acceptedAt, stellarTxHashRelease, stellarMemoReceipt
    //           + listing.status = 'sold', offer.status = 'completed' (mismo $transaction)
    // Crea log: 'accepted'
  }

  static async autoResolve(escrowId: string) {
    // Similar a accept pero sin validar TTL (es la razón por la que se llama).
    // release firmada por platform + árbitro; status = auto-released; listing → 'sold'
    // El on-chain (tx hash) queda como prueba de cuándo se ejecutó realmente.
  }

  static async dispute(escrowId: string, reporterId: string, reason: DisputeReason, description: string, photoUrl: string) {
    // Valida estado y razón
    // Ancla el hash en Stellar (manageData, platform + árbitro) — §6.3 op 6
    // Crea DisputeEvidence + actualiza Escrow.status = 'disputed'
    // El listing permanece 'pending' hasta resolución admin (fuera del MVP)
    // Log: 'disputed'
  }

  static async cancel(escrowId: string, actorId: string) {
    // Valida estado: awaiting-funding | funded | awaiting-exchange
    // Si el escrow tiene fondos (funded/awaiting-exchange): stellar.refundEscrow
    //   → escrow → buyer (monto completo, firmado por platform + árbitro, §6.2)
    // Actualiza: status = refunded, refundedAt
    // + listing → 'active', la oferta aceptada → 'pending' (mismo $transaction,
    //   decisión del equipo, ver §7.2)
    // Log: 'refunded'
  }

  static async autoCancel(escrowId: string) {
    // Cron (ventana de confirmación vencida, §11.1): igual que cancel() pero llamada por
    // el server (sin validar actor). Refund completo al buyer; listing → 'active';
    // oferta → 'pending'. Log: 'refunded' (o 'exchange-window-expired').
  }
}
```

**Regla de oro:** nunca actualizar el estado del escrow sin envolver en `prisma.$transaction`. Si falla Stellar, hacemos rollback del cambio en DB.

> **Regla de oro #2 (anti-carrera entre transiciones concurrentes):** cada cambio de estado usa **`updateMany` con `where: { id, status: '<esperado>' }`** y verifica `count === 1` antes de continuar. Un `update` sin condición pierde contra el cron: por ejemplo `confirm-exchange` (buyer confirma el intercambio) y `autoCancel` (cron, ventana de confirmación vencida) pueden leer `status = 'awaiting-exchange'` al mismo tiempo; sin la condición, el último `update` gana y es posible que una refund se firme DESPUÉS de que el escrow ya quedó en `exchange-recorded` — riesgo de dinero. La condición `updateMany` serializa la decisión al nivel de la DB y la segunda transición recibe 409. `EscrowService.autoResolve` y `autoCancel` además **releen el estado DENTRO de su propio `$transaction`** y abortan sin firmar Stellar si el estado ya cambió (§11.1).

---

## 8. API surface

Todos los endpoints van en `app/api/*/route.ts`. Validamos input con Zod. Errores uniformes.

### 8.1 Helper de errores

```typescript
// lib/api.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: 'validation_failed', issues: error.issues }, { status: 400 });
  }
  console.error(error);
  return Response.json({ error: 'internal_error' }, { status: 500 });
}
```

### 8.2 Auth middleware

```typescript
// lib/auth.ts
import { cookies } from 'next/headers';   // ⚠️ Next 16: cookies() es async
import { prisma } from './db';
import { verifyCookie } from './crypto';

const SESSION_COOKIE = 'pumatrade-session';

// La cookie guarda `${email}.${hmac}` (firmada con APP_SECRET_KEY, ver §6.4): leer la
// cookie NO es suficiente — un atacante podría forjar `email.firma` con un curl.
export async function getCurrentUser() {
  const cookieStore = await cookies();            // await obligatorio en Next 16
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const email = verifyCookie(raw);                // devuelve null si la firma no cuadra
  if (!email) return null;
  return prisma.user.findUnique({ where: { email } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, 'unauthorized', 'Login requerido');
  return user;
}
```

(El detalle de cómo se setea la cookie después del login de Pollar está en §9.4.)

### 8.3 Listado de endpoints

#### Listings

| Método | Path | Input | Output |
|---|---|---|---|
| `GET` | `/api/listings` | query: `type?`, `major?`, `verifiedOnly?`, `search?` | `{ listings: Listing[] }` |
| `POST` | `/api/listings` | `{ title, description, priceXlm, type, majors[], condition, photoUrl, videoVerified }` (priceXlm en centavos) | `{ listing: Listing }` |
| `GET` | `/api/listings/[id]` | — | `{ listing, offers?: Offer[] }` (offers solo si eres el seller) |
| `PATCH` | `/api/listings/[id]` | `{ status? }` | `{ listing }` |
| `POST` | `/api/listings/[id]/price-alert` | `{ title, type, price }` | `PriceAlert` |

#### Offers

| Método | Path | Input | Output |
|---|---|---|---|
| `POST` | `/api/offers` | `{ listingId, type, offeredItems?, xlmAmount?, message? }` (xlmAmount en centavos) | `{ offer: Offer }` |
| `PATCH` | `/api/offers/[id]` | `{ status: 'withdrawn' \| 'rejected' }` | `{ offer }` |

#### Escrow

| Método | Path | Input | Output |
|---|---|---|---|
| `POST` | `/api/escrow/accept-offer` | `{ offerId }` | `{ escrow: Escrow }` (estado: awaiting-funding; **409** si el listing ya tiene un escrow en vuelo). El listing pasa a `pending` |
| `POST` | `/api/escrow/fund` | `{ escrowId }` | `{ escrow, paymentParams: { destination, amount, asset }, funded }` — idempotente: verifica el saldo del escrow en Horizon (≥ `amountXlm`) y marca `funded` si ya pagó |
| `POST` | `/api/escrow/record-exchange` | `{ escrowId }` | `{ escrow }` (estado: awaiting-exchange; arranca `confirmWindowExpiresAt`) |
| `POST` | `/api/escrow/confirm-exchange` | `{ escrowId }` | `{ escrow }` (estado: exchange-recorded, TTL corriendo) |
| `POST` | `/api/escrow/accept` | `{ escrowId }` | `{ escrow, txHash, memo }` (estado: released; release firmada por platform+árbitro) |
| `POST` | `/api/escrow/dispute` | `multipart/form-data`: `escrowId, reason, description, photo (File ≤2MB jpeg/png/webp)` | `{ escrow }` (estado: disputed) |
| `POST` | `/api/escrow/cancel` | `{ escrowId }` | `{ escrow }` (estado: refunded; refund platform+árbitro; listing → active, oferta → pending) |
| `GET` | `/api/escrow/[id]` | — | `{ escrow, listing, buyer, seller, events[] }` — **autorización:** solo buyer o seller del escrow (403 vía guard serve-side; `/api/escrow/my` ya viene filtrado por sesión) |
| `GET` | `/api/escrow/my` | — | `{ escrows: Escrow[] }` (todos donde soy buyer o seller) |

#### Disputes (admin)

| Método | Path | Input | Output |
|---|---|---|---|
| `GET` | `/api/disputes` | — | `{ disputes: DisputeEvidence[] }` |
| `PATCH` | `/api/disputes/[id]` | `{ status: 'resolved' \| 'rejected' }` | `{ dispute }` (fuera de scope MVP, documentado) |

#### Valoration (price alert)

| Método | Path | Input | Output |
|---|---|---|---|
| `POST` | `/api/price-alert` | `{ title, type, price }` | `PriceAlert` |

#### Demo

| Método | Path | Input | Output |
|---|---|---|---|
| `POST` | `/api/reset-demo` | — | `{ ok: true }` (dev: libre; prod: `Authorization: Bearer $CRON_SECRET` + `ALLOW_RESET_DEMO=true` — ver §11.5) |
| `POST` | `/api/cron/timeout-check` | `Authorization: Bearer $CRON_SECRET` | `{ released: number, autoCancelled: number }` (loop: auto-resolve TTL + auto-cancel ventana de confirmación) |

#### Auth (cookie de demo)

| Método | Path | Input | Output |
|---|---|---|---|
| `POST` | `/api/auth/dev-login` | `{ email }` | `{ user }` — sets cookie (firmada). **DOBLE GUARDA DEV**: responde 404 si `DEV_LOGIN_ENABLED !== 'true'` **o** si `NODE_ENV === 'production'`. La flag `DEV_LOGIN_ENABLED` solo se setea en `.env.local` (nunca en Vercel) — si una mala config la sube, el handler sigue cerrado por `NODE_ENV`. En prod es un bypass de auth. |
| `POST` | `/api/auth/logout` | — | `{ ok: true }` |

### 8.4 Ejemplo concreto: `accept-offer`

```typescript
// app/api/escrow/accept-offer/route.ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ApiError, handleApiError } from '@/lib/api';
import { EscrowService } from '@/lib/escrow.service';
import { createEscrowAccount } from '@/lib/stellar';

const schema = z.object({
  offerId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { offerId } = schema.parse(await req.json());

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { listing: true, offerer: true },   // offerer → pollarWalletId se necesita abajo
    });

    if (!offer) throw new ApiError(404, 'offer_not_found', 'Oferta no existe');
    if (offer.listing.sellerId !== user.id) {
      throw new ApiError(403, 'not_your_listing', 'Solo el vendedor puede aceptar');
    }
    if (offer.status !== 'pending') {
      throw new ApiError(409, 'offer_not_pending', `Estado actual: ${offer.status}`);
    }
    // 1 escrow por listing: si el listing no está 'active', no se aceptan más ofertas.
    // (El status 'pending' del listing ya lo garantiza; este check es defensa ante carreras.)
    if (offer.listing.status !== 'active') {
      throw new ApiError(409, 'listing_not_available', `El listing está: ${offer.listing.status}`);
    }

    // 1. Crear la cuenta escrow en Stellar (server-side). Signers: platform + árbitro (§6.2).
    //    El buyer NO es signer (su llave vive en el KMS de Pollar, sin API de firma ajena).
    //    ⚠️ Si el $transaction de abajo falla (ej. carrera contra otro vendedor),
    //    esta cuenta queda huérfana en testnet — gratis, aceptado; en prod el
    //    residual (~3 XLM) se podría drenar con un accountMerge post-MVP (§6.3).
    const { publicKey, arbiterSecretEnc } = await createEscrowAccount();

    // 2. Transición autoritativa DENTRO del $transaction con updateMany condicional
    //    (§7.3 regla #2). Sin esto, dos clicks concurrentes del vendedor (o dos
    //    buyers con ofertas a la vez) pasan los pre-checks de arriba y crean 2
    //    cuentas Stellar + 2 escrows. Las escrituras condicionales serializan la
    //    decisión a nivel de DB: la segunda recibe 409.
    const escrow = await prisma.$transaction(async (tx) => {
      const listingLock = await tx.listing.updateMany({
        where: { id: offer.listingId, status: 'active' },
        data: { status: 'pending' },
      });
      if (listingLock.count !== 1) {
        throw new ApiError(409, 'listing_not_available',
          'Este listing ya tiene un escrow en vuelo (otro buyer aceptó primero)');
      }

      const offerLock = await tx.offer.updateMany({
        where: { id: offer.id, status: 'pending' },
        data: { status: 'accepted' },
      });
      if (offerLock.count !== 1) {
        throw new ApiError(409, 'offer_not_pending',
          'Esta oferta ya no está pendiente (carrera contra otro vendedor)');
      }

      const seller = await tx.user.findUniqueOrThrow({ where: { id: offer.listing.sellerId } });
      const buyer = await tx.user.findUniqueOrThrow({ where: { id: offer.offererId } });

      // Trueque puro (amountXlm = 0) → el escrow NACE directamente en `funded`,
      // no en `awaiting-funding`. No hay nada que fondear; la UI en §10.4 nunca
      // entra al estado "Esperando que el comprador fondee…" (ni muestra
      // "Fondear 0.00 XLM", que era una fuga de UI).
      const initialStatus = (offer.xlmAmount ?? 0) === 0 ? 'funded' : 'awaiting-funding';

      const newEscrow = await tx.escrow.create({
        data: {
          offerId: offer.id,
          listingId: offer.listingId,
          buyerId: buyer.id,
          sellerId: seller.id,
          amountXlm: offer.xlmAmount ?? 0,          // centavos; 0 si trueque puro
          stellarEscrowAccount: publicKey,
          arbiterSecretEnc,                          // llave del árbitro (encriptada, solo server)
          platformFeeBps: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? 200),
          status: initialStatus,
        },
      });

      await tx.transactionLog.create({
        data: { escrowId: newEscrow.id, actorId: user.id, action: 'offer-accepted' },
      });

      return newEscrow;
    });

    return Response.json({ escrow });
  } catch (e) {
    return handleApiError(e);
  }
}
```

---

## 9. Frontend — árbol de componentes

### 9.1 Estructura de archivos

```
app/
├── layout.tsx                       # PollarProvider
├── page.tsx                         # Redirige a /home o /login según auth
├── login/page.tsx                   # Splash + botón Google
│
├── home/page.tsx                    # Dashboard del usuario logueado
│
├── marketplace/
│   ├── page.tsx                     # Grid de listings con filtros
│   └── [listingId]/
│       ├── page.tsx                 # Detalle listing (vista vendedor o visitante)
│       └── offer/page.tsx           # Modal full-screen para hacer oferta
│
├── escrow/
│   └── [escrowId]/
│       ├── page.tsx                 # Detalle del escrow (todos los estados)
│       └── report/page.tsx          # Rama C — elegir razón + evidencia
│
├── receipt/[escrowId]/page.tsx      # Recibo final
│
├── create/page.tsx                  # Form de crear listing
│
├── settings/page.tsx                # Wallet + admin links
│
└── admin/
    └── disputes/page.tsx            # Cola de disputas (guard: ADMIN_EMAILS — el User model no tiene columna role)

components/
├── layout/
│   ├── AppShell.tsx                 # Header + bottom nav, wraps authed routes
│   ├── Header.tsx                   # Logo + WalletButton + avatar menu
│   └── BottomNav.tsx                # Inicio | Buscar | Míos | Ajustes
│
├── listings/
│   ├── ListingCard.tsx              # Card del grid
│   ├── ListingDetailHeader.tsx      # Foto + título + precio
│   ├── FilterBar.tsx                # Carrera + Tipo + checkboxes
│   └── PriceAlertBadge.tsx          # ⚠ / ✓ después de valuar
│
├── offers/
│   ├── OfferBoard.tsx               # Tablero de ofertas del vendedor
│   ├── OfferCard.tsx                # Card por oferta (3 tipos distintos)
│   ├── OfferForm.tsx                # Form de hacer oferta
│   └── OfferTypeSelector.tsx        # Radio: solo saldo | trueque | híbrida
│
├── escrow/
│   ├── EscrowTimeline.tsx           # Stepper visual de los 5 pasos
│   ├── EscrowActions.tsx            # Botones contextuales por estado
│   ├── CountdownTimer.tsx           # TTL countdown (re-renders cada 1s)
│   ├── ExchangeRecorder.tsx         # "Intercambio realizado" + confirmación
│   └── DisputeForm.tsx              # Elegir razón + foto + descripción
│
├── wallet/
│   ├── WalletBadge.tsx              # Saldo en el header
│   └── EscrowFundingModal.tsx       # Wrapper sobre runTx('payment', …) de Pollar
│
├── receipt/
│   └── ReceiptSummary.tsx           # Desglose + tx hash + memo
│
└── ui/                              # Primitivos
    ├── Button.tsx
    ├── Card.tsx
    ├── Badge.tsx
    └── Toast.tsx

lib/
├── api-client.ts                    # fetch wrapper para /api/*
├── formatters.ts                    # currency, dates
└── constants.ts                     # tipos, enums

stores/
├── authStore.ts                     # currentUser
├── escrowStore.ts                   # cache de mis escrows activos
└── uiStore.ts                       # toasts, modales globales
```

### 9.2 Stores (Zustand)

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import type { User } from '@/types/db';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  refresh: async () => {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const { user } = await res.json();
      set({ user, loading: false });
    } else {
      set({ user: null, loading: false });
    }
  },
}));
```

```typescript
// stores/escrowStore.ts
import { create } from 'zustand';
import type { Escrow } from '@/types/db';

interface EscrowState {
  byId: Record<string, Escrow>;
  setEscrow: (e: Escrow) => void;
  fetchMine: () => Promise<void>;
}

export const useEscrowStore = create<EscrowState>((set, get) => ({
  byId: {},
  setEscrow: (e) => set({ byId: { ...get().byId, [e.id]: e } }),
  fetchMine: async () => {
    const res = await fetch('/api/escrow/my');
    if (res.ok) {
      const { escrows } = await res.json();
      const byId: Record<string, Escrow> = {};
      escrows.forEach((e: Escrow) => { byId[e.id] = e; });
      set({ byId });
    }
  },
}));
```

### 9.3 Custom hooks

```typescript
// hooks/useCountdown.ts
import { useEffect, useState } from 'react';

export function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return { hours, minutes, seconds, expired: remaining === 0 };
}
```

### 9.4 Flujo de auth (Pollar + cookie propia)

Pollar maneja la auth en el cliente, pero para identificar al usuario en el backend necesitamos nuestra propia cookie. El patrón:

```typescript
// components/LoginButton.tsx
'use client';
import { usePollar } from '@pollar/react';
import { useState } from 'react';
import { useEffect } from 'react';

export function LoginButton() {
  const { login, wallet, isAuthenticated, getClient } = usePollar();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !wallet) return;
    (async () => {
      let email = wallet.user?.email;
      let displayName = wallet.user?.name ?? wallet.user?.email;
      // ⚠️ @pollar/react 0.11.3: `wallet.user` puede venir vacío. Fallback: perfil
      // desde la sesión de Pollar vía client.getUserProfile() (shape en §5.4).
      if (!email) {
        const profile = await getClient().getUserProfile();
        email = profile?.email;
        displayName = profile?.name ?? profile?.email;
      }
      if (!email) return;   // Pollar aún no expone el email; el próximo render reintenta
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollarWalletId: wallet.address, email, displayName }),
      }).catch(() => {});   // no romper el login si el sync falla
    })();
  }, [isAuthenticated, wallet]);

  return (
    <div className="space-y-3">
      {/* Opción 1: Google (usuarios reales) */}
      <button onClick={() => login({ provider: 'google' })} className="w-full bg-blue-600 text-white py-3 rounded-xl">
        🔵 Continuar con Google
      </button>

      {/* Opción 2: Email OTP (seed users con correos temporales) */}
      <div className="border-t pt-3">
        <p className="text-xs text-gray-500 mb-2">¿Eres usuario seed? Entra con tu email:</p>
        <input
          type="email"
          placeholder="maria.pumatrade+seed1@mail.tm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <button
          disabled={!email}
          onClick={() => login({ provider: 'email', email })}
          className="w-full mt-2 bg-gray-700 text-white py-2 rounded disabled:opacity-50"
        >
          ✉️ Enviar código por email
        </button>
      </div>
    </div>
  );
}
```

**Sobre los correos temporales:** usamos servicios como `mail.tm` (que genera inboxes temporales sin signup). El implementador pre-crea 5 cuentas:
- `maria.pumatrade+seed1@mail.tm` → María
- `juan.pumatrade+seed1@mail.tm` → Juan
- `andrea.pumatrade+seed1@mail.tm` → Andrea
- `pablo.pumatrade+seed1@mail.tm` → Pablo
- `sofia.pumatrade+seed1@mail.tm` → Sofía

Durante el demo, abre cada inbox en una pestaña, lee el código OTP, y entra. **Cero cuentas de Google que crear.**

```typescript
// app/api/auth/sync/route.ts
// POST: crea User en DB si no existe, setea cookie con email
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { signCookie } from '@/lib/crypto';

const schema = z.object({
  pollarWalletId: z.string().regex(/^G[A-Z0-9]{55}$/),
  email: z.string().email(),
  displayName: z.string().min(1),
});

export async function POST(req: Request) {
  const body = schema.parse(await req.json());

  // 🛡️ Bind de wallet una sola vez. Si el user existe y su wallet YA está
  // vinculada a un G-address real (≠ placeholder del seed), rebrindar con otra
  // wallet → 409. Esto cierra la toma de cuenta vía impersonación de email:
  // el atacante crea su wallet en Pollar, le pega el email de un seed user y
  // se queda con su sesión (y por tanto con sus payouts en escrows). Para
  // seed users el primer login real actualiza el placeholder; los usuarios
  // reales, al re-loggear, reciben el mismo G-address de Pollar → update es no-op.
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (
    existing?.pollarWalletId &&
    !existing.pollarWalletId.startsWith('G_PLACEHOLDER') &&
    existing.pollarWalletId !== body.pollarWalletId
  ) {
    return Response.json(
      { error: 'wallet_mismatch', message: 'Esta cuenta ya está vinculada a otra wallet' },
      { status: 409 },
    );
  }

  const user = await prisma.user.upsert({
    where: { email: body.email },
    create: {
      email: body.email,
      displayName: body.displayName,
      pollarWalletId: body.pollarWalletId,
      major: 'Otra', // default; el usuario lo cambia después
      bio: '',
      balanceXlm: 0,
    },
    // Solo actualizar cuando estamos reemplazando un placeholder (primer login
    // real del seed). Los re-logins de usuarios reales no tocan este campo
    // porque Pollar siempre devuelve la misma G-address.
    update: existing?.pollarWalletId?.startsWith('G_PLACEHOLDER')
      ? { pollarWalletId: body.pollarWalletId }
      : {},
  });

  const cookieStore = await cookies();               // ⚠️ Next 16: await
  cookieStore.set('pumatrade-session', signCookie(user.email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 semana
    path: '/',
  });

  return Response.json({ user });
}
```

**Limitación conocida (reducida):** la cookie ahora es `email + firma HMAC` (`APP_SECRET_KEY`), así que **no es forjable** — pero sigue sin expirar en el cliente (`logout` solo borra la cookie) y no es un JWT de Pollar. Aceptado para el demo de 24h; migrar a JWT en producción. **Nota canary:** al probar con `npm run dev`, si Pollar no expone `wallet.user`, obtener email/name vía `client.getUserProfile()` (ver §5.4) — el contrato del body de `/api/auth/sync` no cambia.

---

## 10. Componentes clave — diseño detallado

### 10.1 ListingDetailHeader

```typescript
// components/listings/ListingDetailHeader.tsx
'use client';
import { PriceAlertBadge } from './PriceAlertBadge';
import type { Listing } from '@/types/db';

export function ListingDetailHeader({ listing }: { listing: Listing }) {
  return (
    <div className="space-y-3">
      <img
        src={listing.photoUrl}
        alt={listing.title}
        className="w-full aspect-square object-cover rounded-2xl"
      />
      <div>
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-3xl font-bold">{(listing.priceXlm / 100).toFixed(2)} XLM</span>
          {listing.videoVerified && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
              ✓ Verificado
            </span>
          )}
        </div>
        <PriceAlertBadge title={listing.title} type={listing.type} price={listing.priceXlm} />
      </div>
    </div>
  );
}
```

### 10.2 OfferBoard

```typescript
// components/offers/OfferBoard.tsx
'use client';
import { OfferCard } from './OfferCard';
import type { Offer } from '@/types/db';

export function OfferBoard({ offers }: { offers: Offer[] }) {
  // Ordenar: híbridas con buen valor primero, luego saldo-only, luego barter sin diferencia cubierta
  const sorted = [...offers].sort((a, b) => scoreOffer(b) - scoreOffer(a));
  return (
    <div className="space-y-3">
      <h2 className="text-sm uppercase tracking-wide text-gray-500">
        Tablero de ofertas ({offers.length})
      </h2>
      {sorted.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function scoreOffer(o: Offer): number {
  // Prioriza híbridas con valor cercano al listing
  if (o.type === 'hybrid') return 100;
  if (o.type === 'saldo-only') return 50 + (o.xlmAmount ?? 0);
  if (o.type === 'barter') return 30;
  return 0;
}
```

> **Cuando el listing está `pending`** (1 escrow en vuelo, §7.2): `ListingDetailHeader` muestra un badge "⏳ Pendiente — transacción en curso" y el `OfferBoard` NO se renderiza (el seller no puede aceptar más ofertas; el guard 409 del backend lo respalda).

### 10.3 CountdownTimer

```typescript
// components/escrow/CountdownTimer.tsx
'use client';
import { useCountdown } from '@/hooks/useCountdown';

export function CountdownTimer({ target }: { target: Date | string | null }) {
  const targetDate = target ? new Date(target) : null;
  const { hours, minutes, seconds, expired } = useCountdown(targetDate);

  if (!targetDate) return null;   // sin ventana activa (awaiting-funding, funded, sold…) → no pintar nada
  if (expired) return <span className="text-red-600 font-mono">00:00:00</span>;

  return (
    <div className="font-mono text-4xl text-center my-4 tabular-nums">
      {String(hours).padStart(2, '0')}:
      {String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </div>
  );
}
```

> Reutiliza el mismo componente para **dos ventanas**: `ttlExpiresAt` (exchange-recorded → Rama A/B) y `confirmWindowExpiresAt` (awaiting-exchange → auto-refund). El label de arriba cambia según el estado ("Ventana para confirmar el intercambio" vs "Tiempo de prueba del artículo").

### 10.4 EscrowActions

Componente crítico — encapsula toda la lógica condicional de qué botones mostrar según estado + rol del usuario:

```typescript
// components/escrow/EscrowActions.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePollar } from '@pollar/react';
import { useAuthStore } from '@/stores/authStore';
import { useEscrowStore } from '@/stores/escrowStore';
import { useUiStore } from '@/stores/uiStore';
import type { Escrow } from '@/types/db';

export function EscrowActions({ escrow }: { escrow: Escrow }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setEscrow = useEscrowStore((s) => s.setEscrow);
  const toast = useUiStore((s) => s.toast);
  const { getClient } = usePollar();   // patrón verificado: runTx + refreshBalance (ver §5.4)
  const [busy, setBusy] = useState(false);

  const isBuyer = user?.id === escrow.buyerId;
  const isSeller = user?.id === escrow.sellerId;

  async function callApi(path: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error');
      }
      const data = await res.json();
      setEscrow(data.escrow);
      toast({ type: 'success', message: 'Listo' });
      return data;
    } catch (e: any) {
      toast({ type: 'error', message: e.message });
      throw e;
    } finally {
      setBusy(false);
    }
  }

  switch (escrow.status) {
    case 'awaiting-funding':
      if (isBuyer) {
        return (
          <div className="space-y-3">
            <button
              disabled={busy}
              onClick={async () => {
                const { paymentParams } = await callApi('/api/escrow/fund', {
                  escrowId: escrow.id,
                });
                // Pago vía Pollar (runTx, no openSendModal) — verificado en el demo app
                const client = getClient();
                await client.runTx('payment', {
                  destination: paymentParams.destination,
                  amount: paymentParams.amount,
                  asset: { type: 'native' },   // XLM nativo (shape verificado en docs Pollar 2026-09-25)
                });
                await client.refreshBalance();
                router.refresh();
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Fondear escrow ({(escrow.amountXlm / 100).toFixed(2)} XLM)
            </button>
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
              className="w-full text-gray-500 py-2 text-sm"
            >
              Cancelar y reembolsar
            </button>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Esperando que el comprador fondee...</p>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="w-full text-gray-500 py-2 text-sm"
          >
            Cancelar (sin costo para ti)
          </button>
        </div>
      );

    case 'funded':
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Coordina el encuentro entre las dos partes (el "📍 Biblioteca central…" del wireframe PRD §7.7 se coordina fuera de la app; no se modela en el MVP). Cuando intercambian los objetos, pulsen "Intercambio realizado".
          </p>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/record-exchange', { escrowId: escrow.id })}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
          >
            🤝 Intercambio realizado
          </button>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="w-full text-gray-500 py-2 text-sm"
          >
            Cancelar y reembolso
          </button>
        </div>
      );

    case 'awaiting-exchange':
      if (escrow.exchangeInitiatorId === user?.id) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Esperando que la otra parte confirme el intercambio.
            </p>
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
              className="w-full text-gray-500 py-2 text-sm"
            >
              Cancelar y reembolsar
            </button>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <p className="text-sm">
            La otra parte registró que hicieron el intercambio. ¿Lo confirmas?
          </p>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/confirm-exchange', { escrowId: escrow.id })}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
          >
            ✅ Sí, confirmar
          </button>
          <button
            disabled={busy}
            onClick={() => router.push(`/escrow/${escrow.id}/report?reason=exchange-never-happened`)}
            className="w-full text-red-600 py-2 text-sm"
          >
            ⚠ No, eso no pasó
          </button>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="w-full text-gray-500 py-2 text-sm"
          >
            Cancelar y reembolsar
          </button>
        </div>
      );

    case 'exchange-recorded':
      if (isBuyer) {
        return (
          <div className="space-y-3">
            <p className="text-sm">¿Funciona el artículo?</p>
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/accept', { escrowId: escrow.id })}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
            >
              ✅ Aceptar artículo
            </button>
            <button
              disabled={busy}
              onClick={() => router.push(`/escrow/${escrow.id}/report`)}
              className="w-full text-red-600 py-2 text-sm"
            >
              ⚠ Reportar problema
            </button>
          </div>
        );
      }
      return <p className="text-sm text-gray-600">Esperando que el comprador pruebe el artículo...</p>;

    case 'released':
    case 'auto-released':
      return (
        <button
          onClick={() => router.push(`/receipt/${escrow.id}`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
        >
          Ver recibo
        </button>
      );

    case 'disputed':
      return <p className="text-red-600">⚠ Disputa abierta. Nuestro equipo la revisará.</p>;

    case 'refunded':
      return <p className="text-gray-500">Este intercambio fue cancelado y reembolsado.</p>;
  }
}
```

---

---

> **Notificación del lado del receptor (MVP):** los estados `funded` (vendedor), `awaiting-exchange` (el initiator espera a la otra parte) y `exchange-recorded` (vendedor espera decisión del comprador) son **vista estática** — sin push real. La página `/escrow/[id]` hace `router.refresh()` cada 30 s mientras el estado esté en `{awaiting-exchange, exchange-recorded}`, más un refresh de datos cuando el tab vuelve a tener foco. **Post-MVP:** webhook de Pollar o WebSocket (no implementado en MVP — el demo es supervisado y los participantes no necesitan push).

## 11. Cron jobs

> ⚠️ **v1.1:** con deploy a Vercel (serverless), el `setInterval` solo funciona en dev local. En prod usamos **Vercel Cron** (mínimo 1 min de granularidad — suficiente para un TTL de 48h/3 min). El mismo código `runTimeoutCheck()` corre en ambos.

### 11.1 La función de negocio (compartida dev/prod)

```typescript
// lib/cron.ts — lógica pura, no depende del runner
import { prisma } from './db';
import { EscrowService } from './escrow.service';

export async function runTimeoutCheck(): Promise<{ released: number; autoCancelled: number }> {
  const now = new Date();

  // Pasada 1: TTL vencido en exchange-recorded → auto-resolve (release a seller, Rama B)
  const expired = await prisma.escrow.findMany({
    where: { status: 'exchange-recorded', ttlExpiresAt: { lt: now } },
    select: { id: true },
    take: 10, // procesar de a 10 por iteración
  });

  for (const { id } of expired) {
    try {
      await EscrowService.autoResolve(id);
      console.log(`[timeout-check] auto-resolved escrow ${id}`);
    } catch (e) {
      console.error(`[timeout-check] failed to auto-resolve ${id}:`, e);
    }
  }

  // Pasada 2: ventana de confirmación vencida en awaiting-exchange → auto-cancel (refund al buyer)
  const windowExpired = await prisma.escrow.findMany({
    where: { status: 'awaiting-exchange', confirmWindowExpiresAt: { lt: now } },
    select: { id: true },
    take: 10,
  });

  for (const { id } of windowExpired) {
    try {
      await EscrowService.autoCancel(id);
      console.log(`[timeout-check] auto-cancelled escrow ${id} (ventana de confirmación)`);
    } catch (e) {
      console.error(`[timeout-check] failed to auto-cancel ${id}:`, e);
    }
  }

  return { released: expired.length, autoCancelled: windowExpired.length };
}
```

> **`awaiting-funding` no entra al cron:** solo `exchange-recorded` (TTL vencido → Rama B) y `awaiting-exchange` (ventana de confirmación vencida → auto-refund al buyer) tienen timeout automático. Un escrow que se queda en `awaiting-funding` (comprador fantasma) **no expira** — el costo es solo una fila en DB + la cuenta Stellar huérfana (testnet, gratis; en prod el residual sería ~3 XLM de buffer, mitigación post-MVP). Cierre: **cancel manual** (botón "Cancelar y reembolsar" presente en §10.4) o **reset-demo**. Cada pasada del cron pasa por `EscrowService.autoResolve` / `autoCancel`, que relee el estado al inicio del `$transaction` y aborta sin firmar Stellar si la transición ya fue ejecutada por otra vía concurrente — regla #2 de §7.3.

### 11.2 Dev local — `setInterval` en el proceso principal (30s)

En dev, el servidor Next es un proceso vivo; el hook oficial para código de arranque del runtime es **`instrumentation.ts`** (mejor que un side-effect en `layout.tsx`: corre UNA vez por arranque, no por render).

```typescript
// instrumentation.ts — hook oficial de Next (opcional: register())
export async function register() {
  if (process.env.NODE_ENV === 'production') return;   // en prod lo hace Vercel Cron
  if (process.env.ENABLE_CRON !== 'true') return;      // gate explícito para dev
  const { startDevCron } = await import('./lib/cron-dev');
  startDevCron();
}
```

```typescript
// lib/cron-dev.ts — SOLO dev / procesos largos (Railway)
let timer: NodeJS.Timeout | null = null;

export function startDevCron() {
  if (timer) return;
  const tick = async () => {
    try {
      const { released, autoCancelled } = await runTimeoutCheck();
      if (released + autoCancelled > 0) {
        console.log(`[cron-dev] ${released} auto-resueltos, ${autoCancelled} auto-cancelados`);
      }
    } catch (e) {
      console.error('[cron-dev] error:', e);
    }
  };
  tick();
  timer = setInterval(tick, 30_000);
}
```

> **Railway (proceso único, no serverless):** en vez de un segundo servicio HTTP, basta con `ENABLE_CRON=true NODE_ENV=production` **si** el deploy usa Next standalone que carga `instrumentation.ts` — el `setInterval` corre en el mismo proceso. La alternativa "segundo servicio HTTP" (§11.4) sigue disponible.

### 11.3 Prod — Vercel Cron (1 min)

El endpoint HTTP que corren los cron runners. Protegido con un header secreto.

```typescript
// app/api/cron/timeout-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runTimeoutCheck } from '@/lib/cron';
import { ApiError } from '@/lib/api';

export async function GET(req: NextRequest) {
  // Auth: Vercel envía `Authorization: Bearer $CRON_SECRET` automáticamente (Cron Secret).
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new ApiError(403, 'cron_forbidden', 'Cron secreto inválido');
  }
  const { released, autoCancelled } = await runTimeoutCheck();
  return NextResponse.json({ ok: true, released, autoCancelled });
}
```

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/timeout-check", "schedule": "* * * * *" }
  ]
}
```

> ⚠️ En el dashboard de Vercel: Project → Settings → Cron Jobs → asignar el **Cron Secret** y marcarlo como variable de entorno (`CRON_SECRET`). Vercel pausa los crons si no hay deploy reciente en 60 días — crear la branch de demo activa antes.

### 11.4 Alternativa Railway (si el equipo prefiere Railway sobre Vercel)

- Railway hace deploy del mismo repo (Next standalone). Un segundo servicio "cron" ejecuta `node scripts/schedule-cron.mjs` que hace `fetch('http://localhost:3000/api/cron/timeout-check')` cada 30s, o se usa Railway Cron (misma granularidad de 1 min).
- Postgres de Railway reemplaza a Neon con el mismo `DATABASE_URL`.

### 11.5 Reset demo

En serverless **no hay `exec`**, así que el reset es 100% Prisma. El seed data vive en un módulo TS (`lib/seed-data.ts`) compartido por `prisma/seed.ts` (CLI local) y este endpoint (runtime).

```typescript
// app/api/reset-demo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { seedUsers, seedListings, seedOffers } from '@/lib/seed-data';

export async function POST(req: NextRequest) {
  // Guard: en producción se exige el mismo secreto del cron (CRON_SECRET)
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  // Reset en orden de dependencias
  await prisma.transactionLog.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({ data: seedUsers });
  await prisma.listing.createMany({ data: seedListings });
  await prisma.offer.createMany({ data: seedOffers });

  return NextResponse.json({ ok: true });
}
```

> ⚠️ **Escrows huérfanos en Stellar:** este reset borra la DB, pero las cuentas escrow de un demo anterior **quedan en Stellar** (fondos ≤ reservas + saldo retenido, testnet). Como la plataforma conserva ambas llaves (§6.2), se puede refundir manualmente desde el dashboard de dev, o dejar el residuo (es testnet). Aceptado para el MVP; un script de limpieza es post-hackathon.

---

## 12. Seguridad

### 12.1 Lo que el backend NUNCA debe confiar del cliente

| Campo | Confianza | Por qué |
|---|---|---|
| `actorId` (implícito en session) | Alta | Sale de la cookie server-side |
| `escrowId` en URLs | Media | Lo validamos contra la sesión |
| `xlmAmount` en `accept-offer` | Nula | Se lee del offer original, no del body |
| `status` en cualquier PATCH | Nula | El servidor calcula la transición |
| `platformFeeBps` | Nula | Hardcoded en el código o env |
| Fotos de evidencia | Nula (formato) | Validamos MIME y tamaño; path se genera server-side |
| `pollarWalletId` en `/api/auth/sync` | Nula | **Bind una sola vez**: si el user ya tiene wallet ligada (≠ placeholder del seed), un re-bind con address distinto → 409 (§9.4). Cierra la toma de cuenta vía impersonación de email que, en dinero real, permitiría redirigir payouts a la wallet del atacante. |

### 12.2 Validación con Zod

Cada endpoint valida su input:

```typescript
// lib/schemas.ts
import { z } from 'zod';

export const ListingTypeSchema = z.enum([
  'libros', 'calculadoras', 'electronica', 'batas-uniformes', 'laboratorio', 'otros',
]);

export const MajorSchema = z.enum([
  'Ing. en Computación', 'Ing. Eléctrica', 'Ing. Mecánica',
  'Matemáticas', 'Física', 'Química', 'Biología', 'Otra',
]);

export const ConditionSchema = z.enum(['nuevo', 'como-nuevo', 'bueno', 'aceptable']);

export const OfferTypeSchema = z.enum(['saldo-only', 'barter', 'hybrid']);

export const DisputeReasonSchema = z.enum([
  'item-damaged', 'exchange-never-happened', 'item-different',
]);

export const CreateListingSchema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(20).max(500),
  priceXlm: z.number().int().positive().max(50_000_000),  // centavos (máx 500,000 XLM)
  type: ListingTypeSchema,
  majors: z.array(MajorSchema).min(1),
  condition: ConditionSchema,
  photoUrl: z.string().url(),
  videoVerified: z.boolean(),
});

export const CreateOfferSchema = z.object({
  listingId: z.string().min(1),
  type: OfferTypeSchema,
  offeredItems: z.array(z.object({
    title: z.string().min(1).max(80),
    estimatedValueXlm: z.number().int().positive(),  // centavos
  })).optional(),
  xlmAmount: z.number().int().min(0).optional(),  // centavos
  message: z.string().max(280).optional(),
}).refine(
  (data) => {
    // Reglas semánticas por tipo (evitan `barter con xlmAmount=0` y similares):
    if (data.type === 'barter')   return data.xlmAmount === undefined;        // trueque puro: SIN saldo
    if (data.type === 'saldo-only') return typeof data.xlmAmount === 'number' && data.xlmAmount > 0;
    if (data.type === 'hybrid')   return typeof data.xlmAmount === 'number' && data.xlmAmount > 0;
    return true;
  },
  { message: 'Reglas: "barter" NO debe traer xlmAmount; "saldo-only" e "hybrid" requieren xlmAmount > 0' },
);

// Disputa: la foto viaja como multipart/form-data (File), no JSON.
// El server valida MIME y tamaño (≤2MB jpeg/png/webp) ANTES de storeEvidence().
// Campos del form: escrowId, reason, description, photo
export const DisputeFormSchema = z.object({
  escrowId: z.string().min(1),
  reason: DisputeReasonSchema,
  description: z.string().min(10).max(500),
});
```

### 12.3 Protección de claves

```bash
# .env.local (NO commitear)
NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=pub_testnet_users_...   # puede ir al cliente
POLLAR_USERS_SECRET_KEY=sec_testnet_users_...                    # SOLO server (user app)
POLLAR_OPS_SECRET_KEY=sec_testnet_ops_...                        # SOLO server (operational app)
PLATFORM_SECRET_KEY=S...                                          # Stellar secret, SOLO server
PLATFORM_PUBLIC_KEY=G...                                          # público
APP_SECRET_KEY=<hex 32 bytes, openssl rand -hex 32>               # cifrado árbitro + firma de cookies (§6.4)
CRON_SECRET=<random>                                              # cron/prod + reset-demo (§11.3/11.5)
ADMIN_EMAILS=maria.pumatrade+seed1@mail.tm                       # guard de la cola de disputas (no hay columna role)
```

### 12.4 Lo que el cliente nunca debe ver

- `POLLAR_USERS_SECRET_KEY` — Pollar ni lo entrega al cliente si el provider está bien configurado
- `POLLAR_OPS_SECRET_KEY` — solo usado server-side en API routes específicas (sweep fees, etc.)
- `PLATFORM_SECRET_KEY` — solo importado desde `lib/server-keypair.ts` que tiene el guard `typeof window !== 'undefined'`
- `PLATFORM_PUBLIC_KEY` — sí puede ser público (es un G-address), pero no aporta nada al atacante

### 12.5 CORS y dominios

Configurar en el dashboard de Pollar (app Usuarios y app Operacional):
- `localhost:3000` (dev)
- El dominio de producción (deploy, ej. `pumatrade.vercel.app`)
- **La IP de LAN de la máquina de dev** (ej. `http://192.168.1.23:3000`): el demo se prueba en **celulares** apuntando al mismo `next dev` por la red local ("Preparar ambos" — ver PRD §15). Sin esta entrada, Pollar rechaza el login desde el teléfono con CORS error.

> ⚠️ **La IP de LAN solo se agrega cuando `NODE_ENV !== 'production'`.** El bloque `if (NODE_ENV !== 'production' && LAN_IP)` debe vivir en la config que arma el array de allowed origins en runtime (lib/cors.ts o equivalente) — **no se commitea con la IP hardcodeada a prod**. Si por error de config queda, el riesgo es: cualquier dispositivo en la LAN puede llamar la API. Aceptado en dev (es una red privada local); en prod se elimina.

### 12.6 Almacenamiento de evidencia (fotos de disputa)

> **v1.1:** por el deploy a Vercel, las fotos van a **Vercel Blob** en prod (filesystem efímero en serverless), con fallback a disco local en dev. El hash SHA256 siempre se ancla en la cuenta del escrow (ver §6.5).

```typescript
// lib/evidence-storage.ts — abstracción sobre el backend de archivos
import { put, del } from '@vercel/blob';
import crypto from 'crypto';

// Validación server-side ANTES de storeEvidence() — bug conocido de File.type
// es que puede ser falsificable en clientes legacy; aquí re-validamos MIME
// mirando los magic bytes del buffer, no el header del file.
const VALID_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function sniffMimeFromMagicBytes(buf: Buffer): string | null {
  // JPEG: FF D8 FF. PNG: 89 50 4E 47. WEBP: 'RIFF'....'WEBP'.
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function validateEvidenceFile(file: File): Promise<Buffer> {
  if (file.size > MAX_BYTES) throw new ApiError(413, 'evidence_too_large', `Máx ${MAX_BYTES} bytes`);
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMimeFromMagicBytes(buf);
  if (!sniffed || !VALID_MIME.has(sniffed)) {
    throw new ApiError(415, 'evidence_unsupported_type', 'Formato no soportado (jpeg/png/webp)');
  }
  return buf;
}

export async function storeEvidence(
  escrowId: string,
  file: File
): Promise<{ url: string; hash: string }> {
  // ⚠️ Validación de MIME/tamaño ANTES de subir (Magic bytes, no solo File.type).
  const buffer = await validateEvidenceFile(file);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  if (process.env.NODE_ENV === 'production') {
    // Vercel Blob — requiere BLOB_READ_WRITE_TOKEN en el entorno
    const blob = await put(`disputes/${escrowId}.jpg`, file, {
      access: 'public',
      addRandomSuffix: false, // el nombre ya es único (id del escrow)
      allowOverwrite: true,
    });
    return { url: blob.url, hash };
  }

  // Dev local — vuelca a disco (único caso donde se toca el filesystem)
  const fs = await import('node:fs/promises');
  const path = `${process.cwd()}/public/disputes/${escrowId}.jpg`;
  await fs.mkdir(`${process.cwd()}/public/disputes`, { recursive: true });
  await fs.writeFile(path, buffer);
  return { url: `/disputes/${escrowId}.jpg`, hash };
}

export async function deleteEvidence(escrowId: string, url: string) {
  if (process.env.NODE_ENV === 'production') {
    await del(url);
  } else {
    const fs = await import('node:fs/promises');
    await fs.unlink(`${process.cwd()}/public/disputes/${escrowId}.jpg`).catch(() => {});
  }
}
```

**Contratos de API que dependen de esto:**

- `POST /api/escrow/dispute` acepta **`multipart/form-data`** (no JSON): `escrowId`, `reason`, `description`, `photo` (File). El server → `storeEvidence()` → ancla hash en Stellar → crea `DisputeEvidence` + `Escrow.status = 'disputed'`.
- Límites de archivo a validar en el server: máx **2 MB**, tipos `image/jpeg|png|webp`.
- Flujo de la Rama C (detalle): §7.3 + PRD v3.4 §7.4.

### 12.7 Matriz de amenazas (auditada R3)

Resultado de la pasada R3 (auditoría adversarial contra el blueprint). Severidad **Alta** = vector de dinero real o toma de cuenta; **Media** = DoS/IDOR/abuso acotado; **Baja** = riesgo residual o post-MVP. La columna **Mitigación** apunta al lugar exacto del doc donde el implementador la aplica.

| # | Vector | Sev | Estado / Mitigación (ubicación exacta) |
|---|---|---|---|
| A1 | **Suplantación de seed user vía mail.tm.** Las direcciones `maria.pumatrade+seed1@mail.tm` etc. son impersonables — un atacante externo puede crear las mismas en mail.tm y robar el OTP de email si los inboxes no están pre-creados y aislados antes del demo. | Alta | **Procedimiento pre-demo (§15 paso 10):** el implementador Crea LOS 5 INBOXES EN MAIL.TM en T-2h y conserva las credenciales de cada uno. El primer login de cada seed es la **ventana de bind** — el `pollarWalletId` se vincula por el bind de §9.4 (si un atacante externo entra después, recibe 409 al re-bind porque su wallet ≠ la del seed). Razonamiento: el seed está protegido por wallet binding; pero la OTP inicial es lo único que roba el atacante externo antes del bind. **No automatizable.** |
| A2 | **`/api/auth/dev-login` se vuelve bypass en prod** si Vercel no setea `NODE_ENV=production` o un middleware lo sobreescribe. | Alta | **Doble guarda (§8.3):** el handler responde 404 si `DEV_LOGIN_ENABLED !== 'true'` **o** si `NODE_ENV === 'production'`. Solo la combinación las dos negaciones (config explícita Y entorno de dev) lo habilita. |
| A3 | **Cuenta Stellar huérfana** si la DB tx post-create falla entre `createEscrowAccount()` y el `$transaction` en §8.4. | Alta | **Documentado y aceptado (§6.3, §7.2, §11.5):** testnet es gratis; el `reset-demo` limpia huérfanos. En prod cada huérfano deja ~3 XLM varados; mitigación `accountMerge` post-MVP. Razonamiento: la alternativa "crear Stellar DENTRO del Prisma `$transaction`" no es posible porque Stellar `submitTransaction()` espera confirmación sincrónica de Horizon (≈3–5 s) que excede el timeout de una Prisma tx serverless, y porque el create del Escrow row necesita el `publicKey` devuelto. |
| A4 | **Cookie sin revocación server-side.** Si un atacante la copia (XSS, LAN sniffer), la usa hasta 7d. No hay DB de sesiones. | Alta | **Aceptado demo:** HMAC firmado (§6.4 con HKDF), maxAge 7d, `httpOnly` + `Secure` en prod. **Post-MVP:** tabla `Session` con `expiresAt` + `revokedAt`. El implementador puede agregar el modelo en una migración futura. |
| M1 | **Bypass semántico en ofertas:** un atacante postea `{type:'barter', xlmAmount:0}` (en vez de `undefined`) — el server antes lo aceptaba y generaba escrow en barter puro disfrazado de saldo. | Media | **Cerrado (§12.2):** Zod `refine()` exige `tipo → xlmAmount` correcto: barter ⇒ `undefined`; saldo-only/hybrid ⇒ `> 0`. |
| M2 | **Sin rate-limit en auth/sync/dev-login.** Permite brute-force de emails. | Media | **Aceptado demo.** Vercel Edge Config con limit de ~10 req/min/IP es la opción post-MVP (Bloque 2). |
| M3 | **MIME de evidencia falsificable** (`File.type` viene del cliente, un atacante puede setear `image/jpeg` a un `.exe`). | Media | **Cerrado (§12.6):** `validateEvidenceFile()` usa **sniffing de magic bytes** del buffer (FF D8 FF / 89 50 4E 47 / RIFF…WEBP), no el header del File. Magic bytes son robustos a renombre. |
| M4 | **IDOR en `GET /api/escrow/[id]`** — si el implementador olvida el guard, cualquier usuario autenticado ve el detalle de un escrow ajeno. | Media | **Guard documentado (§8.3 + §8.4 patrón):** `if (escrow.buyerId !== user.id && escrow.sellerId !== user.id) throw new ApiError(403, ...)`. El mismo patrón aplica a `receipt/[id]` (§10.4) y `escrow/[id]/report`. |
| M5 | **Doble firma de release (replay).** Si dos requests accept llegan exactamente al mismo tiempo, ambos firman y envían release. La segunda tx falla en Horizon (cuenta vaciada), pero pierde fees y deja estado inconsistente. | Media | **Cerrado (§6.3):** `EscrowService.accept`/`autoResolve` usan `tx.escrow.updateMany({ where: { id, stellarTxHashRelease: null }, data: { stellarTxHashRelease: <hash>, status: 'released/auto-released' } })` DENTRO del `$transaction` antes de firmar Stellar. Si el primer write ya puso el hash, el segundo updateMany tiene count=0 → abort sin firmar. **Regla #2 de §7.3** en acción. |
| M6 | **CORS-LAN IP filtrada a producción.** Si por error queda, cualquier dispositivo LAN accede a la API. | Media | **Guard (§12.5):** la IP solo se agrega al array de allowed origins si `NODE_ENV !== 'production'`. Documentado en línea explícita. |
| B1 | **`NEXT_PUBLIC_PLATFORM_FEE_BPS` malformado** → `Number()` retorna NaN → `feeCents()` calcula mal → fee flotante roto. | Baja | **TODO en `lib/config.ts` (Bloque 0):** validar al arrancar que sea entero positivo entre 0 y 10000 (100%). Fail-fast si no. Aceptado no implementarlo en el commit del MVP — pero el bloque debe quedar listo antes de cualquier release del MVP. |
| B2 | **Vercel Blob URLs públicas.** Las fotos de disputa quedan en `/disputes/{escrowId}.jpg` accesibles sin auth. | Baja | **Aceptado demo:** la URL no es enumerable públicamente en flujo normal (escrowId es cuíd, 25 chars). En prod, usar signed URLs con expiración corta (post-MVP); el `put()` ya soporta `{ access: 'private' }`. |
| B3 | **Memorias de memo on-chain** (`PT-{escrowIdShort}-{hash16}`) no son únicas por diseño — un replay manual es bloqueado por el tx hash guard (M5), pero dos escrows con mismo id teóricamente podrían chocar. | Baja | `escrowId` es `cuid()` (25 chars random, 36^25 espacio) — colisión astronómicamente improbable. Documentado. |

> **Resumen ejecutivo de R3:** la implementación **NO debe** proceder hasta que se cierren explícitamente **A1** (pre-crear 5 inboxes mail.tm antes del demo — paso §15), **A2** (doble guarda dev-login), **A3** (no requiere acción, decisión documentada), **A4** (aceptado demo). **M1**, **M3**, **M5** ya están cerrados en este blueprint; **M2** y **M6** son guards + notas; **B1** es TODO en Bloque 0.

---

## 13. Seed data + reset demo

### 13.1 Script de seed

> **v1.1:** Prisma 7 genera el client a `src/generated/prisma` (import, no `@prisma/client`), la config vive en `prisma.config.ts`, y el seed data es un **módulo TS compartido** (`lib/seed-data.ts`) para que `prisma/seed.ts` (CLI) y `/api/reset-demo` (runtime) usen lo mismo.

```typescript
// prisma.config.ts (raíz)
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
```

```typescript
// lib/db.ts — cliente compartido con driver adapter (Neon, serverless-friendly)
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@/generated/prisma/client';

neonConfig.poolConnectionTimeoutMillis = 30000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaNeon(pool);

export const prisma = new PrismaClient({ adapter });
```

```typescript
// lib/seed-data.ts — 5 users + 10 listings + 4 offers (datos puros, sin dependencias)
// (El JSON original de seed/seed.json se convierte a este módulo en el Bloque 0:
//  mismas figuras, shapes tipados con los tipos generados por Prisma.)
export const seedUsers = [ /* usr_maria, usr_juan, usr_andrea, usr_pablo, usr_sofia */ ];
export const seedListings = [ /* 10 listings */ ];
export const seedOffers = [ /* 4 ofertas (mix barter/pollar/hybrid) */ ];
```

```typescript
// prisma/seed.ts
import { prisma } from '../lib/db';
import { seedUsers, seedListings, seedOffers } from '../lib/seed-data';

async function main() {
  const walletIds = JSON.parse(process.env.SEED_WALLET_IDS || '{}');

  await prisma.user.createMany({
    data: seedUsers.map((u) => ({ ...u, pollarWalletId: walletIds[u.id] ?? `G_PLACEHOLDER_${u.id}` })),
  });
  await prisma.listing.createMany({ data: seedListings });
  await prisma.offer.createMany({ data: seedOffers });
  console.log('✅ Seed cargado');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

> ⚠️ `createMany` no dispara hooks de Prisma y no resuelve relaciones: los `@@relation` entre seed rows deben referenciar por `id` explícito. Los campos JSON (`majors`, `offeredItems`) siguen viajando como strings — ver §4.2.

### 13.2 Package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seed.ts",
    "capture:wallets": "tsx scripts/capture-wallets.ts"
  }
}
```

### 13.3 Setup de wallets seed (lo que SÍ es automatizable)

> ⚠️ **Realidad Pollar (0.11.3, verificada):** las wallets se crean **en el login** del usuario (Google/email OTP). NO existe endpoint server-side para crear wallets arbitrarias. Lo automatizable es:
> 1. **Funding con XLM:** la **Server API `POST /v1/wallets/fund`** (con la secret key de la app) fondea una wallet con XLM de testnet — es el patrón KYC-simulated del demo app oficial (✅). Un route handler dev lo llama tras el primer login de cada seed user, **con el saldo por persona del PRD §1**: María 1,250 / Juan 2,000 / Andrea 800 / Pablo 500 / Sofía 1,800 XLM (multiplicar ×100 al guardarlo en centavos). Cero pagos manuales, cero distribution rules (eso era para tokens; nuestra moneda es XLM nativo).
> 2. **Captura de G-addresses:** tras el primer login de cada seed user, un componente dev (solo `NODE_ENV !== 'production'`) imprime `wallet.address` y lo guarda en `SEED_WALLET_IDS` vía un endpoint dev.

```typescript
// scripts/capture-wallets.ts — no crea wallets; valida lo capturado
// Lee SEED_WALLET_IDS de .env.local y verifica en Stellar que cada
// G-address existe y tiene su balance de XLM (vía Horizon).
// Advertencia amistosa si falta alguno: "login de X pendiente".
```

**Flujo del implementador (una sola vez, ~20 min):**

1. Levanta `npm run dev` (con `POLLAR_USERS_SECRET_KEY` en `.env.local`).
2. Se loguea **una vez por seed user** (5 email OTP con `mail.tm`); tras cada login, el route handler dev llama a `POST /v1/wallets/fund` y el componente dev registra el `G-address` en `SEED_WALLET_IDS`.
3. Corre `npm run capture:wallets` → confirma 5 wallets con balance de XLM.
4. Corre `npm run db:seed` con `SEED_WALLET_IDS` ya poblado.

---

## 14. Variables de entorno

> **v1.1:** `DATABASE_URL` es Postgres (Neon), se agregaron `CRON_SECRET` y `BLOB_READ_WRITE_TOKEN` para el deploy. Nada de SQLite.

```bash
# .env.local — ejemplo
# === Pollar App 1: Usuarios ===
NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=pub_testnet_users_xxxxxxxxxxxxxxxxxxxx
POLLAR_USERS_SECRET_KEY=sec_testnet_users_xxxxxxxxxxxxxxxxxxxx

# === Pollar App 2: Operacional ===
POLLAR_OPS_SECRET_KEY=sec_testnet_ops_xxxxxxxxxxxxxxxxxxxx

# === Stellar (plataforma) ===
PLATFORM_PUBLIC_KEY=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PLATFORM_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# === Cifrado del árbitro (AES-256-GCM; openssl rand -hex 32) ===
APP_SECRET_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# === Base de datos (Neon Postgres; misma string en dev y prod) ===
DATABASE_URL=postgresql://user:pass@ep-xxxx-pooler.us-east-1.aws.neon.tech/pumatrade?sslmode=require

# === App ===
NEXT_PUBLIC_PLATFORM_FEE_BPS=200
DEMO_TTL_MINUTES=3
CONFIRM_WINDOW_MINUTES=10     # ventana para confirmar/disputar tras registrar intercambio (prod: 8h = 480)
HACKATHON_FREE_FEES=true
ENABLE_CRON=true
ADMIN_EMAILS=maria.pumatrade+seed1@mail.tm   # guard de /admin/disputes (separar con coma para varios)

# === Deploy (Vercel) ===
CRON_SECRET=genera-un-random-de-32-chars
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx          # solo prod; vacío en dev

# === Seed (opcional, sobreescribe IDs de seed.json) ===
SEED_WALLET_IDS={"usr_maria":"G...","usr_juan":"G...","usr_andrea":"G...","usr_pablo":"G...","usr_sofia":"G..."}

# === Demo / dev ===
NODE_ENV=development
ALLOW_RESET_DEMO=true
```

### 14.1 `.env.example` (lo que sí se commitea)

```bash
# .env.example
NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=
POLLAR_USERS_SECRET_KEY=
POLLAR_OPS_SECRET_KEY=
PLATFORM_PUBLIC_KEY=
PLATFORM_SECRET_KEY=
APP_SECRET_KEY=
DATABASE_URL=
NEXT_PUBLIC_PLATFORM_FEE_BPS=200
DEMO_TTL_MINUTES=3
CONFIRM_WINDOW_MINUTES=10
HACKATHON_FREE_FEES=true
ENABLE_CRON=true
ADMIN_EMAILS=
CRON_SECRET=
BLOB_READ_WRITE_TOKEN=
SEED_WALLET_IDS={}
```

---

## 15. Setup pre-codear

Una sola persona hace esto ANTES de que el equipo empiece a codear. Tiempo estimado: 2–2.5h. **Las apps de Pollar las creamos nosotros** (no hay keys del socio); la treasury manual sigue fuera de Pollar.

**T-24h (dashboard + llaves):**

1. [ ] Crear **app Usuarios** en dashboard.pollar.xyz ("PumaTrade Usuarios"): Chains → Stellar testnet; Auth providers → Google + email OTP; Funding mode → Immediate (XLM nativo: **no hay tokens ni trustlines que configurar**)
2. [ ] Generar API keys app Usuarios (`pub_testnet_users_…` / `sec_testnet_users_…`)
3. [ ] Crear **app Operacional** ("PumaTrade Operacional"): Stellar testnet, sin auth providers (solo server), Immediate
4. [ ] Generar API keys app Operacional (`sec_testnet_ops_…`; la publishable no se usa)
5. [ ] Crear **treasury manual** (fuera de Pollar): `stellar keys generate platform-treasury --network testnet --fund` (o laboratorio.stellar.org) → guardar secret en `.env.local` como `PLATFORM_SECRET_KEY`, nunca al repo
6. [ ] Fondear treasury con XLM testnet vía friendbot (`https://friendbot.stellar.org/?addr=G…`) → confirmar saldo XLM en stellar.expert
7. [ ] Crear **Neon Postgres** (neon.tech, free tier) → branch main; copiar `DATABASE_URL` (pooler) a `.env.local`
8. [ ] (Opcional) Crear proyecto Vercel y conectar repo (deploy inicial automático en T+0)

**T-2h (seed wallets + arranque):**

9. [ ] (No requiere config) El fundeo seed va por **Server API `POST /v1/wallets/fund`** con XLM — config predefinida, ver §13.3
10. [ ] Crear 5 emails temporales en `mail.tm` (`maria.pumatrade+seed1@…`, etc.)
11. [ ] `git clone` + `cp .env.example .env.local` + llenar vars
12. [ ] `npm install` → `npx prisma migrate dev --name init` → `npm run db:seed`
13. [ ] Login una vez por cada seed user (email OTP) → el dev helper fondea con XLM y captura `G-address` en `SEED_WALLET_IDS` (§13.3)
14. [ ] `npm run dev` → login como María → ver saldo **1,250 XLM** (PRD §1) → ver marketplace
15. [ ] SEND de prueba María → Juan (runTx payment) → visible en stellar.expert
16. [ ] Confirmar `DEMO_TTL_MINUTES=3` y `HACKATHON_FREE_FEES=true`
17. [ ] `vercel deploy` → set env vars en Vercel (incluido `CRON_SECRET` + `BLOB_READ_WRITE_TOKEN`) → habilitar Vercel Cron en Settings

---

## 16. Plan de implementación (orden exacto)

Cada bloque = ~2-4 horas de trabajo para 1 implementador. El bloque 1 y 2 son los más críticos.

### Bloque 0 — Scaffolding (1h)
- `npm create next-app@latest . --typescript --tailwind --app` (Next 16 + React 19 + Tailwind 4 ya integrados)
- Instalar dependencias del §3.1 (incluye `@prisma/adapter-neon`, `@neondatabase/serverless`, `@vercel/blob`)
- Crear `.gitignore` (Next.js lo hace; agregar `.env.local`, `src/generated/`, `public/disputes/`)
- Setup Prisma 7: `prisma.config.ts`, `schema.prisma` (`provider = "postgresql"`, generator `prisma-client` con `output = "../src/generated/prisma"`), `lib/db.ts` con `PrismaNeon`
- Migración inicial: `npx prisma migrate dev --name init`
- Clonar estructura de carpetas de §9.1 (app/, components/, lib/, stores/, hooks/)

### Bloque 1 — Auth + sync (2h)
- `app/layout.tsx` con `PollarProvider client={{ apiKey }}` (sin `network`)
- `app/login/page.tsx` con Google + email OTP (§9.4)
- `components/LoginButton.tsx`
- `app/api/auth/sync/route.ts` (cookies async §8.2; email/name vía sesión o `getUserProfile()` — §5.4)
- `app/api/auth/me/route.ts`
- `app/api/auth/dev-login/route.ts`
- `lib/auth.ts` (await cookies)
- `stores/authStore.ts`
- `app/page.tsx` (redirect logic)
- **Test:** login (Google y email OTP) → cookie seteada → `me` devuelve user → reload mantiene sesión

### Bloque 2 — Marketplace + listings (3h)
- `app/marketplace/page.tsx` (grid + filtros)
- `app/marketplace/[listingId]/page.tsx`
- `app/api/listings/route.ts` (GET, POST)
- `app/api/listings/[id]/route.ts` (GET)
- `components/listings/{ListingCard,FilterBar,PriceAlertBadge}.tsx`
- `lib/priceAlert/{referencePrices,engine}.ts`
- `app/api/price-alert/route.ts`
- **Test:** ver grid, filtrar, ver detalle

### Bloque 3 — Offers + tablero (3h)
- `app/marketplace/[listingId]/offer/page.tsx`
- `app/api/offers/route.ts` (POST)
- `app/api/offers/[id]/route.ts` (PATCH)
- `components/offers/{OfferBoard,OfferCard,OfferForm,OfferTypeSelector}.tsx`
- `lib/escrow-helpers.ts` (cálculo de diferencias, validaciones de oferta)
- **Test:** ofertar 3 tipos distintos, ver tablero del vendedor

### Bloque 4 — Stellar setup + escrow account creation (4h)
- `lib/stellar.ts` (asset, `Horizon.Server`, helpers, `releaseEscrow`/`refundEscrow` esqueleto — API v17, ver §6.3)
- `lib/server-keypair.ts`
- `lib/escrow.service.ts` (esqueleto + recordExchange + confirmExchange)
- `app/api/escrow/accept-offer/route.ts`
- `scripts/capture-wallets.ts`
- **Test:** crear escrow real en testnet → ver cuenta multi-sig en stellar.expert

### Bloque 5 — Fund + exchange recorded (3h)
- `app/api/escrow/fund/route.ts` (devuelve `{ destination, amount, asset }` para `runTx`)
- `app/escrow/[escrowId]/page.tsx`
- `components/escrow/{EscrowTimeline,EscrowActions,ExchangeRecorder}.tsx`
- Integración con `getClient().runTx('payment', { destination, amount, asset: { type: 'native' } })` (§5.4)
- **Test:** buyer fondea → estado funded → ambos registran → estado exchange-recorded con TTL

### Bloque 6 — Accept + auto-resolve + cron (3h)
- `lib/cron.ts` (`runTimeoutCheck` compartido) + `lib/cron-dev.ts` (setInterval 30s dev)
- `app/api/cron/timeout-check/route.ts` (protegido con `CRON_SECRET` — §11.3)
- `app/api/escrow/accept/route.ts` (Rama A: release multi-sig firmada por platform + árbitro, §6.2)
- `app/api/escrow/cancel/route.ts` (refund platform+árbitro)
- `components/escrow/CountdownTimer.tsx`
- **Test:** Rama A manual + Rama B con TTL de **3 min** (`DEMO_TTL_MINUTES`) chequeado **cada 30s en dev / 1 min en Vercel Cron** + auto-cancel por ventana de confirmación vencida (`CONFIRM_WINDOW_MINUTES`)

### Bloque 7 — Disputas (Rama C) (2h)
- `app/escrow/[escrowId]/report/page.tsx`
- `app/api/escrow/dispute/route.ts` (**multipart form**: `photo` File ≤2MB → `lib/evidence-storage.ts` → ancla hash en Stellar → crea dispute)
- `components/escrow/DisputeForm.tsx` (file input + preview)
- `app/admin/disputes/page.tsx`
- `app/api/disputes/route.ts`
- **Test:** reportar con las 3 razones con foto (dev: disco local; prod: Vercel Blob), ver en admin queue

### Bloque 8 — Recibo + polish + deploy (3h)
- `app/receipt/[escrowId]/page.tsx`
- `components/receipt/ReceiptSummary.tsx`
- Memo hash generation
- Mejoras de UI (toasts, loading states, empty states)
- Reset demo button (`/api/reset-demo`, §11.5)
- **Deploy:** `vercel deploy --prod` + env vars + Vercel Cron + verificar en el dominio
- **Test:** happy path completo en móvil + escritorio (ventana angosta)

### Bloque 9 — Demo prep (1h)
- Verificar todos los seed offers
- Pre-cargar la primera oferta en estado `awaiting-exchange` (atajo para el demo)
- Verificar links a stellar.expert
- Probar reset demo
- Backup del seed por si algo falla en vivo

**Total: ~24 horas.**

---

## 17. Mapa PRD → arquitectura

Para que el implementador verifique que no nos dejamos nada:

| Historia del PRD | Endpoints | Pantallas | Componentes |
|---|---|---|---|
| Login con Google o email OTP | `/api/auth/sync` | `/login` | `LoginButton` |
| Ver mi saldo | `/api/auth/me` | header | `WalletBadge` |
| Publicar listing | `POST /api/listings` | `/create` | form + `PriceAlertBadge` |
| Ver marketplace | `GET /api/listings` | `/marketplace` | `ListingCard` + `FilterBar` |
| Ver detalle listing | `GET /api/listings/[id]` | `/marketplace/[id]` | `ListingDetailHeader` |
| Hacer oferta saldo-only | `POST /api/offers` | `/marketplace/[id]/offer` | `OfferForm` |
| Hacer oferta barter | `POST /api/offers` | idem | idem (variante) |
| Hacer oferta híbrida | `POST /api/offers` | idem | idem (variante) |
| Ver tablero | `GET /api/listings/[id]` (campo offers) | `/marketplace/[id]` (seller) | `OfferBoard` + `OfferCard` |
| Aceptar oferta | `POST /api/escrow/accept-offer` | idem | `OfferCard` botón |
| Fondear escrow | `POST /api/escrow/fund` + `runTx('payment', …)` | `/escrow/[id]` | `EscrowActions` |
| Registrar intercambio | `POST /api/escrow/record-exchange` | `/escrow/[id]` | `EscrowActions` |
| Confirmar intercambio | `POST /api/escrow/confirm-exchange` | `/escrow/[id]` | `EscrowActions` |
| Aceptar artículo (Rama A) | `POST /api/escrow/accept` | `/escrow/[id]` | `EscrowActions` |
| Auto-resolve (Rama B) | cron `/api/cron/timeout-check` | automático | `EscrowActions` (pasivo) |
| Reportar problema (Rama C) | `POST /api/escrow/dispute` | `/escrow/[id]/report` | `DisputeForm` |
| Cancelar | `POST /api/escrow/cancel` | `/escrow/[id]` | `EscrowActions` |
| Ver recibo | `GET /api/escrow/[id]` | `/receipt/[id]` | `ReceiptSummary` |
| Ver mis escrows | `GET /api/escrow/my` | home + escrow list | `EscrowStore` |
| Alerta de precios | `POST /api/price-alert` | create + offer form | `PriceAlertBadge` |
| Ver disputas (admin) | `GET /api/disputes` | `/admin/disputes` | tabla simple |
| Reset demo | `POST /api/reset-demo` | `/settings` | botón |

**Cobertura:** 22 historias PRD ↔ arquitectura. 0 historias sin endpoint correspondiente.

---

## 18. Decisiones cerradas y próximos pasos

### 18.1 Decisiones aprobadas (integradas en este doc)

| # | Decisión | Dónde se refleja |
|---|---|---|
| 1 | **Dos apps separadas de Pollar** (Usuarios + Operacional), creadas por nosotros (sin keys del socio) | §5.1, §5.2 (setup 16 pasos), §5.4 (dos clientes), §14 (env vars), §15 (pasos 1-4) |
| 2 | **Wallets seed**: login único por email OTP (mail.tm) + fundeo con XLM vía **Server API `POST /v1/wallets/fund`** + `SEED_WALLET_IDS` capturado por dev helper | §5.2 (paso 17), §5.4 (fund API), §13.3 (flujo real de Pollar), §15 (pasos 9-13) |
| 3 | **Cuenta multi-sig nueva por escrow** (master efímero + llave de arbitraje por-escrow, encriptada en DB) | §6.2, §6.3, §6.4 |
| 4 | **Foto de evidencia**: SHA256 anclado en Stellar `manageData` + foto en **Vercel Blob (prod) / disco local (dev)** | §4.1 (campos), §6.3 (op 6), §6.5, §12.6 (`lib/evidence-storage.ts`), §8.3 (dispute multipart) |
| 5 | **Correos temporales** (mail.tm) para los 5 seed users; Google opcional para usuarios reales | §5.4 (provider dual), §9.4 (`LoginButton` con ambos flujos), §5.2 setup |
| 6 | **Pila actualizada a la última generación**: Next 16 + React 19 + Tailwind 4 + Prisma 7 + Stellar SDK 17 + Zod 4 (TS 5.x) | §3.1 (matriz + tabla de compatibilidad), todos los ejemplos de código re-verificados |
| 7 | **Deploy a Vercel** (Railway como alternativa): Neon Postgres, Vercel Cron (1 min), Vercel Blob | §3.2, §3.3, §11 (cron dev/prod), §12.6 (fotos), §14 (env vars), §15 (paso 17), §16 (Bloque 8) |
| 8 | **Moneda = Lumens (XLM) nativos de testnet; todas las cantidades en `Int` centavos** | §4.1 (schema), §4.2 (doctrina de dinero), §6.6, §8.3/§8.4, §12.2, §13.3, §15 |
| 9 | **Escrow 2-de-2 PLATAFORMA + ÁRBITRO** (v3.4). El comprador NO es signer: su llave vive en el AWS KMS de Pollar, sin API de firma ajena (verificado 2026-09-25). Toda transición on-chain se firma con las 2 llaves server-side | §6.2, §6.3, §6.4 (`lib/crypto.ts`), §7.3, §8.4 |
| 10 | **Ventana de confirmación** en `awaiting-exchange` (`CONFIRM_WINDOW_MINUTES`) → al expirar, cron auto-cancela → refund completo al buyer. `cancel` también permitido en ese estado | §4.1 (`confirmWindowExpiresAt`), §7.2, §11.1, §14, PRD §4.3/§4.4 |
| 11 | **1 escrow por listing**: aceptar una oferta pone el listing en `pending` (409 si se intenta aceptar otra); al resolver → `sold` (Rama A/B) o `active` (refund) | §4.1 (Listing.status), §7.2, §8.3/§8.4, §10.1/§10.2, PRD PASO 4 |

### 18.2 Lo que sigue — próximos pasos

Antes de empezar a codear:

1. **Tú (PM):** lee este doc completo y avísame si hay algo que cambiar. Este doc es el contrato entre tú y el implementador.
2. **Tú:** confirma que el PRD v3.4 sigue alineado con tu visión (especialmente la sección del intercambio físico como evento central y el nuevo modelo de firma del escrow).
3. **Cuando me digas "OK, empieza":**
   - Escribo `package.json` con dependencias exactas (§3.1)
   - Escribo `prisma/schema.prisma` con el modelo completo (§4.1)
   - Escribo `lib/seed-data.ts` con los 5 usuarios + 10 listings + 4 ofertas (§13.1 — módulo compartido por `prisma/seed.ts` y `/api/reset-demo`)
   - Escribo `prisma/seed.ts` (§13.1)
   - Escribo `scripts/capture-wallets.ts` (§13.3)
   - Escribo `.env.example` (§14.1)
   - Escribo `lib/stellar.ts`, `lib/server-keypair.ts`, `lib/escrow.service.ts`, `lib/priceAlert/*` (esqueleto)
   - Configuro el `app/layout.tsx` con PollarProvider
   - Sigo el plan de implementación del §16 bloque por bloque
4. **Cada bloque se commitea por separado** (no mega-commit), previa tu aprobación para push (como pediste).

### 18.3 Lo que NO está en este doc y quedará fuera del MVP

Documentado como "La Casa" en el PRD v3.4 §12. Resumen:

- On-ramp fiat / off-ramp
- Counter-offers / negociación
- Reputación y ratings
- Resolución automática de disputas (manual en MVP)
- Foro de nuevo ingreso
- Rentas / cafetería
- Smart contract Soroban real
- App nativa
- Agente IA completo
- Compra urgente (buyback)

---

**FIN DEL ARCHITECTURE v1.3**

> Total: ~2,540 líneas, 18 secciones, 22 historias PRD mapeadas a endpoints, plan de implementación dividido en 9 bloques de ~2-4h cada uno.