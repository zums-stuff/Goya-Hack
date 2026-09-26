// app/(authed)/receipt/[escrowId]/page.tsx — Recibo final.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { fmtPrice } from '@/lib/format';

export default async function ReceiptPage(props: {
  params: Promise<{ escrowId: string }>;
}) {
  const { escrowId } = await props.params;
  const me = await tryGetUser();
  if (!me) return null;

  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      listing: { select: { title: true } },
    },
  });
  if (!escrow) notFound();
  if (escrow.buyerId !== me.id && escrow.sellerId !== me.id) {
    return <p className="p-6">No autorizado.</p>;
  }
  if (!['released', 'auto-released', 'refunded'].includes(escrow.status)) {
    return (
      <section style={{ maxWidth: 520 }}>
        <div className="sell-modal" style={{ width: '100%' }}>
          <div className="modal-spark">
            <Wallet />
          </div>
          <p className="eyebrow">RECIBO · PENDIENTE</p>
          <h2>El escrow aún no tiene recibo final</h2>
          <p>
            Estado actual: <strong>{escrow.status}</strong>. Vuelve cuando el
            intercambio concluya.
          </p>
          <Link href={`/escrow/${escrow.id}`} className="sell-button offer-button" style={{ marginTop: 16 }}>
            Ir al escrow <ChevronRight />
          </Link>
        </div>
      </section>
    );
  }

  const isRelease = escrow.status !== 'refunded';
  const net = (escrow.amountXlm - escrow.platformFeeXlm) / 100;
  const fee = escrow.platformFeeXlm / 100;
  const toneClass = isRelease ? 'verified' : 'warning-text';
  const toneText = isRelease ? '✓ Transacción completada' : '↺ Reembolso emitido';
  const toneIcon = isRelease ? <CheckCircle2 /> : <ArrowLeft />;

  return (
    <section style={{ maxWidth: 560 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 16 }}>
        <ArrowLeft />
        Volver
      </Link>

      <p className="eyebrow">RECIBO · {escrow.status.toUpperCase()}</p>
      <h1
        style={{
          fontSize: 27,
          letterSpacing: '-1px',
          margin: '0 0 14px',
          color: '#26364c',
        }}
      >
        {isRelease ? 'Intercambio completado' : 'Reembolso emitido'}
      </h1>

      <div className="balance-card" style={{ minHeight: 170 }}>
        <div className="balance-top">
          <span>{escrow.listing.title}</span>
          <Wallet />
        </div>
        <div className="balance-amount">P$ {fmtPrice(escrow.amountXlm)}</div>
        <div className="balance-footer">
          <span className={toneClass}>
            {toneIcon}
            {toneText}
          </span>
          <span>Stellar testnet</span>
        </div>
      </div>

      <div className="account-grid" style={{ margin: '20px 0' }}>
        <div
          className="balance-card"
          style={{ minHeight: 130, padding: '16px 18px 14px' }}
        >
          <div className="balance-top">
            <span>Compra</span>
          </div>
          <div className="balance-amount" style={{ fontSize: 22, margin: '10px 0 6px' }}>
            {escrow.buyer.displayName}
          </div>
          <div className="balance-footer" style={{ fontSize: 10 }}>
            <span>Comprador</span>
          </div>
        </div>
        <div
          className="balance-card"
          style={{ minHeight: 130, padding: '16px 18px 14px' }}
        >
          <div className="balance-top">
            <span>Venta</span>
          </div>
          <div className="balance-amount" style={{ fontSize: 22, margin: '10px 0 6px' }}>
            {escrow.seller.displayName}
          </div>
          <div className="balance-footer" style={{ fontSize: 10 }}>
            <span>Vendedor</span>
          </div>
        </div>
      </div>

      <div className="wallet-panel" style={{ marginTop: 14 }}>
        <span>
          <ShieldCheck />
          <strong>Desglose de la transacción</strong>
          <small>
            Monto: P$ {fmtPrice(escrow.amountXlm)}
            {escrow.platformFeeXlm > 0 && (
              <>
                {' '}· Plataforma ({escrow.platformFeeBps} bps): P${' '}
                {fee.toLocaleString('es-MX', { maximumFractionDigits: 4 })}
              </>
            )}
          </small>
        </span>
        {isRelease && (
          <span className="ai-price-signal market" style={{ marginTop: 0 }}>
            Vendedor recibe P$ {net.toLocaleString('es-MX', { maximumFractionDigits: 4 })}
          </span>
        )}
      </div>

      {escrow.stellarTxHashRelease && (
        <div className="wallet-panel" style={{ marginTop: 10 }}>
          <span>
            <Wallet />
            <strong style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 11 }}>
              {escrow.stellarTxHashRelease.slice(0, 18)}…{escrow.stellarTxHashRelease.slice(-8)}
            </strong>
            <small>Tx on-chain Stellar — ver en Horizon</small>
          </span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${escrow.stellarTxHashRelease}`}
            target="_blank"
            rel="noreferrer"
            className="outline-button"
          >
            Ver <ChevronRight />
          </a>
        </div>
      )}

      {escrow.stellarMemoReceipt && (
        <p
          className="subcopy"
          style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          Memo: <code>{escrow.stellarMemoReceipt}</code>
        </p>
      )}
    </section>
  );
}
