# PumaTrade — Goya-Hack

> **Marketplace universitario de intercambio flexible con dinero protegido y ventana de prueba.**

PumaTrade permite a los estudiantes de la UNAM **publicar artículos académicos en desuso** (libros, calculadoras, batas, componentes electrónicos) y recibir propuestas en **3 formatos**: solo saldo en **XLM (Lumens)**, objeto por objeto (trueque puro), o una combinación de ambos (híbrido). El vendedor **elige la mejor oferta desde su tablero**.

Cuando una oferta se acepta, el saldo del comprador se **congela en un smart contract** (cuenta Stellar multi-sig 2-de-2: plataforma + llave de arbitraje). El listing pasa a **"Pendiente"** — un solo escrow por publicación, no se aceptan más ofertas. Los estudiantes se encuentran en la facultad, **intercambian físicamente los objetos**, y ambos registran ese momento en la app. En ese instante arranca una **ventana de prueba (TTL)** — 48 horas en producción, 3 minutos en modo demo. Tres caminos posibles durante esa ventana:

- **Rama A (happy path):** el comprador prueba el artículo y acepta → el pago se libera al vendedor.
- **Rama B (auto-resolve):** el comprador no confirma → el TTL expira → el sistema libera automáticamente (nadie puede secuestrar los fondos).
- **Rama C (disputa):** el comprador reporta un problema (artículo dañado / intercambio nunca ocurrió / artículo diferente al publicado) con foto y descripción → el escrow se congela para revisión.

Todo se mueve en **Lumens (XLM)**, la moneda nativa de la red **Stellar** (testnet para el demo), gestionada a través del SDK [Pollar](https://pollar.xyz) — wallets embebidas que se crean con solo iniciar sesión con Google o email OTP. Cero seed phrases, cero conocimiento de blockchain. Sin tokens propios ni emisores: el saldo de la app ES XLM real.

---

## Quickstart (demo local)

```bash
# 1. Setup
nvm use                                # Node 22 LTS
npm install
npm run setup:env                      # genera .env.local + fondea treasury testnet (2 cuentas friendbot)
npm run db:up                          # levanta Postgres local en Docker (puerto 5433)
npx prisma migrate dev --name init     # crea tablas
npm run db:seed                        # siembra 5 users + 10 listings + 4 offers

# 2. Arranca el dev server con cron in-process
ENABLE_CRON=true DEMO_TTL_MINUTES=3 CONFIRM_WINDOW_MINUTES=10 \
  HACKATHON_FREE_FEES=true npm run dev

# 3. Pre-crear 5 inboxes en mail.tm y loguearse con cada uno (paso §15.10).
#    El dev helper fondea cada wallet con el saldo PRD §1.
npm run capture:wallets                # valida las 5 wallets seed en Horizon
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
