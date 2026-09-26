// lib/fees.ts — Doctrina de dinero en centavos (§4.2). NUNCA Float.
//   feeCents(amountCents, bps) = floor(amountCents × bps / 10000)
// HACKATHON_FREE_FEES=true → 0.

import { env } from './config';

export const DEFAULT_PLATFORM_FEE_BPS = 200; // 2%

export function feeCents(amountCents: number, bps = env.NEXT_PUBLIC_PLATFORM_FEE_BPS): number {
  if (env.HACKATHON_FREE_FEES) return 0;
  if (amountCents <= 0) return 0;
  if (bps < 0 || bps > 10000) throw new Error(`bps fuera de rango: ${bps}`);
  return Math.floor((amountCents * bps) / 10000);
}

// Conversión exacta DB ↔ Stellar (string con hasta 7 decimales).
export function centsToXlm(cents: number): string {
  if (cents < 0) throw new Error(`cents negativos: ${cents}`);
  // 1 centavo = 100,000 stroops → 7 decimales (1 XLM = 10^7 stroops).
  return (cents / 100).toFixed(7);
}

export function xlmToCents(xlm: string): number {
  const n = Number(xlm);
  if (Number.isNaN(n)) throw new Error(`XLM inválido: ${xlm}`);
  return Math.round(n * 100);
}

// Snapshots (§4.2): platformFeeBps en el escrow al crear.
// (el snapshot se hace en el servicio; aquí solo la constante por defecto)
export const SNAPSHOT_FEE_BPS_DEFAULT = env.NEXT_PUBLIC_PLATFORM_FEE_BPS;
