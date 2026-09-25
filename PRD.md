# PRD — PumaTrade (Goya-Hack) — MVP "El Ladrillo"

**Versión:** 3.0 — alineado con el documento "MVP PumaTrade" del socio
**Fecha:** 2026-09-24
**Estado:** Aprobado para implementación
**Tiempo de implementación:** <24h
**Audiencia del documento:** 1 implementador full-stack + 2 teammates (diseño/pitch)
**Audiencia del producto:** Estudiantes universitarios (UNAM, principalmente FI)

> **El "Ladrillo"**: marketplace de intercambio flexible entre estudiantes, con dinero protegido hasta la verificación presencial. Esta versión contiene el **núcleo funcional** que valida la confianza entre dos alumnos; el resto vive en "La Casa".

---

## 0. Resumen ejecutivo

**PumaTrade** es un marketplace móvil-first para estudiantes universitarios donde puedes **publicar un artículo** y recibir propuestas en **3 formatos** (solo saldo en PumaDolar, objeto por objeto, o una combinación de objeto + saldo). Tú, como vendedor, **eliges la oferta que mejor resuelve tu semestre** desde un tablero.

**El dinero se congela** en un smart contract (cuenta Stellar multi-sig 2-de-2) hasta que ambos se encuentran en la facultad, verifican que el artículo funciona, y **confirman en la app**. Solo entonces se libera el pago al vendedor.

**Diferenciadores del MVP:**

1. **Intercambio flexible, no solo venta** — si tu libro vale $300 y la calculadora del otro vale $800, le das tu libro + 500 P$ de diferencia. PumaDolar cubre el desbalance.
2. **Tablero de ofertas múltiples** — el vendedor no depende de un solo interesado; ve todas las propuestas apiladas y elige.
3. **Candado de seguridad** — el saldo del comprador se retiene hasta la confirmación presencial de ambos.

**Stack:** Next.js 14 + `@pollar/react` (wallets embebidas vía SDK Pollar) + Stellar testnet (USDC como PumaDolar).

**Ingresos:** 2% de comisión sobre el saldo PumaDolar liberado (0% en hackathon).

---

## 1. Personas (5 usuarios seed)

Se crean en el dashboard de Pollar ANTES del hackathon y se siembran en la DB local. Sus balances iniciales se fondean desde el treasury de la app.

### 1.1 María — `maria@unam.mx` (vendedora con varias ofertas)

- **Carrera:** Ing. en Computación, 5º semestre
- **Saldo:** 1,250 P$
- **Bio:** "Cambio de carrera, vendo todo lo de circuitos"
- **Listings (3):**
  1. **Calculadora TI-89 Titanium** — 800 P$ — `Calculadoras` — ✓ verificado. *"Sin caja, pero funciona perfecto."*
  2. **Multímetro Fluke 117** — 1,200 P$ — `Laboratorio` — ✓ verificado. *"Un semestre de uso."*
  3. **Bata blanca talla M** — 250 P$ — `Batas y uniformes` — ✓ verificado. *"Sin usar."*

### 1.2 Juan — `juan@unam.mx` (comprador técnico)

- **Carrera:** Ing. Eléctrica, 3º semestre
- **Saldo:** 2,000 P$
- **Bio:** "Armando mi kit de electrónica"
- **Listings (2):**
  1. **Arduino Mega 2560** — 450 P$ — `Electrónica` — ✓ verificado. *"Con cable USB."*
  2. **Libro Sadiku — Electromagnetismo** — 300 P$ — `Libros` — ✓ verificado.

### 1.3 Andrea — `andrea@unam.mx` (vendedora flexible)

- **Carrera:** Matemáticas, 7º semestre
- **Saldo:** 800 P$
- **Bio:** "Intercambio lo que ya no uso por lo que sí voy a usar"
- **Listings (2):**
  1. **Cálculo de Spivak (3ra ed.)** — 600 P$ — `Libros` — ✓ verificado.
  2. **Bata blanca talla CH** — 200 P$ — `Batas y uniformes` — ✓ verificado.

### 1.4 Pablo — `pablo@unam.mx` (nuevo ingreso)

- **Carrera:** Física, 1º semestre
- **Saldo:** 500 P$
- **Bio:** "Armando mi primer kit"
- **Listings (1):**
  1. **Libro Tipler — Física Moderna** — 350 P$ — `Libros` — ✓ verificado.

### 1.5 Sofía — `sofia@unam.mx` (vendedora high-value)

- **Carrera:** Ing. en Computación, 8º semestre
- **Saldo:** 1,800 P$
- **Bio:** "Tesis terminada, liquidando mi setup"
- **Listings (2):**
  1. **Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)** — 8,500 P$ — `Electrónica` — ✓ verificado. *"Batería dura 4h."*
  2. **Raspberry Pi 4 Model B 8GB** — 1,100 P$ — `Electrónica` — ✓ verificado.

**Total listings seed:** 10 cubriendo 4 majors × 5 tipos.

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

// 3 tipos de oferta que el ofertante puede elegir al proponer
type OfferType = 'pollar-only' | 'barter' | 'hybrid';

interface User {
  id: string;                    // UUID
  email: string;
  displayName: string;
  major: Major;
  bio: string;
  avatarUrl?: string;
  pollarWalletId: string;        // ej. "G-ABC..."
  balancePumaDolar: number;      // cache local; refrescado con Pollar
  createdAt: string;
}

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  pricePumaDolar: number;        // precio sugerido en P$ (referencia, no rígido)
  type: ListingType;
  majors: Major[];               // multi-select: puede aplicar a varias carreras
  condition: Condition;
  photoUrl: string;
  videoVerified: boolean;        // mock: toggle manual "verificado"
  status: 'active' | 'paused' | 'sold' | 'removed';
  createdAt: string;
}

interface Offer {
  id: string;
  listingId: string;
  offererId: string;
  type: OfferType;

  // Para type === 'barter' o 'hybrid'
  offeredItems?: {
    title: string;
    estimatedValuePumaDolar: number;
  }[];

  // Para type === 'pollar-only' o 'hybrid' (parte que el ofertante paga en P$)
  pollarAmount?: number;

  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
}

type EscrowStatus =
  | 'awaiting-funding'           // vendedor aceptó, comprador debe fondear
  | 'funded'                     // fondeado, esperando encuentro
  | 'released'                   // ambos confirmaron → pago liberado
  | 'refunded';                  // cancelación antes de la confirmación

interface Escrow {
  id: string;
  offerId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  pollarAmount: number;          // monto en P$ retenido (0 si es trueque puro)
  barterValuePumaDolar?: number; // valor estimado del bien que el ofertante entrega
  stellarEscrowAccount: string;  // cuenta multi-sig 2-de-2
  stellarTxHashFunding?: string;
  stellarTxHashRelease?: string;
  stellarMemoReceipt?: string;   // recibo público
  status: EscrowStatus;
  buyerConfirmedAt?: string;
  sellerConfirmedAt?: string;
  releasedAt?: string;
  platformFeePumaDolar: number;  // 2% de pollarAmount, al release
  createdAt: string;
}

interface TransactionLog {
  id: string;
  escrowId: string;
  actorId: string;
  action: 'offer-accepted' | 'escrow-funded' | 'seller-confirmed'
        | 'buyer-confirmed' | 'released' | 'refunded';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Alerta simple de sobreprecio (sin engine complejo — solo comparación contra DB local)
interface PriceAlert {
  level: 'ok' | 'overpriced';    // ok = dentro de rango, overpriced = por encima
  marketMin: number;
  marketMax: number;
  sources: { title: string; price: number; source: string }[];
}
```

---

## 3. Flujo de usuario (happy path completo)

```
PASO 1 — Login
   [El vendedor/comprador entra con Google → Pollar crea la wallet automáticamente]
   [Ve su saldo en P$]

PASO 2 — María publica su TI-89
   [Crea listing con título, descripción, foto, video mock (✓), precio 800 P$,
    tipo "Calculadoras", carreras, condición]

PASO 3 — Juan (y otros) ven el listing y ofertan
   [El tablero de María recibe ofertas:
     - Pablo: solo saldo → 750 P$
     - Juan: trueque puro → su "Tipler" (350 P$) — pero María debe pagar 450 P$ de diferencia
       → no es viable sin saldo del vendedor
     - Juan: híbrida → su "Arduino Mega" (450 P$) + 300 P$ = 750 P$ totales
   ]

PASO 4 — María revisa su tablero y elige la oferta híbrida
   [Ve desglose claro: "Juan te ofrece Arduino + 300 P$ por tu TI-89"]
   [Toca "Aceptar"]

PASO 5 — Creación del escrow
   [Estado: awaiting-funding]
   [Se crea cuenta Stellar multi-sig 2-de-2 (comprador + plataforma)]
   [Se notifica a Juan]

PASO 6 — Juan fondea el escrow
   [SendModal de Pollar pre-llenado: 300 P$]
   [Tx visible en stellar.expert]
   [Estado: funded]

PASO 7 — Se encuentran en la facultad
   [Punto sugerido: biblioteca o CIA]
   [María entrega la TI-89; Juan la prueba]

PASO 8 — Ambos confirman en la app
   [María toca "Confirmé la entrega" → estado seller-confirmed]
   [Juan toca "Recibí y probé" → estado buyer-confirmed]
   [Al tener ambas confirmaciones: release automático]
   [Tx de Stellar: 300 P$ − 6 P$ (2% comisión) = 294 P$ para María]
   [Memo receipt público]
   [Estado: released]

PASO 9 — Recibo
   [Pantalla con tx hash, memo, saldos actualizados]
```

**Trueque puro (sin saldo):** si la oferta es solo objeto↔objeto, `pollarAmount = 0`, no hay transferencia de fondos, solo confirmación mutua y el recibo registra el intercambio.

---

## 4. Mecánica del escrow (versión MVP, simplificada)

### 4.1 Cuenta Stellar multi-sig 2-de-2

```
Cuenta: ESCROW-{uuid}
Signers:
  - COMPRADOR (peso 1)
  - PLATAFORMA (peso 1)
Threshold: 2
```

### 4.2 Estados (MVP)

```
                    [Oferta aceptada]
                          │
                          ▼
                  awaiting-funding
                          │
              [Comprador fondea vía SendModal Pollar]
                          │
                          ▼
                       funded ──────────────────┐
                          │                       │
   [Vendedor confirma entrega]                   │
                          │                       │
                          ▼                       │
                  seller-confirmed ───────┐       │
                          │               │       │
   [Comprador confirma recepción]        │       │
                          │               │       │
                          ▼               │       │
                  buyer-confirmed        │       │
                          │               │       │
       [Plataforma firma la liberación]  │       │
                          │               │       │
                          ▼               ▼       ▼
                       released (con comisión)   [cancelación]
```

Si **ambas confirmaciones** ocurren (o una + firma de plataforma con la otra pendiente por mucho tiempo, no implementado en MVP): release.

**Cancelación antes de cualquier confirmación:** reembolso automático al comprador.

### 4.3 Comisión

```typescript
// lib/fees.ts
const PLATFORM_FEE_BPS = 200; // 2%. Hackathon: 0 (HACKATHON_FREE_FEES=true)
export function calculateFee(amount: number): number {
  if (process.env.HACKATHON_FREE_FEES === 'true') return 0;
  return Math.round((amount * PLATFORM_FEE_BPS) / 10000 * 1e6) / 1e6;
}
// 300 P$ → fee 6 P$ → María recibe 294 P$
```

### 4.4 Memo receipt (Stellar)

```
memo_text: "PT-{escrowIdShort}-{sha256(escrowId|buyerId|sellerId|amount).slice(0,16)}"
```

Visible en el historial de ambas wallets en stellar.expert.

### 4.5 Edge cases

| Caso | Comportamiento en MVP |
|---|---|
| Vendedor no confirma tras funding | El comprador puede tocar "Solicitar cancelación" → reembolso. |
| Comprador no fondea tras aceptar oferta | Después de 7 días la oferta expira. |
| Intentar ofertar en tu propio listing | Bloqueado en UI. |
| Listing vendido | Al aceptar oferta, status → sold. No se puede ofertar de nuevo. |

---

## 5. Alerta de sobreprecio (IA básica)

### 5.1 Comportamiento

Cuando un ofertante va a crear una oferta de tipo **`pollar-only`** o **`hybrid`**, o cuando el vendedor define el precio sugerido, el sistema compara contra una base local de precios de referencia y muestra:

```
✓ Precio dentro del mercado ($650–850 según 14 listados reales)
⚠ Precio por encima del mercado ($650–850). Sugerencia: ajustar a $750
```

### 5.2 Base local

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
  { keywords: ['ti-89', 'titanium'],    type: 'calculadoras', marketMin: 650,  marketMax: 850,  source: 'Mercado Libre MX' },
  { keywords: ['fluke', '117'],         type: 'laboratorio',  marketMin: 950,  marketMax: 1250, source: 'Mercado Libre MX' },
  { keywords: ['arduino', 'mega'],      type: 'electronica',  marketMin: 380,  marketMax: 500,  source: 'Mercado Libre MX' },
  { keywords: ['sadiku'],               type: 'libros',       marketMin: 250,  marketMax: 350,  source: 'BookFinder' },
  { keywords: ['spivak'],               type: 'libros',       marketMin: 500,  marketMax: 700,  source: 'BookFinder' },
  { keywords: ['tipler'],               type: 'libros',       marketMin: 300,  marketMax: 400,  source: 'BookFinder' },
  { keywords: ['thinkpad', 'x1'],       type: 'electronica',  marketMin: 7800, marketMax: 9500, source: 'Mercado Libre MX' },
  { keywords: ['raspberry'],            type: 'electronica',  marketMin: 900,  marketMax: 1200, source: 'Mercado Libre MX' },
  { keywords: ['bata'],                 type: 'batas-uniformes', marketMin: 180, marketMax: 280, source: 'Amazon MX' },
  // Fallbacks por tipo
  { keywords: [], type: 'libros',        marketMin: 150,  marketMax: 400, source: 'BookFinder (promedio)' },
  { keywords: [], type: 'calculadoras',  marketMin: 300,  marketMax: 700, source: 'Mercado Libre MX' },
  { keywords: [], type: 'electronica',   marketMin: 250,  marketMax: 900, source: 'Mercado Libre MX' },
  { keywords: [], type: 'batas-uniformes', marketMin: 120, marketMax: 250, source: 'Amazon MX' },
  { keywords: [], type: 'laboratorio',   marketMin: 150,  marketMax: 400, source: 'Mercado Libre MX' },
  { keywords: [], type: 'otros',         marketMin: 100,  marketMax: 500, source: 'Mercado Libre MX' },
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

Esto es **deliberadamente simple y determinista**: la demo nunca se cae por red, y la lógica cabe en 50 líneas. La versión completa con LLM y tasador vive en "La Casa".

---

## 6. Categorías

Dos ejes independientes:

**Eje 1 — Carrera (multi-select por listing):** `Ing. en Computación`, `Ing. Eléctrica`, `Ing. Mecánica`, `Matemáticas`, `Física`, `Química`, `Biología`, `Otra`.

**Eje 2 — Tipo de item:** `libros`, `calculadoras`, `electronica`, `batas-uniformes`, `laboratorio`, `otros`.

**UI de filtrado** (sticky en el marketplace):
```
Carrera: [Todas ▼]   Tipo: [Todos ▼]
☐ Solo con video verificado
🔍 [Buscar...]
```

---

## 7. Wireframes

### 7.1 Splash / Auth

```
┌─────────────────────────────────────┐
│                                     │
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
│                                     │
└─────────────────────────────────────┘
```

### 7.2 Home (María)

```
┌─────────────────────────────────────┐
│ 🐆 PumaTrade         💰 1,250 P$  👤│
├─────────────────────────────────────┤
│  Hola, María 👋                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📦 Tienes 3 publicaciones   │    │
│  │ 💬 3 ofertas nuevas          │    │
│  │ 🔒 0 intercambios activos   │    │
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
│  ┌─────────────────────────────┐    │
│  │ [📷 Fluke 117] 1,200 P$     │    │
│  │ Multímetro      ✓ verificado  │    │
│  │ 0 ofertas                     │    │
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
│  ┌─────────────────────────────┐    │
│  │ [📷 TI-89]    800 P$        │    │
│  │ Calculadora · María          │    │
│  │ ✓ verificado · 3 ofertas     │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ [📷 Arduino]  450 P$        │    │
│  │ Electrónica · Juan           │    │
│  │ ✓ verificado · 0 ofertas     │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ [📷 ThinkPad] 8,500 P$      │    │
│  │ Electrónica · Sofía          │    │
│  │ ✓ verificado · 1 oferta      │    │
│  └─────────────────────────────┘    │
│  [Cargar más]                       │
└─────────────────────────────────────┘
```

### 7.4 Detalle de listing — vista vendedor (con tablero)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto]                          │
│                                     │
│  Calculadora TI-89 Titanium         │
│  800 P$ · ✓ Verificado              │
│                                     │
│  Vendida por María R.               │
│  Ing. en Computación                │
│                                     │
│  ─── Descripción ───                │
│  Sin caja, funciona perfecto.       │
│                                     │
│  ─── Tablero de ofertas (3) ───     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 💵 Compra directa            │    │
│  │ Pablo ofrece: 750 P$          │    │
│  │ (50 P$ menos que tu precio)  │    │
│  │ "Me serviría para el prox    │    │
│  │  semestre"                   │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🔄 Híbrida (RECOMENDADA)    │    │
│  │ Juan ofrece:                 │    │
│  │   • Arduino Mega (450 P$)    │    │
│  │   • 300 P$ en PumaDolar      │    │
│  │ Total: 750 P$                │    │
│  │ Diferencia a tu favor: 50 P$ │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🎁 Trueque puro              │    │
│  │ Andrea ofrece:               │    │
│  │   • Spivak 3ra ed. (600 P$)  │    │
│  │ ⚠ Tu artículo vale 200 P$    │    │
│  │ más. No procede sin saldo.   │    │
│  │ [Rechazar]                   │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Pausar listing]                   │
└─────────────────────────────────────┘
```

### 7.5 Detalle de listing — vista visitante

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto]                          │
│                                     │
│  Multímetro Fluke 117               │
│  1,200 P$ · ✓ Verificado            │
│                                     │
│  Vendido por María R.               │
│                                     │
│  ─── Descripción ───                │
│  Un semestre de uso.                │
│                                     │
│  ─── 0 ofertas ───                  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Hacer una oferta  →       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.6 Hacer oferta (modal full-screen)

```
┌─────────────────────────────────────┐
│ ← Cancelar      Hacer oferta        │
├─────────────────────────────────────┤
│  Ofertando por:                     │
│  Multímetro Fluke 117 (1,200 P$)    │
│                                     │
│  ─── Tipo de oferta ───             │
│  ⦿ Compra directa (solo PumaDolar)  │
│  ○ Trueque puro (objeto por objeto) │
│  ○ Híbrida (objeto + diferencia)    │
│                                     │
│  ─── Tu oferta ───                  │
│  Cantidad en PumaDolar:             │
│  ┌─────────────────────────────┐    │
│  │ 1,100                        │    │
│  └─────────────────────────────┘    │
│  ℹ Mercado: $950–1,250. Buena      │
│    oferta.                          │
│                                     │
│  Mensaje opcional:                  │
│  ┌─────────────────────────────┐    │
│  │ Me urge, lo necesito para... │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Enviar oferta  →         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Variante híbrida:** muestra form para listar items + input de P$.
**Variante trueque:** form para listar items, calcula diferencia y advierte si el vendedor debe pagar.

### 7.7 Detalle de escrow (comprador)

```
┌─────────────────────────────────────┐
│ 🔒 ESCROW ACTIVO                    │
├─────────────────────────────────────┤
│  Comprando: TI-89 Titanium          │
│  A: María R.                        │
│  Monto retenido: 300 P$             │
│                                     │
│  Estado: 🟡 FUNDED                  │
│  Tu pago está retenido.             │
│  Coordina el encuentro.             │
│                                     │
│  ─── Siguiente paso ───             │
│  📍 Punto sugerido:                 │
│     Biblioteca central, 12:00 hrs   │
│                                     │
│  ─── Detalle técnico ───            │
│  Cuenta escrow Stellar:             │
│  GABC...XYZ (multi-sig 2-de-2)      │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  ─── Acciones ───                   │
│  [Confirmé la entrega]              │
│  (tocar tras verificar)             │
│                                     │
│  [Cancelar → reembolso]             │
└─────────────────────────────────────┘
```

### 7.8 Recibo final

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│           ✅ ¡Listo!                 │
│                                     │
│     Intercambio completado          │
│                                     │
│  ─── Resumen ───                    │
│  Articulo: TI-89 Titanium           │
│  Comprador: Juan P.                 │
│  Vendedor: María R.                 │
│                                     │
│  Monto: 300 P$                      │
│  Comisión (2%): −6 P$               │
│  María recibió: 294 P$              │
│                                     │
│  ─── Recibo público (Stellar) ───   │
│  Tx: def456...ab                     │
│  Memo: PT-abc1-9f3e...              │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  ─── Saldos ───                     │
│  María: 1,250 + 294 = 1,544 P$      │
│  Juan: 2,000 − 300 = 1,700 P$       │
│                                     │
└─────────────────────────────────────┘
```

### 7.9 Crear listing

```
┌─────────────────────────────────────┐
│ ← Cancelar   Publicar artículo      │
├─────────────────────────────────────┤
│  📷 [Subir foto]                    │
│  Título* [Calculadora TI-89...]      │
│  Descripción* [Sin caja, funciona..]│
│  Precio sugerido* [800] P$          │
│  ⚠ Mercado: $650–850. OK.           │
│                                     │
│  Tipo* [Calculadoras ▼]             │
│  Carreras* [✓ Compu][✓ Eléctrica]   │
│  Condición [Bueno ▼]                │
│                                     │
│  ─── Verificación ───               │
│  📹 [Subir video de prueba]         │
│  ☑ Acepto verificación manual       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Publicar artículo  →     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 7.10 Settings / Wallet

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  👤 María R.                        │
│  maria@unam.mx                      │
│  Ing. en Computación                │
│                                     │
│  ─── Tu wallet ───                  │
│  Balance: 💰 1,544 P$ [Actualizar]  │
│  Dirección Stellar: GABC...XYZ      │
│  [Copiar] [Ver en explorer ↗]       │
│  [Ver historial de transacciones]   │
│                                     │
│  ─── Demo ───                       │
│  [Resetear datos demo]              │
│  [Crear escrow simulado]            │
│                                     │
│  [Cerrar sesión]                    │
│  v0.3.0 · Stellar Testnet           │
└─────────────────────────────────────┘
```

---

## 8. Seed data

```jsonc
// seed/seed.json — los IDs reales de wallets Pollar se inyectan al sembrar
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
    { "id": "lst_thinkpad","sellerId": "usr_sofia","title": "ThinkPad X1 Carbon (i7,16GB)", "pricePumaDolar": 8500, "type": "electronica",     "videoVerified": true },
    { "id": "lst_raspi",  "sellerId": "usr_sofia",  "title": "Raspberry Pi 4 8GB",          "pricePumaDolar": 1100, "type": "electronica",     "videoVerified": true }
  ],
  "offers": [
    { "id": "ofr_pablo_ti89", "listingId": "lst_ti89", "offererId": "usr_pablo",
      "type": "pollar-only", "pollarAmount": 750,
      "message": "Me serviría mucho para el próximo semestre.", "status": "pending" },
    { "id": "ofr_juan_ti89_full", "listingId": "lst_ti89", "offererId": "usr_juan",
      "type": "pollar-only", "pollarAmount": 750,
      "message": "Te la compro en efectivo digital.", "status": "pending" },
    { "id": "ofr_juan_ti89_hybrid", "listingId": "lst_ti89", "offererId": "usr_juan",
      "type": "hybrid",
      "offeredItems": [{ "title": "Arduino Mega 2560", "estimatedValuePumaDolar": 450 }],
      "pollarAmount": 300,
      "message": "Oferta final, la hago porque necesito la calculadora.", "status": "pending" },
    { "id": "ofr_andrea_ti89_barter", "listingId": "lst_ti89", "offererId": "usr_andrea",
      "type": "barter",
      "offeredItems": [{ "title": "Cálculo de Spivak (3ra ed.)", "estimatedValuePumaDolar": 600 }],
      "message": "Solo cambiaría si me das efectivo para la diferencia.",
      "status": "pending" },
    { "id": "ofr_pablo_thinkpad", "listingId": "lst_thinkpad", "offererId": "usr_pablo",
      "type": "pollar-only", "pollarAmount": 8300,
      "message": "Si me la dejas en 8300 te la compro hoy.", "status": "pending" }
  ]
}
```

---

## 9. Modelo de ingresos

| Fuente | Implementación |
|---|---|
| **Comisión de escrow** | 2% sobre el P$ liberado (deducido al release). Hackathon: 0%. |
| **Premium listings (futuro)** | Destacar un artículo: 10–15 P$ / semana. |

El MVP es **gratis para el usuario** durante el hackathon. La monetización es visible en el flujo (modal de release muestra el desglose) pero no se ejecuta en el demo.

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
│   ├── receipt/[escrowId]/page.tsx
│   ├── create/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── escrow/{accept-offer,fund,confirm,release,cancel}/route.ts
│       ├── offers/route.ts
│       ├── listings/route.ts
│       ├── price-alert/route.ts
│       └── reset-demo/route.ts
├── components/{ListingCard,OfferCard,EscrowTimeline,FilterBar,WalletBadge}.tsx
├── lib/
│   ├── db.ts  pollar.ts  stellar.ts  fees.ts  validation.ts
│   └── priceAlert/{referencePrices,engine}.ts
├── prisma/schema.prisma
├── seed/seed.json
└── .env.local
```

### 10.3 Integración Pollar

```tsx
// app/layout.tsx
import { PollarProvider } from '@pollar/react';
<PollarProvider client={{ apiKey: process.env.NEXT_PUBLIC_POLLAR_API_KEY!, network: 'stellar' }}>
```

- `<WalletButton>` (header)
- `usePollar().login()` (login)
- `<SendModal>` (fondear escrow)
- `<TxHistoryModal>` (settings)
- `client.refreshBalance()` tras cada acción
- Server-side: `client.stellar.buildTransaction()` / `submitTransaction()` para funding + release del escrow multi-sig

---

## 11. Setup checklist pre-hackathon

**T-24h:**
- [ ] Crear app en [dashboard.pollar.xyz](https://dashboard.pollar.xyz)
  - [ ] Network: Stellar Testnet, G-accounts, funding Immediate, Google auth
  - [ ] Obtener API keys (`pk_test_*`, `sk_test_*`)
- [ ] Treasury fondeado con USDC testnet (~10,000)
- [ ] 5 wallets seed creadas y fondeadas
- [ ] Capturar `G-...` IDs para `seed.json`
- [ ] Probar send manual entre dos wallets

**T-2h:**
- [ ] `npm install`, `.env.local`, `prisma migrate dev`, `prisma db seed`
- [ ] Login Google OK, saldos visibles, listings seed visibles
- [ ] Botón "Reset demo data" funciona

**Durante el hackathon:**
- [ ] Orden de implementación:
  1. Auth + home + wallet
  2. Marketplace + filtros
  3. Detalle listing (vista vendedor y visitante)
  4. Hacer oferta (3 tipos)
  5. Tablero + aceptar oferta → escrow
  6. Fondear escrow (SendModal)
  7. Doble confirmación → release + recibo
  8. Alerta de sobreprecio al crear listing/oferta
  9. Reset demo
- [ ] Probar happy path en móvil

---

## 12. Backlog post-MVP ("La Casa")

Esto es lo que se cuenta en el pitch como la visión a futuro:

- **Tarjeta física NFC** (estilo Tangem) para confirmar transacciones — "tan sencillo como pagar el transporte público"
- **Pagos seguros de depósitos de renta** para estudiantes foráneos
- **Pago de comidas** en cafeterías de la facultad usando el saldo ganado
- **Foro comunitario** para guiar a alumnos de nuevo ingreso sobre materiales
- **Opción de compra urgente garantizada por la plataforma** (buyback)
- **Asistente IA completo** (búsqueda en lenguaje natural, tasador de depreciación, asesor de materiales)
- **Resolución de disputas** (con TTL de 48h y auto-resolve a favor del vendedor)
- **Smart contract Soroban real** para el escrow (sustituir multi-sig) cuando se vaya a producción
- **On-ramp fiat** (depósito de saldo real vía SEP-24)
- **Featured listings** (10–15 P$ / semana)
- **App nativa** iOS/Android
- **Reputación** y ratings post-transacción

---

## 13. Demo script (3 minutos)

**Setup:** teléfono de Juan (comprador, saldo 2,000 P$) y laptop con stellar.expert de respaldo.

```
[0:00–0:30] PROBLEMA
"Cada semestre gastamos miles de pesos en libros, calculadoras, componentes…
que al terminar quedan arrumbados. El trueque tradicional falla porque
es casi imposible encontrar a alguien cuyo objeto valga exactamente
lo mismo. Y comprar usado es una ruleta: ¿está quemado? ¿me van a
estafar? PumaTrade resuelve las dos cosas."

[0:30–1:00] LA SOLUCIÓN: TABLEROS DE OFERTAS
[Abrir como María → ver su listing de TI-89 con 3 ofertas]
"María vende su calculadora. Mira su tablero: Pablo le ofrece 750
pesos, Juan le ofrece 750 también… pero Juan además le propone algo
mejor: su Arduino Mega valuado en 450 + 300 en PumaDolar. María
elige la oferta híbrida y se lleva un componente que SÍ va a usar,
más 300 P$ para su próximo semestre."

[1:00–1:45] EL CANDADO
[Juan compra → SendModal → FUNDED, mostrar tx en laptop]
"Juan paga. Los 300 P$ se congelan en un smart contract de garantía
en Stellar. Aquí está la transacción en vivo, en testnet. Ni Juan
ni María pueden tocar ese dinero todavía."

[1:45–2:30] EL ENCUENTRO Y LA PRUEBA
"Juan y María se encuentran en la biblioteca. Juan recibe la
calculadora, la prueba, todo bien. Vuelve a la app y toca
'Confirmé la entrega'. María también confirma la suya. Ambas
confirmaciones en menos de un minuto."

[2:30–3:00] LIBERACIÓN + ALERTA DE PRECIO
[Mostrar recibo: 294 P$ a María, 6 P$ comisión, tx hash]
"Al instante se libera el pago: 294 P$ para María (2% se queda en
la plataforma), recibo público en Stellar, saldos actualizados.

Y la plataforma vigila que nadie cobre de más: este listing está
etiquetado porque su precio está dentro del rango de mercado
$650–850. Si alguien lo inflara, le avisaría en el momento.

Eso es PumaTrade: trueque flexible, dinero protegido, cero
estafas — sin que tengas que aprender blockchain."

```

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Multi-sig setup tarda | Alta | Cuenta Stellar pre-creada como template; clonar por escrow |
| SendModal Pollar falla en Safari | Baja | Probar en Chrome; tener Chrome como backup |
| Saldos desincronizados | Media | `refreshBalance()` tras cada acción |
| Tx hash no aparece inmediato en explorer | Alta | Esperar 5–10s; tener tx de backup visible |
| Wallets seed no listas | Media | Plan B: 2 wallets + 3 listings dummy |
| Comisión rompe el flujo visual | Baja | Hackathon: `HACKATHON_FREE_FEES=true` |

---

## 15. Glosario

- **PumaDolar (P$):** saldo en la app. 1 P$ = 1 USDC en Stellar testnet.
- **Pollar (SDK):** infraestructura de wallets embebidas + auth para Stellar.
- **Stellar:** blockchain L1 de liquidación.
- **Escrow:** retención de fondos en una cuenta multi-sig hasta confirmación.
- **Oferta híbrida:** objeto + PumaDolar como diferencia.
- **Smart contract:** cuenta Stellar multi-sig 2-de-2 (en MVP); Soroban real más adelante.
- **"El Ladrillo":** lo que se demuestra en el hackathon.
- **"La Casa":** la visión completa post-MVP.

---

**FIN DEL PRD v3.0** — MVP simple, intercambiable, con dinero protegido y alerta básica de precios. Lo demás se construye encima.