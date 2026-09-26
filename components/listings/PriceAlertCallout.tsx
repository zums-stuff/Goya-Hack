// components/listings/PriceAlertCallout.tsx — Alerta inline que muestra
// si el precio listing está fuera del rango del motor (§10.X PRD §5).
'use client';

import { useEffect, useState } from 'react';
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
        // 404 silencioso: el endpoint placeholder no acepta id "_", pero si el
        // server devuelve 404 el cliente no debe romper.
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

  if (r.verdict === 'no_reference') return null;
  if (r.verdict === 'fair') return null;

  const fairXlm = (r.fairPriceCents / 100).toFixed(2);
  const actualXlm = (r.actualCents / 100).toFixed(2);
  if (r.verdict === 'overpriced') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded text-red-800 text-sm">
        ⚠️ <strong>Sobreprecio:</strong> el precio justo ronda {fairXlm} XLM; estás pagando{' '}
        {actualXlm} XLM (+{r.deltaPct}%).
      </div>
    );
  }
  return (
    <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded text-green-800 text-sm">
      💚 <strong>Ganga:</strong> el precio justo ronda {fairXlm} XLM; estás pagando {actualXlm}{' '}
      XLM ({r.deltaPct}%). Verifica que no esté dañado.
    </div>
  );
}
