// app/(authed)/escrow/[escrowId]/report/page.tsx — Form de disputa.
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { DisputeForm } from '@/components/escrow/DisputeForm';

export default async function DisputePage(props: {
  params: Promise<{ escrowId: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { escrowId } = await props.params;
  const sp = await props.searchParams;
  const me = await tryGetUser();
  if (!me) return null; // layout ya redirige

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      disputeReason: true,
    },
  });

  // Misma recuperación elegante que /escrow/[escrowId]: si el escrow no
  // existe (race con demo-reset, ID inválido, ya cerrado hace tiempo),
  // mostramos un panel claro en vez del 404.
  if (!escrow) {
    return (
      <section style={{ maxWidth: 520 }}>
        <Link href="/home" className="back-button" style={{ marginBottom: 12 }}>
          <ArrowLeft />
          Volver al dashboard
        </Link>
        <div className="sell-modal" style={{ width: '100%' }}>
          <div className="modal-spark" style={{ background: 'var(--yellow)', color: '#a17a18' }}>
            <ShieldAlert />
          </div>
          <p className="eyebrow">DISPUTA · NO ENCONTRADO</p>
          <h2>No se puede abrir una disputa</h2>
          <p>
            El escrow <code className="font-mono">{escrowId}</code> ya no
            existe o se cerró antes de que pudieras reportar. Vuelve a la
            lista y abre un proceso que siga activo.
          </p>
          <div className="submit-row" style={{ marginTop: 16 }}>
            <Link href="/procesos" className="sell-button offer-button">
              Ver mis procesos <ChevronRight />
            </Link>
            <Link href="/home" className="outline-button">
              Inicio
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (escrow.buyerId !== me.id && escrow.sellerId !== me.id) {
    return <p className="p-6">No autorizado.</p>;
  }

  return (
    <section style={{ maxWidth: 560 }}>
      <Link href={`/escrow/${escrow.id}`} className="back-button" style={{ marginBottom: 12 }}>
        <ArrowLeft />
        Volver al escrow
      </Link>

      <div className="sell-modal" style={{ width: '100%' }}>
        <div className="modal-spark" style={{ background: 'var(--lavender)', color: '#9a86dc' }}>
          <ShieldAlert />
        </div>
        <p className="eyebrow">DISPUTA · PUMATRADE</p>
        <h2>Reportar un problema</h2>
        <p>
          Cuéntale a un administrador qué pasó. Necesitas ser una de las dos
          partes del escrow (comprador o vendedor).
        </p>
        <div
          className="detail-trust"
          style={{ background: 'var(--lavender)', borderColor: '#d6c8f5', marginBottom: 16 }}
        >
          <ShieldAlert />
          <span>
            <strong>Estado del escrow: {escrow.status}</strong>
            {escrow.status === 'disputed' && (
              <small>Ya hay una disputa abierta para este escrow.</small>
            )}
          </span>
        </div>
        <DisputeForm
          escrowId={escrow.id}
          initialReason={sp.reason}
          disabled={escrow.status === 'disputed'}
        />
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          Un administrador revisará la evidencia de ambas partes y decidirá
          si libera al vendedor o reembolsa al comprador.
        </div>
      </div>
    </section>
  );
}
