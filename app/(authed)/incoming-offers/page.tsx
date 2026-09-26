// app/(authed)/incoming-offers/page.tsx — Ofertas recibidas (vista del SELLER).
// Lista de offers EN mis listings con Aceptar/Rechazar inline.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Inbox } from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { IncomingOffersList, type IncomingOffer } from '@/components/incoming-offers/IncomingOffersList';

export default async function IncomingOffersPage() {
  const me = await tryGetUser();
  if (!me) redirect('/');

  const offers = await prisma.offer.findMany({
    where: { listing: { sellerId: me.id } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      listing: { select: { id: true, title: true, priceXlm: true, status: true } },
      offerer: { select: { id: true, displayName: true, major: true } },
    },
  });

  // Cast a IncomingOffer — el join de Prisma devuelve shapes ligeramente
  // distintas según el client (Date|string|null); uso el shape del componente.
  const rows: IncomingOffer[] = offers.map((o) => ({
    id: o.id,
    type: o.type as IncomingOffer['type'],
    xlmAmount: o.xlmAmount,
    message: o.message,
    status: o.status,
    createdAt: o.createdAt,
    offeredItems: o.offeredItems,
    listing: o.listing,
    offerer: o.offerer,
  }));

  const pendingCount = rows.filter((o) => o.status === 'pending').length;

  return (
    <section style={{ maxWidth: 760 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Volver
      </Link>

      <p className="eyebrow">OFERTAS RECIBIDAS · PUMATRADE</p>
      <h1 style={{ fontSize: 29, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Propuestas sobre tus productos
      </h1>
      <p className="subcopy">
        Acepta o rechaza las ofertas que otros estudiantes te hicieron.
        <strong> {pendingCount}</strong> pendientes de tu respuesta.
      </p>

      <div style={{ marginTop: 24 }}>
        <IncomingOffersList offers={rows} />
      </div>

      {pendingCount > 0 && (
        <div
          className="detail-trust"
          style={{
            marginTop: 28,
            background: 'var(--yellow)',
            borderColor: '#e9d279',
          }}
        >
          <Inbox />
          <span>
            <strong>Tienes {pendingCount} ofertas por revisar</strong>
            <small>
              El vendedor también recibe notificaciones por correo en
              producción. En este demo, las respuestas aquí son tu inbox.
            </small>
          </span>
        </div>
      )}
    </section>
  );
}
