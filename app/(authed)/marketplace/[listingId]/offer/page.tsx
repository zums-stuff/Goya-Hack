import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, AlertCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { OfferForm } from '@/components/offers/OfferForm';
import { fmtXlm } from '@/lib/currency';
import type { ListingType } from '@/lib/schemas';

export default async function OfferPage(props: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await props.params;
  const me = await tryGetUser();
  
  if (!me) {
    redirect('/');
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { seller: { select: { displayName: true } } },
  });

  if (!listing) {
    notFound();
  }

  if (listing.status !== 'active') {
    return (
      <section style={{ maxWidth: 600, margin: '40px auto' }}>
        <div className="sell-modal" style={{ width: '100%' }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">ARTÍCULO NO DISPONIBLE</p>
              <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.7px', margin: '0 0 7px' }}>Artículo no disponible</h1>
              <p style={{ color: '#8793a3', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Este artículo ya no acepta ofertas porque su estado es &ldquo;{listing.status}&rdquo;.
              </p>
            </div>
            <AlertCircle size={28} color="#c45f4e" />
          </div>
          <Link href={`/marketplace/${listingId}`} className="sell-button offer-button">
            Volver al artículo
          </Link>
        </div>
      </section>
    );
  }

  if (listing.sellerId === me.id) {
    return (
      <section style={{ maxWidth: 600, margin: '40px auto' }}>
        <div className="sell-modal" style={{ width: '100%' }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">OFERTA NO PERMITIDA</p>
              <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.7px', margin: '0 0 7px' }}>No puedes ofertar</h1>
              <p style={{ color: '#8793a3', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Este artículo fue publicado por ti.
              </p>
            </div>
            <AlertCircle size={28} color="#c45f4e" />
          </div>
          <Link href={`/marketplace/${listingId}`} className="sell-button offer-button">
            Volver a tu publicación
          </Link>
        </div>
      </section>
    );
  }

  const listingType = listing.type as ListingType;

  return (
    <section style={{ maxWidth: 600, margin: '40px auto' }}>
      <div className="sell-modal" style={{ width: '100%' }}>
        <Link href={`/marketplace/${listingId}`} className="back-button">
          <ArrowLeft />
          Volver al artículo
        </Link>

        <div className="section-heading" style={{ marginTop: 8 }}>
          <div>
            <p className="eyebrow">NUEVA OFERTA</p>
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.7px', margin: '0 0 7px' }}>Hacer una oferta</h1>
            <p style={{ color: '#8793a3', fontSize: 12, margin: '0 0 4px', lineHeight: 1.5 }}>
              Ofrece saldo, trueque o una combinación por este artículo.
            </p>
          </div>
          <Tag />
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 11, padding: '13px 14px', marginBottom: 22, border: '1px solid var(--line)' }}>
          <div className="kv-row">
            <span className="kv-key">Artículo</span>
            <span className="kv-val" style={{ fontWeight: 600 }}>{listing.title}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Tipo</span>
            <span className="kv-val">{listingType.toUpperCase().replace('-', ' ')}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Vendedor</span>
            <span className="kv-val">{listing.seller.displayName}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Precio listado</span>
            <span className="kv-val" style={{ fontWeight: 700, color: 'var(--primary)' }}>
              {await fmtXlm(listing.priceXlm)}
            </span>
          </div>
        </div>

        <OfferForm listingId={listing.id} maxXlmCents={listing.priceXlm} />
      </div>
    </section>
  );
}
