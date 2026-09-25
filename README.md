# PumaTrade — Goya-Hack

> **Compraventa universitaria con precio justo y dinero protegido hasta que pruebas el producto.**

Un marketplace móvil-first donde los estudiantes de la UNAM pueden **vender o comprar** bienes académicos en desuso (libros, calculadoras, batas, componentes electrónicos) pagando en **PumaDolar (P$)** — una moneda digital respaldada por USDC en Stellar testnet, gestionada a través del SDK [Pollar](https://pollar.xyz). Cada usuario tiene una wallet embebida que se crea con su login de Google: cero seed phrases, cero conocimiento de blockchain.

---

## El problema

Cada semestre los estudiantes gastan miles de pesos en activos académicos temporales (libros, multímetros, tarjetas de desarrollo) que al terminar quedan arrumbados. Comprar de segunda mano es una ruleta rusa: equipo dañado, estafas, sin trazas, sin garantías. Y el trueque tradicional fracasa porque encontrar dos personas cuyos objetos valgan exactamente lo mismo es casi imposible.

## La solución

**PumaTrade es una plataforma de compraventa** (no de trueque), con tres piezas:

1. **Venta entre estudiantes (flujo principal)** — publicas tu artículo con un precio; los compradores pagan en PumaDolar y el dinero queda retenido en un **escrow sobre Stellar** con **ventana de prueba**:
   - **COMMIT:** los estudiantes se encuentran en el campus; el comprador escanea el QR del vendedor y arranca un **TTL de 48h**.
   - **GRACE:** el comprador prueba el artículo en casa.
     - **Rama A:** funciona → toca "Aceptar artículo" → se libera el pago al vendedor.
     - **Rama B:** no confirma → el TTL expira → **auto-resolve** a favor del vendedor (nadie puede secuestrar los fondos).
     - **Rama C:** está dañado → "Reportar fallo" antes del TTL → el escrow se **congela**.
2. **IA de tasación contra precios reales (core)** — un motor híbrido (base local de precios de referencia + reglas de depreciación + LLM opcional) compara cada artículo contra el mercado real y muestra al comprador un **badge de precio justo** (verde/amarillo/rojo con rango de mercado), alimenta un **simulador de tasación**, y fija las ofertas de compra de la plataforma.
3. **Venta a la plataforma (opcional)** — si te urge saldo, **PumaTrade te compra el artículo**: la IA lo tasa, la plataforma paga al instante en P$ (70% de la mediana justa) y luego lo revende en el catálogo marcado como **"Venta Oficial"**. **No es necesario vender para comprar.**

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / App | Next.js 14 (App Router) + TypeScript + Tailwind |
| Wallets embebidas | [`@pollar/react`](https://github.com/pollar-xyz/pollar) + [`@pollar/core`](https://www.npmjs.com/package/@pollar/core) |
| Blockchain | Stellar (testnet) — escrow a través de cuentas multi-sig 2-de-2 |
| IA de tasación | Motor local determinista (base de precios de referencia + depreciación) + LLM opcional (Claude/GPT) cuando hay red |
| Estado local | Zustand |
| ORM | Prisma + SQLite |

## Documentación

- **[`PRD.md`](PRD.md)** — El Product Requirements Document completo: modelo de datos, flujos (P2P, buyback, tasador), mecánica del escrow (COMMIT/GRACE/auto-resolve/dispute), engine de IA de tasación, wireframes (Figma-style), seed data, checklist pre-hackathon y guión de demo de 3 minutos. **Este es el documento principal del proyecto.**

---

## Estado del proyecto

🚧 **En desarrollo** — preparación para hackathon. Alcance MVP definido en el PRD.

### MVP (versión actual)
- Marketplace P2P con filtros por carrera × tipo de item
- **Precio justo vs. mercado** en cada listing (badge IA) + simulador de tasación
- Compraventa con escrow Stellar: checkout → escaneo QR (COMMIT) → ventana de prueba (GRACE) → aceptar / auto-resolve / disputa
- Venta a la plataforma (buyback) con oferta de compra tasada por IA y reventa "Oficial"
- Comisión de plataforma (2% sobre PumaDolar liberado; 0% durante el hackathon)
- Crédito de bienvenida de 500 P$ en el demo
- 6 usuarios seed (5 estudiantes + PumaTrade Oficial) con listings precargados

### Fuera de alcance del MVP (la "Casa" a futuro)
- Depósito de saldo real (on-ramp fiat vía SEP-24)
- Negociación (counter-offers) entre comprador y vendedor
- Reputación y ratings post-transacción
- IA agencial (búsqueda en lenguaje natural sobre el catálogo)
- Resolución real de disputas (evidencia + moderación)
- Foro de nuevo ingreso, escrow de rentas, pagos en cafeterías
- Servicios y tutorías (precio por hora)
- Soroban smart contract real y app nativa cuando se vaya a producción

---

## Licencia

MIT