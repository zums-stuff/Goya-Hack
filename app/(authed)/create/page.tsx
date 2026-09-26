// app/(authed)/create/page.tsx — Form modal-style para publicar artículo.
import { ListingForm } from '@/components/listings/ListingForm';
import { Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateListingPage() {
  return (
    <section style={{ maxWidth: 720 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 12 }}>
        <ArrowLeft />
        Volver
      </Link>

      <div className="sell-modal" style={{ width: '100%' }}>
        <div className="modal-spark">
          <Plus />
        </div>
        <p className="eyebrow">PUBLICAR · PUMATRADE</p>
        <h2>Sube un artículo al marketplace</h2>
        <p>
          Describe brevemente el artículo, indica la condición y propone un
          precio en XLM. Los demás estudiantes podrán ofertar.
        </p>

        <div style={{ marginTop: 18 }}>
          <ListingForm />
        </div>

        <p
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          Tu artículo se publica al instante. Los demás ven la lista y pueden
          ofertarte. Cuando aceptas una oferta, el escrow empieza
          automáticamente.
        </p>
      </div>
    </section>
  );
}
