// components/listings/PriceAlertCallout.tsx — Alerta precio vs mercado.
// Sistema: .detail-trust mint (ganga) / lavender (sobreprecio aviso). No
// interrumpe la página — sólo aparece si hay alerta real.
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import type { PriceAlertResult } from '@/lib/priceAlert';
import type { ListingType } from '@/lib/schemas';

type Props = { title: string; type: ListingType; priceCents: number };

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; result: PriceAlertResult }
  | { kind: 'error'; message?: string };

export function PriceAlertCallout({ title, type, priceCents }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    fetch('/api/price-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, price: priceCents }),
      signal: ctl.signal,
    })
      .then((res) => {
        if (!alive) return null;
        if (!res.ok) throw new Error('alerta falló');
        return res.json();
      })
      .then((data) => {
        if (!alive || !data) return;
        setStatus({ kind: 'ok', result: data as PriceAlertResult });
      })
      .catch((e) => {
        if (!alive || e.name === 'AbortError') return;
        setStatus({ kind: 'error', message: undefined });
      });
    return () => {
      alive = false;
      ctl.abort();
    };
  }, [title, type, priceCents]);

  if (status.kind === 'loading') return null;
  if (status.kind === 'error' || status.kind !== 'ok') return null;
  const r = status.result;

  if (r.verdict === 'no_reference' || r.verdict === 'fair') return null;

  const fairXlm = (r.fairPriceCents / 100).toFixed(2);
  const actualXlm = (r.actualCents / 100).toFixed(2);

  if (r.verdict === 'overpriced') {
    return (
      <div
        className="detail-trust"
        style={{ background: 'var(--lavender)', borderColor: '#d6c8f5' }}
      >
        <AlertCircle />
        <span>
          <strong>Sobreprecio IA — {r.deltaPct}%</strong>
          <small>
            El precio justo ronda <strong>{fairXlm} XLM</strong>; el publicado
            es <strong>{actualXlm} XLM</strong>. Útil para negociar.
          </small>
        </span>
      </div>
    );
  }

  return (
    <div
      className="detail-trust"
      style={{ background: 'var(--mint)', borderColor: '#d8f0e7' }}
    >
      <Sparkles />
      <span>
        <strong>Ganga IA — {r.deltaPct}%</strong>
        <small>
          Precio justo ~ <strong>{fairXlm} XLM</strong>; este listing está en{' '}
          <strong>{actualXlm} XLM</strong>. Verifica el estado antes de ofertar.
        </small>
      </span>
    </div>
  );
}
