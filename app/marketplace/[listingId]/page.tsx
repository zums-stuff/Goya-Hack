// app/marketplace/[listingId]/page.tsx — Detalle + tablero del vendedor.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { OfferBoard, type OfferLite } from '@/components/offers/OfferBoard';
import { OfferForm } from '@/components/offers/OfferForm';
import { PriceAlertCallout } from '@/components/listings/PriceAlertCallout';
import type { ListingType } from '@/lib/schemas';

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

  // `listing.type` viene como `string` desde DB; lo casteamos al enum
  // (validado por Zod en la creación).
  const listingType = listing.type as ListingType;

  // Tablero solo si eres el seller y NO hay escrow en vuelo.
  type DBOfferRaw = Awaited<ReturnType<typeof prisma.offer.findFirst>>;
  const rawOffers = isOwner && !isPending
    ? await prisma.offer.findMany({
        where: { listingId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        include: { offerer: { select: { id: true, displayName: true, major: true } } },
      })
    : [];

  // Map raw → OfferLite (la shape que OfferBoard espera).
  const offers: OfferLite[] = rawOffers.map(
    (o): OfferLite => ({
      id: o.id,
      type: o.type as 'saldo-only' | 'barter' | 'hybrid',
      xlmAmount: o.xlmAmount,
      message: o.message,
      offerer: {
        id: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.id,
        displayName: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.displayName,
        major: (o as unknown as { offerer: { id: string; displayName: string; major: string } }).offerer.major,
      },
    }),
  );

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href="/marketplace" className="text-sm text-blue-600">
        ← Marketplace
      </Link>

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.photoUrl}
          alt={listing.title}
          className="w-full aspect-video object-cover"
        />
        <div className="p-6 space-y-2">
          <h1 className="text-3xl font-bold">{listing.title}</h1>
          <div className="text-sm text-gray-500">
            {listing.seller.displayName} · {listing.seller.major}
          </div>
          <div className="text-2xl font-mono mt-4">
            {(listing.priceXlm / 100).toFixed(2)} XLM
          </div>
          {listing.videoVerified && (
            <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              ✓ Video verificado
            </span>
          )}
          <p className="text-gray-700 dark:text-gray-300 mt-4">{listing.description}</p>
          <div className="text-xs text-gray-500 capitalize">
            Estado: {listing.condition} · Tipo: {listingType}
          </div>
        </div>
      </div>

      <PriceAlertCallout
        title={listing.title}
        type={listingType}
        priceCents={listing.priceXlm}
      />

      {isPending && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <p className="text-yellow-800">
            ⏳ <strong>Pendiente</strong> — transacción en curso. El vendedor no acepta
            nuevas ofertas hasta que el escrow concluya.
          </p>
        </div>
      )}

      {me && !isOwner && listing.status === 'active' && (
        <section className="border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Hacer oferta</h2>
          <OfferForm listingId={listing.id} maxXlmCents={listing.priceXlm} />
        </section>
      )}

      {isOwner && !isPending && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Tablero de ofertas ({offers.length})</h2>
          <OfferBoard offers={offers} />
        </section>
      )}
    </main>
  );
}
