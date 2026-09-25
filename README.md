# PumaTrade — Goya-Hack

> **Marketplace universitario de intercambio flexible con dinero protegido y ventana de prueba.**

PumaTrade permite a los estudiantes de la UNAM **publicar artículos académicos en desuso** (libros, calculadoras, batas, componentes electrónicos) y recibir propuestas en **3 formatos**: solo saldo en **PumaDolar (P$)**, objeto por objeto (trueque puro), o una combinación de ambos (híbrido). El vendedor **elige la mejor oferta desde su tablero**.

Cuando una oferta se acepta, el saldo del comprador se **congela en un smart contract** (cuenta Stellar multi-sig 2-de-2). Los estudiantes se encuentran en la facultad, **intercambian físicamente los objetos**, y ambos registran ese momento en la app. En ese instante arranca una **ventana de prueba (TTL)** — 48 horas en producción, 3 minutos en modo demo. Tres caminos posibles durante esa ventana:

- **Rama A (happy path):** el comprador prueba el artículo y acepta → el pago se libera al vendedor.
- **Rama B (auto-resolve):** el comprador no confirma → el TTL expira → el sistema libera automáticamente (nadie puede secuestrar los fondos).
- **Rama C (disputa):** el comprador reporta un problema (artículo dañado / intercambio nunca ocurrió / artículo diferente al publicado) con foto y descripción → el escrow se congela para revisión.

Todo se mueve en **PumaDolar**, una moneda digital respaldada por USDC en Stellar testnet, gestionada a través del SDK [Pollar](https://pollar.xyz) — wallets embebidas que se crean con solo iniciar sesión con Google. Cero seed phrases, cero conocimiento de blockchain.

---

## El problema

Cada semestre los estudiantes gastan miles de pesos en activos académicos temporales que al terminar quedan arrumbados. El trueque tradicional fracasa porque encontrar dos personas cuyos objetos valgan exactamente lo mismo es casi imposible. Y comprar de segunda mano en grupos de Facebook/WhatsApp es una ruleta: equipo dañado, estafas, sin garantías.

## La solución (MVP "El Ladrillo")

1. **Intercambio flexible, no solo venta.** Si tu artículo vale $300 y el otro vale $800, puedes ofrecer tu artículo + 500 P$ de diferencia. PumaDolar cubre el desbalance.
2. **Tablero de ofertas múltiples.** El vendedor ve todas las propuestas y elige.
3. **El intercambio físico es el evento central.** La confianza se construye alrededor del momento en que los objetos cambian de manos. Ambas partes lo registran, y desde ahí arranca la ventana de prueba.
4. **Candado con ventana de prueba.** TTL configurable (48h prod, 3 min demo) + auto-resolve a favor del vendedor + rama de disputa con evidencia.
5. **Alerta de precios básicos.** Comparación contra una base local de referencias — si un artículo está por encima del mercado, la app lo señala.

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

- **[`PRD.md`](PRD.md)** — El Product Requirements Document completo: modelo de datos, los 3 tipos de oferta, máquina de estados del escrow (intercambio registrado → TTL → 3 ramas), wireframes, seed data, variables de entorno, checklist pre-hackathon y guión de demo de 3 minutos. **Este es el documento principal del proyecto.**

---

## Estado del proyecto

🚧 **En desarrollo** — preparación para hackathon. Alcance MVP definido en el PRD.

### MVP (versión actual)
- Marketplace con filtros por carrera × tipo de item
- Publicación con video mock de verificación
- 3 tipos de oferta: solo saldo / trueque puro / híbrida (objeto + saldo)
- Tablero del vendedor para elegir la mejor oferta
- Escrow Stellar con flujo **intercambio físico registrado → TTL → 3 ramas**:
  - Rama A: comprador acepta → release
  - Rama B: TTL expira → auto-resolve a favor del vendedor
  - Rama C: comprador reporta (dañado / nunca ocurrió / item diferente) → disputa congelada con evidencia
- Comisión de plataforma (2% sobre PumaDolar liberado; 0% durante el hackathon)
- Alerta de precios inflados vs. mercado (DB local de referencias)
- Cola de disputas para admin
- 5 usuarios seed + 10 listings + 4 ofertas precargados

### Fuera de alcance del MVP ("La Casa" a futuro)
- Tarjeta física NFC (Tangem) para confirmar transacciones
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