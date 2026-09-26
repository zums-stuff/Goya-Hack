// components/offers/OfferBoard.tsx — Tablero del vendedor (§10.2).
// Ordena: hybrid con valor cercano al listing primero; luego saldo-only; luego barter.
// Cada OfferCard muestra la "brecha de valor" cuando aplica (UI-only; server NO rechaza).
'use client';

import { OfferCard } from './OfferCard';

type OfferLite = {
  id: string;
  type: 'saldo-only' | 'barter' | 'hybrid';
  xlmAmount: number | null;
  message: string | null;
  offerer: { id: string; displayName: string; major: string };
};

export type { OfferLite };

type Props = { offers: OfferLite[] };

export function OfferBoard({ offers }: Props) {
  const sorted = [...offers].sort((a, b) => scoreOffer(b) - scoreOffer(a));
  return (
    <div className="space-y-3" data-testid="offer-board">
      <h2 className="text-sm uppercase tracking-wide text-gray-500">
        Tablero de ofertas ({offers.length})
      </h2>
      {sorted.length === 0 && (
        <p className="text-gray-500 text-sm py-6 text-center border rounded">
          Aún no hay ofertas. Las ofertas públicas aparecerán aquí en tiempo real.
        </p>
      )}
      {sorted.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
    </div>
  );
}

function scoreOffer(o: OfferLite): number {
  // Heurística para ordenar el tablero sin meter lógica de servidor.
  if (o.type === 'hybrid') return 100 + (o.xlmAmount ?? 0) / 100;
  if (o.type === 'saldo-only') return 50 + (o.xlmAmount ?? 0) / 100;
  return 30;
}
