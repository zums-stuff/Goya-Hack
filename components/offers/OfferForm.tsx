// components/offers/OfferForm.tsx — Ofertar (3 tipos). Muestra aviso de brecha
// de valor cuando el total es menor al listing price (UI-only).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  listingId: string;
  /** centavos — precio del listing (para mostrar aviso de brecha) */
  maxXlmCents: number;
};

export function OfferForm({ listingId, maxXlmCents }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<'saldo-only' | 'barter' | 'hybrid'>('saldo-only');
  const [xlmAmount, setXlmAmount] = useState(''); // XLM (decimal)
  const [itemTitle, setItemTitle] = useState('');
  const [itemValue, setItemValue] = useState(''); // XLM (decimal)
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  function totalCents(): number {
    const val = Number(itemValue || '0');
    const xlm = Number(xlmAmount || '0');
    return Math.round((val + xlm) * 100);
  }

  const deltaPct =
    maxXlmCents > 0
      ? Math.round((totalCents() - maxXlmCents) / (maxXlmCents / 100))
      : 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const offeredItems =
        type === 'barter' || type === 'hybrid'
          ? [
              {
                title: itemTitle.trim(),
                estimatedValueXlm: Math.round(Number(itemValue) * 100),
              },
            ]
          : undefined;
      const xlmCents =
        type === 'saldo-only' || type === 'hybrid'
          ? Math.round(Number(xlmAmount) * 100)
          : undefined;
      const body = {
        listingId,
        type,
        offeredItems,
        xlmAmount: xlmCents,
        message: message.trim() || undefined,
      };
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error creando oferta');
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2">
        {(['saldo-only', 'barter', 'hybrid'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-2 rounded border text-sm ${
              type === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-900 text-gray-700'
            }`}
          >
            {t === 'saldo-only' ? 'Solo saldo' : t === 'hybrid' ? 'Objeto + saldo' : 'Trueque puro'}
          </button>
        ))}
      </div>

      {(type === 'saldo-only' || type === 'hybrid') && (
        <label className="block">
          <span className="text-sm">Saldo XLM</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={xlmAmount}
            onChange={(e) => setXlmAmount(e.target.value)}
            className="w-full border rounded px-3 py-2 mt-1"
            placeholder="300"
            required
          />
        </label>
      )}

      {(type === 'barter' || type === 'hybrid') && (
        <>
          <label className="block">
            <span className="text-sm">Objeto que ofreces</span>
            <input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
              placeholder="Arduino Mega 2560"
              required
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="text-sm">Valor estimado (XLM)</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={itemValue}
              onChange={(e) => setItemValue(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
              required
            />
          </label>
        </>
      )}

      {(type === 'barter' || type === 'hybrid') &&
        itemValue && (
          <p className="text-xs text-amber-700">
            ⚠️ Aviso de brecha: tu oferta cubre ≈ {(totalCents() / 100).toFixed(2)} XLM
            ({deltaPct >= 0 ? '+' : ''}
            {deltaPct}% del precio). El servidor no rechaza — el vendedor decide.
          </p>
        )}

      <label className="block">
        <span className="text-sm">Mensaje al vendedor (opcional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full border rounded px-3 py-2 mt-1"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="bg-blue-600 text-white py-2 px-4 rounded disabled:opacity-50"
      >
        {busy ? 'Enviando...' : 'Enviar oferta'}
      </button>
    </form>
  );
}
