// components/offers/OfferBoard.tsx — Tablero del vendedor (§10.2).
// Sistema: section-heading + empty-state para "sin ofertas".
'use client';

import { Tag } from 'lucide-react';
import { OfferCard } from './OfferCard';

type OfferLite = {
  id: string;
  type: 'saldo-only' | 'barter' | 'hybrid';
  xlmAmount: number | null;
  message: string | null;
  offerer: { id: string; displayName: string; major: string };
};

export type { OfferLite };

type Props = { offers: OfferLite[]; listingPriceCents: number };

export function OfferBoard({ offers, listingPriceCents }: Props) {
  const sorted = [...offers].sort((a, b) => scoreOffer(b) - scoreOffer(a));
  return (
    <div data-testid="offer-board">
      <div className="section-heading" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">TABLERO · PUMATRADE</p>
          <h2 style={{ marginBottom: 4 }}>Ofertas pendientes ({offers.length})</h2>
          <p>Elige la propuesta que más te convenga. Verás primero las más cercanas al precio pedido.</p>
        </div>
        <span style={{ color: '#a18cdb' }}>
          <Tag />
        </span>
      </div>

      {sorted.length === 0 && (
        <div className="empty-state">
          <strong>Aún no hay ofertas</strong>
          Las ofertas públicas aparecerán aquí en tiempo real.
        </div>
      )}

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((o) => (
          <li key={o.id}>
            <OfferCard offer={o} listingPriceCents={listingPriceCents} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function scoreOffer(o: OfferLite): number {
  if (o.type === 'hybrid') return 100 + (o.xlmAmount ?? 0) / 100;
  if (o.type === 'saldo-only') return 50 + (o.xlmAmount ?? 0) / 100;
  return 30;
}
