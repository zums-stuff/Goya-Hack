// components/offers/OfferForm.tsx — 3 tipos + confirmación explícita.
// UX clave: tras POST exitoso mostramos un panel verde con "Oferta
// enviada" + un CTA para volver. La fase 'success' cierra la duda de
// "¿el botón hizo algo?".
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

type Props = {
  listingId: string;
  /** centavos — precio del listing (para mostrar aviso de brecha) */
  maxXlmCents: number;
};

type Phase = 'idle' | 'submitting' | 'success' | 'error';

export function OfferForm({ listingId, maxXlmCents }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [type, setType] = useState<'saldo-only' | 'barter' | 'hybrid'>('saldo-only');
  const [xlmAmount, setXlmAmount] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemValue, setItemValue] = useState('');
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

  function reset() {
    setType('saldo-only');
    setXlmAmount('');
    setItemTitle('');
    setItemValue('');
    setMessage('');
    setError(null);
    setPhase('idle');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === 'submitting' || phase === 'success') return;
    setPhase('submitting');
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
      setPhase('success');
      // Refresh en background para que el tablero del vendedor vea la nueva
      // oferta cuando vuelva, pero no descarto la fase 'success' visible.
      setTimeout(() => router.refresh(), 0);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  if (phase === 'success') {
    return (
      <div
        className="detail-trust"
        style={{ background: 'var(--mint)', borderColor: '#d8f0e7', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <CheckCircle2 />
          <span>
            <strong>Oferta enviada ✨</strong>
            <small>
              El vendedor verá tu propuesta en su tablero. Te avisaremos
              cuando la acepte o responda.
            </small>
          </span>
        </div>
        <div className="submit-row" style={{ marginTop: 14 }}>
          <Link href="/marketplace" className="sell-button" style={{ justifyContent: 'center' }}>
            <ArrowLeft />
            Volver al marketplace
          </Link>
          <button
            type="button"
            onClick={reset}
            className="outline-button"
            style={{ padding: '10px 14px', fontSize: 11, justifyContent: 'center' }}
          >
            Enviar otra
          </button>
        </div>
      </div>
    );
  }

  const busy = phase === 'submitting';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
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

      {!busy && phase === 'error' && (
        <p className="subcopy" style={{ fontSize: 11, color: '#c45f4e' }}>
          No pudimos enviar la oferta. Revisa los datos y vuelve a
          intentar.
        </p>
      )}

      <div className="submit-row">
        <button
          type="submit"
          className="sell-button"
          disabled={busy}
          style={{
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Enviando…' : 'Enviar oferta'}
        </button>
      </div>
    </form>
  );
}
