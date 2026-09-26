// components/offers/OfferForm.tsx — Form con tabs (3 tipos) + campos.
// Sistema: tabs (.tab-bar/.tab-btn), inputs (.form-field), boton primario
// (.sell-button), aviso de brecha (.detail-trust lavender).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

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
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tabs de tipo de oferta */}
      <div className="tab-bar" role="tablist">
        {(['saldo-only', 'barter', 'hybrid'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`tab-btn ${type === t ? 'active' : ''}`}
          >
            {t === 'saldo-only' ? 'Solo saldo' : t === 'hybrid' ? 'Objeto + saldo' : 'Trueque puro'}
          </button>
        ))}
      </div>

      {/* Campos según tipo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(type === 'saldo-only' || type === 'hybrid') && (
          <label className="form-label">
            <span>Saldo XLM</span>
            <input
              className="form-field"
              type="number"
              min={0.01}
              step={0.01}
              value={xlmAmount}
              onChange={(e) => setXlmAmount(e.target.value)}
              placeholder="300"
              required
            />
          </label>
        )}

        {(type === 'barter' || type === 'hybrid') && (
          <>
            <label className="form-label">
              <span>Objeto que ofreces</span>
              <input
                className="form-field"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="Arduino Mega 2560"
                required
                maxLength={80}
              />
            </label>
            <label className="form-label">
              <span>Valor estimado (XLM)</span>
              <input
                className="form-field"
                type="number"
                min={0.01}
                step={0.01}
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                required
              />
            </label>
          </>
        )}

        {(type === 'barter' || type === 'hybrid') && itemValue && (
          <div
            className="detail-trust"
            style={{ background: 'var(--lavender)', borderColor: '#d6c8f5' }}
          >
            <AlertCircle />
            <span>
              <strong>Aviso de brecha</strong>
              <small>
                Tu oferta cubre ≈ {(totalCents() / 100).toFixed(2)} XLM (
                {deltaPct >= 0 ? '+' : ''}
                {deltaPct}% del precio). El servidor no rechaza — el vendedor
                decide.
              </small>
            </span>
          </div>
        )}

        <label className="form-label">
          <span>Mensaje al vendedor</span>
          <span className="form-hint">Opcional</span>
          <textarea
            className="form-field"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Hola, te interesa porque…"
          />
        </label>
      </div>

      {error && (
        <div className="form-error">
          <AlertCircle />
          {error}
        </div>
      )}

      <div className="submit-row">
        <button
          type="submit"
          className="sell-button"
          disabled={busy}
          style={{ opacity: busy ? 0.5 : 1 }}
        >
          {busy ? 'Enviando…' : 'Enviar oferta'}
        </button>
      </div>
    </form>
  );
}
