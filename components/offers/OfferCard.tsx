// components/offers/OfferCard.tsx — Cada oferta en el tablero.
// Sistema: .offer-card + .avatar + .types-badge + .sell-button/.outline-button.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ShieldCheck } from 'lucide-react';

type Props = { offer: { id: string; type: 'saldo-only' | 'barter' | 'hybrid'; xlmAmount: number | null; message: string | null; offerer: { id: string; displayName: string; major: string }; }; listingPriceCents: number };

export function OfferCard({ offer, listingPriceCents }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const coveragePct =
    listingPriceCents > 0 && offer.xlmAmount != null
      ? Math.round((offer.xlmAmount - listingPriceCents) / (listingPriceCents / 100))
      : null;

  async function accept() {
    if (!confirm(`¿Aceptar la oferta de ${offer.offerer.displayName}? Crea el escrow.`))
      return;
    setBusy(true);
    try {
      const res = await fetch('/api/escrow/accept-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id }),
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error aceptando');
      }
      const { escrow } = (await res.json()) as { escrow: { id: string } };
      router.push(`/escrow/${escrow.id}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!confirm('¿Rechazar esta oferta?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.ok) throw new Error('Error rechazando');
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="offer-card recommended" style={{ padding: 14 }}>
      <div className="offer-top">
        <span
          className={`type-badge ${
            offer.type === 'saldo-only'
              ? 'saldo-only'
              : offer.type === 'hybrid'
                ? 'hybrid'
                : 'barter'
          }`}
        >
          {offer.type === 'saldo-only'
            ? 'Solo saldo'
            : offer.type === 'hybrid'
              ? 'Híbrida'
              : 'Trueque puro'}
        </span>
        {offer.xlmAmount != null && (
          <span className="offer-total">
            P$ {(offer.xlmAmount / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
            {coveragePct !== null && (
              <span
                className={`ai-price-signal ${coveragePct >= 0 ? 'cheap' : 'pricey'}`}
                style={{ fontSize: 8, marginLeft: 6, marginTop: 0, padding: '3px 6px' }}
              >
                {coveragePct >= 0 ? '+' : ''}
                {coveragePct}% vs precio
              </span>
            )}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
        <span className="avatar" style={{ width: 38, height: 38, fontSize: 11 }}>
          {initials(offer.offerer.displayName)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 12 }}>
            {offer.offerer.displayName}
          </strong>
          <small style={{ fontSize: 10, color: '#8793a3' }}>
            {offer.offerer.major}
          </small>
        </div>
        <span className="verified">
          <ShieldCheck />
          Verificado
        </span>
      </div>

      {offer.message && (
        <p
          style={{
            fontSize: 11,
            fontStyle: 'italic',
            color: '#5a6878',
            marginTop: 10,
            lineHeight: 1.5,
            borderLeft: '2px solid var(--line)',
            paddingLeft: 12,
          }}
        >
          “{offer.message}”
        </p>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--line)',
        }}
      >
        <button
          onClick={accept}
          disabled={busy}
          className="sell-button"
          style={{ padding: '8px 14px', fontSize: 10, opacity: busy ? 0.5 : 1 }}
        >
          <Check />
          {busy ? 'Aceptando…' : 'Aceptar'}
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="outline-button"
          style={{ padding: '8px 14px', fontSize: 10, opacity: busy ? 0.5 : 1 }}
        >
          <X />
          Rechazar
        </button>
      </div>
    </article>
  );
}

function initials(name: string): string {
  const p = name.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}
