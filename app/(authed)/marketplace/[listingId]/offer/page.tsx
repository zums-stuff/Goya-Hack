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
      <section className="sell-modal">
        <div className="section-heading">
          <div>
            <h1 style={{ fontSize: 24 }}>Artículo no disponible</h1>
            <p>Este artículo ya no acepta ofertas porque su estado es "{listing.status}".</p>
          </div>
          <AlertCircle size={32} color="#c45f4e" />
        </div>
        <Link href={`/marketplace/${listingId}`} className="cancel-button">
          Volver al artículo
        </Link>
      </section>
    );
  }

  if (listing.sellerId === me.id) {
    return (
      <section className="sell-modal">
        <div className="section-heading">
          <div>
            <h1 style={{ fontSize: 24 }}>No puedes ofertar</h1>
            <p>Este artículo fue publicado por ti.</p>
          </div>
          <AlertCircle size={32} color="#c45f4e" />
        </div>
        <Link href={`/marketplace/${listingId}`} className="cancel-button">
          Volver a tu publicación
        </Link>
      </section>
    );
  }

  const listingType = listing.type as ListingType;

  return (
    <section className="sell-modal" style={{ maxWidth: 600, margin: '40px auto' }}>
      <div className="welcome-row">
        <Link 
          href={`/marketplace/${listingId}`} 
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#68778a', fontSize: 13, fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          Volver al artículo
        </Link>
      </div>

      <div className="section-heading" style={{ marginTop: 24 }}>
        <div>
          <p className="eyebrow">NUEVA OFERTA</p>
          <h1 style={{ fontSize: 24, letterSpacing: '-0.5px' }}>Hacer una oferta</h1>
          <p>Ofrece saldo, trueque o una combinación por este artículo.</p>
        </div>
        <Tag />
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <div className="kv-row">
          <span className="kv-key">Artículo</span>
          <span className="kv-value" style={{ fontWeight: 500 }}>{listing.title}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Tipo</span>
          <span className="kv-value">{listingType.toUpperCase().replace('-', ' ')}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Vendedor</span>
          <span className="kv-value">{listing.seller.displayName}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Precio listado</span>
          <span className="kv-value" style={{ fontWeight: 600, color: 'var(--primary)' }}>
            {await fmtXlm(listing.priceXlm)}
          </span>
        </div>
      </div>

      <OfferForm listingId={listing.id} maxXlmCents={listing.priceXlm} />
    </section>
  );
}
