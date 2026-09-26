// lib/priceAlert/reference-prices.ts — Precios de referencia para alertas (PRD §5).
//
// No es un modelo Prisma (decisión §13: el motor de valuación es sin estado).
// Catálogo fijo de productos típicos + "valor orientativo" en centavos de XLM.
// Es deliberadamente conservador: ¡no se compara contra precios en USD!
// Multiplicador ~150 XLM/USD para testnet (arbitrario, ajustable).

export type ReferencePrice = {
  /** keyword normalizada para matchear título */
  keyword: string;
  type: 'libros' | 'calculadoras' | 'electronica' | 'batas-uniformes' | 'laboratorio' | 'otros';
  /** centavos de XLM — valor justo esperado */
  fairPriceCents: number;
};

// Heurística: precio justo +-50% es razonable; fuera de eso la alerta dispara.
export const REFERENCE_PRICES: ReferencePrice[] = [
  // Calculadoras
  { keyword: 'ti-89', type: 'calculadoras', fairPriceCents: 80_000 },
  { keyword: 'ti-84', type: 'calculadoras', fairPriceCents: 50_000 },
  { keyword: 'casio fx', type: 'calculadoras', fairPriceCents: 25_000 },
  // Multímetros
  { keyword: 'fluke', type: 'laboratorio', fairPriceCents: 120_000 },
  { keyword: 'multímetro', type: 'laboratorio', fairPriceCents: 50_000 },
  // Arduino / electrónica
  { keyword: 'arduino mega', type: 'electronica', fairPriceCents: 45_000 },
  { keyword: 'arduino uno', type: 'electronica', fairPriceCents: 25_000 },
  { keyword: 'raspberry pi 4', type: 'electronica', fairPriceCents: 110_000 },
  { keyword: 'thinkpad x1', type: 'electronica', fairPriceCents: 850_000 },
  // Libros típicos
  { keyword: 'tipler', type: 'libros', fairPriceCents: 35_000 },
  { keyword: 'sadiku', type: 'libros', fairPriceCents: 30_000 },
  { keyword: 'spivak', type: 'libros', fairPriceCents: 60_000 },
  // Batas (rango típico 200-300 XLM)
  { keyword: 'bata', type: 'batas-uniformes', fairPriceCents: 25_000 },
];

/** Busca el mejor match por substring de keyword (case-insensitive). */
export function findReference(title: string, type: ReferencePrice['type']): ReferencePrice | null {
  const t = title.toLowerCase();
  // Primero matches en la misma `type` (más precisión), si no, en cualquier type.
  const same = REFERENCE_PRICES.find(
    (r) => r.type === type && t.includes(r.keyword.toLowerCase()),
  );
  if (same) return same;
  return REFERENCE_PRICES.find((r) => t.includes(r.keyword.toLowerCase())) ?? null;
}
