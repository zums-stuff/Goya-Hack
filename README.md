# PumaTrade — Goya-Hack

> **Trueque híbrido universitario sobre Stellar, con escrow garantizado y sin que el usuario tenga que aprender blockchain.**

Un marketplace móvil-first donde los estudiantes de la UNAM pueden **vender, comprar o intercambiar** bienes académicos en desuso (libros, calculadoras, batas, componentes electrónicos) y liquidar la **diferencia de valor** en **PumaDolar** — una moneda digital respaldada por USDC en Stellar testnet, gestionada a través del SDK [Pollar](https://pollar.xyz).

---

## El problema

Cada semestre los estudiantes gastan miles de pesos en activos académicos temporales (libros, multímetros, tarjetas de desarrollo) que al terminar quedan arrumbados, perdiendo su valor. El trueque tradicional falla por la falta de **doble coincidencia de deseos**: encontrar dos personas cuyos objetos valgan exactamente lo mismo es casi imposible.

## La solución

**PumaTrade** integra tres piezas:

1. **Tablero de ofertas múltiples** — al publicar un artículo recibes ofertas en 3 formatos: trueque puro, compra directa en PumaDolar, o bien + diferencia en PumaDolar. Tú eliges la que mejor resuelve tu semestre.
2. **Escrow garantizado en Stellar** — los fondos se retienen en una **cuenta multi-sig 2-de-2** (comprador + plataforma) y se liberan solo cuando ambas partes confirman la entrega presencial. Timeout a favor del vendedor si hay ghosting. Cada transacción deja un **memo hash público** como recibo inmutable.
3. **Cero fricción de wallet** — gracias al SDK de Pollar, cada usuario tiene una wallet Stellar embebida que se crea automáticamente con su login de Google. Sin seed phrases, sin claves, sin conocimiento de blockchain.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / App | Next.js 14 (App Router) + TypeScript + Tailwind |
| Wallets embebidas | [`@pollar/react`](https://github.com/pollar-xyz/pollar) + [`@pollar/core`](https://www.npmjs.com/package/@pollar/core) |
| Blockchain | Stellar (testnet) — G-accounts, escrow multi-sig |
| Estado local | Zustand |
| ORM | Prisma + SQLite |

## Documentación

- **[`PRD.md`](PRD.md)** — El Product Requirements Document completo: modelo de datos, flujos, mecánica del escrow, wireframes (Figma-style), seed data, checklist pre-hackathon y guión de demo de 3 minutos. **Este es el documento principal del proyecto.**

---

## Estado del proyecto

🚧 **En desarrollo** — preparación para hackathon. Alcance MVP definido en el PRD.

### MVP (versión actual)
- Marketplace con filtros por carrera × tipo de item
- Tablero de ofertas múltiples (trueque puro / compra directa / híbrida)
- Escrow multi-sig en Stellar testnet con liberación dual
- Comisión de plataforma (2% sobre PumaDolar liberado)
- 5 usuarios seed + listings precargados para demo

### Fuera de alcance del MVP (la "Casa" a futuro)
- Agente de IA (búsqueda en lenguaje natural, detección de sobreprecio, asesor de depreciación)
- Instant buyback (liquidez inmediata para vendedores urgentes)
- Foro de nuevo ingreso y guías de materiales
- Escrow de depósitos de renta para estudiantes foráneos
- Pagos en cafeterías del campus
- Onramp fiat (comprar PumaDolar con tarjeta bancaria vía SEP-24)

---

## Licencia

MIT