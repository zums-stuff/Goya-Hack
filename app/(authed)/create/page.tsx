// app/(authed)/create/page.tsx — Modal de publicación. El ListingForm
// recibe `defaultMajor` para preseleccionar la carrera del usuario.
import { tryGetUser } from '@/lib/auth';
import { ListingForm } from '@/components/listings/ListingForm';
import { Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function CreateListingPage() {
  const me = await tryGetUser();
  if (!me) return null; // layout ya redirige

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
          <ListingForm defaultMajor={me.major} />
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
          Al publicar, el artículo aparece en el marketplace (visible en{' '}
          <code className="font-mono">/marketplace</code>) y los demás
          estudiantes ven tu publicación al instante.
        </p>
      </div>
    </section>
  );
}
