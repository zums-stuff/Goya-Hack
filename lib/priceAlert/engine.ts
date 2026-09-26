// lib/priceAlert/engine.ts — Motor de valuación sin estado (PRD §5).
//
// Reglas:
//   - Compara listing.title + listing.type contra un catálogo local de referencia.
//   - Si el listing está >50% por encima del precio justo → ALERTA (sobreprecio).
//   - Si está >50% por debajo → puede ser ganga; nota aviso.
//   - Si no hay keyword match → "sin alerta" (devuelve null / unknown).

import { findReference } from './reference-prices';
import type { ListingType } from '../schemas';

export type PriceAlertResult =
  | { verdict: 'overpriced'; fairPriceCents: number; actualCents: number; deltaPct: number }
  | { verdict: 'underpriced'; fairPriceCents: number; actualCents: number; deltaPct: number }
  | { verdict: 'fair'; fairPriceCents: number; actualCents: number; deltaPct: number }
  | { verdict: 'no_reference'; reason: 'no_keyword_match' };

export interface CheckPriceInput {
  title: string;
  type: ListingType;
  /** centavos */
  priceCents: number;
}

export function checkPrice(input: CheckPriceInput): PriceAlertResult {
  const ref = findReference(input.title, input.type);
  if (!ref) return { verdict: 'no_reference', reason: 'no_keyword_match' };

  const fairPriceCents = ref.fairPriceCents;
  const delta = input.priceCents - fairPriceCents;
  // % respecto al fair price. +50% es mucho; -50% también es mucho.
  const deltaPct = Math.round((delta / fairPriceCents) * 100);

  if (deltaPct > 50) {
    return { verdict: 'overpriced', fairPriceCents, actualCents: input.priceCents, deltaPct };
  }
  if (deltaPct < -50) {
    return { verdict: 'underpriced', fairPriceCents, actualCents: input.priceCents, deltaPct };
  }
  return { verdict: 'fair', fairPriceCents, actualCents: input.priceCents, deltaPct };
}
