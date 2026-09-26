// app/(authed)/marketplace/[listingId]/page.tsx — Detalle con tablero.
// Estilo: .detail-layout del frontend example (foto izquierda, info+ofertas derecha).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { OfferBoard, type OfferLite } from '@/components/offers/OfferBoard';
import { OfferForm } from '@/components/offers/OfferForm';
import { PriceAlertCallout } from '@/components/listings/PriceAlertCallout';
import { ChatThread } from '@/components/chat/ChatThread';
import { fmtXlm, mxnFromCents, xlmMxnRate, fmtMxn } from '@/lib/currency';
import type { ListingType } from '@/lib/schemas';

const VISUALS = ['visual-coral', 'visual-blue', 'visual-yellow', 'visual-purple'];
function pickVisual(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return VISUALS[Math.abs(h) % VISUALS.length];
}

export default async function ListingDetailPage(props: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await props.params;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { seller: { select: { id: true, displayName: true, major: true } } },
  });
  if (!listing) notFound();

  const me = await tryGetUser();
  const isOwner = me?.id === listing.sellerId;
  const isPending = listing.status === 'pending';
  const listingType = listing.type as ListingType;

  // Carga de ofertas — diferente según si eres owner o no.
  const [rawOffersForOwner, rawMyOffer, publicCount] = await Promise.all([
    isOwner && !isPending
      ? prisma.offer.findMany({
          where: { listingId, status: 'pending' },
          orderBy: { createdAt: 'desc' },
          include: { offerer: { select: { id: true, displayName: true, major: true } } },
        })
      : Promise.resolve([]),
    me && !isOwner
      ? prisma.offer.findFirst({
          where: { listingId, offererId: me.id },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve(null),
    prisma.offer.count({ where: { listingId, status: 'pending' } }),
  ]);
  const offers: OfferLite[] = rawOffersForOwner.map((o) => ({
    id: o.id,
    type: o.type as 'saldo-only' | 'barter' | 'hybrid',
    xlmAmount: o.xlmAmount,
    message: o.message,
    offerer: {
      id: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.id,
      displayName: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.displayName,
      major: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.major,
    },
  }));

  // Precio medio de las ofertas pendientes (se muestra en stats) — sólo
  // cuando no eres el owner (interés público de mercado).
  let avgOfferCents: number | null = null;
  if (publicCount > 0 && !isOwner) {
    const sample = await prisma.offer.findMany({
      where: { listingId, status: 'pending' },
      select: { type: true, xlmAmount: true, offeredItems: true },
    });
    const totals = sample.map((o) => {
      if (o.xlmAmount == null) {
        const items = o.offeredItems
          ? (JSON.parse(o.offeredItems) as Array<{ estimatedValueXlm: number }>)
          : [];
        return items.reduce((a, it) => a + it.estimatedValueXlm, 0);
      }
      return o.xlmAmount;
    });
    avgOfferCents = totals.length
      ? Math.round(totals.reduce((a, n) => a + n, 0) / totals.length)
      : null;
  }

  // Currency formatters for this render.
  const rate = await xlmMxnRate();
  const fmt = (cents: number) =>
    `${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxn(mxnFromCents(cents, rate))}`;

  return (
    <section className="detail-view">
      <Link href="/marketplace" className="back-button">
        <ArrowLeft />
        Volver al marketplace
      </Link>

      <div className="detail-layout">
        {/* Columna izquierda — foto + precio */}
        <div>
          <div className={`detail-visual ${pickVisual(listing.id)}`}>
            {listing.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={listing.photoUrl} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 15 }} />
            ) : null}
            {listing.videoVerified && (
              <span>
                <CheckCircle2 />
                Video verificado
              </span>
            )}
          </div>
          <span className="product-type" style={{ marginTop: 14, fontSize: 9 }}>
            {listingType.toUpperCase().replace('-', ' ')}
          </span>
          <h1 style={{ fontSize: 27, letterSpacing: '-1px', margin: '0 0 8px' }}>
            {listing.title}
          </h1>
          <p className="subcopy">
            Publicado por {listing.seller.displayName} · {listing.seller.major}
          </p>
          <div className="detail-price">
            <strong>{fmt(listing.priceXlm)}</strong>
            <span className="ai-price-signal market">
              <Bot /> IA: Precio de mercado
            </span>
          </div>
          <div className="detail-trust">
            <ShieldCheck />
            <span>
              <strong>Intercambio protegido</strong>
              <small>
                Tu pago queda retenido hasta que confirmes recibir el artículo.
              </small>
            </span>
          </div>
          {listing.description && (
            <p style={{ fontSize: 12, color: '#68778a', lineHeight: 1.55, marginTop: 16 }}>
              {listing.description}
            </p>
          )}
          <PriceAlertCallout
            title={listing.title}
            type={listingType}
            priceCents={listing.priceXlm}
          />
          {isPending && (
            <div
              style={{
                marginTop: 18,
                borderLeft: '3px solid var(--primary)',
                background: '#fff0ed',
                borderRadius: 8,
                padding: '12px 14px',
                color: '#d95d4b',
                fontSize: 12,
              }}
            >
              ⏳ <strong>Pendiente</strong> — transacción en curso. El vendedor no
              acepta nuevas ofertas hasta que el escrow concluya.
            </div>
          )}
        </div>

        {/* Columna derecha — ofertas / form */}
        <div className="offers-board">
          {!isOwner && (
            <div
              className="detail-trust"
              style={{ background: 'var(--mint)', borderColor: '#d8f0e7' }}
            >
              <Tag />
              <span>
                <strong>
                  {publicCount === 0
                    ? 'Aún no hay ofertas'
                    : publicCount === 1
                      ? '1 oferta pendiente'
                      : `${publicCount} ofertas pendientes`}
                </strong>
                <small>
                  {publicCount > 0 && avgOfferCents != null && (
                    <>
                      {' '}Promedio: {fmt(avgOfferCents)} ({Math.round((avgOfferCents / (listing.priceXlm / 100)))}% del precio).
                    </>
                  )}
                  {publicCount === 0 && ' Sé el primero en ofertar.'}
                </small>
              </span>
            </div>
          )}

          {me && !isOwner && listing.status === 'active' && !rawMyOffer ? (
            <>
              <div className="section-heading">
                <div>
                  <h2>Hacer una oferta</h2>
                  <p>Ofrece saldo, trueque o una combinación de ambos.</p>
                </div>
                <Tag />
              </div>
              <OfferForm listingId={listing.id} maxXlmCents={listing.priceXlm} />
            </>
          ) : me && !isOwner && rawMyOffer ? (
            <div className="detail-trust" style={{ background: 'var(--lavender)', borderColor: '#d6c8f5' }}>
              <CheckCircle2 />
              <span>
                <strong>Ya enviaste una oferta</strong>
                <small>
                  Tipo: {rawMyOffer.type === 'saldo-only' ? 'solo saldo' : rawMyOffer.type === 'hybrid' ? 'híbrida' : 'trueque puro'}{' '}
                  · Estado actual:&nbsp;
                  <strong>
                    {rawMyOffer.status === 'pending'
                      ? 'pendiente · esperando al vendedor'
                      : rawMyOffer.status === 'accepted' || rawMyOffer.status === 'completed'
                        ? 'aceptada · revisa tu cola de escrows'
                        : rawMyOffer.status === 'rejected'
                          ? 'rechazada · puedes intentar otra'
                          : 'retirada'}
                  </strong>
                </small>
                {rawMyOffer.xlmAmount ? (
                  <small style={{ marginTop: 4, display: 'block' }}>
                    Tu oferta: {fmt(rawMyOffer.xlmAmount)}.
                  </small>
                ) : null}
              </span>
            </div>
          ) : isOwner && !isPending ? (
            <>
              <div className="section-heading">
                <div>
                  <h2>Tablero de ofertas ({offers.length})</h2>
                  <p>Elige la propuesta que más te convenga.</p>
                </div>
                <Tag />
              </div>
              <OfferBoard offers={offers} listingPriceCents={listing.priceXlm} />
              <div style={{ height: 10 }} />
              <Link href="/marketplace" className="sell-button offer-button">
                Volver a tu publicación <ChevronRight />
              </Link>
            </>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>Inicia sesión para ofertar</h2>
                  <p>Necesitas una cuenta activa para enviar una propuesta.</p>
                </div>
              </div>
              <Link href="/" className="sell-button offer-button">
                Iniciar sesión <ChevronRight />
              </Link>
            </>
          )}

          {/* Chat pre-oferta: solo si soy participante (seller u offerer). */}
          {me && (isOwner || rawMyOffer) && (
            <div style={{ marginTop: 26 }}>
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <div>
                  <p className="eyebrow">MENSAJES · NEGOCIACIÓN</p>
                  <h2>Negocia con {isOwner ? 'los offerers' : 'el vendedor'}</h2>
                  <p>
                    Coordina detalles antes de aceptar la oferta: estado real
                    del artículo, horario de encuentro, trueques mixtos.
                  </p>
                </div>
              </div>
              <ChatThread
                scope="listing"
                scopeId={listingId}
                meId={me.id}
                title={listing.title}
              />
              {isOwner && (
                <p
                  className="subcopy"
                  style={{ marginTop: 8, fontSize: 10, color: '#7f8c9d' }}
                >
                  Como vendedor, tu chat es con CADA offerer que haya escrito.
                  Polling cada 4s para ver mensajes nuevos — la pestaña
                  refresca sola cuando está visible.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
