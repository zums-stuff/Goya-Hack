# PRD — PumaTrade (Goya-Hack)

**Versión:** 2.0 (corregida según modelo: plataforma de compraventa, NO trueque)
**Fecha:** 2026-09-24
**Estado:** Aprobado para implementación
**Tiempo de implementación:** <24h
**Audiencia del documento:** 1 implementador full-stack + 2 teammates (diseño/pitch)
**Audiencia del producto:** Estudiantes universitarios (UNAM, principalmente FI)

---

## 0. Resumen ejecutivo (1 página para pitch)

**PumaTrade** es una **plataforma de compraventa** móvil-first para estudiantes universitarios donde puedes **vender o comprar** bienes académicos en desuso (libros, calculadoras, batas, componentes electrónicos) pagando en **PumaDolar (P$)** — una moneda digital respaldada por USDC en Stellar testnet, gestionada a través del SDK **Pollar**, que crea una wallet embebida para cada usuario con solo iniciar sesión con Google.

**Dos formas de participar:**

1. **Venta entre estudiantes (flujo principal):** publicas tu artículo con un precio. Los compradores paguen en P$; el dinero queda retenido en un **escrow garantizado** hasta que el comprador **pruebe físicamente el artículo** y confirme en la app.
2. **Venta a la plataforma (opcional):** si te urge saldo, puedes **vender tu artículo a PumaTrade** — la plataforma lo tasa con IA y te paga al instante en P$, y luego lo revende en el catálogo (los artículos se marcan como **"Venta Oficial"**). **No es necesario vender para comprar**: puedes llegar, tener saldo (crédito de bienvenida en el demo) y comprar directamente.

**La IA de tasación es el corazón del producto.** Un motor híbrido (base local de precios de referencia + reglas de depreciación + LLM opcional cuando hay red) compara el valor de cada artículo contra **precios reales de mercado** y:
- Muestra al comprador un **badge de precio justo** en cada listing (rango de mercado + bandera verde/amarilla/roja).
- Alimenta un **simulador de tasación** donde describes tu artículo y la IA te dice cuánto vale y cuánto te pagaría la plataforma.
- Fija el precio de compra de la plataforma (buyback) y el de reventa de artículos "Oficiales".

**Confianza en la compraventa P2P (escrow con período de gracia):**

| Fase | Qué pasa | Estado del escrow |
|---|---|---|
| **Checkout** | El comprador paga en P$; los fondos quedan retenidos en una cuenta Stellar multi-sig 2-de-2. | `FUNDED` |
| **Fase 1 — COMMIT** | Se encuentran en el campus. El comprador recibe el objeto y **escanea el QR del vendedor**. El contrato no libera nada; cambia a `PENDING_VERIFICATION` e inicia un **TTL** (24–48h). | `PENDING_VERIFICATION` |
| **Fase 2 — GRACE (Rama A)** | El objeto funciona. Comprador toca **"Aceptar artículo"** → se libera el pago al vendedor (menos 2% de comisión). | `RELEASED` |
| **Fase 2 — GRACE (Rama B)** | El comprador no confirma y el **TTL llega a cero** → el contrato hace **auto-resolve** y libera al vendedor. Evita que un comprador malicioso secuestre los fondos. | `AUTO_RELEASED` |
| **Fase 2 — GRACE (Rama C)** | El objeto está dañado. Comprador toca **"Reportar fallo" antes** de que expire el TTL → el temporizador se detiene y el contrato queda **congelado**. | `DISPUTED` |

**Modelo de ingresos:** 2% de comisión sobre el P$ liberado en ventas P2P + margen de reventa en artículos comprados a estudiantes y vendidos por la plataforma. Durante el hackathon: comisión en 0%.

**Onboarding del demo:** cada usuario nuevo recibe un **crédito de bienvenida de 500 P$**. En producción: depósito de saldo (on-ramp fiat vía SEP-24 de Pollar).

**Out of scope MVP:** trueque, servicios/tutorías, pagos de comida, formular escrow de rentas, IA agencial "PumaAgent" autónoma (aquí la IA es el **tasador de precios**, que sí es core).

---

## 1. Personas (5 usuarios seed + cuenta de la plataforma)

Se crean ANTES del hackathon en el dashboard de Pollar y se siembran en la DB local. Los balances incluyen el crédito de bienvenida de 500 P$ donde aplica.

### 1.1 María — `maria@unam.mx` (vendedora P2P)

- **Carrera:** Ing. en Computación, 5º semestre
- **Saldo:** 750 P$ (250 ahorrados + 500 de bienvenida)
- **Bio:** "Vendo lo que ya no uso para financiar mi próximo semestre"
- **Listings (3):**
  1. **Calculadora TI-89 Titanium** — 750 P$ — AI: rango $650–850, badge verde. (verified ✓)
  2. **Multímetro Fluke 117** — 1,100 P$ — AI: $950–1,250, badge verde. (verified ✓)
  3. **Bata blanca talla M** — 200 P$ — AI: $180–280, badge verde. (verified ✓)

### 1.2 Juan — `juan@unam.mx` (comprador técnico)

- **Carrera:** Ing. Eléctrica, 3º semestre
- **Saldo:** 2,000 P$
- **Bio:** "Armando mi kit de electrónica"
- **Listings (2):**
  1. **Arduino Mega 2560** — 420 P$ — AI: $380–500, badge verde. (verified ✓)
  2. **Libro Sadiku — Elementos de Electromagnetismo** — 280 P$ — AI: $250–350, badge verde. (verified ✓)

### 1.3 Andrea — `andrea@unam.mx` (vende a la plataforma)

- **Carrera:** Matemáticas, 7º semestre
- **Saldo:** 600 P$
- **Bio:** "Liquido lo que ya no uso"
- **Listings (1):**
  1. **Cálculo de Spivak (3ra ed.)** — 550 P$ — AI: $500–700, badge verde. (verified ✓)
  - Además, en el demo **vende su bata talla CH a la plataforma** para mostrar el buyback.

### 1.4 Pablo — `pablo@unam.mx` (nuevo ingreso, crédito de bienvenida)

- **Carrera:** Física, 1º semestre
- **Saldo:** 500 P$ (exactamente el crédito de bienvenida)
- **Bio:** "Armando mi kit con el crédito de bienvenida"
- **Listings (1):**
  1. **Libro Tipler — Física Moderna** — 320 P$ — AI: $300–400, badge verde. (verified ✓)

### 1.5 Sofía — `sofia@unam.mx` (vendedora high-value)

- **Carrera:** Ing. en Computación, 8º semestre (último)
- **Saldo:** 1,800 P$
- **Bio:** "Tesis terminada, liquidando mi setup"
- **Listings (2):**
  1. **Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)** — 8,200 P$ — AI: $7,800–9,500, badge verde. (verified ✓)
  2. **Raspberry Pi 4 Model B 8GB** — 1,000 P$ — AI: $900–1,200, badge verde. (verified ✓)

### 1.6 PumaTrade Oficial (cuenta de la plataforma)

- **Rol:** SYS
- **Listings "Venta Oficial" (2)** — artículos comprados vía buyback y reacondicionados:
  1. **Kit Arduino Starter (armado por PumaTrade)** — 550 P$ — AI: $500–650 (margen sobre precio de compra). (verified ✓)
  2. **Multímetro genérico DT830B (reacondicionado)** — 190 P$ — AI: $170–230. (verified ✓)

**Total listings seed:** 11 (9 de estudiantes + 2 "Oficiales"), cubriendo 4 majors × 5 tipos.

---

## 2. Modelo de datos

### 2.1 Entidades

```typescript
// types/db.ts

type Major =
  | 'Ing. en Computación' | 'Ing. Eléctrica' | 'Ing. Mecánica'
  | 'Matemáticas' | 'Física' | 'Química' | 'Biología' | 'Otra';

type ListingType =
  | 'libros' | 'calculadoras' | 'electronica'
  | 'batas-uniformes' | 'laboratorio' | 'otros';

type Condition = 'nuevo' | 'como-nuevo' | 'bueno' | 'aceptable';

type SellerKind = 'student' | 'platform'; // plataforma = artículos comprados via buyback

interface User {
  id: string;
  email: string;
  displayName: string;
  major: Major;
  bio: string;
  pollarWalletId: string;        // ej. "G-ABC..."
  balancePumaDolar: number;      // cache local
  welcomeCreditGranted: boolean; // demo: 500 P$ al primer login
  isPlatform?: boolean;          // true solo para la cuenta de PumaTrade
  createdAt: string;
}

interface Listing {
  id: string;
  sellerId: string;              // User.id (puede ser la cuenta plataforma)
  sellerKind: SellerKind;
  title: string;
  description: string;
  pricePumaDolar: number;        // precio SEMÁNTICO: el vendedor fija el precio de venta
  type: ListingType;
  majors: Major[];
  condition: Condition;
  photoUrl: string;
  videoVerified: boolean;        // mock: toggle manual
  status: 'active' | 'paused' | 'sold' | 'removed';

  // --- Datos calculados por la IA de tasación (cache) ---
  aiFairPriceMin: number;        // rango de mercado: límite inferior
  aiFairPriceMax: number;        // rango de mercado: límite superior
  aiBadge: 'green' | 'yellow' | 'red';   // precio vs. mediana de mercado
  aiComparables: AiComparable[]; // [{title, price, source}]
  aiLastValuationAt: string;

  createdAt: string;
}

interface AiComparable {
  title: string;
  price: number;
  source: string;                // ej. "Mercado Libre MX", "BookFinder", "Amazon"
}

// Estados del escrow según el modelo COMMIT / GRACE / auto-resolve / dispute
type EscrowStatus =
  | 'funded'                    // pago retenido, esperando encuentro
  | 'pending-verification'      // Fase 1 COMMIT: QR escaneado, TTL corriendo
  | 'released'                  // Rama A: comprador aceptó
  | 'auto-released'             // Rama B: TTL expiró → auto-resolve
  | 'disputed'                  // Rama C: reporte de fallo antes del TTL
  | 'refunded';                 // cancelación antes del COMMIT

interface Escrow {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountPumaDolar: number;      // monto retenido (== precio del listing)
  stellarEscrowAccount: string; // cuenta multi-sig 2-de-2
  stellarTxHashFunding?: string;
  stellarTxHashRelease?: string;
  stellarMemoReceipt?: string;  // recibo público
  status: EscrowStatus;
  qrScannedAt?: string;         // momento del COMMIT
  ttlStartsAt?: string;         // == qrScannedAt
  ttlExpiresAt?: string;        // qrScannedAt + TTL
  acceptedAt?: string;
  autoReleasedAt?: string;
  disputedAt?: string;
  refundedAt?: string;
  platformFeePumaDolar: number; // 2% del monto, al release
  createdAt: string;
}

// Buyback: venta de un estudiante a la plataforma
interface BuybackQuote {
  id: string;
  userId: string;
  title: string;                // lo que describe el usuario
  type: ListingType;
  condition: Condition;
  ageYears?: number;
  aiFairPriceMin: number;
  aiFairPriceMax: number;
  purchaseOfferPumaDolar: number;   // 70% de la mediana justa (configurable)
  rationale: string[];              // "por qué" en lenguaje natural
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

// Simulador de tasación (no guarda estado, pero cacheamos por usuario)
interface ValuationRequest {
  id: string;
  userId: string;
  title: string;
  type: ListingType;
  condition: Condition;
  ageYears?: number;
  result: {
    fairPriceMin: number;
    fairPriceMax: number;
    platformOffer: number;     // lo que pagaría la plataforma hoy
    comparables: AiComparable[];
    rationale: string;
    llmUsed: boolean;          // true si el LLM enriqueció el resultado
  };
  createdAt: string;
}

interface TransactionLog {
  id: string;
  escrowId: string;
  actorId: string;
  action: 'checkout' | 'committed' | 'accepted' | 'auto-released'
        | 'disputed' | 'refunded' | 'buyback-accepted';
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

### 2.2 Decisiones de almacenamiento

- SQLite local (Prisma/Drizzle). La DB guarda el estado de la app; los fondos reales viven en Stellar vía Pollar.
- `aiFairPriceMin/Max`, `aiBadge`, `aiComparables` se calculan al crear el listing y se refrescan al editarlo (cache).
- Balances: cache local + `client.refreshBalance()` de Pollar; la fuente de verdad para fondos es Stellar.

---

## 3. Flujo de compraventa P2P (el del demo)

```
PASO 1 — María publica la TI-89 con la ayuda de la IA
   [Crea listing → la IA sugiere rango justo $650–850 → fija precio 750 P$ → badge verde]

PASO 2 — Juan encuentra el listing
   [Ve: precio 750 P$, badge verde "Precio justo vs. mercado ($650–850) en 14 listados reales"]

PASO 3 — Juan compra (Checkout)
   [Toca "Comprar" → confirma → SendModal de Pollar pre-llenado: 750 P$]
   [Los fondos van a la cuenta escrow multi-sig 2-de-2]
   [ Estado FUNDED · Tx hash visible en stellar.expert ]

PASO 4 — Se encuentran en la facultad (Fase 1: COMMIT)
   [María muestra su QR del escrow → Juan lo escanea con la cámara]
   [El contrato NO libera nada. Estado → PENDING_VERIFICATION, arranca TTL 48h]
   [Pantalla de ambos: "Ventana de prueba abierta — 47:59:32 restantes"]

PASO 5 — Juan prueba la calculadora en casa (Fase 2: GRACE)

   -> RAMA A (happy): funciona bien → toca "Aceptar artículo"
      [Escrow → RELEASED, 750 P$ − 2% (15 P$) = 735 P$ para María]
      [Rama B si no confirma: TTL a cero → AUTO_RELEASED, igual a favor de María]
      [Rama C si está muerta: toca "Reportar fallo" antes del TTL → DISPUTED, congelado]

PASO 6 — Recibo
   [Pantalla de recibo con tx hash Stellar + memo receipt]
   [Saldos actualizados: María 750+735=1,485 P$ · Juan 2,000−750=1,250 P$]
```

### 3.1 Flujo de venta a la plataforma (buyback; opcional)

```
PASO 1 — Andrea decide liquidar su bata
   [Toca "Vender a PumaTrade" → describe: "Bata talla CH, como nueva, 1 año"]
   [La IA tasa: rango justo $180–280, mediana 230 → oferta de compra: 70% = 161 P$]
   [Muestra por qué: 3 comparables reales + nota de depreciación]

PASO 2 — Andrea acepta la oferta
   [Agenda entrega en el punto del campus (CIA / Edificio M), simulado]

PASO 3 — Inspección en campus
   [Verificador físico revisa la bata, confirma que cumple la descripción]
   [Se acredita 161 P$ a la cuenta de Andrea (transacción Stellar)]

PASO 4 — PumaTrade la publica como "Venta Oficial"
   [Listing nuevo: precio 200 P$ (dentro del rango justo, badge verde)]
   [Margen: 200 − 161 = 39 P$]
```

### 3.2 Simulador de tasación (independiente)

```
PASO 1 — Cualquier usuario toca "Tasador" en el menú
PASO 2 — Describe: "Calculadora TI-89 Titanium, buena, 2 años"
PASO 3 — Resultado: rango justo $650–850 · la plataforma te pagaría hoy $525
         · explicación: "3 comparables en Mercado Libre MX entre $620 y $880.
           Precio de compra = 70% de la mediana ($750). Depreciación media por
           antigüedad aplicada: −5%."
         · ¿LLM usado? Sí → "Tasado con IA + verificación web".
PASO 4 — CTA: "¿Quieres vender a PumaTrade?" o "Publicar en el mercado"
```

---

## 4. Mecánica del escrow (el corazón técnico)

### 4.1 Implementación: cuenta Stellar multi-sig 2-de-2

Para el MVP NO escribimos un contrato Soroban; usamos una **cuenta Stellar multi-sig** como "smart contract" retenido:

```
Cuenta: ESCROW-{uuid}
Signers:
  - COMPRADOR (peso 1)
  - PLATAFORMA (peso 1)
Threshold de pago: 2 (ambos)
```

- **Checkout:** el comprador envía P$ a esta cuenta (fee-bump patrocinado por la plataforma). Estado `funded`.
- **COMMIT:** el QR del vendedor (encode del `escrowId` + nonce escaneado por el comprador) → la API valida y pasa a `pending-verification`, arranca el TTL.
- **Rama A (accepted):** comprador confirma → la plataforma firma → doble firma → tx de pago: escrow → vendedor (− comisión) y escrow → treasury (comisión). Estado `released`.
- **Rama B (auto-resolve):** cron/job revisa `ttlExpiresAt` vencidos → la plataforma firma sola (con prueba de timestamp) → mismo split de pago. Estado `auto-released`.
- **Rama C (disputed):** reporte ANTES del TTL → se detiene el temporizador, no se toca el dinero. Estado `disputed`. (En MVP: mensaje "Nuestro equipo revisará la evidencia en <24h"; sin resolución real.)

### 4.2 TTL (Time-To-Live)

```typescript
// lib/escrow.ts
const DEFAULT_TTL_HOURS = 48;
// Demo: process.env.DEMO_FAST_TIMEOUT === 'true' → 5 minutos
export const TTL_MS = (process.env.DEMO_FAST_TIMEOUT === 'true'
  ? 5 * 60 * 1000
  : DEFAULT_TTL_HOURS * 60 * 60 * 1000);

export function ttlExpiry(committedAt: Date): Date {
  return new Date(committedAt.getTime() + TTL_MS);
}
```

### 4.3 Comisión

```typescript
const PLATFORM_FEE_BPS = 200; // 2%. Hackathon: 0 (ver .env)
export function calculateFee(amount: number): number {
  if (process.env.HACKATHON_FREE_FEES === 'true') return 0;
  return Math.round((amount * PLATFORM_FEE_BPS) / 10000 * 1e6) / 1e6;
}
// 750 P$ → fee 15 P$ → vendedor recibe 735 P$
```

### 4.4 Recibo (memo Stellar)

```
memo_text: "PT-{escrowIdShort}-{sha256(escrowId|buyer|seller|amount).slice(0,16)}"
```
Visible en stellar.expert en el historial de ambas wallets → prueba pública e inmutable.

### 4.5 Máquina de estados del escrow

```
                    [Checkout: comprador paga]
                             │
                             ▼
                         FUNDED
                             │  [cualquiera cancela antes del COMMIT → REFUNDED]
          [Encuentro: comprador escanea QR del vendedor]
                             │
                             ▼
               PENDING_VERIFICATION  (TTL 48h corriendo)
                  │            │            │
   [Aceptar]       │   [TTL=0]  │  [Reportar fallo]
                  │            │            │
                  ▼            ▼            ▼
              RELEASED    AUTO_RELEASED   DISPUTED
              (Rama A)     (Rama B)       (Rama C, congelado)
```

### 4.6 API routes

```typescript
// app/api/escrow/checkout/route.ts        POST — comprar: fundear multi-sig (SendModal client + submit server)
// app/api/escrow/commit/route.ts          POST — escanear QR: {escrowId, nonce} → pending-verification + TTL
// app/api/escrow/accept/route.ts          POST — Rama A: liberar al vendedor (resta comisión)
// app/api/escrow/report-fault/route.ts    POST — Rama C: congelar → disputed
// app/api/escrow/timeout-check/route.ts   GET  — cron: auto-resolve TTL vencidos
// app/api/escrow/cancel/route.ts          POST — reembolso antes del COMMIT
// app/api/valuation/route.ts              POST — simulador de tasación (local + LLM si hay red)
// app/api/buyback/quote/route.ts          POST — cotización de compra plataforma
// app/api/buyback/accept/route.ts         POST — aceptar oferta, agenda inspección
// app/api/credit/welcome/route.ts         POST — 500 P$ al primer login (server-side, de treasury)
// app/api/reset-demo/route.ts             POST — reset seed + saldos (solo dev)
```

---

## 5. IA de tasación (engine híbrido — CORE)

### 5.1 Arquitectura

```
Entrada: título / descripción / tipo / condición / antigüedad
        │
        ▼
┌─────────────────────────────┐
│ Módulo LOCAL (siempre)      │
│ · referencePrices.ts (DB)   │
│ · depreciation.ts (reglas)  │
│ → rango justo base +        │
│   comparables de la DB      │
└─────────────────────────────┘
        │
        ▼ ¿LLM habilitado y con red?
┌─────────────────────────────┐
│ Módulo LLM (opcional)       │
│ · Claude/GPT: "dame rango   │
│   de mercado para X con     │
│   fuentes"                  │
│ → enriquece rango y         │
│   "miradas" si coherente    │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Salida                      │
│ · fairPriceMin/Max          │
│ · mediana                   │
│ · comparables[3+]           │
│ · badge (green/yellow/red)  │
│ · rationale (texto)         │
│ · llmUsed: boolean          │
└─────────────────────────────┘
```

### 5.2 Módulo local (base determinista — garantiza el demo)

```typescript
// lib/valuation/referencePrices.ts
interface ReferencePrice {
  keywords: string[];           // matcheo por tokens del título
  type: ListingType;
  marketMin: number;            // MXN de referencia (2026)
  marketMax: number;
  source: string;               // ej. "Mercado Libre MX promedio"
  hint?: string;                // ej. "TI-89 Titanium, buena"
}

export const REFERENCE_PRICES: ReferencePrice[] = [
  { keywords: ['ti-89', 'titanium'], type: 'calculadoras', marketMin: 650, marketMax: 850, source: 'Mercado Libre MX' },
  { keywords: ['fluke', '117'], type: 'laboratorio', marketMin: 950, marketMax: 1250, source: 'Mercado Libre MX' },
  { keywords: ['arduino', 'mega'], type: 'electronica', marketMin: 380, marketMax: 500, source: 'Mercado Libre MX' },
  { keywords: ['sadiku', 'electromagnetismo'], type: 'libros', marketMin: 250, marketMax: 350, source: 'BookFinder' },
  { keywords: ['spivak'], type: 'libros', marketMin: 500, marketMax: 700, source: 'BookFinder' },
  { keywords: ['tipler', 'física moderna'], type: 'libros', marketMin: 300, marketMax: 400, source: 'BookFinder' },
  { keywords: ['thinkpad', 'x1'], type: 'electronica', marketMin: 7800, marketMax: 9500, source: 'Mercado Libre MX' },
  { keywords: ['raspberry', 'pi 4'], type: 'electronica', marketMin: 900, marketMax: 1200, source: 'Mercado Libre MX' },
  { keywords: ['bata'], type: 'batas-uniformes', marketMin: 180, marketMax: 280, source: 'Amazon MX' },
  { keywords: ['multímetro', 'multimetro'], type: 'laboratorio', marketMin: 170, marketMax: 260, source: 'Mercado Libre MX' },
  { keywords: ['arduino', 'kit'], type: 'electronica', marketMin: 500, marketMax: 650, source: 'Mercado Libre MX' },
  // fallback genérico por tipo
  { keywords: [], type: 'libros', marketMin: 150, marketMax: 400, source: 'BookFinder (promedio)' },
  { keywords: [], type: 'calculadoras', marketMin: 300, marketMax: 700, source: 'Mercado Libre MX' },
  { keywords: [], type: 'electronica', marketMin: 250, marketMax: 900, source: 'Mercado Libre MX' },
  { keywords: [], type: 'batas-uniformes', marketMin: 120, marketMax: 250, source: 'Amazon MX' },
  { keywords: [], type: 'laboratorio', marketMin: 150, marketMax: 400, source: 'Mercado Libre MX' },
  { keywords: [], type: 'otros', marketMin: 100, marketMax: 500, source: 'Mercado Libre MX' },
];
```

```typescript
// lib/valuation/depreciation.ts
// Multiplicadores sobre el rango base según condición y antigüedad
export const CONDITION_FACTOR: Record<Condition, number> = {
  'nuevo': 1.0,
  'como-nuevo': 0.95,
  'bueno': 0.85,
  'aceptable': 0.7,
};
export function depreciationFactor(ageYears: number): number {
  // -4% por año, piso 0.55, techo 1.0
  return Math.max(0.55, 1 - ageYears * 0.04);
}
// range = [base.min * f_cond * f_age, base.max * f_cond * f_age]
```

### 5.3 Módulo LLM (opcional — enriquece si hay red)

```typescript
// lib/valuation/llm.ts
// Solo se llama si AI_ENABLED viaja en true Y hay API key + red.
// Prompt (en español):
//   "Eres un tasador de artículos académicos universitarios en México.
//    Dado esto: {título, tipo, condición, antigüedad} devuelve JSON:
//    {min, max, comparables:[{title, price, source}], rationale}"
// Merge con el módulo local:
//   - Si el rango del LLM cae dentro de una banda de sanity (±40% del local), tomar el del LLM.
//   - Si no, usar el local (para que el demo nunca falle).
//   - llmUsed = true si se usó el LLM.
```

### 5.4 Badge del comprador

```typescript
// lib/valuation/badges.ts
export type Badge = 'green' | 'yellow' | 'red';
export function badgeFor(price: number, [min, max]: [number, number]): Badge {
  const median = (min + max) / 2;
  if (price <= median * 1.05) return 'green';        // precio justo o por debajo
  if (price <= median * 1.15) return 'yellow';       // ligeramente arriba
  return 'red';                                       // sobreprecio
}
```

UI del badge:
```
🟢 Precio justo · mercado $650–850 (14 comparables)
🟡 Algo arriba del mercado ($650–850)
🔴 Sobreprecio · mercado $650–850 — considera ofertas similares
```
Siempre muestra el enlace "¿Cómo se calcula?" → explica rango, fuente, y si el LLM participó.

### 5.5 Oferta de compra de la plataforma (buyback)

```typescript
// lib/valuation/buyback.ts
export const BUYBACK_RATE = 0.70;              // configurable
export function platformOffer([min, max]: [number, number]): number {
  const median = (min + max) / 2;
  return Math.round(median * BUYBACK_RATE);
}
// rationale de ejemplo:
//   "Rango de mercado para tu situación: $650–850.
//    Mediana: $750. Nuestra oferta = 70% de la mediana = $525,
//    cubriendo nuestro margen de reventa (30%) y el riesgo de
//    inventario. Pagamos al instante al entregar en el campus."
```

### 5.6 Fallo del módulo LLM / sin red

El módulo local siempre responde. La UI distingue:
```
Tasado con IA local · 14 comparables de referencia (2026)
``` 
vs
```
Tasado con IA + verificación web (LLM)
```
La demo nunca se cae por red: el local es lo que se muestra por defecto.

---

## 6. Categorías

Dos ejes independientes (igual que v1, sin cambios):

**Eje 1 — Carrera:** `Ing. en Computación`, `Ing. Eléctrica`, `Ing. Mecánica`, `Matemáticas`, `Física`, `Química`, `Biología`, `Otra` (multi-select por listing).

**Eje 2 — Tipo de item:** `libros`, `calculadoras`, `electronica`, `batas-uniformes`, `laboratorio`, `otros`.

**UI de filtrado** (sticky en el marketplace): dropdown Carrera + dropdown Tipo + checkbox "Solo Venta Oficial" + checkbox "Solo verificados" + búsqueda.

---

## 7. Wireframes (Figma-style text spec)

### 7.1 Auth — "Tu primera transacción segura"

```
┌─────────────────────────────────────┐
│                                     │
│          🐆 PUMATRADE                │
│     Compra y venta universitaria    │
│                                     │
│   Vende lo que ya no usas.          │
│   Compra a precio justo.            │
│   Tu dinero queda protegido hasta   │
│   que PRUEBES el producto.          │
│                                     │
│   🎁 Al registrarte: 500 P$ de      │
│      crédito de bienvenida          │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  🔵  Continuar con Google   │   │
│   └─────────────────────────────┘   │
│                                     │
│   Tu wallet se crea automáticamente.│
│                                     │
└─────────────────────────────────────┘
ESTADOS: default / loading (spinner en botón) / error (toast)
```

### 7.2 Home

```
┌─────────────────────────────────────┐
│ 🐆 PumaTrade         💰 1,250 P$  👤│
├─────────────────────────────────────┤
│  Hola, Juan 👋                      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔍 Comprar                  │    │
│  │ 📤 Vender artículo          │    │
│  │ ⚡ Vender a PumaTrade       │    │
│  │ 🧮 Tasador (IA)             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ─── Para ti (precio justo) ───     │
│  ┌─────────────────────────────┐    │
│  │ [📷 TI-89]  750 P$  🟢      │    │
│  │ Calculadora · María          │    │
│  │ Mercado $650–850             │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ [📷 Bata]   200 P$  🟢       │    │
│  │ Bata CH · Andrea (Oficial)   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ─── Tu actividad ───               │
│  ⏱ 1 escrow activo (TI-89) →       │
│  💬 0 ventas pendientes             │
│                                     │
└─────────────────────────────────────┘
│ 🏠 Inicio  🔍 Buscar  📦 Míos  ⚙️ │
└─────────────────────────────────────┘
```

### 7.3 Marketplace

```
┌─────────────────────────────────────┐
│ Carrera: [Todas ▼] Tipo: [Todos ▼]  │
│ ☐ Oficiales  ☐ Solo verificados     │
│ 🔍 [Buscar...]                      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────┐     │
│ │ [📷 TI-89]     750 P$  🟢   │     │
│ │ Calculadora · María         │     │
│ │ Mercado $650–850 · 14 comp. │     │
│ └─────────────────────────────┘     │
│ ┌─────────────────────────────┐     │
│ │ [📷 ThinkPad] 8,200 P$  🟢   │     │
│ │ Electrónica · Sofía          │     │
│ │ Mercado $7,800–9,500        │     │
│ └─────────────────────────────┘     │
│ ┌─────────────────────────────┐     │
│ │ [📷 Kit Arduino]  550 P$ 🟢  │     │
│ │ Electrónica · PumaTrade     │     │
│ │ ⭐ Venta Oficial             │     │
│ └─────────────────────────────┘     │
│ [Cargar más]                        │
└─────────────────────────────────────┘
```

### 7.4 Detalle de listing (comprador)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto]                          │
│                                     │
│  Calculadora TI-89 Titanium         │
│  750 P$                             │
│  🟢 Precio justo · mercado $650–850  │
│  [¿Cómo se calcula?]                │
│                                     │
│  Vendida por María R. · Compu       │
│  ✓ Video de funcionamiento          │
│                                     │
│  ─── Descripción ───                │
│  Sin caja, funciona perfecto.       │
│                                     │
│  ─── Garantía del escrow ───        │
│  1. Pagas: tu dinero queda retenido │
│  2. Te encuentras y escaneas QR     │
│  3. Pruebas 48h → si falla,         │
│     reportas y se congela           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Comprar · 750 P$  →      │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 7.5 Crear listing (con IA de precio)

```
┌─────────────────────────────────────┐
│ ← Cancelar   Publicar artículo      │
├─────────────────────────────────────┤
│  📷 [Subir foto]                    │
│  Título*                            │
│  ┌─────────────────────────────┐    │
│  │ Calculadora TI-89 Titanium  │    │
│  └─────────────────────────────┘    │
│  Descripción*                       │
│  ┌─────────────────────────────┐    │
│  │ Sin caja, funciona perfecto │    │
│  └─────────────────────────────┘    │
│  Tipo* [Calculadoras ▼]             │
│  Carreras* [✓Compu][✓Eléc][✓Mat]    │
│  Condición [Bueno ▼]  Antigüedad [2 ▼]│
│                                     │
│  🤖 Tasar con IA                    │
│  ┌─────────────────────────────┐    │
│  │ Mercado: $650–850           │    │
│  │ Mediana sugerida: 750 P$    │    │
│  │ [Usar sugerencia]           │    │
│  └─────────────────────────────┘    │
│  Precio de venta*                   │
│  ┌─────────────────────────────┐    │
│  │ 750                          │    │
│  └─────────────────────────────┘    │
│  📹 Video de funcionamiento (mock)  │
│  ☑ Acepto verificación manual       │
│  ┌─────────────────────────────┐    │
│  │     Publicar artículo  →     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.6 Simulador de tasación

```
┌─────────────────────────────────────┐
│ 🧮 Tasador IA                       │
├─────────────────────────────────────┤
│  Describe tu artículo               │
│  ┌─────────────────────────────┐    │
│  │ Calculadora TI-89 Titanium  │    │
│  └─────────────────────────────┘    │
│  Tipo [Calculadoras ▼]              │
│  Condición [Buena ▼] Antigüedad [2] │
│  [Tasar con IA →]                   │
│                                     │
│  ─── Resultado ───                  │
│  💰 Rango justo de mercado:         │
│     $650 – $850                     │
│  ⚡ Si vendes a PumaTrade HOY:      │
│     $525 P$ (70% de la mediana)     │
│                                     │
│  ¿Por qué?                          │
│  · 14 comparables en Mercado Libre  │
│    MX (2026): $620–$880             │
│  · Depreciación por 2 años: −5%     │
│  · Condición 'buena': ×0.85         │
│  · LLM verificación web: sí          │
│                                     │
│  [Vender a PumaTrade] [Publicar]    │
└─────────────────────────────────────┘
```

### 7.7 Vender a PumaTrade (buyback)

```
┌─────────────────────────────────────┐
│ ← Atrás   ⚡ Vender a PumaTrade      │
├─────────────────────────────────────┤
│  📷 [Subir foto]                    │
│  Título: [Bata blanca talla CH]     │
│  Tipo [Batas ▼] Condición [Nueva ▼] │
│  Antigüedad [1 año]                 │
│  [Tasar →]                          │
│                                     │
│  ─── Oferta de PumaTrade ───        │
│  Rango justo: $180–280              │
│  Mediana: $230                      │
│  Nuestra oferta: 161 P$  (70%)      │
│  [¿Cómo calculamos esto?]           │
│                                     │
│  ─── Cómo funciona ───              │
│  1. Aceptas la oferta               │
│  2. Entregas en el punto del campus │
│     (CIA / Edificio M)              │
│  3. Verificamos y te pagamos        │
│     al instante en P$               │
│                                     │
│  [Aceptar oferta · 161 P$ →]        │
└─────────────────────────────────────┘
```

### 7.8 Escrow — detalle (comprador, estado FUNDED)

```
┌─────────────────────────────────────┐
│ 🔒 Escrow activo                    │
├─────────────────────────────────────┤
│  Comprando: TI-89 Titanium          │
│  A: María R.                        │
│  Monto retenido: 750 P$             │
│                                     │
│  Estado: 🟡 FUNDED                  │
│  "Tu pago está retenido. Nos falta  │
│   el encuentro."                    │
│                                     │
│  ─── Siguiente paso ───             │
│  Coordina con María:                │
│  📍 Punto seguro: Edificio M,       │
│     planta baja, 12:00 hrs          │
│                                     │
│  [Ver QR de este escrow]            │
│  (el vendedor lo muestra para que   │
│   escanees al recibir el objeto)    │
│                                     │
│  ─── Técnico ───                    │
│  Cuenta escrow: GABC...XYZ          │
│  [Ver en stellar.expert ↗]          │
│  [Cancelar compra → reembolso]      │
│                                     │
└─────────────────────────────────────┘
```

### 7.9 Escaneo QR — Fase 1 COMMIT

```
┌─────────────────────────────────────┐
│ ← Atrás   Confirmar encuentro       │
├─────────────────────────────────────┤
│                                     │
│  Escanea el QR del vendedor         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        ┌─────────┐          │    │
│  │        │ ░░▒▒▓▓  │          │    │
│  │        │ QR CODE │          │    │
│  │        └─────────┘          │    │
│  │   (cámara)                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Recibiste el objeto físico y       │
│  escaneaste el QR del vendedor.     │
│  Esto arranca tu ventana de prueba  │
│  de 48h.  El dinero sigue retenido. │
│                                     │
│  [No reconocí el QR — abrir          │
│   soporte]                          │
└─────────────────────────────────────┘
```

### 7.10 Ventana de prueba — GRACE (comprador)

```
┌─────────────────────────────────────┐
│ 🔒 Escrow · Ventana de prueba       │
├─────────────────────────────────────┤
│  Estado: 🟢 PRUEBA ACTIVA           │
│                                     │
│  ⏱ Tiempo restante:                │
│  ┌─────────────────────────────┐    │
│  │  ⏳ 47 : 59 : 32            │    │
│  │   TTL cuenta regresiva       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ¿Funciona la TI-89?                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ✅ Aceptar artículo        │    │
│  │  → libera 750 P$ a María    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚠️ Reportar fallo          │    │
│  │  → congela el escrow (si    │    │
│  │    faltan +24h de plazo)    │    │
│  └─────────────────────────────┘    │
│                                     │
│  💡 Si no haces nada, al llegar     │
│  a 00:00 el pago se libera solo     │
│  al vendedor (evita secuestro).     │
└─────────────────────────────────────┘
```

### 7.11 Recibo final

```
┌─────────────────────────────────────┐
│ ✅ ¡Listo!                          │
│                                     │
│  TI-89 Titanium vendida             │
│  (María) · 735 P$ recibidos         │
│                                     │
│  ─── Resumen ───                    │
│  Precio:            750 P$          │
│  Comisión (2%):    −15 P$           │
│  Total:             735 P$          │
│                                     │
│  ─── Recibo (Stellar) ───           │
│  Tx: def456...ab                     │
│  Memo: PT-abc1-9f3e...              │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  Saldo: 1,485 P$ (María)            │
│        1,250 P$ (Juan)              │
│                                     │
└─────────────────────────────────────┘
```

### 7.12 Configuración / wallet

```
┌─────────────────────────────────────┐
│ 👤 Juan P. · juan@unam.mx           │
│ Ing. Eléctrica                      │
│                                     │
│  Saldo: 💰 2,000 P$ [Actualizar]    │
│  Dirección: GABC...XYZ [Copiar]     │
│  [Historial de transacciones]       │
│  [Depositar saldo — próximamente]   │
│                                     │
│  Crédito de bienvenida: ✓ 500 P$    │
│  Notificaciones: [●]                │
│  [Cerrar sesión]                    │
│  v0.2.0 · Stellar Testnet           │
└─────────────────────────────────────┘
```

---

## 8. Seed data

### 8.1 `seed.json` (resumen; archivo completo junto al código)

```jsonc
{
  "users": [
    { "id": "usr_maria",  "email": "maria@unam.mx",  "displayName": "María R.",  "major": "Ing. en Computación", "balancePumaDolar": 750  },
    { "id": "usr_juan",   "email": "juan@unam.mx",   "displayName": "Juan P.",   "major": "Ing. Eléctrica",      "balancePumaDolar": 2000 },
    { "id": "usr_andrea", "email": "andrea@unam.mx", "displayName": "Andrea L.", "major": "Matemáticas",         "balancePumaDolar": 600  },
    { "id": "usr_pablo",  "email": "pablo@unam.mx",  "displayName": "Pablo M.",  "major": "Física",              "balancePumaDolar": 500  },
    { "id": "usr_sofia",  "email": "sofia@unam.mx",  "displayName": "Sofía C.",  "major": "Ing. en Computación", "balancePumaDolar": 1800 },
    { "id": "usr_platform", "email": "oficial@pumatrade.mx", "displayName": "PumaTrade Oficial",
      "major": "Otra", "isPlatform": true, "balancePumaDolar": 5000 }
  ],
  "listings": [
    { "id": "lst_ti89",   "sellerId": "usr_maria",  "title": "Calculadora TI-89 Titanium", "pricePumaDolar": 750,  "type": "calculadoras", "videoVerified": true, "ai": { "min": 650, "max": 850, "badge": "green" } },
    { "id": "lst_fluke",  "sellerId": "usr_maria",  "title": "Multímetro Fluke 117",        "pricePumaDolar": 1100, "type": "laboratorio",   "videoVerified": true, "ai": { "min": 950, "max": 1250, "badge": "green" } },
    { "id": "lst_bata_m", "sellerId": "usr_maria",  "title": "Bata blanca talla M",         "pricePumaDolar": 200,  "type": "batas-uniformes","videoVerified": true, "ai": { "min": 180, "max": 280, "badge": "green" } },
    { "id": "lst_arduino","sellerId": "usr_juan",   "title": "Arduino Mega 2560",           "pricePumaDolar": 420,  "type": "electronica",   "videoVerified": true, "ai": { "min": 380, "max": 500, "badge": "green" } },
    { "id": "lst_sadiku", "sellerId": "usr_juan",   "title": "Sadiku — Electromagnetismo",  "pricePumaDolar": 280,  "type": "libros",        "videoVerified": true, "ai": { "min": 250, "max": 350, "badge": "green" } },
    { "id": "lst_spivak", "sellerId": "usr_andrea", "title": "Cálculo de Spivak (3ra ed.)",  "pricePumaDolar": 550,  "type": "libros",        "videoVerified": true, "ai": { "min": 500, "max": 700, "badge": "green" } },
    { "id": "lst_tipler", "sellerId": "usr_pablo",  "title": "Tipler — Física Moderna",     "pricePumaDolar": 320,  "type": "libros",        "videoVerified": true, "ai": { "min": 300, "max": 400, "badge": "green" } },
    { "id": "lst_thinkpad","sellerId": "usr_sofia","title": "ThinkPad X1 Carbon (i7,16GB)", "pricePumaDolar": 8200, "type": "electronica",   "videoVerified": true, "ai": { "min": 7800, "max": 9500, "badge": "green" } },
    { "id": "lst_raspi",  "sellerId": "usr_sofia",  "title": "Raspberry Pi 4 8GB",          "pricePumaDolar": 1000, "type": "electronica",   "videoVerified": true, "ai": { "min": 900, "max": 1200, "badge": "green" } },
    { "id": "lst_kit_arduino", "sellerId": "usr_platform", "sellerKind": "platform",
      "title": "Kit Arduino Starter (reacondicionado)", "pricePumaDolar": 550,
      "type": "electronica", "videoVerified": true, "ai": { "min": 500, "max": 650, "badge": "green" } },
    { "id": "lst_dt830b", "sellerId": "usr_platform", "sellerKind": "platform",
      "title": "Multímetro DT830B (reacondicionado)", "pricePumaDolar": 190,
      "type": "laboratorio", "videoVerified": true, "ai": { "min": 170, "max": 230, "badge": "green" } }
  ]
}
```

### 8.2 Botón "Reset demo data"

Settings → "Resetear demo" (solo dev): limpia DB, recarga seed, resetea saldos en Pollar vía API server-side.

---

## 9. Modelo de ingresos

| Fuente | Cómo se cobra (en código) |
|---|---|
| **Comisión de escrow (P2P)** | 2% sobre el P$ liberado (Rama A o B), deducido en la tx de release. `PLATFORM_FEE_BPS = 200`. Hackathon: 0%. |
| **Margen de reventa (buyback/venta oficial)** | La plataforma compra al 70% de la mediana justa y revende dentro del rango justo. El spread (≈30%) es el margen. |
| **Crédito de bienvenida (demo)** | 500 P$ por usuario, server-side desde treasury. No es ingreso; es costo de adquisición del demo. |
| **Futuro: on-ramp fiat** | SEP-24 de Pollar (`RampWidget`) para depositar saldo real. Se cobra el spread del anchor. |

---

## 10. Stack y arquitectura

### 10.1 Dependencias

```json
{
  "dependencies": {
    "next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0", "typescript": "^5.4.0",
    "@pollar/core": "^0.11.3", "@pollar/react": "^0.11.3",
    "@stellar/stellar-sdk": "^11.0.0",
    "tailwindcss": "^3.4.0", "zustand": "^4.5.0", "zod": "^3.23.0",
    "@prisma/client": "^5.15.0", "lucide-react": "^0.400.0", "date-fns": "^3.6.0",
    "html5-qrcode": "^2.3.8"
  },
  "devDependencies": {
    "prisma": "^5.15.0", "@types/node": "^20.0.0", "@types/react": "^18.3.0",
    "eslint": "^8.57.0", "prettier": "^3.3.0"
  }
}
```

### 10.2 Estructura de carpetas

```
.
├── app/
│   ├── layout.tsx                  # PollarProvider
│   ├── page.tsx                    # Auth
│   ├── home/page.tsx
│   ├── marketplace/page.tsx        # + filtros
│   ├── marketplace/[listingId]/page.tsx
│   ├── create/page.tsx             # crear listing (+IA precio)
│   ├── valuer/page.tsx             # simulador de tasación
│   ├── buyback/page.tsx            # vender a PumaTrade
│   ├── escrow/[escrowId]/page.tsx  # detalle + QR + ventana de prueba
│   ├── escrow/[escrowId]/qr/page.tsx      # QR para escanear (vendedor)
│   ├── escrow/[escrowId]/scan/page.tsx    # escáner (comprador)
│   ├── receipt/[escrowId]/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── escrow/{checkout,commit,accept,report-fault,timeout-check,cancel}/route.ts
│       ├── valuation/route.ts
│       ├── buyback/{quote,accept}/route.ts
│       ├── credit/welcome/route.ts
│       └── reset-demo/route.ts
├── components/{ListingCard,BadgeAI,EscrowTimeline,FilterBar,WalletBadge,QRModal}.tsx
├── lib/
│   ├── db.ts  pollar.ts  stellar.ts  fees.ts  validation.ts
│   └── valuation/{referencePrices,depreciation,engine,llm,badges,buyback}.ts
├── prisma/schema.prisma
├── seed/seed.json
├── public/seed/
└── .env.local
```

### 10.3 Pollar — integración (resumen de v1, sin cambios)

```tsx
// app/layout.tsx
import { PollarProvider } from '@pollar/react';
<PollarProvider client={{ apiKey: process.env.NEXT_PUBLIC_POLLAR_API_KEY!, network: 'stellar' }}>
```

- `<WalletButton>` (header), `usePollar().login()`, `<SendModal>` (checkout), `<TxHistoryModal>` (settings), `refreshBalance()` tras cada acción.
- Server-side: `client.stellar.buildTransaction()` y `submitTransaction()` para escrow multi-sig (funding, release, reembolso), con fee-bump patrocinado por la plataforma.
- **Crédito de bienvenida:** `POST /api/credit/welcome`: 500 P$ desde el treasury a la wallet del usuario (solo una vez, flag `welcomeCreditGranted`).
- **Futuro (documentado):** `RampWidget` de Pollar para depósito fiat en producción.

---

## 11. Setup checklist pre-hackathon

**T-24h:**
- [ ] App en [dashboard.pollar.xyz](https://dashboard.pollar.xyz): Stellar Testnet, G-accounts, funding Immediate, Google auth, API keys
- [ ] Treasury fondeado con USDC testnet (~10,000)
- [ ] 6 wallets seed creadas y fondeadas (5 usuarios + PumaTrade Oficial)
- [ ] Capturar IDs G-... para `seed.json`
- [ ] Probar un send entre dos wallets seed

**T-2h:**
- [ ] `npm install`, `.env.local`, `prisma migrate dev`, `prisma db seed` OK
- [ ] Login Google OK, saldos visibles, listings seed OK
- [ ] Crédito de bienvenida (500 P$) aplica al crear cuenta nueva

**Durante:**
- [ ] Orden de implementación: (1) auth+home, (2) marketplace+badges, (3) crear listing con IA de precio, (4) checkout+escrow FUNDED, (5) QR COMMIT+TTL, (6) accept/timeout/report, (7) recibo, (8) tasador+buyback, (9) reset demo
- [ ] Probar happy path completo en móvil

---

## 12. Backlog post-MVP (la casa)

- **On-ramp fiat:** depósito de saldo real vía SEP-24 (`RampWidget` de Pollar)
- **Negociación (counter-offers):** comprador puede ofrecer un monto distinto; vendedor acepta/rechaza
- **Reputación y ratings** post-transacción
- **Servicios/tutorías** (precio por hora, validación de calidad) — requiere modelo nuevo
- **IA agencial (PumaAgent):** búsqueda en lenguaje natural sobre el catálogo ("busca laptops que me alcancen con 2,000 P$")
- **Resolución real de disputas** (evidencia, mensajería, moderación humana)
- **Foro de nuevo ingreso + guías de materiales** por carrera (link a listings)
- **Escrow de depósitos de renta** para foráneos
- **Pagos en cafeterías de CU** con P$
- **Featured listings** (10–15 P$/semana)
- **Soroban smart contract real** para el escrow (sustituir multi-sig) cuando se vaya a mainnet
- **App nativa** (React Native; `@pollar/core` ya tiene adaptadores)
- **Chat en app** para coordinar encuentros

---

## 13. Demo script (3 minutos)

**Setup:** teléfono de Juan (comprador, saldo 2,000 P$) y laptop con stellar.expert de respaldo. Se asume estados ya avanzados o se hacen en vivo “modo demo rápido” (TTL de 5 min).

```
[0:00–0:30] PROBLEMA
"Cada semestre gastamos miles de pesos en libros, calculadoras, componentes…
que al terminar quedan arrumbados. Y comprar usado es una ruleta rusa:
¿está quemada? ¿me van a estafar? PumaTrade resuelve las dos cosas:
compraventa entre estudiantes con el dinero protegido HASTA que pruebas
el producto — sin que tengas que aprender nada de blockchain."

[0:30–1:00] IA DE PRECIO JUSTO
[Abrir marketplace, mostrar badges]
"Lo primero: cada artículo está tasado contra el mercado real. La TI-89
de María: $650–850 según 14 listados reales. Ella la vende en 750, badge
verde — precio justo. Si alguien la publica al doble, la plataforma lo
marca en rojo. Esta comparación contra precios reales es el corazón
del producto."

[1:00–1:45] COMPRA + ESCROW
[Juan toca Comprar → confirma con Google → FUNDED, mostrar tx en laptop]
"Juan compra. Los 750 P$ quedan retenidos en una cuenta de garantía en
Stellar. Aquí está la transacción en vivo en stellar.expert. Ni Juan ni
María pueden gastar ese dinero todavía."

[1:45–2:30] ENCUENTRO + PRUEBA (COMMIT / GRACE)
[Simular encuentro: María muestra QR, Juan escanea → TTL]
"Se encuentran en la facultad. Juan recibe la calculadora y escanea el QR
de María — eso abre su ventana de prueba de 48 horas. El dinero sigue
congelado.

[Mostrar countdown]
Ahora viene la magia: Juan puede (1) aceptar el artículo, (2) reportar
que está dañado, o (3) simplemente NO hacer nada. Si no hace nada, al
llegar el tiempo a cero el sistema libera el pago automáticamente —
así nadie puede secuestrar los fondos de María."

[2:30–3:00] RELEASE + RECIBO
[Juan toca Aceptar → mostrar release, 735 P$ a María, comisión]
"Juan la probó y funciona. Toca 'Aceptar artículo' y el pago se libera:
735 P$ para María (2% se queda en la plataforma). Recibo público en
Stellar, saldos actualizados al instante.

Y si María tuviera prisa por saldo, puede vender directo a PumaTrade:
la tasa la IA contra el mercado en segundos. Ventas P2P seguras +
liquidez instantánea + precio justo, todo sin saber qué es blockchain."

[Nota para el presentador: si hay red y LLM configurado, disparar el
tasador una vez y mencionar "tasado con IA + verificación web".]
```

---

## 14. Riesgos conocidos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| LLM no disponible en el demo | Media–alta | El módulo local SIEMPRE responde; badge muestra "IA local" sin romper nada |
| Escaneo QR falla en vivo | Media | Botón manual "Certifico que recibí el objeto" como fallback (mismo efecto que el escaneo) |
| Multi-sig setup tarda | Alta | Cuenta escrow pre-creada como template; clonar por venta |
| TTL 48h no se puede probar | Baja | `DEMO_FAST_TIMEOUT=true` → TTL de 5 min |
| SendModal Pollar en mobile Safari | Baja | Probar en Chrome; tener Chrome como backup |
| Saldos desincronizados | Media | `refreshBalance()` tras cada acción |
| Tx no visible al instante en explorer | Alta | Esperar 5–10s; tener un tx ya visible de backup |
| Wallets seed no listas | Media | Plan B: 2 wallets + 3 listings dummy |
| Comisión rompe flujo visual | Baja | Hackathon: comisión en 0 (`HACKATHON_FREE_FEES=true`) |

---

## 15. Glosario

- **PumaDolar (P$):** nombre visual del saldo. 1 P$ = 1 USDC en Stellar testnet. (En textos del equipo a veces aparece como "Pollar" — es el mismo saldo de la app; el SDK se llama Pollar.)
- **Pollar (SDK):** orquestador de pagos de Stellar: wallets embebidas, auth social, modales de enviar/recibir, treasury.
- **Stellar:** blockchain L1; capa de liquidación.
- **Escrow:** retención de fondos condicionada a confirmación.
- **TTL (Time-To-Live):** cuenta regresiva de la ventana de prueba (48h; 5 min en demo).
- **COMMIT:** fase 1 — encuentro físico, escaneo de QR, arranca el TTL.
- **GRACE / ventana de prueba:** fase 2 — el comprador prueba el artículo.
- **Auto-resolve:** Rama B — el TTL expira y el escrow se libera al vendedor.
- **Buyback:** venta de un estudiante a la plataforma (liquidez instantánea).
- **"Venta Oficial":** listing vendido por la plataforma (artículo comprado vía buyback).
- **Seed data:** `seed/seed.json`, datos precargados.
- **"El Ladrillo":** lo que se demuestra en vivo. **"La Casa":** la visión completa post-MVP.

---

**FIN DEL PRD v2.0** — El escrow sigue el modelo COMMIT/GRACE/auto-resolve/dispute, la venta es P2P con buyback opcional, y la IA de tasación es parte del ladrillo, no de la casa.