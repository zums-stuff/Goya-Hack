// app/(authed)/escrow/[escrowId]/page.tsx — Detalle del escrow.
// Estado + participantes + acciones. Estilo del example: .wallet-panel + .detail-trust.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { EscrowActions } from '@/components/escrow/EscrowActions';
import { CountdownTimer } from '@/components/escrow/CountdownTimer';
import { ChatThread } from '@/components/chat/ChatThread';
import { tryGetUser } from '@/lib/auth';
import { fmtXlm, mxnFromCents, xlmMxnRate, fmtMxn } from '@/lib/currency';

function statusLabel(s: string): { label: string; tone: 'positive' | 'soon' | 'alert' | 'muted' } {
  switch (s) {
    case 'awaiting-funding':
      return { label: 'Esperando fondeo', tone: 'soon' };
    case 'funded':
      return { label: 'Fondeado', tone: 'positive' };
    case 'exchange-pending':
      return { label: 'Intercambio pendiente', tone: 'soon' };
    case 'exchange-confirmed':
      return { label: 'Intercambio confirmado', tone: 'soon' };
    case 'disputed':
      return { label: 'En disputa', tone: 'alert' };
    case 'completed':
    case 'released':
    case 'auto-released':
      return { label: 'Liberado', tone: 'positive' };
    case 'refunded':
      return { label: 'Reembolsado', tone: 'muted' };
    default:
      return { label: s, tone: 'muted' };
  }
}

export default async function EscrowDetailPage(props: {
  params: Promise<{ escrowId: string }>;
}) {
  const { escrowId } = await props.params;
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      buyer: { select: { id: true, displayName: true, pollarWalletId: true } },
      seller: { select: { id: true, displayName: true, pollarWalletId: true } },
      listing: { select: { id: true, title: true, type: true } },
    },
  });
  if (!escrow) notFound();

  const me = await tryGetUser();
  const st = statusLabel(escrow.status);
  const toneClass =
    st.tone === 'positive'
      ? 'verified'
      : st.tone === 'alert'
        ? 'warning-text'
        : 'ai-price-signal market';

  const rate = await xlmMxnRate();
  const fmtAmount = await fmtXlm(escrow.amountXlm);
  const fmtShort = (cents: number) =>
    `${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxn(mxnFromCents(cents, rate))}`;

  // El chat se deshabilita una vez que el escrow está cerrado (released /
  // refunded / auto-released) — coordinar pickup ya no aplica.
  const chatClosedStates = ['released', 'auto-released', 'refunded', 'disputed'];
  const chatDisabled = chatClosedStates.includes(escrow.status);
  const chatDisabledReason =
    escrow.status === 'disputed'
      ? 'Chat cerrado durante la disputa (usa /report para aportar evidencia).'
      : escrow.status === 'refunded'
        ? 'Chat cerrado — el escrow fue reembolsado.'
        : 'Chat cerrado — el intercambio ya terminó.';

  return (
    <section style={{ maxWidth: 760 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 20 }}>
        <ArrowLeft />
        Volver al dashboard
      </Link>

      <p className="eyebrow">ESCROW · PUMATRADE</p>
      <h1
        style={{
          fontSize: 29,
          letterSpacing: '-1px',
          margin: '0 0 10px',
          color: '#26364c',
        }}
      >
        {escrow.listing.title}
      </h1>

      <div className="balance-card" style={{ minHeight: 160 }}>
        <div className="balance-top">
          <span>Monto del intercambio</span>
          <Wallet />
        </div>
        <div className="balance-amount">{fmtAmount}</div>
        <div className="balance-footer">
          <span className={toneClass}>
            {st.tone === 'alert' ? <ShieldAlert /> : <ShieldCheck />}
            {st.label}
          </span>
          <CountdownTimer
            targetDate={
              escrow.confirmWindowExpiresAt ?? escrow.ttlExpiresAt ?? null
            }
            status={escrow.status}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          margin: '20px 0',
        }}
      >
        <div className="wallet-panel" style={{ marginTop: 0 }}>
          <span>
            <ShieldCheck />
            <strong>{escrow.buyer.displayName}</strong>
            <small>Comprador · {escrow.buyer.pollarWalletId.slice(0, 10)}…</small>
          </span>
          <span className="verified">
            <ShieldCheck />
            Verificado
          </span>
        </div>
        <div className="wallet-panel" style={{ marginTop: 0 }}>
          <span>
            <ShieldCheck />
            <strong>{escrow.seller.displayName}</strong>
            <small>Vendedor · {escrow.seller.pollarWalletId.slice(0, 10)}…</small>
          </span>
          <span className="verified">
            <ShieldCheck />
            Verificado
          </span>
        </div>
      </div>

      {escrow.status === 'disputed' && (
        <div className="detail-trust" style={{ background: 'var(--lavender)', borderColor: '#d6c8f5' }}>
          <ShieldAlert />
          <span>
            <strong>Disputa abierta</strong>
            <small>
              Un administrador revisará las evidencias de ambas partes antes
              de resolver el escrow.
            </small>
          </span>
          <Link href={`/escrow/${escrow.id}/report`}>
            Ver reporte <ChevronRight />
          </Link>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <EscrowActions
          meId={me?.id ?? null}
          demoMode={Boolean(process.env.DEMO_FUNDING_BYPASS) && process.env.NODE_ENV !== 'production'}
          escrow={{
            id: escrow.id,
            status: escrow.status,
            amountXlm: escrow.amountXlm,
            exchangeInitiatorId: escrow.exchangeInitiatorId,
            buyerId: escrow.buyerId,
            sellerId: escrow.sellerId,
          }}
        />
        {Boolean(process.env.DEMO_FUNDING_BYPASS) && process.env.NODE_ENV !== 'production' && (
          <div
            className="detail-trust"
            style={{
              background: 'var(--yellow)',
              borderColor: '#e9d279',
              marginTop: 12,
              color: '#7a5b14',
            }}
          >
            <AlertCircle />
            <span>
              <strong>Modo DEMO activo</strong>
              <small>
                Las keys de Pollar son placeholders. "Fondear" avanza el
                escrow directamente sin enviar la transacción on-chain a
                Stellar. Para demo end-to-end sin redeploy; en producción
                (NODE_ENV=production) el bypass está deshabilitado aunque
                la env esté puesta.
              </small>
            </span>
          </div>
        )}
      </div>

      {me && (me.id === escrow.buyerId || me.id === escrow.sellerId) && (
        <div style={{ marginTop: 36 }}>
          <div className="section-heading" style={{ marginBottom: 10 }}>
            <div>
              <p className="eyebrow">MENSAJES · TRADE</p>
              <h2>Coordina con {me.id === escrow.buyerId ? 'el vendedor' : 'el comprador'}</h2>
              <p>
                Habla directo: lugar de encuentro, horario, identidad del
                objeto. Polling 4s — refresca solo cuando la pestaña está
                visible.
              </p>
            </div>
          </div>
          <ChatThread
            scope="escrow"
            scopeId={escrow.id}
            meId={me.id}
            title={escrow.listing.title}
            disabled={chatDisabled}
            disabledReason={chatDisabledReason}
          />
        </div>
      )}

      <p className="subcopy" style={{ marginTop: 24, fontSize: 11 }}>
        ID: <code className="font-mono">{escrow.id}</code>
        {escrow.listing.type && (
          <>
            {' '}• Tipo: <code className="font-mono">{escrow.listing.type}</code>
          </>
        )}
      </p>
    </section>
  );
}