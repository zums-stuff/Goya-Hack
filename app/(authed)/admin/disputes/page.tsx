// app/(authed)/admin/disputes/page.tsx — Cola de disputas.
// Estilo del example: list de .offer-card (item-style) para cada disputa.
import { notFound, redirect } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { getSessionEmail, tryGetUser } from '@/lib/auth';
import { isAdmin } from '@/lib/config';
import type { DisputeEvidence } from '@/generated/prisma/client';

interface DisputeWithRelations extends DisputeEvidence {
  disputePhotoUrl?: string | null;
  escrow: { id: string; listingId: string; listing: { title: string } };
}

function fmtDate(d: Date): string {
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminDisputesPage() {
  const me = await tryGetUser();
  if (!me) return null;
  const email = await getSessionEmail();
  if (!email || !isAdmin(email)) {
    return (
      <section style={{ maxWidth: 520 }}>
        <div className="sell-modal">
          <div className="modal-spark">
            <ShieldAlert />
          </div>
          <p className="eyebrow">ADMIN · ACCESO DENEGADO</p>
          <h2>Esta página es solo para administradores</h2>
          <p>
            Necesitas un email ∈ <code className="font-mono">ADMIN_EMAILS</code>.
            Tu email actual: <code className="font-mono">{email ?? '—'}</code>.
          </p>
        </div>
      </section>
    );
  }

  const disputes = (await prisma.disputeEvidence.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      escrow: { include: { listing: { select: { title: true } } } },
    },
  })) as DisputeWithRelations[];

  return (
    <section className="admin-view">
      <p className="eyebrow">ADMIN · PUMATRADE</p>
      <h1
        style={{
          fontSize: 27,
          letterSpacing: '-1px',
          margin: '0 0 8px',
          color: '#26364c',
        }}
      >
        Disputas pendientes
      </h1>
      <p className="subcopy">
        {disputes.length} caso(s) esperando revisión. Resuelve liberando al
        vendedor o reembolsando al comprador.
      </p>

      {disputes.length === 0 && (
        <div
          className="detail-trust"
          style={{ marginTop: 24, background: 'var(--mint)', borderColor: '#d8f0e7' }}
        >
          <CheckCircle2 />
          <span>
            <strong>No hay disputas abiertas 🎉</strong>
            <small>Volveremos a avisarte cuando un caso necesite revisión.</small>
          </span>
        </div>
      )}

      <ul style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {disputes.map((d) => (
          <li
            key={d.id}
            className="offer-card"
            style={{ borderRadius: 12, padding: 16 }}
          >
            <div className="offer-top">
              <span className="offer-kind" style={{ color: 'var(--primary)' }}>
                ⚠ {d.reason.toUpperCase()}
              </span>
              <span className="market-range">{fmtDate(d.createdAt)}</span>
            </div>
            <strong style={{ display: 'block', fontSize: 13 }}>
              {d.escrow.listing.title}
            </strong>
            <p style={{ margin: '10px 0', fontSize: 11, color: '#7f8c9d', lineHeight: 1.5 }}>
              “{d.description}”
            </p>
            <code
              className="listing-meta"
              style={{ fontSize: 9 }}
            >
              escrow {d.escrowId}
            </code>
            {d.disputePhotoUrl ?? d.photoUrl ? (
              <a
                style={{ display: 'block', fontSize: 10, color: 'var(--primary)', marginTop: 6 }}
                href={`/disputes/${d.id}.jpg`}
                className="text-button"
              >
                Ver evidencia fotográfica
              </a>
            ) : null}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                borderTop: '1px solid var(--line)',
                marginTop: 14,
                paddingTop: 12,
              }}
            >
              <form
                action={`/api/admin/disputes/${d.id}/resolve`}
                method="POST"
                style={{ display: 'inline' }}
              >
                <input type="hidden" name="decision" value="release" />
                <button type="submit" className="sell-button" style={{ padding: '8px 12px', fontSize: 10 }}>
                  Release al vendedor
                </button>
              </form>
              <form
                action={`/api/admin/disputes/${d.id}/resolve`}
                method="POST"
                style={{ display: 'inline' }}
              >
                <input type="hidden" name="decision" value="refund" />
                <button
                  type="submit"
                  className="outline-button"
                  style={{ padding: '8px 12px', fontSize: 10 }}
                >
                  Refund al comprador
                </button>
              </form>
              <a
                href={`/escrow/${d.escrowId}`}
                className="text-button"
                style={{ marginLeft: 'auto' }}
              >
                Ver escrow <ChevronRight />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
