# Gremium — Goya-Hack

> **Marketplace universitario de intercambio flexible con dinero protegido y ventana de prueba.**

Gremium permite a los estudiantes de la UNAM **publicar artículos académicos en desuso** (libros, calculadoras, batas, componentes electrónicos) y recibir propuestas en **3 formatos**: solo saldo en **XLM (Lumens)**, objeto por objeto (trueque puro), o una combinación de ambos (híbrido). El vendedor **elige la mejor oferta desde su tablero**.

Cuando una oferta se acepta, el saldo del comprador se **congela en un smart contract** (cuenta Stellar multi-sig 2-de-2: plataforma + llave de arbitraje). El listing pasa a **"Pendiente"** — un solo escrow por publicación, no se aceptan más ofertas. Los estudiantes se encuentran en la facultad, **intercambian físicamente los objetos**, y ambos registran ese momento en la app. En ese instante arranca una **ventana de prueba (TTL)** — 48 horas en producción, 3 minutos en modo demo. Tres caminos posibles durante esa ventana:

- **Rama A (happy path):** el comprador prueba el artículo y acepta → el pago se libera al vendedor.
- **Rama B (auto-resolve):** el comprador no confirma → el TTL expira → el sistema libera automáticamente (nadie puede secuestrar los fondos).
- **Rama C (disputa):** el comprador reporta un problema (artículo dañado / intercambio nunca ocurrió / artículo diferente al publicado) con foto y descripción → el escrow se congela para revisión.

Todo se mueve en **Lumens (XLM)**, la moneda nativa de la red **Stellar** (testnet para el demo), gestionada a través del SDK [Pollar](https://pollar.xyz) — wallets embebidas que se crean con solo iniciar sesión con Google o email OTP. Cero seed phrases, cero conocimiento de blockchain. Sin tokens propios ni emisores: el saldo de la app ES XLM real.

---

## Demo en un solo comando

```bash
git clone https://github.com/zums-stuff/Goya-Hack.git
cd Goya-Hack
npm install
npm run demo          # ← UN comando. Levanta todo.
```

`npm run demo` corre `scripts/demo.mjs`, que en orden:

1. Verifica Node ≥ 20 + Docker.
2. Levanta Postgres local en Docker (`pumatrade-db`, puerto 5433) — idempotente.
3. Espera a que Postgres acepte conexiones (`pg_isready`).
4. `prisma migrate deploy` (idempotente, corre migrations SQL).
5. `prisma/seed.ts` — siembra los 6 usuarios (`juan / maría / andrea / pablo / sofía / diego`) + 17 listings + 7 offers. Siembra omite si la DB ya tiene users (idempotente).
6. Arranca `next dev` con `ENABLE_CRON=true`, `DEMO_TTL_MINUTES=3`, `CONFIRM_WINDOW_MINUTES=10`, `HACKATHON_FREE_FEES=true` (TTL de 3 min para demos rápidos).
7. Hace polling contra `/api/auth/me` hasta 200.
8. Imprime:

```
   ✓ Self-check (0.1s)
   ✓ Postgres up (1.8s)
   ✓ Postgres healthy (0.1s)
   ✓ Prisma migrations (0.4s)
   ✓ Demo seed (0.3s)
   ✓ Start dev server (4.0s)
   ✓ Wait for server (1.2s)

  ╔═════════════════════════════════════════════════╗
  ║   🎉 READY — open http://localhost:3000         ║
  ╚═════════════════════════════════════════════════╝
```

Al correr Ctrl-C, el dev server se detiene. Para volver a montar: `npm run demo` otra vez (idempotente).

### Personas de prueba disponibles

| Persona | Interest | Listings | Pendientes de aceptar |
|---|---|---|---|
| María R.   | Ing. Computación  | 3 (TI-89, Fluke, Bata M)         | 0 |
| Juan P.    | Ing. Eléctrica    | 2 (Arduino, Sadiku)              | 0 |
| Andrea L.  | Matemáticas       | 2 (Spivak, Bata CH, Gafas lab)   | 0 |
| Pablo M.   | Física            | 3 (Tipler, Casio fx-991, Stewart)| 0 |
| Sofía C.   | Ing. Computación  | 3 (ThinkPad, RPi4, microSD)      | 0 |
| **Diego G.** | **Ing. Mecánica** | **3 (Vernier, Soldador, Bici)** | **3 ofertas pendientes** ⭐ |

**Diego** es la "persona demo" — su `/incoming-offers` muestra tres ofertas entrantes (María le ofrece 650 XLM cash por la estación de soldadura, Pablo truequea su Casio por el Vernier, Juan 2800 XLM cash por la bici). Esa vista es la única donde se puede disparar el flow completo de escrow sin alternar cuentas: acepta una oferta y verás el cap. Sesgo → 2-of-2 → grabación en Stellar testnet.

### Reset rápido

```bash
npm run db:reset      # recrea contenedor Postgres vacío
npm run demo          # vuelve a correr todo desde cero
```

---

## Quickstart (control fino)

Si prefieres paso a paso manual en vez de `npm run demo`, la versión larga sigue aquí. Útil sólo cuando estés depurando algo específico del bootstrap.

```bash
# Requisitos: Node 22 LTS, Docker Desktop corriendo.
nvm use                                # Node 22 LTS
npm install
npm run db:up                          # Postgres local (puerto 5433)
npx prisma migrate deploy              # aplica migrations
npm run db:seed                        # 6 users + 17 listings + 7 offers

# Arranca con cron in-process (TTL corto para demos rápidos):
npm run dev
```

> ⚠️ **Importante:** para el demo en celulares por LAN, agrega la IP de tu máquina
> (ej. `http://192.168.x.x:3000`) tanto a los **allowed origins de la app Pollar**
> (dashboard.pollar.xyz) como a tu `.env.local`. Sin esto, Pollar rechaza el login.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / App | Next.js **16.2.9** (App Router) + React **19.3.0** + TypeScript ^5.9 + Tailwind **4.3.3** |
| Wallets embebidas | [`@pollar/react`](https://github.com/pollar-xyz/pollar) **0.11.3** + [`@pollar/core`](https://www.npmjs.com/package/@pollar/core) **0.11.3** |
| Blockchain | Stellar (testnet) SDK **17.1.0** — escrow multi-sig 2-de-2 (plataforma + llave de arbitraje). Moneda nativa XLM (sin tokens). |
| Estado local | Zustand 5.0.15 |
| ORM | Prisma **7.10.0** + Postgres (local Docker en dev · serverless en prod) |
| Validación | Zod 4.6.5 |
| Cron | `setInterval` 30s en dev (`instrumentation.ts`) · Vercel Cron 1 min en prod |

---

## Documentación

- **[`PRD.md`](PRD.md)** — Product Requirements Document completo (v3.4): QUÉ construimos — modelo de datos, los 3 tipos de oferta, máquina de estados del escrow (intercambio registrado → TTL → 3 ramas), wireframes, seed data, variables de entorno, checklist pre-hackathon y guión de demo de 3 minutos.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — Blueprint de implementación (v1.3): CÓMO lo construimos — versiones exactas pinned, Prisma schema completo, Stellar SDK 17 (multi-sig 2-de-2, reserva, operaciones), máquina de estados con carrera-safe `updateMany`, endpoints, componentes clave, cron, seguridad, plan en 10 bloques. **Este es el documento que sigue el implementador.**

- [Documento MVP ](https://docs.google.com/document/d/1ut08s4x3h_ELaW86xqLz0RL17Ytuf7euiq6waGZi5yo/edit) — Especificación del Producto Mínimo Viable: EL LADRILLO — alcance funcional para el hackathon, validación de la hipótesis crítica y flujo presencial de intercambio protegido sin tecnicismos.

---

## MVP (versión actual)

- Marketplace con filtros por carrera × tipo de item
- Publicación con foto + flag video-verified
- 3 tipos de oferta: solo saldo / trueque puro / híbrida (objeto + saldo)
- Tablero del vendedor para elegir la mejor oferta
- Escrow Stellar con flujo **intercambio físico registrado → TTL → 3 ramas**:
  - Rama A: comprador acepta → release firmado por plataforma+árbitro
  - Rama B: TTL expira → auto-resolve (cron) a favor del vendedor
  - Rama C: comprador reporta (dañado / nunca ocurrió / item diferente) → disputa congelada con evidencia (hash anclado en Stellar `manageData`)
- Comisión de plataforma (2% sobre el monto XLM liberado; 0% durante el hackathon)
- Alerta de precios inflados vs catálogo de referencia (motor sin estado)
- Cola de disputas para admin (resolver release o refund)
- 5 usuarios seed + 10 listings + 4 ofertas precargados (saldos PRD §1)

---

## Fuera de alcance del MVP ("La Casa" a futuro)

- Tarjeta física NFC (Tangem) para confirmar transacciones
- Pagos de depósitos de renta para estudiantes foráneos
- Pago de comidas en cafeterías con XLM
- Foro comunitario para guiar a alumnos de nuevo ingreso
- Opción de compra urgente (buyback) por la plataforma
- Asistente IA completo (búsqueda en lenguaje natural, tasador de depreciación)
- On-ramp fiat (depósito real de saldo vía SEP-24)
- Smart contract Soroban real sustituyendo el multi-sig
- Reputación y ratings post-transacción

---

## Estado del proyecto

🚧 **En desarrollo — preparación para hackathon** · Alcance MVP definido en PRD v3.4 + ARCHITECTURE v1.3 (pinned) + Bloque 0-9 implementado.

---

## Licencia

MIT
