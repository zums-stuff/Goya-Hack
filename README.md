# PumaTrade — Goya-Hack

> **Marketplace universitario de intercambio flexible con dinero protegido hasta que pruebas el producto.**

PumaTrade permite a los estudiantes de la UNAM **publicar artículos académicos en desuso** (libros, calculadoras, batas, componentes electrónicos) y recibir propuestas en **3 formatos**: solo saldo en **PumaDolar (P$)**, objeto por objeto (trueque puro), o una combinación de ambos (híbrido). El vendedor **elige la mejor oferta desde su tablero**.

Cuando una oferta se acepta, el saldo del comprador se **congela en un smart contract** (cuenta Stellar multi-sig 2-de-2) hasta que ambos estudiantes se encuentran en la facultad, **verifican que el artículo funciona**, y **confirman en la app**. Solo entonces se libera el pago al vendedor.

Todo el dinero se mueve en **PumaDolar**, una moneda digital respaldada por USDC en Stellar testnet, gestionada a través del SDK [Pollar](https://pollar.xyz) — wallets embebidas que se crean con solo iniciar sesión con Google. Cero seed phrases, cero conocimiento de blockchain.

---

## El problema

Cada semestre los estudiantes gastan miles de pesos en activos académicos temporales que al terminar quedan arrumbados. El trueque tradicional fracasa porque encontrar dos personas cuyos objetos valgan exactamente lo mismo es casi imposible. Y comprar de segunda mano en grupos de Facebook/WhatsApp es una ruleta: equipo dañado, estafas, sin garantías.

## La solución (MVP "El Ladrillo")

1. **Intercambio flexible, no solo venta.** Si tu artículo vale $300 y el otro vale $800, puedes ofrecer tu artículo + 500 P$ de diferencia. PumaDolar cubre el desbalance.
2. **Tablero de ofertas múltiples.** El vendedor no depende de un solo interesado. Ve todas las propuestas (solo saldo / objeto↔objeto / híbrido) y elige la que mejor resuelve su semestre.
3. **Candado de seguridad.** El saldo del comprador queda retenido en un smart contract de Stellar hasta que ambos confirman la entrega en la app.

**Diferenciador técnico:** una alerta básica de IA compara cada precio contra una base local de referencias y avisa si un artículo está por encima del mercado.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / App | Next.js 14 (App Router) + TypeScript + Tailwind |
| Wallets embebidas | [`@pollar/react`](https://github.com/pollar-xyz/pollar) + [`@pollar/core`](https://www.npmjs.com/package/@pollar/core) |
| Blockchain | Stellar (testnet) — escrow multi-sig 2-de-2 |
| Estado local | Zustand |
| ORM | Prisma + SQLite |

## Documentación

- **[`PRD.md`](PRD.md)** — El Product Requirements Document completo: modelo de datos, flujos de los 3 tipos de oferta, mecánica del escrow, wireframes, seed data, checklist pre-hackathon y guión de demo de 3 minutos. **Este es el documento principal del proyecto.**

---

## Estado del proyecto

🚧 **En desarrollo** — preparación para hackathon. Alcance MVP definido en el PRD.

### MVP (versión actual)
- Marketplace con filtros por carrera × tipo de item
- Publicación con video mock de verificación
- 3 tipos de oferta: solo saldo / trueque puro / híbrida (objeto + saldo)
- Tablero del vendedor para elegir la mejor oferta
- Escrow Stellar con doble confirmación (ambos confirman en el encuentro → release)
- Comisión de plataforma (2% sobre PumaDolar liberado; 0% durante el hackathon)
- Alerta básica de precios inflados vs. mercado (DB local de referencias)
- 5 usuarios seed + 10 listings + 5 ofertas precargados para demo

### Fuera de alcance del MVP ("La Casa" a futuro)
- Tarjeta física NFC (Tangem) para confirmar transacciones
- Resolución de disputas con TTL y auto-resolve a favor del vendedor
- Pagos de depósitos de renta para estudiantes foráneos
- Pago de comidas en cafeterías con PumaDolar
- Foro comunitario para guiar a alumnos de nuevo ingreso
- Opción de compra urgente (buyback) por la plataforma
- Asistente IA completo (búsqueda en lenguaje natural, tasador de depreciación)
- On-ramp fiat (depósito real de saldo vía SEP-24)
- Smart contract Soroban real sustituyendo el multi-sig
- Reputación y ratings post-transacción

---

## Licencia

MIT