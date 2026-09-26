// components/incoming-offers/IncomingOffersList.tsx — Lista client para
// aceptar/rechazar rápido sin ir al detalle de cada listing.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  HeartHandshake,
  Hourglass,
  X,
} from 'lucide-react';

export type IncomingOffer = {
  id: string;
  type: 'saldo-only' | 'barter' | 'hybrid';
  xlmAmount: number | null;
  message: string | null;
  status: string;
  createdAt: Date | string;
  offeredItems: string | null;
  listing: { id: string; title: string; priceXlm: number; status: string };
  offerer: { id: string; displayName: string; major: string };
};

function initials(n: string): string {
  const p = n.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

const FALLBACK_RATE = 7.5;
function fmtMxN(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function IncomingOffersList({ offers }: { offers: IncomingOffer[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(FALLBACK_RATE);

  // Tasa XLM/MXN: refetch al montar para que el MXN esté sincronizado.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/fx', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { rate: number };
        if (!cancelled && Number.isFinite(j.rate) && j.rate > 0) setRate(j.rate);
      } catch {
        /* fallback rate ya está */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (cents: number) =>
    `${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxN((cents / 100) * rate)}`;

  async function accept(id: string, listingTitle: string) {
    if (!confirm(`¿Aceptar la oferta de "${listingTitle}"? Crea el escrow.`)) return;
    setPendingId(id);
    setError(null);
    try {
      const r = await fetch('/api/escrow/accept-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? 'Error aceptando');
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  async function reject(id: string) {
    if (!confirm('¿Rechazar esta oferta?')) return;
    setPendingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/offers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!r.ok) throw new Error('Error rechazando');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="form-error" style={{ marginBottom: 14 }}>
          <AlertCircle />
          {error}
        </div>
      )}
      {offers.length === 0 ? (
        <div className="empty-state">
          <strong>Sin ofertas pendientes</strong>
          Las propuestas que recibas por tus listings aparecerán aquí, una
          por línea, con botones Aceptar / Rechazar inline (sin ir al
          detalle del listing).
        </div>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {offers.map((o) => {
            const busy = pendingId === o.id;
            const totalCents =
              (o.xlmAmount ?? 0) +
              (o.offeredItems
                ? (JSON.parse(o.offeredItems) as Array<{ estimatedValueXlm: number }>).reduce(
                    (a, it) => a + it.estimatedValueXlm,
                    0,
                  )
                : 0);
            const coveragePct =
              o.listing.priceXlm > 0 && o.xlmAmount != null
                ? Math.round((o.xlmAmount - o.listing.priceXlm) / (o.listing.priceXlm / 100))
                : null;
            const statusTone =
              o.status === 'pending'
                ? 'ai-price-signal market'
                : o.status === 'completed' || o.status === 'accepted'
                  ? 'ai-price-signal cheap'
                  : 'ai-price-signal pricey';
            return (
              <li
                key={o.id}
                className="offer-card recommended"
                style={{ padding: 14 }}
              >
                <div className="offer-top">
                  <span className={`type-badge ${o.type}`}>
                    {o.type === 'saldo-only'
                      ? 'Solo saldo'
                      : o.type === 'hybrid'
                        ? 'Híbrida'
                        : 'Trueque puro'}
                  </span>
                  <span className="offer-total">
                    {fmt(totalCents)}
                    {coveragePct !== null && (
                      <span
                        className={
                          coveragePct >= 0 ? 'ai-price-signal cheap' : 'ai-price-signal pricey'
                        }
                        style={{ fontSize: 8, marginLeft: 6, marginTop: 0, padding: '3px 6px' }}
                      >
                        {coveragePct >= 0 ? '+' : ''}
                        {coveragePct}% vs precio
                      </span>
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
                  <span className="avatar" style={{ width: 38, height: 38, fontSize: 11 }}>
                    {initials(o.offerer.displayName)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: 12 }}>
                      {o.offerer.displayName}
                    </strong>
                    <small style={{ fontSize: 10, color: '#8793a3' }}>
                      {o.offerer.major}
                    </small>
                  </div>
                  <span className="verified">
                    <HeartHandshake />
                    Quiere tu producto
                  </span>
                </div>

                {o.message && (
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
                    "{o.message}"
                  </p>
                )}

                <p style={{ fontSize: 11, color: '#4a5568', marginTop: 10 }}>
                  Por tu listing:{' '}
                  <Link
                    href={`/marketplace/${o.listing.id}`}
                    style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'underline' }}
                  >
                    {o.listing.title}{' '}
                    <ChevronRight
                      className="lucide-inline"
                      style={{ width: 10, height: 10 }}
                    />
                  </Link>
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span className={statusTone} style={{ marginTop: 0 }}>
                    {o.status === 'pending' ? (
                      <Hourglass />
                    ) : o.status === 'completed' || o.status === 'accepted' ? (
                      <Check />
                    ) : (
                      <X />
                    )}
                    {o.status === 'pending'
                      ? 'Pendiente de tu decisión'
                      : o.status === 'completed' || o.status === 'accepted'
                        ? 'Aceptada (escrow creado)'
                        : o.status === 'rejected'
                          ? 'Rechazada'
                          : o.status}
                  </span>
                  {o.status === 'pending' && (
                    <>
                      <button
                        onClick={() => reject(o.id)}
                        disabled={busy}
                        className="outline-button"
                        style={{
                          padding: '7px 12px',
                          fontSize: 10,
                          opacity: busy ? 0.5 : 1,
                          marginLeft: 'auto',
                        }}
                      >
                        <X />
                        Rechazar
                      </button>
                      <button
                        onClick={() => accept(o.id, o.listing.title)}
                        disabled={busy}
                        className="sell-button"
                        style={{
                          padding: '7px 12px',
                          fontSize: 10,
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        <Check />
                        {busy ? 'Aceptando…' : 'Aceptar'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
