// components/offers/OfferCard.tsx — Cada oferta en el tablero; botones Accept / Reject.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  offer: {
    id: string;
    type: 'saldo-only' | 'barter' | 'hybrid';
    xlmAmount: number | null;
    message: string | null;
    offerer: { id: string; displayName: string; major: string };
  };
};

export function OfferCard({ offer }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!confirm(`¿Aceptar la oferta de ${offer.offerer.displayName}? Crea el escrow.`)) return;
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
    <article className="border rounded-lg p-4 bg-white dark:bg-gray-900">
      <header className="flex justify-between items-start gap-3">
        <div>
          <div className="font-medium">{offer.offerer.displayName}</div>
          <div className="text-xs text-gray-500">{offer.offerer.major}</div>
        </div>
        <span
          className={`text-xs uppercase font-semibold rounded px-2 py-1 ${
            offer.type === 'saldo-only'
              ? 'bg-blue-100 text-blue-700'
              : offer.type === 'hybrid'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {offer.type === 'saldo-only'
            ? 'Solo saldo'
            : offer.type === 'hybrid'
              ? 'Híbrida'
              : 'Trueque puro'}
        </span>
      </header>

      <div className="mt-3 text-sm">
        {offer.xlmAmount !== null && (
          <div className="font-mono">{(offer.xlmAmount / 100).toFixed(2)} XLM</div>
        )}
        {offer.message && (
          <p className="text-gray-600 dark:text-gray-400 italic mt-1">"{offer.message}"</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={accept}
          disabled={busy}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Aceptar
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
    </article>
  );
}
