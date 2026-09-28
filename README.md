# Gremium — Goya-Hack 2026

> **Marketplace universitario de intercambio flexible con dinero protegido y ventana de prueba.**

Gremium permite a los estudiantes de la UNAM **publicar artículos académicos en desuso** (libros, calculadoras, batas, componentes electrónicos) y recibir propuestas en **3 formatos**: solo saldo en **XLM (Lumens)**, objeto por objeto (trueque puro), o una combinación de ambos (híbrido). El vendedor **elige la mejor oferta desde su tablero**.

Cuando una oferta se aceptan, el saldo del comprador se **congela en un smart contract** (cuenta Stellar multi-sig 2-de-2: plataforma + llave de arbitraje). El listing pasa a **"Pendiente"** — un solo escrow por publicación, no se aceptan más ofertas. Los estudiantes se encuentran en la facultad, **intercambian físicamente los objetos**, y ambos registran ese momento en la app. En ese instante arranca una **ventana de prueba (TTL)** — 48 horas en producción, 3 minutos en modo demo. Tres caminos posibles durante esa ventana:

- **Rama A (happy path):** el comprador prueba el artículo y acepta → el pago se libera al vendedor.
- **Rama B (auto-resolve):** el comprador no confirma → el TTL expira → el sistema libera automáticamente (nadie puede secuestrar los fondos).
- **Rama C (disputa):** el comprador reporta un problema (artículo dañado / intercambio nunca ocurrió / artículo diferente al publicado) con foto y descripción → el escrow se congela para revisión.

Todo se mueve en **Lumens (XLM)**, la moneda nativa de la red **Stellar** (testnet para el demo), gestionada a través del SDK [Pollar](https://pollar.xyz) — wallets embebidas que se crean con solo iniciar sesión con Google o email OTP. Cero seed phrases, cero conocimiento de blockchain. Sin tokens propios ni emisores: el saldo de la app ES XLM real.

---

## ⚡ Demo en un solo comando

```bash
git clone https://github.com/zums-stuff/Goya-Hack.git
cd Goya-Hack
npm install
cp .env.example .env.local     # rellena SOLO las 5 claves de Pollar (ver abajo)
npm run demo                   # ← UN comando. Levanta todo.
```

> **Requisitos:** Node ≥ 20 y Docker Desktop corriendo. En Windows hace falta **Git Bash** (viene con Git for Windows) — `npm run demo` es un script bash. En macOS/Linux `bash` ya está.
>
> ⚠️ **Si corres el comando desde WSL**, Docker Desktop debe tener la integración WSL activada: *Settings → Resources → WSL Integration → Enable*. El runner detecta esto y te lo dice explícito si falta.

`npm run demo` ejecuta `scripts/demo.sh`, que recorre 7 pasos **idempotentes** y se queda en foreground:

| # | Paso | Qué hace |
|---|---|---|
| 1 | Self-check | Node ≥ 20, daemon de Docker alcanzable |
| 2 | Postgres up | Contenedor `pumatrade-db` (`postgres:16`) en `:5433` — lo crea si no existe |
| 3 | Postgres healthy | Polling a `pg_isready` (timeout 30 s) |
| 4 | Prisma migrations | `prisma migrate deploy` |
| 5 | Demo seed | `prisma/seed.ts` — 6 usuarios · 17 listings · 7 ofertas. Aborta si ya hay usuarios |
| 6 | Dev server | `next dev` con `ENABLE_CRON=true`, `DEMO_TTL_MINUTES=3`, `CONFIRM_WINDOW_MINUTES=10`, `HACKATHON_FREE_FEES=true` |
| 7 | Wait for server | Polling a `/api/auth/me` hasta 200 (timeout 45 s) |

Salida real (una vez en verde):

```
╔═════════════════════════════════════════════════╗
║     Gremium — Goya-Hack 2026 demo runner       ║
╚═════════════════════════════════════════════════╝
Single command to bring up the entire demo. Ensure Docker
Desktop is running on Windows / OrbStack on Mac — the script
uses Docker to host Postgres on localhost:5433.

[1. Self-check] starting...
✓ Node v24.19.0 (/usr/local/bin/node)
✓ Docker daemon reachable (/usr/local/bin/docker)
[2. Postgres up] starting...
✓ pumatrade-db ya corriendo en :5433
[3. Postgres healthy] starting...
✓ ready @ :5433 (postgresql://postgres:postgres@localhost:5433/pumatrade?sslmode=disable)
[4. Prisma migrations] starting...
✓ Migrations aplicadas
[5. Demo seed] starting...
✓ Seed DB
[6. Start dev server] starting...
[7. Wait for server] starting...
✓ Respondiendo en http://localhost:3000

╔═════════════════════════════════════════════════╗
║              🎉 READY                           ║
║                                                 ║
║  Open:    http://localhost:3000                 ║
║  Mode:    Demo (6 users · 17 listings · 7 offers)║
║  Stop:    Ctrl-C en esta terminal               ║
║  Reset:   npm run db:reset && npm run demo      ║
╚═════════════════════════════════════════════════╝
```

`next dev` corre en foreground. **Ctrl-C** lo detiene. Volver a correr `npm run demo` es idempotente — no duplica contenedores ni datos.

### Reset limpio

```bash
npm run db:reset      # borra y recrea el contenedor Postgres vacío
npm run demo          # vuelve a sembrar y arrancar desde cero
```

### Las 5 claves que sí tienes que poner

`.env.local` está en `.gitignore`. Copia `.env.example` y rellena **sólo** estas 5 (el resto ya tiene valores por defecto que funcionan en dev):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY` | SDK Pollar, login social/OTP (dashboard.pollar.xyz) |
| `POLLAR_USERS_SECRET_KEY` | verificar sesiones en el servidor |
| `POLLAR_OPS_SECRET_KEY` | wallet de la plataforma (server-only) |
| `PLATFORM_PUBLIC_KEY` | firmante 1 de 2 del escrow |
| `PLATFORM_SECRET_KEY` | tu secret en testnet |

`DATABASE_URL` ya apunta al Postgres del contenedor (`:5433`). `DEV_LOGIN_ENABLED=true` habilita el Modo demo de abajo.

> **Si no tienes claves de Pollar ni cuenta en Stellar testnet:** el **Modo demo** (§ siguiente) funciona sin ninguna de las dos. Está pensado justamente para eso — un juez sin wallet puede entrar y recorrer el producto entero.

---

## Entrar: Modo demo (sin Pollar, sin wallet)

En `http://localhost:3000`, abajo del todo, hay un panel **Modo demo** con las 6 personas seed. Un click y entas con cookie de sesión firmada. No requiere Google, ni OTP, ni extensión de wallet.

| Persona | Carrera | Listings | Ofertas pendientes de aceptar |
|---|---|---|---|
| María R. | Ing. Computación | 3 (TI-89, Fluke, Bata M) | 0 |
| Juan P. | Ing. Eléctrica | 2 (Arduino, Sadiku) | 0 |
| Andrea L. | Matemáticas | 3 (Spivak, Bata CH, Gafas lab) | 0 |
| Pablo M. | Física | 3 (Tipler, Casio fx-991, Stewart) | 0 |
| Sofía C. | Ing. Computación | 3 (ThinkPad, RPi4, microSD) | 0 |
| **Diego G.** | **Ing. Mecánica** | **3 (Vernier, Soldador, Bici)** | **3 ⭐** |

**Diego es la persona demo.** Es el único con ofertas entrantes, así que es el único que dispara el flow completo de escrow sin alternar entre cuentas:

1. Entra como **Diego G.**
2. Ve a **`/incoming-offers`** → 3 ofertas: María ofrece 650 XLM cash por la estación de soldadura · Pablo truequea su Casio fx-991 por el Vernier · Juan ofrece 2800 XLM cash por la bici.
3. **Aceptar** en cualquiera → cap de sesgo → se crea el escrow 2-de-2 en Stellar testnet → el listing pasa a `in_escrow`.
4. Registra el intercambio físico en `/procesos` → arranca el **TTL de 3 minutos**.
5. Rama A: el comprador acepta en `/escrow/[id]` → release firmado plataforma + árbitro.
   Rama B: no hace nada → el cron auto-resuelve a favor del vendedor.
   Rama C: **Reportar** → disputa congelada con evidencia anclada en `manageData`, visible en `/admin/disputes`.

### El resto del producto en 30 segundos

| Ruta | Qué es |
|---|---|
| `/marketplace` | Feed con filtros por carrera × tipo de item |
| `/create` | Publicar artículo (foto, flag video-verified, precio en XLM o trueque) |
| `/incoming-offers` | Bandeja de ofertas del vendedor — aquí se elige |
| `/procesos` | Ofertas enviadas por ti + estado de cada escrow |
| `/escrow/[id]` | Ventana de prueba del compra: aceptar / reportar / countdown |
| `/receipt/[id]` | Comprobante con hashes on-chain de cada operación |
| `/map` | **Mapa real** (Leaflet + OpenStreetMap) de tiendas cercanas a Ciudad Universitaria, con filtros por categoría y geolocalización |
| `/assistant` | Asistente de tasación por depreciación |
| `/settings` | Perfil, alias público,QR de wallet |
| `/admin/disputes` | Cola de disputas (sólo `ADMIN_EMAILS`) |

---

## El smart contract en Stellar (para revisarlo en el explorer)

El escrow **no es un contrato de Soroban**: es una **cuenta Stellar con multi-sig 2-de-2** (cuenta + `setOptions` con dos firmantes de peso 1). Requiere ambas firmas — la plataforma y el árbitro — para mover fondos. Es determinista, auditable y se puede inspeccionar en cualquier explorer.

**Cuenta maestra de la plataforma** (firmante 1 de 2 en *todos* los escrows, funded por friendbot en testnet):

```
https://stellar.expert/explorer/testnet/account/GDTSAVM2RNRP73D2Z72OIP2U3SVNKQRJA2KLP3HPEPJEIZ2OER46OAAE
```

Transacciones de funding visibles (create_account):

```
https://stellar.expert/explorer/testnet/tx/67633f1c51cf717b0061559ab53989f4f73762b5426d9994dbeb213a2eb2f508
https://stellar.expert/explorer/testnet/tx/049e63ccb9b92dc0c588f6a693b635fb12467148c6510da2a90855d91c9ba1fc
```

**Para ver un escrow real:** acepta una oferta como Diego (§ anterior). El `G…` de la cuenta nueva queda guardado en la columna `Escrow.stellarAccountId`; se obtiene desde `/api/escrow/my` y se pega en la misma URL cambiando `account/<G-KEY>`. Ahí verás los 2 firmantes y los pagos de create/fund/release. El flujo completo está en `lib/escrow.service.ts::accept()`.

---

## Verificación

```bash
npm run typecheck    # tsc --noEmit
npm test             # pretest crea pumatrade_test · vitest 6 archivos · 57 tests
npm run e2e:demo     # smoke test contra el server corriendo — 6 checks
```

> ⚠️ **`npm test` no toca tu demo.** Los tests corren contra una base
> aparte (`pumatrade_test`) que `pretest` crea a partir de `DATABASE_URL`.
> Esto NO es negociable: los tests hacen `TRUNCATE` de todas las tablas
> entre casos, y antes apuntaban a la misma base que la app — o sea,
> `npm test` te borraba el seed (6 users · 17 listings · 7 offers) y te
> dejaba los fixtures del último test como si fueran datos reales. Para
> reponer el seed: `npm run db:reset && npm run demo`.

`npm run e2e:demo` requiere el dev server arriba (o sea, `npm run demo` en otra terminal). Sus 6 checks:

| # | Check |
|---|---|
| 1 | `GET /` → 200 |
| 2 | `GET /api/auth/me` sin sesión → 200 |
| 3 | `GET /api/auth/dev-users` lista las 6 personas seed |
| 4 | `POST /api/auth/dev-login` → 200 + `Set-Cookie: pumatrade-session=…` |
| 5 | `GET /api/auth/me` **con** la cookie → 200 y el email correcto |
| 6 | `GET /api/fx` → 200 |

El check 4 es el guardián de que el login demo no volvió a romperse: antes daba 404 de forma intermitente por un snapshot de `process.env.NODE_ENV` distinto por ruta. Ver `lib/dev-login-flag.ts` y `instrumentation.ts`.

---

## Quickstart (control fino)

Sólo si estás depurando el bootstrap y quieres paso a paso:

```bash
nvm use 20
npm install
cp .env.example .env.local
npm run db:up                  # scripts/db-up.sh up → Postgres en :5433
npx prisma migrate deploy
npm run db:seed                # 6 users · 17 listings · 7 offers
npm run dev                    # next dev (sin el env de TTL corto)
```

| Script | Qué hace |
|---|---|
| `npm run demo` | **Runner completo** (este es el que quieres) |
| `npm run db:up` / `db:down` / `db:reset` | Ciclo de vida del contenedor Postgres |
| `npm run db:seed` | Siembra (idempotente) |
| `npm run demo:check` | Verifica que la DB tenga el dataset demo completo |
| `npm test` | Tests unitarios + integración (base `pumatrade_test`, aislada) |
| `npm run e2e:demo` | Smoke test HTTP end-to-end |
| `npm run test:stellar` | Prueba real contra Horizon testnet |
| `npm run cron:once` | Dispara un ciclo del cron de TTL a mano |
| `npm run capture:wallets` | Genera `SEED_WALLET_IDS` con wallets reales |
| `npm run setup:env` | Genera claves de Stellar testnet (friendbot) |
| `npm run boot` | Docker build + migrate + seed + start (modo producción) |

> ⚠️ **Demo por LAN (celulares):** para abrir `http://192.168.x.x:3000` desde el teléfono hay que agregar la IP a los **allowed origins de la app Pollar** (dashboard.pollar.xyz → Gremium Usuarios → Settings) **y** a `.env.local`. Sin eso Pollar rechaza el login. El Modo demo no tiene este requisito.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / App | Next.js **16.2.9** (App Router) + React **19.3.0** + TypeScript ^5.9 + Tailwind **4.3.3** |
| Wallets embebidas | [`@pollar/react`](https://github.com/pollar-xyz/pollar) **0.11.3** + [`@pollar/core`](https://www.npmjs.com/package/@pollar/core) **0.11.3** |
| Blockchain | Stellar (testnet) SDK **17.1.0** — escrow multi-sig 2-de-2 (plataforma + llave de arbitraje). Moneda nativa XLM (sin tokens). |
| Mapa | Leaflet **1.9.4** + react-leaflet **5.0.0** sobre tiles de OpenStreetMap (sin API key) |
| Estado local | Zustand 5.0.15 |
| ORM | Prisma **7.10.0** + Postgres (Docker local en dev · serverless en prod) |
| Validación | Zod 4.6.5 |
| Cron | `setInterval` 30s en dev (`instrumentation.ts`) · Vercel Cron 1 min en prod |

---

## Documentación

- **[`PRD.md`](PRD.md)** — Product Requirements Document (v3.4): QUÉ construimos — modelo de datos, los 3 tipos de oferta, máquina de estados del escrow (intercambio registrado → TTL → 3 ramas), wireframes, seed data, variables de entorno, checklist pre-hackathon y guión de demo de 3 minutos.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — Blueprint de implementación (v1.3): CÓMO lo construimos — versiones pinned, Prisma schema completo, Stellar SDK 17 (multi-sig 2-de-2, reserva, operaciones), máquina de estados con carrera-safe `updateMany`, endpoints, componentes clave, cron, seguridad. **Es el documento que sigue el implementador.**
- [`app/setup/page.tsx`](app/setup/page.tsx) — guía interactiva de configuración de Pollar + Stellar, servida en `/setup` dentro de la app.
- [`presentacion/`](presentacion/) — deck de pitches (reveal.js) para el hackathon. `node presentacion/serve.mjs` y abre `http://localhost:4173`.
- [Documento MVP](https://docs.google.com/document/d/1ut08s4x3h_ELaW86xqLz0RL17Ytuf7euiq6waGZi5yo/edit) — Especificación del Producto Mínimo Viable: EL LADRILLO.

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
- **Login en 3 modalities**: Google / GitHub (OAuth de Pollar) · email OTP · Modo demo por cookie firmada — sin wallet ni seed phrase
- **Mapa real de Stores** (`/map`) con POIs de Ciudad Universitaria, filtros por categoría y geolocalización
- 6 usuarios seed · 17 listings · 7 ofertas precargadas

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

🚧 **Demo-ready — Goya-Hack 2026.** Alcance MVP definido en PRD v3.4 + ARCHITECTURE v1.3 (pinned) + Bloque 0-9 implementado. Un comando levanta el demo completo.

---

## Licencia

MIT
