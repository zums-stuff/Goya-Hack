// lib/format.ts — Formateadores PUROS (sincrónicos, sin red).
//
// Client components importan desde acá para evitar arrastrar el fetch de
// CoinGecko que vive en lib/currency.ts (server-only async).
//
// `fmtPrice(cents)` → "1,250" (entero, es-MX). La app completa usa XLM como
// unidad visible pero guarda los valores en centavos (`Int` en DB) — no usar
// floats en ningún display.

export function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

/** "12.34 XLM" — solo dígitos, sufijo XLM. Cliente seguro. */
export function fmtXlmShort(cents: number, decimals = 2): string {
  return `${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} XLM`;
}

/**
 * "12.34 XLM · ≈ $92.55 MXN" — sync, requiere rate pasada.
 * Útil cuando el padre ya hizo el fetch y solo formatea.
 */
export function fmtXlmWithRate(
  cents: number,
  rate: number,
  decimals = 2,
): string {
  const xlm = (cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const mxn = (cents / 100) * rate;
  const mxnStr = mxn.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${xlm} XLM · ≈ ${mxnStr}`;
}

/** Fecha tipo "24 de Septiembre, 2026" en español para eyebrows de fecha. */
export function fmtTodayEs(d = new Date()): string {
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
}
