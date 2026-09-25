# PRD — PumaTrade (Goya-Hack) — MVP "El Ladrillo"

**Versión:** 3.2 — el evento central del escrow es **el intercambio físico de los objetos**
**Fecha:** 2026-09-24
**Estado:** Aprobado para implementación
**Tiempo de implementación:** <24h
**Audiencia del documento:** 1 implementador full-stack + 2 teammates (diseño/pitch)
**Audiencia del producto:** Estudiantes universitarios (UNAM, principalmente FI)

> **El "Ladrillo"**: marketplace de intercambio flexible entre estudiantes, con dinero protegido durante una ventana de prueba. Esta versión contiene el **núcleo funcional** que valida la confianza entre dos alumnos; el resto vive en "La Casa".

---

## 0. Resumen ejecutivo

**PumaTrade** es un marketplace móvil-first donde los estudiantes universitarios pueden **publicar un artículo** y recibir propuestas en **3 formatos** (solo saldo en PumaDolar, objeto por objeto, o una combinación de objeto + saldo). El vendedor **elige la oferta que mejor le conviene** desde un tablero.

**El dinero se congela** en un smart contract (cuenta Stellar multi-sig 2-de-2). Cuando los estudiantes se encuentran en la facultad e **intercambian físicamente los objetos**, registran ese momento en la app. En ese instante arranca una **ventana de prueba (TTL)** — 48h en producción, 3 min en demo — durante la cual el comprador prueba el artículo. Tres caminos posibles:

- **Rama A (happy path):** funciona → comprador acepta → el pago se libera al vendedor.
- **Rama B (auto-resolve):** el comprador no confirma → el TTL expira → el sistema libera automáticamente al vendedor (evita que un comprador malicioso secuestros los fondos).
- **Rama C (disputa):** algo está mal → comprador reporta con evidencia antes del TTL → el escrow se congela para revisión.

**Diferenciadores del MVP:**

1. **Intercambio flexible, no solo venta** — la diferencia de valor entre dos artículos se cubre con PumaDolar.
2. **Tablero de ofertas múltiples** — el vendedor ve todas las propuestas y elige.
3. **El intercambio físico es el evento central** — la confianza se construye alrededor del momento en que los objetos cambian de manos, no alrededor de un QR o un botón abstracto.
4. **Candado con ventana de prueba** — TTL configurable (48h en producción, 3 min en demo) + auto-resolve a favor del vendedor + rama de disputa con evidencia.

**Stack:** Next.js 14 + `@pollar/react` + Stellar testnet (USDC como PumaDolar).

**Ingresos:** 2% de comisión sobre el saldo PumaDolar liberado (0% en hackathon).

---

## 1. Personas (5 usuarios seed)

Se crean en el dashboard de Pollar ANTES del hackathon y se siembran en la DB local. Saldos fondeados desde el treasury de la app.

### 1.1 María — `maria@unam.mx` (vendedora con varias ofertas)
- **Carrera:** Ing. en Computación, 5º semestre
- **Saldo:** 1,250 P$
- **Listings (3):**
  1. **Calculadora TI-89 Titanium** — 800 P$ — ✓ verificado.
  2. **Multímetro Fluke 117** — 1,200 P$ — ✓ verificado.
  3. **Bata blanca talla M** — 250 P$ — ✓ verificado.

### 1.2 Juan — `juan@unam.mx` (comprador técnico)
- **Carrera:** Ing. Eléctrica, 3º semestre
- **Saldo:** 2,000 P$
- **Listings (2):**
  1. **Arduino Mega 2560** — 450 P$ — ✓ verificado.
  2. **Libro Sadiku — Electromagnetismo** — 300 P$ — ✓ verificado.

### 1.3 Andrea — `andrea@unam.mx` (vendedora flexible)
- **Carrera:** Matemáticas, 7º semestre
- **Saldo:** 800 P$
- **Listings (2):**
  1. **Cálculo de Spivak (3ra ed.)** — 600 P$ — ✓ verificado.
  2. **Bata blanca talla CH** — 200 P$ — ✓ verificado.

### 1.4 Pablo — `pablo@unam.mx` (nuevo ingreso)
- **Carrera:** Física, 1º semestre
- **Saldo:** 500 P$
- **Listings (1):**
  1. **Libro Tipler — Física Moderna** — 350 P$ — ✓ verificado.

### 1.5 Sofía — `sofia@unam.mx` (vendedora high-value)
- **Carrera:** Ing. en Computación, 8º semestre
- **Saldo:** 1,800 P$
- **Listings (2):**
  1. **Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)** — 8,500 P$ — ✓ verificado.
  2. **Raspberry Pi 4 Model B 8GB** — 1,100 P$ — ✓ verificado.

**Total:** 10 listings cubriendo 4 majors × 5 tipos.

---

## 2. Modelo de datos

```typescript
// types/db.ts

type Major =
  | 'Ing. en Computación' | 'Ing. Eléctrica' | 'Ing. Mecánica'
  | 'Matemáticas' | 'Física' | 'Química' | 'Biología' | 'Otra';

type ListingType =
  | 'libros' | 'calculadoras' | 'electronica'
  | 'batas-uniformes' | 'laboratorio' | 'otros';

type Condition = 'nuevo' | 'como-nuevo' | 'bueno' | 'aceptable';
type OfferType = 'pollar-only' | 'barter' | 'hybrid';

// Estados del escrow — el evento central es el intercambio físico de los objetos
type EscrowStatus =
  | 'awaiting-funding'        // vendedor aceptó, comprador debe fondear
  | 'funded'                  // fondeado, aún no hay intercambio
  | 'awaiting-exchange'       // una parte registró el intercambio, la otra debe confirmar
  | 'exchange-recorded'       // ambas partes confirmaron → TTL corriendo
  | 'released'                // Rama A: comprador aceptó
  | 'auto-released'           // Rama B: TTL expiró → auto-resolve
  | 'disputed'                // Rama C: comprador reportó
  | 'refunded';               // cancelación antes del intercambio

// Las 3 razones válidas de disputa
type DisputeReason =
  | 'item-damaged'            // el artículo no funciona o tiene defectos
  | 'exchange-never-happened' // el intercambio nunca ocurrió en realidad
  | 'item-different';         // lo recibido no coincide con lo publicado

interface User {
  id: string;
  email: string;
  displayName: string;
  major: Major;
  bio: string;
  pollarWalletId: string;
  balancePumaDolar: number;
  createdAt: string;
}

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  pricePumaDolar: number;
  type: ListingType;
  majors: Major[];
  condition: Condition;
  photoUrl: string;
  videoVerified: boolean;
  status: 'active' | 'paused' | 'sold' | 'removed';
  createdAt: string;
}

interface Offer {
  id: string;
  listingId: string;
  offererId: string;
  type: OfferType;
  offeredItems?: { title: string; estimatedValuePumaDolar: number }[];
  pollarAmount?: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
}

interface Escrow {
  id: string;
  offerId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  pollarAmount: number;          // 0 si es trueque puro
  barterValuePumaDolar?: number;
  stellarEscrowAccount: string;
  stellarTxHashFunding?: string;
  stellarTxHashRelease?: string;
  stellarMemoReceipt?: string;

  status: EscrowStatus;

  // Registro del intercambio físico (evento central)
  exchangeInitiatorId?: string;     // quién tocó primero "Intercambio realizado"
  exchangeInitiatedAt?: string;     // cuándo lo registró
  exchangeConfirmedAt?: string;    // cuándo la otra parte confirmó
  // ttlStartsAt === exchangeConfirmedAt
  ttlExpiresAt?: string;           // ttlStartsAt + TTL

  // Resolución
  acceptedAt?: string;
  autoReleasedAt?: string;
  refundedAt?: string;

  // Disputa
  disputedAt?: string;
  disputeReason?: DisputeReason;
  disputeEvidenceUrl?: string;
  disputeDescription?: string;     // ≤500 chars

  platformFeePumaDolar: number;
  createdAt: string;
}

interface TransactionLog {
  id: string;
  escrowId: string;
  actorId: string;
  action: 'offer-accepted' | 'escrow-funded'
        | 'exchange-initiated' | 'exchange-confirmed'
        | 'accepted' | 'auto-released' | 'disputed' | 'refunded';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface PriceAlert {
  level: 'ok' | 'overpriced';
  marketMin: number;
  marketMax: number;
  sources: { title: string; price: number; source: string }[];
}
```

---

## 3. Flujo de usuario (happy path completo)

```
PASO 1 — Login con Google
   [Pollar crea la wallet automáticamente]

PASO 2 — María publica la TI-89 con video ✓

PASO 3 — Juan (y otros) ofertan
   [Tres ofertas en el tablero de María:
     - Pablo: solo saldo → 750 P$
     - Juan: híbrida → Arduino Mega (450 P$) + 300 P$ = 750 P$
     - Andrea: trueque puro → Spivak (600 P$) — no procede, falta 200 P$
   ]

PASO 4 — María acepta la híbrida de Juan
   [Estado: awaiting-funding]
   [Se crea cuenta multi-sig 2-de-2, se notifica a Juan]

PASO 5 — Juan fondea el escrow (CHECKOUT)
   [SendModal de Pollar: 300 P$]
   [Tx visible en stellar.expert]
   [Estado: funded]

PASO 6 — Se encuentran en la facultad e intercambian
   [María entrega la TI-89. Juan la recibe.]
   [María toca "Intercambio realizado" en su app]
   [Estado → awaiting-exchange · Juan ve la notificación]
   [Juan toca "Sí, confirmo el intercambio"]
   [Estado → exchange-recorded · arranca el TTL: 48h prod, 3 min demo]

PASO 7 — Juan prueba la calculadora (Fase 2: GRACE)

   -> RAMA A (happy): funciona bien → toca "Aceptar artículo"
      [Estado: released · 300 P$ − 6 P$ (2%) = 294 P$ para María]

   -> RAMA B (auto-resolve): Juan no confirma → TTL a cero
      [Estado: auto-released · 294 P$ para María]

   -> RAMA C (disputa): algo está mal → toca "Reportar problema"
      [Elige razón: dañado / nunca ocurrió / item diferente]
      [Sube foto + razón ≤500 chars]
      [TTL se cancela · estado: disputed · fondos congelados]

PASO 8 — Recibo
   [Tx hash + memo receipt en stellar.expert]
   [Saldos actualizados]
```

---

## 4. Mecánica del escrow

### 4.1 Smart contract = cuenta Stellar multi-sig 2-de-2

```
Cuenta: ESCROW-{uuid}
Signers:
  - COMPRADOR (peso 1)
  - PLATAFORMA (peso 1)
Threshold: 2
```

### 4.2 TTL (Time-To-Live)

```typescript
// lib/escrow.ts
const DEFAULT_TTL_MINUTES = 48 * 60; // 2880 min = 48h (producción)
// Demo: DEMO_TTL_MINUTES=3 → 3 minutos

export const TTL_MINUTES = (() => {
  if (process.env.DEMO_TTL_MINUTES) return parseInt(process.env.DEMO_TTL_MINUTES, 10);
  if (process.env.DEMO_FAST_TIMEOUT === 'true') return 3;
  return DEFAULT_TTL_MINUTES;
})();

export function ttlExpiry(exchangeConfirmedAt: Date): Date {
  return new Date(exchangeConfirmedAt.getTime() + TTL_MINUTES * 60 * 1000);
}
```

### 4.3 Estados del escrow

```
                  [Oferta aceptada]
                        │
                        ▼
                awaiting-funding
                        │
              [Comprador fondea vía SendModal]
                        │
                        ▼
                     funded ────────────────────┐
                        │                        │  [cualquiera cancela]
                        │                        ▼
   [Una parte registra el intercambio]         refunded
                        │
                        ▼
              awaiting-exchange
                        │
              [La otra parte confirma]
                        │
                        ▼
            exchange-recorded (TTL corriendo)
                │           │            │
   [Aceptar]    │   [TTL=0] │  [Reportar problema con evidencia]
                │           │            │
                ▼           ▼            ▼
             released   auto-released  disputed
             (Rama A)   (Rama B)      (Rama C, congelado)
```

### 4.4 El momento del intercambio (evento central)

El TTL no arranca por un QR, una cámara o un gesto técnico. Arranca porque **los objetos cambiaron de manos** — y ambas partes lo reconocen.

**Registro simétrico:**

1. Cualquiera de las dos partes toca **"Intercambio realizado"** en su app (en su pantalla de escrow `funded`).
2. El estado pasa a `awaiting-exchange`. La otra parte recibe una notificación push: *"{Nombre} registró que hicieron el intercambio. ¿Confirmas?"*
3. La otra parte tiene dos opciones:
   - **"Sí, confirmar intercambio"** → estado `exchange-recorded`, arranca el TTL.
   - **"No, eso no pasó"** → se abre inmediatamente Rama C con razón `exchange-never-happened`.

```typescript
// POST /api/escrow/record-exchange
{ escrowId, initiator: 'buyer' | 'seller' }
// → status = awaiting-exchange, exchangeInitiatorId + exchangeInitiatedAt set

// POST /api/escrow/confirm-exchange
{ escrowId, confirmerId }
// Valida que confirmer sea la otra parte
// → status = exchange-recorded, ttlStartsAt = exchangeConfirmedAt, ttlExpiresAt = ttlExpiry(now)
```

**Auditoría:** el `TransactionLog` distingue quién inició y quién confirmó, con timestamps separados. Si alguna vez hay una investigación, queda claro quién hizo qué.

### 4.5 Resolución

**Rama A — Accept (`POST /api/escrow/accept`):**
- Comprador toca "Aceptar artículo" mientras está en `exchange-recorded`
- Plataforma firma + comprador firma → tx Stellar: escrow → vendedor (− comisión) + escrow → treasury (comisión)
- Estado: `released`

**Rama B — Auto-resolve (`GET /api/escrow/timeout-check`, llamado por cron cada 30s):**
- Encuentra escrows donde `ttlExpiresAt < NOW()` y status = `exchange-recorded`
- Plataforma firma con timestamp (verificable en el ledger de Stellar)
- Tx Stellar: igual a Rama A
- Estado: `auto-released`

**Rama C — Disputa (`POST /api/escrow/dispute`):**
- Comprador toca "Reportar problema" mientras está en `exchange-recorded` (o `awaiting-exchange` si eligió "no, eso no pasó")
- Elige razón de una de las 3 opciones:
  - **`item-damaged`**: el artículo tiene defectos o no funciona
  - **`exchange-never-happened`**: el intercambio nunca ocurrió
  - **`item-different`**: lo recibido no es lo publicado
- Sube 1 foto (obligatoria) + descripción ≤500 chars
- TTL se cancela
- Estado: `disputed`
- Aparece en la cola de disputas en `/admin/disputes` para revisión manual

### 4.6 Comisión

```typescript
// lib/fees.ts
const PLATFORM_FEE_BPS = 200; // 2%. Hackathon: 0
export function calculateFee(amount: number): number {
  if (process.env.HACKATHON_FREE_FEES === 'true') return 0;
  return Math.round((amount * PLATFORM_FEE_BPS) / 10000 * 1e6) / 1e6;
}
// 300 P$ → fee 6 P$ → María recibe 294 P$
```

### 4.7 Memo receipt (Stellar)

```
memo_text: "PT-{escrowIdShort}-{sha256(escrowId|buyerId|sellerId|amount).slice(0,16)}"
```

Visible en stellar.expert en el historial de ambas wallets.

### 4.8 API routes

```typescript
// app/api/escrow/accept-offer/route.ts   POST — vendedor acepta oferta → crea escrow
// app/api/escrow/fund/route.ts           POST — comprador fondea multi-sig (SendModal)
// app/api/escrow/record-exchange/route.ts POST — una parte registra el intercambio → awaiting-exchange
// app/api/escrow/confirm-exchange/route.ts POST — la otra parte confirma → exchange-recorded + TTL
// app/api/escrow/accept/route.ts         POST — Rama A: liberar al vendedor (resta comisión)
// app/api/escrow/timeout-check/route.ts  GET  — cron: auto-resolve TTL vencidos
// app/api/escrow/dispute/route.ts        POST — Rama C: evidencia + congelar
// app/api/escrow/cancel/route.ts         POST — reembolso antes del intercambio
// app/api/disputes/route.ts              GET  — cola de disputas para admin
// app/api/offers/route.ts                POST — crear oferta
// app/api/listings/route.ts              POST — crear listing
// app/api/price-alert/route.ts           POST — alerta de sobreprecio
// app/api/reset-demo/route.ts            POST — reset seed + saldos (solo dev)
```

---

## 5. Alerta de precios (IA básica)

```typescript
// lib/priceAlert/referencePrices.ts
interface RefPrice {
  keywords: string[];
  type: ListingType;
  marketMin: number;
  marketMax: number;
  source: string;
}
export const REFERENCE_PRICES: RefPrice[] = [
  { keywords: ['ti-89', 'titanium'],  type: 'calculadoras',    marketMin: 650,  marketMax: 850,  source: 'Mercado Libre MX' },
  { keywords: ['fluke', '117'],       type: 'laboratorio',     marketMin: 950,  marketMax: 1250, source: 'Mercado Libre MX' },
  { keywords: ['arduino', 'mega'],    type: 'electronica',     marketMin: 380,  marketMax: 500,  source: 'Mercado Libre MX' },
  { keywords: ['sadiku'],             type: 'libros',          marketMin: 250,  marketMax: 350,  source: 'BookFinder' },
  { keywords: ['spivak'],             type: 'libros',          marketMin: 500,  marketMax: 700,  source: 'BookFinder' },
  { keywords: ['tipler'],             type: 'libros',          marketMin: 300,  marketMax: 400,  source: 'BookFinder' },
  { keywords: ['thinkpad', 'x1'],     type: 'electronica',     marketMin: 7800, marketMax: 9500, source: 'Mercado Libre MX' },
  { keywords: ['raspberry'],          type: 'electronica',     marketMin: 900,  marketMax: 1200, source: 'Mercado Libre MX' },
  { keywords: ['bata'],               type: 'batas-uniformes', marketMin: 180,  marketMax: 280,  source: 'Amazon MX' },
  { keywords: [], type: 'libros',          marketMin: 150, marketMax: 400, source: 'BookFinder' },
  { keywords: [], type: 'calculadoras',    marketMin: 300, marketMax: 700, source: 'Mercado Libre MX' },
  { keywords: [], type: 'electronica',     marketMin: 250, marketMax: 900, source: 'Mercado Libre MX' },
  { keywords: [], type: 'batas-uniformes', marketMin: 120, marketMax: 250, source: 'Amazon MX' },
  { keywords: [], type: 'laboratorio',     marketMin: 150, marketMax: 400, source: 'Mercado Libre MX' },
  { keywords: [], type: 'otros',           marketMin: 100, marketMax: 500, source: 'Mercado Libre MX' },
];
```

```typescript
// lib/priceAlert/engine.ts
export function checkPrice(title: string, type: ListingType, price: number): PriceAlert {
  const match = REFERENCE_PRICES.find(r =>
    r.type === type && (r.keywords.length === 0 || r.keywords.every(k => title.toLowerCase().includes(k)))
  );
  if (!match) return { level: 'ok', marketMin: 0, marketMax: Infinity, sources: [] };
  const overpriced = price > match.marketMax;
  return {
    level: overpriced ? 'overpriced' : 'ok',
    marketMin: match.marketMin,
    marketMax: match.marketMax,
    sources: [{ title: `Referencia ${match.source}`, price: (match.marketMin + match.marketMax) / 2, source: match.source }],
  };
}
```

UI:
```
✓ Precio dentro del mercado ($650–850 según 14 listados reales)
⚠ Precio por encima del mercado ($650–850). Sugerencia: ajustar a $750.
```

---

## 6. Categorías

Dos ejes: **Carrera** (multi-select) × **Tipo de item** (libros / calculadoras / electronica / batas-uniformes / laboratorio / otros). UI de filtrado sticky en el marketplace.

---

## 7. Wireframes

### 7.1 Splash / Auth

```
┌─────────────────────────────────────┐
│          🐆 PUMATRADE                │
│     Marketplace Universitario      │
│                                     │
│   Vende, cambia o intercambia      │
│   materiales universitarios.       │
│                                     │
│   Tu dinero queda protegido hasta   │
│   que pruebes el artículo.          │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  🔵  Continuar con Google   │   │
│   └─────────────────────────────┘   │
│                                     │
│   Tu primera wallet se crea         │
│   automáticamente.                  │
└─────────────────────────────────────┘
```

### 7.2 Home

```
┌─────────────────────────────────────┐
│ 🐆 PumaTrade         💰 1,250 P$  👤│
├─────────────────────────────────────┤
│  Hola, María 👋                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📦 3 publicaciones           │    │
│  │ 💬 3 ofertas nuevas          │    │
│  │ 🔒 0 intercambios activos    │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Explorar marketplace →]           │
│                                     │
│  ─── Tus publicaciones (3) ───     │
│  ┌─────────────────────────────┐    │
│  │ [📷 TI-89]    800 P$        │    │
│  │ Calculadora    ✓ verificado  │    │
│  │ 3 ofertas  [Ver tablero →]   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
│ 🏠 Inicio  🔍 Buscar  📦 Míos  ⚙️ │
└─────────────────────────────────────┘
```

### 7.3 Marketplace

```
┌─────────────────────────────────────┐
│ Carrera: [Todas ▼]  Tipo: [Todos ▼] │
│ ☐ Solo verificados                  │
│ 🔍 [Buscar...]                      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────┐     │
│ │ [📷 TI-89]   800 P$         │     │
│ │ Calculadora · María · 3 of.  │     │
│ └─────────────────────────────┘     │
│ ┌─────────────────────────────┐     │
│ │ [📷 ThinkPad] 8,500 P$      │     │
│ │ Electrónica · Sofía · 1 of.  │     │
│ └─────────────────────────────┘     │
│ [Cargar más]                        │
└─────────────────────────────────────┘
```

### 7.4 Detalle de listing — vista vendedor (con tablero)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto]                          │
│  Calculadora TI-89 Titanium         │
│  800 P$ · ✓ Verificado              │
│                                     │
│  ─── Tablero de ofertas (3) ───     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 💵 Compra directa            │    │
│  │ Pablo ofrece: 750 P$          │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🔄 Híbrida (RECOMENDADA)    │    │
│  │ Juan ofrece:                 │    │
│  │   • Arduino Mega (450 P$)    │    │
│  │   • 300 P$ en PumaDolar      │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🎁 Trueque puro              │    │
│  │ Andrea: Spivak (600 P$)      │    │
│  │ ⚠ Falta 200 P$ → no procede  │    │
│  │ [Rechazar]                   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.5 Detalle de listing — vista visitante

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto]                          │
│  Multímetro Fluke 117               │
│  1,200 P$ · ✓ Verificado            │
│                                     │
│  ─── 0 ofertas ───                  │
│  ┌─────────────────────────────┐    │
│  │   Hacer una oferta  →       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.6 Hacer oferta (3 tipos)

```
┌─────────────────────────────────────┐
│ ← Cancelar      Hacer oferta        │
├─────────────────────────────────────┤
│  Ofertando por: TI-89 (800 P$)      │
│                                     │
│  ⦿ Compra directa (solo PumaDolar)  │
│  ○ Trueque puro (objeto por objeto) │
│  ○ Híbrida (objeto + diferencia)    │
│                                     │
│  Cantidad: [1,100] P$               │
│  ℹ Mercado $650–850. Por encima.   │
│                                     │
│  Mensaje: [Hola, me urge...]        │
│  ┌─────────────────────────────┐    │
│  │     Enviar oferta  →         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.7 Detalle de escrow — funded (comprador)

```
┌─────────────────────────────────────┐
│ 🔒 ESCROW ACTIVO                    │
├─────────────────────────────────────┤
│  Comprando: TI-89 Titanium          │
│  A: María R. · Monto: 300 P$        │
│                                     │
│  Estado: 🟡 FUNDED                  │
│  Tu pago está retenido.             │
│  Coordina el encuentro.             │
│                                     │
│  📍 Punto sugerido:                 │
│     Biblioteca central, 12:00 hrs   │
│                                     │
│  Cuando intercambien los objetos,   │
│  toquen "Intercambio realizado"     │
│  para empezar la prueba.            │
│                                     │
│  [Intercambio realizado →]          │
│  [Cancelar → reembolso]             │
│                                     │
│  Cuenta escrow: GABC...XYZ          │
│  [Ver en stellar.expert ↗]          │
└─────────────────────────────────────┘
```

### 7.8 Notificación — la otra parte registró el intercambio

```
┌─────────────────────────────────────┐
│ 🔔 Nueva notificación               │
├─────────────────────────────────────┤
│                                     │
│  María registró que hicieron        │
│  el intercambio.                    │
│                                     │
│  ¿Lo confirmas?                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ✅ Sí, confirmar             │    │
│  │  → empieza la prueba (48h)    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚠️ No, eso no pasó          │    │
│  │  → abrir disputa              │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 7.9 Ventana de prueba — GRACE (comprador)

```
┌─────────────────────────────────────┐
│ 🔒 Escrow · Ventana de prueba       │
├─────────────────────────────────────┤
│  Estado: 🟢 PRUEBA ACTIVA           │
│                                     │
│  ⏱ Tiempo restante:                │
│  ┌─────────────────────────────┐    │
│  │  ⏳ 02 : 58 : 14            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ¿Funciona la TI-89?                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ✅ Aceptar artículo        │    │
│  │  → libera 300 P$ a María    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚠️ Reportar problema        │    │
│  └─────────────────────────────┘    │
│                                     │
│  💡 Si no haces nada, al llegar     │
│  a 00:00 el pago se libera solo     │
│  al vendedor (auto-resolve).        │
└─────────────────────────────────────┘
```

### 7.10 Reportar problema (Rama C) — elegir razón

```
┌─────────────────────────────────────┐
│ ← Atrás   Reportar problema         │
├─────────────────────────────────────┤
│  ⚠ Esto congelará el escrow.       │
│                                     │
│  ¿Qué pasó?                         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔧 El artículo está dañado    │    │
│  │    o no funciona              │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🚫 El intercambio nunca      │    │
│  │    ocurrió                    │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 📦 Lo que recibí no es lo     │    │
│  │    que se publicó             │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.11 Reportar problema — evidencia

```
┌─────────────────────────────────────┐
│ ← Atrás   Reportar problema         │
├─────────────────────────────────────┤
│  Razón seleccionada:                │
│  "El artículo está dañado"          │
│                                     │
│  Foto de evidencia (obligatoria):   │
│  ┌─────────────────────────────┐    │
│  │ 📷 Subir foto                │    │
│  └─────────────────────────────┘    │
│                                     │
│  Describe (máx 500 chars):          │
│  ┌─────────────────────────────┐    │
│  │ La pantalla no enciende,     │    │
│  │ la batería está inflada...   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Enviar reporte  →           │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.12 Recibo final

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│           ✅ ¡Listo!                 │
│     Intercambio completado          │
│                                     │
│  Artículo: TI-89 Titanium           │
│  Comprador: Juan P.                 │
│  Vendedor: María R.                 │
│                                     │
│  Monto: 300 P$                      │
│  Comisión (2%): −6 P$               │
│  María recibió: 294 P$              │
│                                     │
│  ─── Recibo (Stellar) ───           │
│  Tx: def456...ab                     │
│  Memo: PT-abc1-9f3e...              │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  Saldos:                            │
│  María: 1,250 + 294 = 1,544 P$      │
│  Juan:  2,000 − 300 = 1,700 P$      │
└─────────────────────────────────────┘
```

### 7.13 Crear listing

```
┌─────────────────────────────────────┐
│ ← Cancelar   Publicar artículo      │
├─────────────────────────────────────┤
│  📷 [Subir foto]                    │
│  Título [Calculadora TI-89...]      │
│  Descripción [Sin caja, funciona..] │
│  Precio sugerido [800] P$           │
│  ⚠ Mercado: $650–850. OK.           │
│  Tipo [Calculadoras ▼]              │
│  Carreras [✓Compu][✓Eléctrica]      │
│  Condición [Bueno ▼]                │
│  📹 [Subir video de prueba] ✓       │
│  ┌─────────────────────────────┐    │
│  │     Publicar artículo  →     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.14 Settings / Wallet

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  👤 María R.                        │
│  maria@unam.mx                      │
│                                     │
│  Balance: 💰 1,544 P$ [Actualizar]  │
│  Dirección: GABC...XYZ [Copiar]     │
│  [Historial de transacciones]       │
│                                     │
│  ─── Demo ───                       │
│  [Resetear datos demo]              │
│                                     │
│  [Cerrar sesión]                    │
│  v0.3.2 · Stellar Testnet           │
└─────────────────────────────────────┘
```

### 7.15 Admin — cola de disputas

```
┌─────────────────────────────────────┐
│ Admin · Disputas pendientes         │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ ⚠ Disputa #abc              │    │
│  │ TI-89 Titanium · Juan vs María│    │
│  │ Razón: item-damaged          │    │
│  │ Hace 12 min                  │    │
│  │ [Ver evidencia]              │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ ⚠ Disputa #def              │    │
│  │ ThinkPad X1 · Pablo vs Sofía│    │
│  │ Razón: exchange-never-happened│    │
│  │ [Ver evidencia]              │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## 8. Seed data

```jsonc
// seed/seed.json — IDs de wallets Pollar se inyectan al sembrar
{
  "users": [
    { "id": "usr_maria",  "email": "maria@unam.mx",  "displayName": "María R.",  "major": "Ing. en Computación", "balancePumaDolar": 1250 },
    { "id": "usr_juan",   "email": "juan@unam.mx",   "displayName": "Juan P.",   "major": "Ing. Eléctrica",      "balancePumaDolar": 2000 },
    { "id": "usr_andrea", "email": "andrea@unam.mx", "displayName": "Andrea L.", "major": "Matemáticas",         "balancePumaDolar": 800 },
    { "id": "usr_pablo",  "email": "pablo@unam.mx",  "displayName": "Pablo M.",  "major": "Física",              "balancePumaDolar": 500 },
    { "id": "usr_sofia",  "email": "sofia@unam.mx",  "displayName": "Sofía C.",  "major": "Ing. en Computación", "balancePumaDolar": 1800 }
  ],
  "listings": [
    { "id": "lst_ti89",   "sellerId": "usr_maria",  "title": "Calculadora TI-89 Titanium", "pricePumaDolar": 800,  "type": "calculadoras",    "videoVerified": true },
    { "id": "lst_fluke",  "sellerId": "usr_maria",  "title": "Multímetro Fluke 117",        "pricePumaDolar": 1200, "type": "laboratorio",     "videoVerified": true },
    { "id": "lst_bata_m", "sellerId": "usr_maria",  "title": "Bata blanca talla M",         "pricePumaDolar": 250,  "type": "batas-uniformes", "videoVerified": true },
    { "id": "lst_arduino","sellerId": "usr_juan",   "title": "Arduino Mega 2560",           "pricePumaDolar": 450,  "type": "electronica",     "videoVerified": true },
    { "id": "lst_sadiku", "sellerId": "usr_juan",   "title": "Sadiku — Electromagnetismo",  "pricePumaDolar": 300,  "type": "libros",          "videoVerified": true },
    { "id": "lst_spivak", "sellerId": "usr_andrea", "title": "Cálculo de Spivak (3ra ed.)", "pricePumaDolar": 600,  "type": "libros",          "videoVerified": true },
    { "id": "lst_bata_ch","sellerId": "usr_andrea", "title": "Bata blanca talla CH",        "pricePumaDolar": 200,  "type": "batas-uniformes", "videoVerified": true },
    { "id": "lst_tipler", "sellerId": "usr_pablo",  "title": "Tipler — Física Moderna",     "pricePumaDolar": 350,  "type": "libros",          "videoVerified": true },
    { "id": "lst_thinkpad","sellerId":"usr_sofia",  "title": "ThinkPad X1 Carbon (i7,16GB)","pricePumaDolar": 8500, "type": "electronica",     "videoVerified": true },
    { "id": "lst_raspi",  "sellerId": "usr_sofia",  "title": "Raspberry Pi 4 8GB",          "pricePumaDolar": 1100, "type": "electronica",     "videoVerified": true }
  ],
  "offers": [
    { "id": "ofr_pablo_ti89", "listingId": "lst_ti89", "offererId": "usr_pablo",
      "type": "pollar-only", "pollarAmount": 750, "message": "Me serviría mucho.", "status": "pending" },
    { "id": "ofr_juan_ti89_hybrid", "listingId": "lst_ti89", "offererId": "usr_juan",
      "type": "hybrid",
      "offeredItems": [{ "title": "Arduino Mega 2560", "estimatedValuePumaDolar": 450 }],
      "pollarAmount": 300,
      "message": "Oferta final, la hago porque necesito la calculadora.", "status": "pending" },
    { "id": "ofr_andrea_ti89_barter", "listingId": "lst_ti89", "offererId": "usr_andrea",
      "type": "barter",
      "offeredItems": [{ "title": "Cálculo de Spivak (3ra ed.)", "estimatedValuePumaDolar": 600 }],
      "message": "Solo cambiaría si me das efectivo para la diferencia.", "status": "pending" },
    { "id": "ofr_pablo_thinkpad", "listingId": "lst_thinkpad", "offererId": "usr_pablo",
      "type": "pollar-only", "pollarAmount": 8300, "message": "Si me la dejas en 8300 te la compro hoy.", "status": "pending" }
  ]
}
```

---

## 9. Modelo de ingresos

| Fuente | Implementación |
|---|---|
| **Comisión de escrow** | 2% sobre PumaDolar liberado (deducido al release). Hackathon: 0%. |
| **Premium listings (futuro)** | Destacar un artículo: 10–15 P$ / semana. |

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
    "@prisma/client": "^5.15.0", "lucide-react": "^0.400.0", "date-fns": "^3.6.0"
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
│   ├── marketplace/page.tsx
│   ├── marketplace/[listingId]/page.tsx
│   ├── offer/[listingId]/page.tsx
│   ├── escrow/[escrowId]/page.tsx
│   ├── escrow/[escrowId]/report/page.tsx
│   ├── receipt/[escrowId]/page.tsx
│   ├── create/page.tsx
│   ├── settings/page.tsx
│   ├── admin/disputes/page.tsx
│   └── api/
│       ├── escrow/{accept-offer,fund,record-exchange,confirm-exchange,accept,timeout-check,dispute,cancel}/route.ts
│       ├── disputes/route.ts
│       ├── offers/route.ts
│       ├── listings/route.ts
│       ├── price-alert/route.ts
│       └── reset-demo/route.ts
├── components/{ListingCard,OfferCard,EscrowTimeline,FilterBar,WalletBadge,CountdownTimer,DisputeReasonPicker}.tsx
├── lib/
│   ├── db.ts  pollar.ts  stellar.ts  fees.ts  validation.ts
│   ├── escrow.ts
│   ├── cron.ts
│   └── priceAlert/{referencePrices,engine}.ts
├── prisma/schema.prisma
├── seed/seed.json
└── .env.local
```

### 10.3 Variables de entorno

```bash
NEXT_PUBLIC_POLLAR_API_KEY=pk_test_...
POLLAR_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_PLATFORM_FEE_BPS=200
DEMO_TTL_MINUTES=3                  # demo: 3 min; producción: omitir (default 2880)
DEMO_FAST_TIMEOUT=true
HACKATHON_FREE_FEES=true
POLLAR_TREASURY_WALLET_ID=G-...
```

### 10.4 Integración Pollar

```tsx
// app/layout.tsx
import { PollarProvider } from '@pollar/react';
<PollarProvider client={{ apiKey: process.env.NEXT_PUBLIC_POLLAR_API_KEY!, network: 'stellar' }}>
```

- `<WalletButton>` (header), `usePollar().login()`, `<SendModal>` (checkout), `<TxHistoryModal>` (settings), `refreshBalance()` post-acción.
- Server-side: `client.stellar.buildTransaction()` / `submitTransaction()` para funding y release multi-sig.
- Cron: `lib/cron.ts` corre cada 30s vía `setInterval` (Node) o un endpoint `/api/escrow/timeout-check` invocado por Vercel Cron / worker externo.

---

## 11. Setup checklist pre-hackathon

**T-24h:**
- [ ] App en [dashboard.pollar.xyz](https://dashboard.pollar.xyz): Stellar Testnet, G-accounts, funding Immediate, Google auth, API keys
- [ ] Treasury fondeado con USDC testnet (~10,000)
- [ ] 5 wallets seed creadas y fondeadas
- [ ] Capturar `G-...` IDs para `seed.json`
- [ ] Probar send entre dos wallets seed

**T-2h:**
- [ ] `npm install`, `.env.local`, `prisma migrate dev`, `prisma db seed`
- [ ] `DEMO_TTL_MINUTES=3` y `HACKATHON_FREE_FEES=true`
- [ ] Login Google OK, saldos visibles, listings seed visibles
- [ ] Botón "Reset demo data" funciona
- [ ] Cron de timeout-check corriendo

**Durante el hackathon (orden sugerido):**
1. Auth + home + wallet
2. Marketplace + filtros
3. Detalle listing (vendedor y visitante)
4. Hacer oferta (3 tipos)
5. Tablero + aceptar oferta → escrow (awaiting-funding)
6. Fondear escrow (SendModal) → funded
7. Pantalla escrow funded + botón "Intercambio realizado"
8. Notificación + confirmar intercambio → exchange-recorded + TTL
9. Countdown TTL + Aceptar → released + recibo
10. Rama B (auto-resolve): esperar TTL expirar → auto-released
11. Rama C (disputa con evidencia): reporte → disputed (3 razones)
12. Admin /disputes para ver la cola
13. Alerta de precios en crear listing/oferta
14. Reset demo

---

## 12. Backlog post-MVP ("La Casa")

- Tarjeta física NFC (Tangem)
- Pagos de depósitos de renta para estudiantes foráneos
- Pago de comidas en cafeterías con PumaDolar
- Foro comunitario para alumnos de nuevo ingreso
- Compra urgente por la plataforma (buyback)
- Asistente IA completo (búsqueda en lenguaje natural, tasador de depreciación)
- On-ramp fiat (depósito real vía SEP-24)
- Featured listings
- Reputación y ratings post-transacción
- Smart contract Soroban real sustituyendo multi-sig
- App nativa iOS/Android
- Resolución automática de disputas con evidencia + reglas

---

## 13. Demo script (3 minutos)

**Setup previo:** `DEMO_TTL_MINUTES=3`, `HACKATHON_FREE_FEES=true`. Teléfonos de Juan y María precargadas. Laptop con stellar.expert.

```
[0:00–0:30] PROBLEMA
"Cada semestre gastamos miles de pesos en libros, calculadoras,
componentes… que quedan arrumbados. El trueque tradicional falla
porque es difícil encontrar equivalencia exacta. Y comprar usado
es ruleta rusa: ¿está quemado? ¿me van a estafar?

PumaTrade resuelve las dos cosas: intercambio flexible con el
saldo cubriendo la diferencia, y dinero protegido durante una
ventana de prueba."

[0:30–1:00] EL TABLERO
[Abrir como María → ver su TI-89 con 3 ofertas]
"María vende su calculadora. Su tablero muestra tres ofertas.
María elige la híbrida: Juan le da su Arduino valuado en 450
más 300 en PumaDolar. María se lleva un componente que SÍ va a
usar más saldo para el próximo semestre."

[1:00–1:30] CHECKOUT + FUNDED
[Juan compra → SendModal → funded]
"Juan paga los 300 P$ en PumaDolar. Inmediatamente el dinero
se congela en un smart contract — una cuenta multi-sig en
Stellar, aquí está la transacción en vivo. Ni Juan ni María
pueden tocar ese dinero todavía."

[1:30–2:00] EL ENCUENTRO
[Simular encuentro: María entrega, Juan recibe, ambos tocan "Intercambio realizado"]
"Se encuentran en la biblioteca. María entrega la calculadora,
Juan la recibe. Cada uno toca 'Intercambio realizado' en su
app — ese es el momento que registra el contrato. Ahora arranca
la ventana de prueba."

[2:00–2:30] LAS TRES SALIDAS
[Mostrar las 3 opciones]
"Desde aquí Juan tiene tres caminos:
- Funciona → toca Aceptar artículo y se libera el pago.
- Está dañada, no es la correcta, o el intercambio nunca
  ocurrió → sube foto, explica, y el escrow se congela.
- Si no hace nada, al llegar el TTL a cero el sistema libera
  automáticamente. Nadie puede secuestrar los fondos de María."

[2:30–3:00] ACEPTAR + RECIBO
[Juan acepta → mostrar release, recibo, saldos]
"Juan la probó, funciona. Acepta. Mira: 294 P$ para María,
recibo público en Stellar, saldos actualizados al instante.

Eso es PumaTrade: trueque justo, dinero protegido, cero
estafas — sin que tengas que aprender qué es blockchain."

[NOTA: si da tiempo, mencionar la alerta de precios: "Y la
plataforma también cuida que nadie cobre de más: comparamos
cada artículo contra precios reales del mercado."]
```

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Multi-sig setup tarda | Alta | Cuenta Stellar pre-creada como template; clonar por escrow |
| TTL demo muy corto | Baja | `DEMO_TTL_MINUTES=3` da tiempo a explicar y mostrar Rama B |
| Auto-resolve no dispara en vivo | Baja | Cron corre cada 30s; suficiente margen |
| SendModal falla en Safari | Baja | Probar en Chrome; tener Chrome como backup |
| Saldos desincronizados | Media | `refreshBalance()` tras cada acción |
| Tx hash no aparece inmediato en explorer | Alta | Esperar 5–10s; tx de backup visible |
| Wallets seed no listas | Media | Plan B: 2 wallets + 3 listings dummy |
| Comisión rompe el flujo visual | Baja | Hackathon: `HACKATHON_FREE_FEES=true` |
| Una parte no confirma el intercambio | Baja | Cualquiera puede cancelar; reembolso |

---

## 15. Glosario

- **PumaDolar (P$):** saldo de la app. 1 P$ = 1 USDC en Stellar testnet.
- **Pollar (SDK):** infraestructura de wallets embebidas + auth para Stellar.
- **Stellar:** blockchain L1 de liquidación.
- **Escrow:** retención de fondos en cuenta multi-sig 2-de-2.
- **TTL / ventana de prueba:** período entre el intercambio registrado y la resolución (48h prod, 3 min demo).
- **Intercambio registrado:** ambas partes confirman que los objetos cambiaron físicamente de manos → arranca el TTL.
- **Rama A:** comprador acepta → release.
- **Rama B:** TTL expira → auto-resolve a favor del vendedor.
- **Rama C:** comprador reporta (dañado / nunca ocurrió / item diferente) → disputa congelada.
- **Oferta híbrida:** objeto + PumaDolar como diferencia.
- **"El Ladrillo":** lo que se demuestra en el hackathon.
- **"La Casa":** la visión completa post-MVP.

---

**FIN DEL PRD v3.2** — El intercambio físico es el evento central: ambas partes lo registran, el TTL arranca, y de ahí vienen las tres salidas posibles. Listo para implementar.