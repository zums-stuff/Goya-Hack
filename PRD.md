# PRD — PumaTrade (PumaDolar Marketplace)

**Versión:** 1.0  
**Fecha:** 2026-09-24  
**Estado:** Aprobado para implementación  
**Tiempo de implementación:** <24h  
**Audiencia del documento:** 1 implementador full-stack + 2 teammates (diseño/pitch)  
**Audiencia del producto:** Estudiantes universitarios (UNAM, principalmente FI)

---

## 0. Resumen ejecutivo (1 página para pitch)

**PumaTrade** es un marketplace móvil-first para estudiantes universitarios donde puedes **vender, comprar o intercambiar (trueque)** bienes académicos en desuso (libros, calculadoras, batas, componentes electrónicos). La diferencia de valor entre los bienes se liquida en **PumaDolar**, una moneda digital respaldada por **USDC en Stellar testnet** a través del SDK **Pollar**, que crea wallets embebidas para cada usuario sin que tenga que aprender blockchain.

**Innovación clave:** un **tablero de ofertas múltiples** por listing. Cuando publicas un artículo, recibes ofertas en 3 formatos: (1) trueque puro bien-por-bien, (2) compra directa en PumaDolar, (3) bien del ofertante + PumaDolar compensando la diferencia. Tú eliges la que mejor resuelve tu semestre.

**Confianza:** los fondos se retienen en una **cuenta escrow multi-sig 2-de-2 de Stellar** (comprador + plataforma). Los bienes se intercambian presencialmente en el campus. Cuando ambos confirman entrega, la plataforma firma la liberación; un timeout favorece al vendedor si hay ghosting. Cada transacción deja un **memo hash en Stellar** como recibo público e inmutable.

**Ingresos:** 2% de comisión sobre el PumaDolar liberado (no sobre el valor de los bienes físicos intercambiados). Lanza con $0 de comisión durante el hackathon.

**Out of scope MVP:** Tangem, agente de IA, instant buyback, foro de nuevo ingreso, rentas, food payments.

---

## 1. Personas (5 usuarios seed)

Estos 5 usuarios se crean manualmente en el dashboard de Pollar ANTES del hackathon y se siembran en la DB local de la app. Cada uno tiene listings realistas para que el tablero se vea poblado al instante del demo.

### 1.1 María — `maria@unam.mx` (vendedora con urgencia)

- **Carrera:** Ing. en Computación, 5º semestre
- **Saldo inicial:** 1,250 P$ (PumaDolar)
- **Bio:** "Cambio de carrera, vendo todo lo de circuitos"
- **Listings (3):**
  1. **Calculadora TI-89 Titanium** — `Libros / Calculadoras` — 800 P$ — condición: "Sin caja, pero funciona perfecto. Batería nueva." (mock video verified ✓)
  2. **Multímetro Fluke 117** — `Material de laboratorio` — 1,200 P$ — "Lo usé un semestre. Incluye puntas." (verified ✓)
  3. **Bata blanca talla M** — `Batas y uniformes` — 250 P$ — "Sin usar, me quedó chica." (verified ✓)

### 1.2 Juan — `juan@unam.mx` (comprador técnico)

- **Carrera:** Ing. Eléctrica, 3º semestre
- **Saldo inicial:** 2,000 P$
- **Bio:** "Armando mi kit de electrónica desde cero"
- **Listings (2):**
  1. **Arduino Mega 2560** — `Electrónica` — 450 P$ — "Compré dos, vendo uno. Con cable USB." (verified ✓)
  2. **Libro Sadiku — Elementos de Electromagnetismo** — `Libros` — 300 P$ — "Tiene marcatexto en cap. 3, resto limpio." (verified ✓)

### 1.3 Andrea — `andrea@unam.mx` (vendedora inversora)

- **Carrera:** Matemáticas, 7º semestre
- **Saldo inicial:** 800 P$
- **Bio:** "Intercambio lo que ya no uso por lo que sí voy a usar"
- **Listings (2):**
  1. **Cálculo de Spivak (3ra ed.)** — `Libros` — 600 P$ — "Edición original. Algunos ejercicios resueltos a lapiz." (verified ✓)
  2. **Bata blanca talla CH** — `Batas y uniformes` — 200 P$ — "Como nueva." (verified ✓)

### 1.4 Pablo — `pablo@unam.mx` (comprador novato)

- **Carrera:** Física, 1º semestre (nuevo ingreso)
- **Saldo inicial:** 500 P$
- **Bio:** "Armando mi primer kit"
- **Listings (1):**
  1. **Libro Tipler — Física Moderna** — `Libros` — 350 P$ — "Lo compré por error, ya no lo necesito." (verified ✓)

### 1.5 Sofía — `sofia@unam.mx` (vendedora high-value)

- **Carrera:** Ing. en Computación, 8º semestre (último)
- **Saldo inicial:** 1,800 P$
- **Bio:** "Tesis terminada, vendiendo mi setup completo"
- **Listings (2):**
  1. **Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)** — `Electrónica` — 8,500 P$ — "Batería dura 4 horas. Garantía hasta dic 2026." (verified ✓)
  2. **Raspberry Pi 4 Model B 8GB** — `Electrónica` — 1,100 P$ — "Con caja oficial y disipadores." (verified ✓)

**Total listings seed:** 10 items cubriendo 4 majors × 5 tipos.

---

## 2. Modelo de datos

### 2.1 Entidades principales

```typescript
// types/db.ts — Tipos para la DB local (Postgres / SQLite / en-memoria según decisión del implementador)

type Major =
  | 'Ing. en Computación'
  | 'Ing. Eléctrica Electrónica'
  | 'Ing. Mecánica'
  | 'Ing. Mecatrónica'
  | 'Otra';

type ListingType =
  | 'libros'
  | 'calculadoras'
  | 'electronica'
  | 'batas-uniformes'
  | 'laboratorio'
  | 'otros';

type ListingCondition = 'nuevo' | 'como-nuevo' | 'bueno' | 'aceptable';

interface User {
  id: string;                    // UUID, también Pollar userId
  email: string;
  displayName: string;           // ej. "María R."
  major: Major;
  bio: string;
  avatarUrl?: string;
  pollarWalletId: string;        // De Pollar, ej. "G-ABC..."
  balancePumaDolar: number;      // Cache local, refrescado con refreshBalance()
  createdAt: string;             // ISO
}

interface Listing {
  id: string;                    // UUID
  sellerId: string;              // User.id
  title: string;
  description: string;
  pricePumaDolar: number;        // Precio de referencia en P$ (no es el precio fijo, es la tasación inicial)
  type: ListingType;
  majors: Major[];               // Puede aplicar a varias carreras (ej. libro de cálculo)
  condition: ListingCondition;
  photoUrl: string;              // Placeholder si no hay
  videoVerified: boolean;        // Mock: toggle manual "verificado por moderador"
  status: 'active' | 'paused' | 'sold' | 'removed';
  createdAt: string;
}

// Los 3 tipos de oferta que recibe un listing
type OfferType = 'barter' | 'pollar-only' | 'hybrid';

interface Offer {
  id: string;
  listingId: string;             // Listing al que aplica
  offererId: string;             // User.id de quien oferta
  type: OfferType;

  // Solo para type === 'barter' o 'hybrid'
  offeredItems?: {
    title: string;               // No requiere ser listing registrado, ej. "Mi tableta Wacom"
    estimatedValuePumaDolar: number;
  }[];

  // Solo para type === 'pollar-only' o 'hybrid' (la parte en P$ que el ofertante pone)
  pollarAmount?: number;

  message?: string;              // Mensaje opcional al vendedor
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
}

type EscrowStatus =
  | 'awaiting-funding'           // Vendedor aceptó oferta, comprador debe fondear
  | 'funded'                     // Fondeado, esperando que se encuentren
  | 'seller-marked-delivered'    // Vendedor marcó como entregado
  | 'buyer-confirmed'            // Comprador confirmó, esperando firma de plataforma
  | 'released'                   // Fondos transferidos al vendedor (menos comisión)
  | 'disputed'                   // Alguien abrió disputa (placeholder MVP)
  | 'refunded'                   // Devuelto al comprador (caso edge)
  | 'timeout-released';          // Pasaron 48h, auto-release al vendedor

interface Escrow {
  id: string;
  offerId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  pollarAmount: number;          // Monto en P$ retenido
  stellarEscrowAccount: string;  // Public key de la cuenta Stellar multi-sig
  stellarTxHashFunding?: string; // Hash de la tx que fondeó el escrow
  stellarTxHashRelease?: string; // Hash de la tx que liberó
  stellarMemoReceipt?: string;   // Memo con hash de la transacción (recibo público)
  status: EscrowStatus;
  sellerDeliveredAt?: string;
  buyerConfirmedAt?: string;
  releasedAt?: string;
  platformFeePumaDolar: number;  // Calculado al release: 2% de pollarAmount
  createdAt: string;
  expiresAt: string;             // createdAt + 48h
}

// Log inmutable de auditoría
interface TransactionLog {
  id: string;
  escrowId: string;
  actorId: string;
  action: 'offer-accepted' | 'escrow-funded' | 'seller-marked-delivered'
        | 'buyer-confirmed' | 'released' | 'disputed' | 'refunded' | 'timeout-released';
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

### 2.2 Decisiones de almacenamiento

**Recomendación:** SQLite local (vía Prisma o Drizzle) para simplicidad y rapidez de implementación. Si el implementador prefiere Postgres o in-memory, los tipos no cambian. La DB solo guarda el estado de la app; los fondos reales viven en Stellar vía Pollar.

**Sincronización con Pollar:** cada vez que el usuario abre su wallet o completa una acción relevante, se llama `client.refreshBalance()` para mantener `balancePumaDolar` actualizado. La DB local es la "fuente de verdad" para listings/offers/escrow, pero los balances siempre vienen de Pollar.

---

## 3. Flujos de usuario

### 3.1 Happy path completo (el del demo de 3 minutos)

```
PASO 1 — María (vendedora) abre la app
   [Login con Google → Pollar crea wallet automáticamente]
   [Saldo: 1,250 P$]
   [Home: ve sus 3 listings propios + 7 listings de otros]

PASO 2 — María navega a su listing "Calculadora TI-89"
   [Ve: precio sugerido 800 P$, video verified ✓, 0 ofertas]

PASO 3 — María revisa el tablero de ofertas tras refrescar
   [Aparecen 3 ofertas:
     - Oferta A (Pablo): trueque puro → su "Libro Tipler" (350 P$) por la calculadora
     - Oferta B (Juan): compra directa → 750 P$ (sin ofertar item)
     - Oferta C (Juan): híbrida → su "Arduino Mega" (450 P$) + 300 P$ diferencia
   ]
   [María toca Oferta C: "Mejor oferta. Me llevo un Arduino Y 300 P$ para mi próximo semestre."]

PASO 4 — María acepta Oferta C → se crea el Escrow
   [Estado: awaiting-funding]
   [Aparece una cuenta Stellar multi-sig 2-de-2: pública, ambos la ven]
   [Se notifica a Juan]

PASO 5 — Juan ve la notificación → entra al detalle del Escrow
   [Ve: "Debes fondear 450 P$ (300 P$ diferencia + 150 P$ valor del Arduino en garantía)"]
   [Ve la dirección de la cuenta escrow multi-sig]
   [Toca "Fondear escrow" → SendModal de Pollar pre-llenado]
   [Confirma envío vía Google (Pollar firma por detrás)]
   [Tx hash: abc123... visible en stellar.expert]
   [Estado: funded]

PASO 6 — María y Juan se encuentran en el campus (simulado en demo)
   [María toca "Marcar como entregado" tras el encuentro]
   [Estado: seller-marked-delivered]
   [Timer de 48h aparece para Juan]

PASO 7 — Juan verifica la calculadora físicamente
   [Toca "Confirmar recepción y liberar fondos"]
   [Aparece modal: "Esto transferirá 450 P$ a María (menos 9 P$ de comisión = 441 P$) y firmará un recibo en Stellar"]
   [Confirma]
   [Tx hash: def456... visible]
   [Estado: released]
   [Saldo de María: 1,250 + 441 = 1,691 P$]
   [Saldo de Juan: 2,000 - 450 = 1,550 P$]
   [Memo receipt: 0xABC... visible en tx history de ambos]
```

### 3.2 Estados del Escrow — máquina de estados completa

```
                    [Oferta aceptada]
                          │
                          ▼
                  awaiting-funding
                          │
              [Comprador fondea vía SendModal Pollar]
                          ▼
                       funded ──────────────────────┐
                          │                         │
        [Vendedor toca "Marcar entregado"]         │  [Timeout 48h]
                          │                         │       │
                          ▼                         │       ▼
                seller-marked-delivered ────[Timeout 48h]──┐
                          │                                │
        [Comprador toca "Confirmar"]                       │
                          │                                │
                          ▼                                │
                    buyer-confirmed                        │
                          │                                │
              [Plataforma firma liberación]                │
                          │                                │
                          ▼                                ▼
                       released (con comisión) ◄──────────┘
                                                          
   En cualquier punto entre funded y released:
     → Cualquiera puede tocar "Abrir disputa" → status = disputed
       (Para MVP: muestra "Un moderador revisará en <24h" — sin lógica real)
```

### 3.3 Edge cases documentados

| Caso | Comportamiento en MVP |
|---|---|
| Vendedor no marca entregado después de funding | Timer de 48h para comprador. Si comprador confirma, libera. Si no, timeout libera al vendedor. |
| Comprador no fondea después de aceptar oferta | Después de 7 días la oferta expira automáticamente (status → expired). |
| Comprador abre disputa | Estado → disputed. UI muestra mensaje placeholder. **No hay lógica de resolución en MVP.** |
| Vendedor intenta vender un item ya vendido | Al aceptar oferta, status del listing → sold. No se puede ofertar de nuevo. |
| Intentar ofertar en tu propio listing | Bloqueado en UI con mensaje "No puedes ofertar en tu propio artículo". |

---

## 4. Integración con Pollar

### 4.1 Setup del dashboard de Pollar (pre-hackathon)

Una sola persona del equipo debe hacer esto ANTES del día del demo:

1. Crear app en [dashboard.pollar.xyz](https://dashboard.pollar.xyz)
2. **Network:** Stellar Testnet
3. **Account model:** G-accounts (classic Stellar)
4. **Funding mode:** Immediate (los wallets se activan al login)
5. **Auth providers:** Google (solo Google para MVP, agregar GitHub/email si da tiempo)
6. **Obtener API key:** `pk_test_...` y `sk_test_...`
7. **Configurar treasury:** la cuenta de la app debe tener saldo USDC en Stellar testnet para fondear a los 5 usuarios seed. Usar [friendbot](https://friendbot.stellar.org) si es necesario.
8. **Trustlines:** USDC en testnet. El SDK de Pollar las maneja si se configuran en el dashboard.
9. **Webhook URL:** apuntar a `/api/polar/webhook` (opcional para MVP, pero recomendado).

### 4.2 Variables de entorno

```bash
# .env.local
NEXT_PUBLIC_POLLAR_API_KEY=pk_test_...
POLLAR_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_PLATFORM_FEE_BPS=200  # 2% en basis points
NEXT_PUBLIC_ESCROW_TIMEOUT_HOURS=48
POLLAR_TREASURY_WALLET_ID=G-...
```

### 4.3 Provider raíz de la app

```typescript
// app/layout.tsx
import { PollarProvider } from '@pollar/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PollarProvider
          client={{
            apiKey: process.env.NEXT_PUBLIC_POLLAR_API_KEY!,
            network: 'stellar',
          }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
```

### 4.4 Hooks y modales de Pollar que usaremos

| Componente Pollar | Dónde lo usamos |
|---|---|
| `<WalletButton>` | Header global, siempre visible |
| `usePollar().login()` | Pantalla de login |
| `usePollar().logout()` | Settings |
| `<SendModal>` | Paso 5 del happy path (fondear escrow) |
| `<TxHistoryModal>` | Settings / "Mis transacciones" |
| `usePollar().refreshBalance()` | Después de cada acción que afecte saldo |
| `client.stellar.buildTransaction()` | Construir tx de escrow funding (server-side) |
| `client.stellar.submitTransaction()` | Server-side: liberar escrow, cobrar comisión |

### 4.5 Llamadas server-side (API routes de Next.js)

```typescript
// app/api/escrow/fund/route.ts — Fondear el escrow
// Recibe: { escrowId, buyerPollarUserId, amount }
// 1. Construye tx Stellar: buyer → multi-sig escrow account
// 2. Pide a Pollar que firme del lado del buyer
// 3. Submit a Stellar testnet
// 4. Devuelve tx hash al cliente

// app/api/escrow/release/route.ts — Liberar el escrow
// Recibe: { escrowId }
// 1. Verifica estado === 'buyer-confirmed' O timeout expirado
// 2. Calcula comisión (2%)
// 3. Construye tx Stellar: multi-sig → seller (con split de comisión a treasury)
// 4. Plataforma firma con su key
// 5. Vendedor firma (Pollar embedded)
// 6. Submit
// 7. Memo con SHA256 de (escrowId + sellerId + buyerId + amount) como recibo
// 8. Devuelve tx hash y memo receipt

// app/api/escrow/timeout-check/route.ts
// Cron job (o llamado manualmente en MVP) que verifica escrows expirados
// y los libera automáticamente a favor del vendedor
```

---

## 5. Mecánica del escrow (el corazón técnico)

### 5.1 Implementación: Stellar multi-sig account

NO escribimos un smart contract de Soroban. Usamos una primitiva nativa de Stellar: **una cuenta multi-sig 2-de-2**.

**Setup por cada escrow:**
```
Cuenta Stellar: ESCROW-{uuid} (subaccount del platform wallet)
Signers: 
  - BUYER_PUBLIC_KEY (peso 1)
  - PLATFORM_PUBLIC_KEY (peso 1)
Threshold para pagos: 2 (ambos required)
```

**Funding:**
```
Buyer envía P$ → Cuenta multi-sig
(Tx firmada por buyer + fee-bump sponsored por plataforma)
```

**Release (dual confirm):**
```
Multi-sig → Seller (monto - comisión)
Multi-sig → Platform treasury (comisión)
(Ambas firmas: buyer confirmó + plataforma)
```

**Release (timeout, 48h):**
```
Multi-sig → Seller (monto - comisión)  
Multi-sig → Platform treasury (comisión)
(Solo firma de plataforma, basada en timestamp)
```

### 5.2 Implementación: Stellar memo como recibo

Al liberar, agregamos un **memo** a la transacción con el siguiente formato:
```
memo_text: "PT-{escrowId_short}-{sha256(escrowId|buyerId|sellerId|amount).substring(0,16)}"
```

Esto aparece en el tx history de ambas wallets en stellar.expert, dando una prueba pública e inmutable de que la transacción ocurrió.

### 5.3 Comisión: cálculo exacto

```typescript
const PLATFORM_FEE_BPS = 200; // 2%

function calculatePlatformFee(amountPumaDolar: number): number {
  // P$ se asume 1:1 con USDC, 6 decimales
  const feePumaDolar = (amountPumaDolar * PLATFORM_FEE_BPS) / 10000;
  return Math.round(feePumaDolar * 1_000_000) / 1_000_000; // redondeo a 6 decimales
}

// Ejemplo: 450 P$ → fee = 9 P$ → seller recibe 441 P$
```

### 5.4 Diagrama de secuencia del escrow

```
Comprador            Vendedor         Plataforma (server)        Stellar Testnet
    │                    │                     │                         │
    │──── oferta híbrida ──────────────────────>│                         │
    │                    │                     │                         │
    │                    │<─── acepta oferta ───│                         │
    │                    │                     │─── crea multi-sig ───────>│
    │                    │                     │<── account_id ───────────│
    │                    │                     │                         │
    │<─── notif: fondea ────────────────────────│                         │
    │                    │                     │                         │
    │──── sendPayment() ───────────────────────>│                         │
    │                    │                     │─── build tx ─────────────>│
    │                    │                     │<── XDR ──────────────────│
    │                    │                     │─── sign (sponsor) ───────>│
    │                    │                     │<── signed XDR ───────────│
    │                    │                     │─── submit ───────────────>│
    │                    │                     │<── tx hash ──────────────│
    │<── confirm ─────────│<── notif: funded ───│                         │
    │                    │                     │                         │
    │                    │─── "marcar entregado" ─>│                       │
    │                    │                     │                         │
    │<── "confirma?" ──────────────────────────│                         │
    │                    │                     │                         │
    │──── confirmRelease() ────────────────────>│                         │
    │                    │                     │─── build release tx ────>│
    │                    │                     │<── XDR ──────────────────│
    │                    │                     │─── platform sign ────────>│
    │                    │<─── buyer sign ──────────────────────────────│
    │                    │                     │─── submit + memo ────────>│
    │                    │                     │<── tx hash ──────────────│
    │<── notif: release ───────────────────────│                         │
    │                    │<── notif: 441 P$ ───│                         │
```

---

## 6. Sistema de categorías

### 6.1 Taxonomía

Dos ejes independientes que se cruzan:

**Eje 1 — Carrera (major):** relevante para qué carrera es el item
```
Ing. en Computación
Ing. Eléctrica
Ing. Mecánica
Matemáticas
Física
Química
Biología
Otra
```

**Eje 2 — Tipo de item:**
```
libros
calculadoras
electronica
batas-uniformes
laboratorio
otros
```

### 6.2 UI de filtrado

Dos dropdowns en la parte superior del marketplace:
```
┌─────────────────────────────────────────┐
│ Carrera: [Todas ▼]  Tipo: [Todos ▼]     │
│ ─────────────────────────────────────── │
│ ☐ Solo items con video verificado       │
│ [Buscar...]                             │
└─────────────────────────────────────────┘
```

### 6.3 Reglas de matching

- Un listing puede aplicar a **múltiples carreras** (campo `majors: Major[]`). Ej: un libro de Cálculo aplica a Matemáticas, Física, Ingeniería.
- El tipo de item es **único** por listing.
- En el seed data, María (Ing. en Computación) lista items que aplican a varias carreras; Andrea (Matemáticas) lista items principalmente de matemáticas.

---

## 7. Wireframes (Figma-style text spec)

### 7.1 Pantalla: Splash / Auth

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│          🐆 PUMATRADE                │
│      Marketplace Universitario      │
│                                     │
│                                     │
│   Compra, vende o intercambia      │
│   sin riesgo de estafa.             │
│                                     │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  🔵  Continuar con Google   │   │
│   └─────────────────────────────┘   │
│                                     │
│   Tu primera wallet se crea         │
│   automáticamente.                  │
│                                     │
│   Ya tienes cuenta? Entrar          │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Logo central (texto estilizado "PumaTrade")
- Subtítulo
- Descripción de 2 líneas
- Botón Google (usa `usePollar().login({ provider: 'google' })`)
- Disclaimer en gris pequeño

ESTADOS:
- default: como se muestra
- loading: spinner en el botón Google, deshabilitado
- error: toast rojo "No pudimos autenticarte. Reintentar"
```

### 7.2 Pantalla: Home (después de login)

```
┌─────────────────────────────────────┐
│ 🐆 PumaTrade         💰 1,250 P$  👤│
├─────────────────────────────────────┤
│                                     │
│  Hola, María 👋                     │
│  Tu actividad reciente:             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📦 Tienes 3 publicaciones   │    │
│  │ 💬 0 ofertas nuevas          │    │
│  │ ⏰ 0 intercambios activos    │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Explorar marketplace →]           │
│                                     │
│  ──── Tu tablero (3 listings) ──── │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [📷 TI-89]    800 P$        │    │
│  │ Calculadora    ✓ verificado  │    │
│  │ Sin caja, perfecta │ 0 of.  │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ [📷 Fluke 117] 1,200 P$     │    │
│  │ Multímetro      ✓ verificado │    │
│  │ 1 semestre de uso │ 0 of.  │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Ver todos]                        │
│                                     │
└─────────────────────────────────────┘
│ 🏠 Inicio  🔍 Buscar  📦 Míos  ⚙️ │
└─────────────────────────────────────┘

COMPONENTES:
- Top bar: logo + balance widget (toca → TxHistoryModal) + avatar
- Saludo personalizado
- Cards de actividad (tap → navega)
- CTA "Explorar"
- Sección "Tu tablero" con listings propios
- Bottom nav (4 tabs)

ESTADOS:
- usuario sin listings: empty state con CTA "Publica tu primer artículo"
- usuario con ofertas nuevas: badge numérico rojo en la sección
```

### 7.3 Pantalla: Marketplace (explorar)

```
┌─────────────────────────────────────┐
│ 🐆 PumaTrade         💰 1,250 P$  👤│
├─────────────────────────────────────┤
│  Carrera: [Todas ▼]  Tipo: [Todos ▼]│
│  ☐ Solo verificados                 │
│  🔍 [Buscar...]                     │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [📷 TI-89]    800 P$        │    │
│  │ Calculadora    ✓ verificado  │    │
│  │ Sin caja, perfecta           │    │
│  │ Vendida por María · Compu    │    │
│  │ 3 ofertas                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [📷 Arduino Mega] 450 P$     │    │
│  │ Electrónica     ✓ verificado  │    │
│  │ Con cable USB                │    │
│  │ Vendido por Juan · Eléctrica │    │
│  │ 0 ofertas                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [📷 ThinkPad X1] 8,500 P$    │    │
│  │ Electrónica     ✓ verificado  │    │
│  │ Batería 4h, garantía dic    │    │
│  │ Vendido por Sofía · Compu    │    │
│  │ 1 oferta                     │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Cargar más]                       │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Filtros sticky en la parte superior
- Cards de listing (foto, título, precio, badge verificado, vendedor, count ofertas)
- Infinite scroll o "cargar más"

ESTADOS:
- sin listings: empty state
- loading: skeletons
- filtros sin resultados: empty state contextual
```

### 7.4 Pantalla: Detalle de listing (como vendedor)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto del item]                 │
│                                     │
│  Calculadora TI-89 Titanium         │
│  800 P$ · ✓ Verificado              │
│                                     │
│  Vendida por María R.               │
│  Ing. en Computación                │
│                                     │
│  ─── Descripción ───                │
│  Sin caja, pero funciona perfecto.  │
│  Batería nueva. La usé 2 semestres. │
│                                     │
│  ─── Estado ───                     │
│  Publicada hace 3 días              │
│  Estado: Activa                      │
│                                     │
│  ─── Tablero de ofertas (3) ───     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🎁 Trueque puro              │    │
│  │ Pablo ofrece:                │    │
│  │   • Libro Tipler (350 P$)    │    │
│  │ Diferencia a tu favor: 450 P$│    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 💵 Compra directa            │    │
│  │ Juan ofrece: 750 P$          │    │
│  │ (50 P$ menos que tu precio)  │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 🔄 Híbrida (RECOMENDADA)    │    │
│  │ Juan ofrece:                 │    │
│  │   • Arduino Mega (450 P$)    │    │
│  │   • 300 P$ en PumaDolar      │    │
│  │ Valor total: 750 P$          │    │
│  │ Diferencia a tu favor: 50 P$ │    │
│  │ [Rechazar]  [Aceptar]        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Pausar listing]                   │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Foto (slider si hay varias, en seed solo 1)
- Metadata del item
- Tablero de ofertas rankeadas
- Cada oferta muestra desglose económico claro

ESTADOS:
- 0 ofertas: empty state "Aún no hay ofertas. Comparte el link"
- 1 oferta: solo se muestra esa
- oferta aceptada: redirige a detalle del escrow
```

### 7.5 Pantalla: Detalle de listing (como visitante, con botón ofertar)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  [📷 Foto del item]                 │
│                                     │
│  Multímetro Fluke 117               │
│  1,200 P$ · ✓ Verificado            │
│                                     │
│  Vendido por María R.               │
│  Ing. en Computación                │
│                                     │
│  ─── Descripción ───                │
│  Lo usé un semestre. Incluye puntas.│
│                                     │
│  ─── 0 ofertas públicas ───         │
│  (Los ofertantes se mantienen        │
│  anónimos hasta que el vendedor     │
│  publique el tablero)               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Hacer una oferta  →       │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Mismo header que vista vendedor
- Mensaje si no hay ofertas (privacidad)
- CTA "Hacer una oferta"
```

### 7.6 Pantalla: Hacer oferta (modal full-screen)

```
┌─────────────────────────────────────┐
│ ← Cancelar      Hacer oferta        │
├─────────────────────────────────────┤
│                                     │
│  Ofertando por:                     │
│  Multímetro Fluke 117 (1,200 P$)    │
│                                     │
│  ─── Elige el tipo de oferta ───    │
│                                     │
│  ⦿ Trueque puro                     │
│   ○ Compra directa en PumaDolar     │
│   ○ Híbrida (item + diferencia)     │
│                                     │
│  ─── Tu oferta ───                  │
│                                     │
│  ¿Qué das a cambio?                 │
│  ┌─────────────────────────────┐    │
│  │ 📷 Mi laptop vieja           │    │
│  │ Valor estimado: [800] P$    │    │
│  │                       [✕]    │    │
│  └─────────────────────────────┘    │
│  [+ Agregar otro item]              │
│                                     │
│  ─── Balance ───                    │
│  Valor de tu oferta:    800 P$      │
│  Precio del listing:  1,200 P$      │
│  Diferencia:   400 P$ (vendedor     │
│  tendría que pagarte)               │
│                                     │
│  💡 El vendedor elegirá la mejor   │
│  oferta. Sé competitivo.            │
│                                     │
│  Mensaje opcional:                  │
│  ┌─────────────────────────────┐    │
│  │ Hola, mi laptop funciona...  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Enviar oferta  →         │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Selector de tipo de oferta (radio buttons)
- Sub-form dinámico según tipo
- Balance en tiempo real con cálculo de diferencia
- Validación: la diferencia calculada debe ser coherente

VARIANTES:
- pollar-only: solo input de "Cantidad en PumaDolar"
- hybrid: items + input de PumaDolar

ESTADOS:
- form vacío: botón "Enviar" deshabilitado
- form válido: botón habilitado
- enviando: spinner en botón
- éxito: toast "Oferta enviada" + back a listing
```

### 7.7 Pantalla: Detalle de escrow (comprador)

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  🔒 ESCROW ACTIVO                   │
│                                     │
│  ─── Resumen ───                    │
│  Comprando: Multímetro Fluke 117    │
│  A: María R. (Compu)                │
│  Monto: 450 P$                      │
│                                     │
│  Estado actual: 🟡 AWAITING FUNDING │
│  Esperando que JUAN fondee el       │
│  escrow.                            │
│                                     │
│  ─── Acciones ───                   │
│  ┌─────────────────────────────┐    │
│  │  Fondear escrow  →          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ─── Detalle técnico ───            │
│  Cuenta escrow Stellar:            │
│  GABC...XYZ (multi-sig 2-de-2)      │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  ─── Timeline ───                   │
│  ✓ Oferta aceptada (hace 2 min)    │
│  ○ Esperando fondeo                 │
│  ○ Vendedor marca entregado         │
│  ○ Comprador confirma               │
│  ○ Fondos liberados                 │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Banner de estado con color (amarillo/verde/rojo)
- Acciones contextuales al estado y al rol
- Detalle técnico siempre visible (educa al usuario)
- Timeline vertical con estados completados/pendientes

VARIANTES POR ESTADO:
- funded: botón "Marcar como recibido" (rol=buyer) o "Marcar entregado" (rol=seller)
- seller-marked-delivered: para buyer aparece "Confirmar recepción" + "Abrir disputa"
- buyer-confirmed: estado transitorio, redirige a released
- released: vista de recibo final
```

### 7.8 Pantalla: Recibo / transacción completada

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│                                     │
│           ✅ ¡Listo!                 │
│                                     │
│     Intercambio completado          │
│                                     │
│  ─── Resumen ───                    │
│  Compraste: Multímetro Fluke 117    │
│  A: María R.                        │
│  Pagaste: 450 P$                    │
│  Comisión (2%): 9 P$                │
│  María recibió: 441 P$              │
│                                     │
│  ─── Recibo público (Stellar) ───   │
│  Tx hash:                          │
│  abc123def456...                     │
│  [Ver en stellar.expert ↗]          │
│                                     │
│  Memo receipt:                      │
│  0xABCDEF1234567890                  │
│                                     │
│  ─── Tu saldo ───                   │
│  Antes:    2,000 P$                 │
│  Ahora:    1,550 P$                 │
│                                     │
│  ─── Próximos pasos ───             │
│  Coordina la entrega presencial     │
│  con María por el chat del campus.  │
│                                     │
│  [Calificar a María ⭐]             │
│  (próximamente)                     │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Confirmación visual grande
- Desglose económico completo
- Links públicos a Stellar explorer
- Saldo actualizado (refrescado desde Pollar)
- CTA opcional a funcionalidad futura (rating)
```

### 7.9 Pantalla: Crear listing

```
┌─────────────────────────────────────┐
│ ← Cancelar      Publicar artículo   │
├─────────────────────────────────────┤
│                                     │
│  📷 [Subir foto]                    │
│                                     │
│  Título*                            │
│  ┌─────────────────────────────┐    │
│  │ Calculadora TI-89...         │    │
│  └─────────────────────────────┘    │
│                                     │
│  Descripción*                       │
│  ┌─────────────────────────────┐    │
│  │ Sin caja, funciona perfecto..│    │
│  └─────────────────────────────┘    │
│                                     │
│  Precio sugerido* (en PumaDolar)    │
│  ┌─────────────────────────────┐    │
│  │ 800                          │    │
│  └─────────────────────────────┘    │
│  💡 Es un precio de referencia.     │
│  Los ofertantes pueden ofrecer      │
│  menos.                             │
│                                     │
│  Tipo*                              │
│  [Calculadoras ▼]                   │
│                                     │
│  Carreras* (multi-select)           │
│  [✓ Computación] [✓ Eléctrica]      │
│  [✓ Matemáticas] [□ Física]         │
│                                     │
│  Condición                          │
│  [Bueno ▼]                          │
│                                     │
│  ─── Verificación ───               │
│  ┌─────────────────────────────┐    │
│  │ 📹 Subir video de prueba     │    │
│  │ (Mostrando que funciona)     │    │
│  └─────────────────────────────┘    │
│  ☑ Acepto verificación manual       │
│  por moderador (24h)                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Publicar artículo  →     │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Upload de foto (placeholder: cualquier URL pegada)
- Form con validación
- Multi-select de carreras
- Upload de video (placeholder: toggle "video verificado")
- Submit

VALIDACIONES:
- Título: 5-80 chars
- Descripción: 20-500 chars
- Precio: > 0
- Tipo: requerido
- Al menos 1 carrera
- Al menos 1 foto
- Video verificado (o declaración explícita sin verificación)

ESTADOS:
- form vacío: submit deshabilitado
- enviando: spinner
- éxito: toast + redirige a detalle del listing
```

### 7.10 Pantalla: Mi wallet / Settings

```
┌─────────────────────────────────────┐
│ ← Atrás                             │
├─────────────────────────────────────┤
│  👤 María R.                        │
│  maria@unam.mx                      │
│  Ing. en Computación                │
│                                     │
│  ─── Tu wallet ───                  │
│  Balance: 💰 1,691 P$               │
│  [Actualizar]                       │
│                                     │
│  Dirección Stellar:                │
│  GABC...XYZ                         │
│  [Copiar] [Ver en explorer ↗]       │
│                                     │
│  [Ver historial de transacciones]   │
│                                     │
│  ─── Configuración ───              │
│  Notificaciones         [●]         │
│  Idioma            [Español ▼]      │
│                                     │
│  ─── Cuenta ───                     │
│  [Cerrar sesión]                    │
│                                     │
│  v0.1.0 · Testnet                   │
│                                     │
└─────────────────────────────────────┘

COMPONENTES:
- Perfil editable
- Balance grande (refresh button)
- Dirección pública + acciones
- Acceso a TxHistoryModal de Pollar
- Settings varios
- Logout
- Indicador de red (testnet)
```

---

## 8. Seed data — JSON para cargar al iniciar

```json
// seed/seed.json
{
  "users": [
    {
      "id": "usr_maria",
      "email": "maria@unam.mx",
      "displayName": "María R.",
      "major": "Ing. en Computación",
      "bio": "Cambio de carrera, vendo todo lo de circuitos",
      "pollarWalletId": "G-MARIA_WALLET_ID_HERE",
      "balancePumaDolar": 1250
    },
    {
      "id": "usr_juan",
      "email": "juan@unam.mx",
      "displayName": "Juan P.",
      "major": "Ing. Eléctrica",
      "bio": "Armando mi kit de electrónica desde cero",
      "pollarWalletId": "G-JUAN_WALLET_ID_HERE",
      "balancePumaDolar": 2000
    },
    {
      "id": "usr_andrea",
      "email": "andrea@unam.mx",
      "displayName": "Andrea L.",
      "major": "Matemáticas",
      "bio": "Intercambio lo que ya no uso por lo que sí voy a usar",
      "pollarWalletId": "G-ANDREA_WALLET_ID_HERE",
      "balancePumaDolar": 800
    },
    {
      "id": "usr_pablo",
      "email": "pablo@unam.mx",
      "displayName": "Pablo M.",
      "major": "Física",
      "bio": "Armando mi primer kit",
      "pollarWalletId": "G-PABLO_WALLET_ID_HERE",
      "balancePumaDolar": 500
    },
    {
      "id": "usr_sofia",
      "email": "sofia@unam.mx",
      "displayName": "Sofía C.",
      "major": "Ing. en Computación",
      "bio": "Tesis terminada, vendiendo mi setup completo",
      "pollarWalletId": "G-SOFIA_WALLET_ID_HERE",
      "balancePumaDolar": 1800
    }
  ],
  "listings": [
    {
      "id": "lst_ti89",
      "sellerId": "usr_maria",
      "title": "Calculadora TI-89 Titanium",
      "description": "Sin caja, pero funciona perfecto. Batería nueva.",
      "pricePumaDolar": 800,
      "type": "calculadoras",
      "majors": ["Ing. en Computación", "Ing. Eléctrica", "Ing. Mecánica", "Matemáticas", "Física"],
      "condition": "bueno",
      "photoUrl": "/seed/ti89.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_fluke",
      "sellerId": "usr_maria",
      "title": "Multímetro Fluke 117",
      "description": "Lo usé un semestre. Incluye puntas.",
      "pricePumaDolar": 1200,
      "type": "laboratorio",
      "majors": ["Ing. Eléctrica", "Ing. Mecánica", "Física"],
      "condition": "bueno",
      "photoUrl": "/seed/fluke.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_bata_m",
      "sellerId": "usr_maria",
      "title": "Bata blanca talla M",
      "description": "Sin usar, me quedó chica.",
      "pricePumaDolar": 250,
      "type": "batas-uniformes",
      "majors": ["Química", "Biología", "Otra"],
      "condition": "nuevo",
      "photoUrl": "/seed/bata.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_arduino",
      "sellerId": "usr_juan",
      "title": "Arduino Mega 2560",
      "description": "Compré dos, vendo uno. Con cable USB.",
      "pricePumaDolar": 450,
      "type": "electronica",
      "majors": ["Ing. en Computación", "Ing. Eléctrica", "Ing. Mecánica"],
      "condition": "como-nuevo",
      "photoUrl": "/seed/arduino.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_sadiku",
      "sellerId": "usr_juan",
      "title": "Libro Sadiku — Elementos de Electromagnetismo",
      "description": "Tiene marcatexto en cap. 3, resto limpio.",
      "pricePumaDolar": 300,
      "type": "libros",
      "majors": ["Ing. Eléctrica", "Ing. Mecánica", "Física"],
      "condition": "bueno",
      "photoUrl": "/seed/sadiku.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_spivak",
      "sellerId": "usr_andrea",
      "title": "Cálculo de Spivak (3ra ed.)",
      "description": "Edición original. Algunos ejercicios resueltos a lápiz.",
      "pricePumaDolar": 600,
      "type": "libros",
      "majors": ["Matemáticas", "Física", "Ing. en Computación"],
      "condition": "bueno",
      "photoUrl": "/seed/spivak.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_bata_ch",
      "sellerId": "usr_andrea",
      "title": "Bata blanca talla CH",
      "description": "Como nueva.",
      "pricePumaDolar": 200,
      "type": "batas-uniformes",
      "majors": ["Química", "Biología", "Otra"],
      "condition": "como-nuevo",
      "photoUrl": "/seed/bata-ch.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_tipler",
      "sellerId": "usr_pablo",
      "title": "Libro Tipler — Física Moderna",
      "description": "Lo compré por error, ya no lo necesito.",
      "pricePumaDolar": 350,
      "type": "libros",
      "majors": ["Física", "Ing. Eléctrica", "Ing. Mecánica"],
      "condition": "como-nuevo",
      "photoUrl": "/seed/tipler.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_thinkpad",
      "sellerId": "usr_sofia",
      "title": "Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)",
      "description": "Batería dura 4 horas. Garantía hasta dic 2026.",
      "pricePumaDolar": 8500,
      "type": "electronica",
      "majors": ["Ing. en Computación", "Ing. Eléctrica", "Matemáticas", "Física", "Otra"],
      "condition": "bueno",
      "photoUrl": "/seed/thinkpad.jpg",
      "videoVerified": true,
      "status": "active"
    },
    {
      "id": "lst_raspi",
      "sellerId": "usr_sofia",
      "title": "Raspberry Pi 4 Model B 8GB",
      "description": "Con caja oficial y disipadores.",
      "pricePumaDolar": 1100,
      "type": "electronica",
      "majors": ["Ing. en Computación", "Ing. Eléctrica"],
      "condition": "como-nuevo",
      "photoUrl": "/seed/raspi.jpg",
      "videoVerified": true,
      "status": "active"
    }
  ],
  "offers": [
    {
      "id": "ofr_pablo_ti89",
      "listingId": "lst_ti89",
      "offererId": "usr_pablo",
      "type": "barter",
      "offeredItems": [
        {
          "title": "Libro Tipler — Física Moderna",
          "estimatedValuePumaDolar": 350
        }
      ],
      "message": "Me serviría mucho para el próximo semestre.",
      "status": "pending",
      "createdAt": "2026-09-23T15:30:00Z"
    },
    {
      "id": "ofr_juan_ti89_full",
      "listingId": "lst_ti89",
      "offererId": "usr_juan",
      "type": "pollar-only",
      "pollarAmount": 750,
      "message": "Te la compro en efectivo digital, sin trueques.",
      "status": "pending",
      "createdAt": "2026-09-23T16:00:00Z"
    },
    {
      "id": "ofr_juan_ti89_hybrid",
      "listingId": "lst_ti89",
      "offererId": "usr_juan",
      "type": "hybrid",
      "offeredItems": [
        {
          "title": "Arduino Mega 2560",
          "estimatedValuePumaDolar": 450
        }
      ],
      "pollarAmount": 300,
      "message": "Oferta final, la hago porque necesito la calculadora para circuitos.",
      "status": "pending",
      "createdAt": "2026-09-23T16:05:00Z"
    },
    {
      "id": "ofr_pablo_thinkpad",
      "listingId": "lst_thinkpad",
      "offererId": "usr_pablo",
      "type": "pollar-only",
      "pollarAmount": 8300,
      "message": "Si me la dejas en 8300 te la compro hoy.",
      "status": "pending",
      "createdAt": "2026-09-24T09:00:00Z"
    }
  ]
}
```

### 8.1 Botón "Reset demo data"

La app debe tener un botón visible en Settings (solo visible si `process.env.NODE_ENV !== 'production'`) que:
1. Limpia la DB
2. Recarga `seed.json`
3. Resetea balances de los 5 usuarios en Pollar (vía API server-side)

---

## 9. Modelo de ingresos — implementación

### 9.1 Fee al release

```typescript
// lib/fees.ts
export const PLATFORM_FEE_BPS = 200; // 2%

export function calculateFee(amountPumaDolar: number): number {
  const raw = (amountPumaDolar * PLATFORM_FEE_BPS) / 10000;
  return Math.round(raw * 1_000_000) / 1_000_000;
}

// Aplicar durante el release:
// const sellerReceives = amount - calculateFee(amount);
// const platformReceives = calculateFee(amount);
// (Ambos transfers van en la misma tx de Stellar con 2 operations)
```

### 9.2 Política de lanzamiento

**Hackathon / Demo:** `PLATFORM_FEE_BPS = 0` (gratis). Configurar vía env var.

**Producción temprana:** `PLATFORM_FEE_BPS = 200` (2%).

**Post-lanzamiento:** considerar fee dinámico o featured listings ($10-15 P$).

### 9.3 Visibilidad del fee

El fee SIEMPRE se muestra antes de confirmar el release, en el modal de confirmación:
```
Vas a liberar: 450 P$
Comisión plataforma (2%): -9 P$
María recibirá: 441 P$
[Cancelar] [Confirmar]
```

---

## 10. Stack técnico y arquitectura

### 10.1 Dependencias

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "@pollar/core": "^0.11.3",
    "@pollar/react": "^0.11.3",
    "@stellar/stellar-sdk": "^11.0.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.5.0",
    "zod": "^3.23.0",
    "@prisma/client": "^5.15.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "prisma": "^5.15.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.0"
  }
}
```

### 10.2 Estructura de carpetas

```
.
├── app/
│   ├── layout.tsx              # Root layout con PollarProvider
│   ├── page.tsx                # Splash / Auth
│   ├── home/
│   │   └── page.tsx            # Home (3.2)
│   ├── marketplace/
│   │   ├── page.tsx            # Explorar (3.3)
│   │   └── [listingId]/
│   │       └── page.tsx        # Detalle listing (3.4 / 3.5)
│   ├── offer/
│   │   └── [listingId]/
│   │       └── page.tsx        # Hacer oferta (3.6)
│   ├── escrow/
│   │   └── [escrowId]/
│   │       └── page.tsx        # Detalle escrow (3.7)
│   ├── escrow-complete/
│   │   └── [escrowId]/
│   │       └── page.tsx        # Recibo (3.8)
│   ├── create/
│   │   └── page.tsx            # Crear listing (3.9)
│   ├── settings/
│   │   └── page.tsx            # Wallet y config (3.10)
│   └── api/
│       ├── escrow/
│       │   ├── fund/
│       │   │   └── route.ts    # POST: fondear escrow
│       │   ├── release/
│       │   │   └── route.ts    # POST: liberar escrow
│       │   ├── mark-delivered/
│       │   │   └── route.ts    # POST: seller marca entregado
│       │   ├── confirm/
│       │   │   └── route.ts    # POST: buyer confirma
│       │   └── timeout-check/
│       │       └── route.ts    # GET: cron check
│       ├── offers/
│       │   └── route.ts        # POST: crear oferta
│       ├── listings/
│       │   └── route.ts        # POST: crear listing
│       └── reset-demo/
│           └── route.ts        # POST: reset (solo dev)
├── components/
│   ├── ListingCard.tsx
│   ├── OfferCard.tsx
│   ├── EscrowTimeline.tsx
│   ├── FilterBar.tsx
│   └── WalletBadge.tsx
├── lib/
│   ├── db.ts                  # Prisma client
│   ├── pollar.ts              # Server-side Pollar client
│   ├── stellar.ts             # Stellar SDK helpers (multi-sig, escrow)
│   ├── fees.ts
│   └── validation.ts          # Zod schemas
├── prisma/
│   └── schema.prisma
├── seed/
│   └── seed.json
├── public/
│   └── seed/                  # Fotos placeholder de items seed
├── types/
│   └── db.ts
├── .env.local
├── tailwind.config.ts
└── package.json
```

### 10.3 Schema de Prisma

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id              String    @id
  email           String    @unique
  displayName     String
  major           String
  bio             String
  pollarWalletId  String
  balancePumaDolar Float    @default(0)
  createdAt       DateTime  @default(now())

  listings        Listing[]
  offersMade      Offer[]   @relation("OffererOffers")
  escrowsAsBuyer  Escrow[]  @relation("BuyerEscrows")
  escrowsAsSeller Escrow[]  @relation("SellerEscrows")
  txLogs          TransactionLog[]
}

model Listing {
  id              String    @id
  sellerId        String
  seller          User      @relation(fields: [sellerId], references: [id])
  title           String
  description     String
  pricePumaDolar  Float
  type            String
  majors          String    // JSON array
  condition       String
  photoUrl        String
  videoVerified   Boolean   @default(false)
  status          String    @default("active")
  createdAt       DateTime  @default(now())

  offers          Offer[]
  escrows         Escrow[]
}

model Offer {
  id              String    @id
  listingId       String
  listing         Listing   @relation(fields: [listingId], references: [id])
  offererId       String
  offerer         User      @relation("OffererOffers", fields: [offererId], references: [id])
  type            String    // 'barter' | 'pollar-only' | 'hybrid'
  offeredItems    String?   // JSON array
  pollarAmount    Float?
  message         String?
  status          String    @default("pending")
  createdAt       DateTime  @default(now())

  escrows         Escrow[]
}

model Escrow {
  id                      String    @id
  offerId                 String    @unique
  offer                   Offer     @relation(fields: [offerId], references: [id])
  listingId               String
  listing                 Listing   @relation(fields: [listingId], references: [id])
  buyerId                 String
  buyer                   User      @relation("BuyerEscrows", fields: [buyerId], references: [id])
  sellerId                String
  seller                  User      @relation("SellerEscrows", fields: [sellerId], references: [id])
  pollarAmount            Float
  stellarEscrowAccount    String
  stellarTxHashFunding    String?
  stellarTxHashRelease    String?
  stellarMemoReceipt      String?
  status                  String    @default("awaiting-funding")
  sellerDeliveredAt       DateTime?
  buyerConfirmedAt         DateTime?
  releasedAt              DateTime?
  platformFeePumaDolar    Float     @default(0)
  createdAt               DateTime  @default(now())
  expiresAt               DateTime

  txLogs                  TransactionLog[]
}

model TransactionLog {
  id          String   @id @default(cuid())
  escrowId    String
  escrow      Escrow   @relation(fields: [escrowId], references: [id])
  actorId     String
  actor       User     @relation(fields: [actorId], references: [id])
  action      String
  metadata    String?  // JSON
  createdAt   DateTime @default(now())
}
```

### 10.4 Stores de cliente (Zustand)

```typescript
// stores/authStore.ts — current user
// stores/escrowStore.ts — cache de escrows activos del user
// stores/uiStore.ts — toasts, modals globales
```

---

## 11. Setup checklist pre-hackathon (ANTES de codear)

**Día 0 (T-24h o antes):**

- [ ] Una persona crea app en [dashboard.pollar.xyz](https://dashboard.pollar.xyz)
  - [ ] Network: Stellar Testnet
  - [ ] Account model: G-accounts
  - [ ] Funding mode: Immediate
  - [ ] Auth providers: Google habilitado
  - [ ] Obtener API keys (`pk_test_*` y `sk_test_*`)
- [ ] Fondear treasury de la app con USDC en testnet (suficiente para los 5 usuarios seed: ~10,000 USDC)
- [ ] Crear 5 cuentas de Google (una por persona del equipo o usar la misma + sufijo)
- [ ] Pre-crear 5 wallets en Pollar (uno por usuario seed)
- [ ] Fondear cada wallet seed con su balance inicial desde el treasury
- [ ] Capturar los IDs de las wallets (`G-...`) para pegarlos en `seed.json`
- [ ] Probar un send manual entre dos wallets seed vía dashboard de Pollar

**Día 0 (T-2h):**

- [ ] Repo clonado, `npm install` ejecutado
- [ ] `.env.local` con todas las variables configuradas
- [ ] `prisma migrate dev` y `prisma db seed` ejecutados sin errores
- [ ] Login con Google funciona
- [ ] Saldo de los 5 usuarios visible en la home
- [ ] Listings seed visibles en el marketplace

**Día 1 (durante el hackathon):**

- [ ] Implementar happy path completo en orden:
  1. Login + home
  2. Marketplace + detalle listing
  3. Hacer oferta (3 tipos)
  4. Tablero de ofertas del vendedor
  5. Aceptar oferta → crear escrow (sin funding aún)
  6. Detalle escrow + funding con SendModal
  7. Mark delivered + confirm
  8. Release + comisión + memo
  9. Recibo final
- [ ] Implementar seed offers antes del demo (para que el tablero no esté vacío)
- [ ] Botón "Reset demo data" funcional
- [ ] Probar happy path en móvil de pies a cabeza

---

## 12. Backlog post-MVP (la casa que viene después)

Documentar esto en el pitch como la "Casa" más allá del "Ladrillo":

- **Servicios / tutorías:** ofertar tiempo (1 hr de clase de cálculo = X P$). Requiere nueva entidad `ServiceOffer` y validación de reputación.
- **Agente IA (PumaAgent):** búsqueda en lenguaje natural, detector de sobreprecio contra mercado, asesor de depreciación de hardware.
- **Instant Buyback:** la plataforma compra urgente con descuento para dar liquidez inmediata al vendedor.
- **Foro de nuevo ingreso:** guía de qué materiales comprar por carrera, link directo a listings relevantes.
- **Rentas para foráneos:** escrow de depósitos de arrendamiento, contratos firmados en Stellar.
- **Pagos en cafeterías de CU:** PumaDolar aceptado en comercios del campus (integración con Pollar Pay).
- **Sistema de reputación:** ratings post-transacción, badge de "vendedor confiable".
- **Featured listings:** pago en P$ por destacar items (10-15 P$ / semana).
- **Onramp fiat:** comprar P$ con tarjeta bancaria vía SEP-24 de Pollar.
- **Multi-carrera dinámica:** agregar nuevas majors sin redeploy.
- **App nativa iOS/Android:** React Native + `@pollar/react` ya tiene adaptadores para RN.
- **Chat dentro de la app:** mensajería pre-encuentro para coordinar entrega.

---

## 13. Demo script (3 minutos)

**Antes del demo (T-30min):**
- 2 teléfonos cargados, sesión iniciada cada uno con un usuario distinto (María y Juan)
- Laptop de respaldo con el dashboard de Stellar abierto (stellar.expert) listo para mostrar tx hashes
- Backup del seed data reseteado
- Grabar un video corto del happy path como respaldo (por si falla algo en vivo)

**Guión del presentador (mientras opera el teléfono en pantalla):**

```
[0:00 - 0:30] CONTEXTO
"Cada semestre, los estudiantes de la UNAM gastamos miles de pesos 
en libros, calculadoras, componentes... que después quedan arrumbados 
para siempre. El problema es: ¿cómo los intercambias sin que te estafen?

Hoy les mostramos PumaTrade: un marketplace donde el trueque se vuelve 
justo gracias a una diferencia que se paga en PumaDolar, nuestra moneda 
digital construida sobre Stellar a través de Pollar — sin que el usuario 
tenga que aprender qué es blockchain."

[0:30 - 1:00] NAVEGACIÓN + TABLERO
[Abrir app, ya logueada como María. Ir a "Mis listings" → TI-89]
"Esta es María. Tiene una calculadora que ya no usa. Publicó su listing 
en menos de 30 segundos — solo填 la descripción, le puso un precio 
sugerido de 800 PumaDolar, y listo.

Vean su tablero: en 24 horas recibió TRES ofertas distintas..."

[1:00 - 1:45] TABLERO DE OFERTAS MÚLTIPLES
[Mostrar las 3 ofertas: trueque puro, compra directa, híbrida]
"Una persona le ofrece trueque directo por un libro. Otra le compra 
en PumaDolar. Y Juan —Juan le ofrece algo más interesante: su Arduino 
Mega valuado en 450 PumaDolar, MÁS 300 PumaDolar para completar la 
diferencia.

María elige la oferta híbrida. ¿Por qué? Porque se lleva un componente 
que SÍ va a usar, más 300 P$ para su próximo semestre."

[1:45 - 2:15] CREACIÓN DEL ESCROW
[Tocar "Aceptar oferta" → mostrar modal "Escrow creado"]
"Automáticamente se crea un smart contract — bueno, técnicamente una 
cuenta multi-sig en Stellar — que retiene los 450 PumaDolar de Juan. 
Aquí está la dirección pública, cualquiera la puede ver en stellar.expert.
[Abrir stellar.expert en laptop, mostrar la cuenta recién creada]

Juan fondea el escrow — tocan el botón, Pollar firma por ellos con su 
Google. Cero seed phrases. Cero complejidad."

[2:15 - 2:45] ENCUENTRO + RELEASE
[Cambiar a cuenta de Juan, mostrar detalle del escrow funded]
"Se encuentran en el campus. Juan verifica la calculadora, todo bien.
[Marcar entregado, luego confirmar]

Ahora viene lo importante: tocar 'Confirmar y liberar'. Esto ejecuta 
una transacción en Stellar que transfiere 441 PumaDolar a María (9 se 
quedan de comisión) y deja un recibo público en la blockchain."

[2:45 - 3:00] RECIBO + RECAP
[Mostrar pantalla de recibo]
"Vean: el saldo de María ya se actualizó. El memo receipt está aquí. 
Cero estafa posible. Cero reclamos.

Esto es PumaTrade: el trueque del siglo XXI, sin que tengas que entender 
blockchain. Gracias."

---

## 14. Riesgos conocidos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Pollar no tiene Stellar testnet USDC trustline | Media | Configurar trustline manualmente con `stellar-cli` o vía dashboard antes del demo |
| Multi-sig setup tarda más de lo esperado | Alta | Tener cuenta Stellar pre-creada como template; clonar para cada escrow |
| Timeout 48h no testeable en demo | Baja | En demo, setear `expiresAt` a 5 minutos via env var `DEMO_FAST_TIMEOUT=true` |
| SendModal de Pollar no funciona en mobile Safari | Baja | Probar en Chrome mobile antes del demo; tener Chrome como backup |
| Balance desincronizado entre Pollar y DB local | Media | Refrescar balance con `client.refreshBalance()` después de cada acción que afecte fondos |
| Tx hash no aparece inmediatamente en stellar.expert | Alta | Esperar 5-10 segundos antes de mostrarlo al jurado; tener un tx ya en explorer de backup |
| 5 wallets seed no creadas a tiempo | Media | Plan B: en el peor caso, demo con 2 wallets (María y Juan) y 3 listings dummy |
| Comisión del 2% rompe el flujo visualmente | Baja | Si el cálculo da números feos, redondear a enteros para el demo (`Math.round`) |

---

## 15. Glosario rápido

- **PumaDolar (P$):** nombre visual de la moneda en la app. 1 P$ = 1 USDC (en testnet).
- **Pollar:** SDK de infraestructura para Stellar que crea wallets embebidas.
- **Stellar:** blockchain L1 usada como capa de liquidación.
- **Multi-sig:** cuenta Stellar que requiere N firmas de M para operar.
- **Escrow:** retención de fondos condicionada a confirmación de entrega.
- **Memo receipt:** campo `memo_text` de una tx Stellar que sirve como prueba.
- **Seed data:** datos precargados que viven en `seed/seed.json`.
- **MVP:** mínimo producto viable (este PRD).
- **"El Ladrillo":** lo que se muestra en vivo en el hackathon.
- **"La Casa":** la visión completa (post-MVP).

---

**FIN DEL PRD**

*Versión 1.0 — listo para implementación. Cualquier duda del implementador, debe quedar resuelta leyendo este documento + la doc oficial de Pollar (`https://docs.pollar.xyz/llms-full.txt`).*