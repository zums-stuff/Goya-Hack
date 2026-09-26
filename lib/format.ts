// lib/format.ts — Formateadores compartidos server/cliente.
//
// `fmtPrice(cents)` → "1,250" (entero, es-MX). La app completa usa XLM como
// unidad visible pero guarda los valores en centavos (`Int` en DB) — no usar
// floats en ningún display.

export function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 });
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
