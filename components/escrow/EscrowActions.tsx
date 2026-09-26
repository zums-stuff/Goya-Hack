// components/escrow/EscrowActions.tsx — Acciones por estado y rol.
// Sistema: detail-trust (.detail-trust/.wallet-panel), botones sell-button
// primario + cancel-button secundario. Texto con .subcopy/.warning-text/.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HandHeart,
  CheckCircle2,
  ArrowRightLeft,
  ShieldAlert,
  Receipt,
} from 'lucide-react';
import { usePollar } from '@pollar/react';
import { useAuthStore } from '@/stores/authStore';

type Escrow = {
  id: string;
  status: string;
  amountXlm: number;
  exchangeInitiatorId: string | null;
  buyerId: string;
  sellerId: string;
};

export function EscrowActions({ escrow }: { escrow: Escrow }) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const { getClient } = usePollar();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuyer = me?.id === escrow.buyerId;
  const isSeller = me?.id === escrow.sellerId;

  async function callApi(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error');
      }
      router.refresh();
      return res.json();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function fund() {
    try {
      const r = await callApi('/api/escrow/fund', { escrowId: escrow.id });
      const data: { paymentParams: { destination: string; amount: string; asset: { type: 'native' } } | null; funded: boolean } = await r.json();
      if (data.funded || !data.paymentParams) {
        router.refresh();
        return;
      }
      const client = getClient();
      await client.runTx('payment', {
        destination: data.paymentParams.destination,
        amount: data.paymentParams.amount,
        asset: data.paymentParams.asset,
      });
      await client.refreshBalance();
      await callApi('/api/escrow/fund', { escrowId: escrow.id });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {escrow.status === 'awaiting-funding' && isBuyer && (
        <>
          <button
            disabled={busy || escrow.amountXlm === 0}
            onClick={() => void fund()}
            className="sell-button"
            style={{ width: '100%', justifyContent: 'center', opacity: busy || escrow.amountXlm === 0 ? 0.5 : 1, padding: '14px 18px' }}
          >
            {escrow.amountXlm === 0
              ? '✦ Trueque puro · no requiere fondeo'
              : `Fondear escrow · P$ {(escrow.amountXlm / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`}
          </button>
          <p className="subcopy" style={{ fontSize: 10, color: '#7f8c9d' }}>
            Tu pago se transfiere a la cuenta de escrow Stellar. Se libera al
            vendedor cuando confirmes que recibiste el artículo.
          </p>
        </>
      )}

      {escrow.status === 'awaiting-funding' && (isBuyer || isSeller) && (
        <button
          disabled={busy}
          onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
          className="cancel-button"
          style={{ opacity: busy ? 0.5 : 1 }}
        >
          Cancelar y reembolsar
        </button>
      )}

      {escrow.status === 'funded' && (isBuyer || isSeller) && (
        <>
          <div className="detail-trust" style={{ background: 'var(--mint)', borderColor: '#d8f0e7' }}>
            <HandHeart />
            <span>
              <strong>Coordina el encuentro entre las dos partes</strong>
              <small>
                Bibliotecao central, Facultad de Ingeniería u otro punto
                acordado. Cuando intercambien los objetos, pulsen{' '}
                <em>“Intercambio realizado”</em>.
              </small>
            </span>
          </div>
          <div className="submit-row">
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/record-exchange', { escrowId: escrow.id })}
              className="sell-button"
              style={{ opacity: busy ? 0.5 : 1 }}
            >
              <ArrowRightLeft />
              {busy ? 'Registrando…' : 'Intercambio realizado'}
            </button>
          </div>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="cancel-button"
          >
            Cancelar y reembolso
          </button>
        </>
      )}

      {escrow.status === 'awaiting-exchange' && (isBuyer || isSeller) && (
        <>
          {escrow.exchangeInitiatorId === me?.id ? (
            <div className="detail-trust" style={{ background: 'var(--lavender)', borderColor: '#d6c8f5' }}>
              <ArrowRightLeft />
              <span>
                <strong>Esperando que la otra parte confirme</strong>
                <small>Ya registraste el encuentro. La otra parte acepta o disputa desde su cuenta.</small>
              </span>
            </div>
          ) : (
            <>
              <div className="detail-trust" style={{ background: 'var(--yellow)', borderColor: '#e9d279' }}>
                <CheckCircle2 />
                <span>
                  <strong>La otra parte dice que hicieron el intercambio</strong>
                  <small>Si ocurrió, confírmalo. Si no, repórtalo.</small>
                </span>
              </div>
              <div className="submit-row">
                <button
                  disabled={busy}
                  onClick={() => callApi('/api/escrow/confirm-exchange', { escrowId: escrow.id })}
                  className="sell-button"
                  style={{ opacity: busy ? 0.5 : 1 }}
                >
                  <CheckCircle2 />
                  {busy ? 'Confirmando…' : 'Sí, confirmar'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => router.push(`/escrow/${escrow.id}/report?reason=exchange-never-happened`)}
                  className="outline-button"
                  style={{ padding: '10px 14px', fontSize: 11, justifyContent: 'center' }}
                >
                  <ShieldAlert />
                  No, eso no pasó
                </button>
              </div>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="cancel-button"
          >
            Cancelar y reembolsar
          </button>
        </>
      )}

      {escrow.status === 'exchange-recorded' && isBuyer && (
        <>
          <div className="detail-trust">
            <ShieldAlert />
            <span>
              <strong>¿Funciona el artículo?</strong>
              <small>
                Tienes la <strong>ventana de prueba</strong> para probarlo. Si
                todo va bien, liberas el pago. Si no, puedes reportar.
              </small>
            </span>
          </div>
          <div className="submit-row">
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/accept', { escrowId: escrow.id })}
              className="sell-button"
              style={{ opacity: busy ? 0.5 : 1 }}
            >
              <CheckCircle2 />
              {busy ? 'Aceptando…' : 'Aceptar artículo · liberar pago'}
            </button>
            <button
              onClick={() => router.push(`/escrow/${escrow.id}/report`)}
              className="outline-button"
              style={{ padding: '10px 14px', fontSize: 11, justifyContent: 'center' }}
            >
              <ShieldAlert />
              Reportar problema
            </button>
          </div>
        </>
      )}

      {escrow.status === 'exchange-recorded' && isSeller && (
        <div className="detail-trust">
          <CheckCircle2 />
          <span>
            <strong>Esperando que el comprador pruebe el artículo</strong>
            <small>Recuerda: tienes 48h de inacción → activa el botón “Liberar” te corresponde a vos o al admin.</small>
          </span>
        </div>
      )}

      {(escrow.status === 'released' || escrow.status === 'auto-released') && (
        <LinkPill href={`/receipt/${escrow.id}`} icon={<Receipt />} text="Ver recibo final" />
      )}

      {escrow.status === 'disputed' && (
        <div
          className="detail-trust"
          style={{ background: '#fff0ed', borderColor: '#f3c8bf', color: '#c45f4e' }}
        >
          <ShieldAlert />
          <span>
            <strong>⚠ Disputa abierta</strong>
            <small>Nuestro equipo revisará la evidencia de ambas partes antes de resolver.</small>
          </span>
        </div>
      )}

      {escrow.status === 'refunded' && (
        <div className="empty-state">
          <strong>Intercambio cancelado y reembolsado</strong>
          El dinero volvió al comprador sin penalización.
        </div>
      )}
    </div>
  );
}

function LinkPill({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  // tiny helper to avoid importing Link wrapping client-component log
  return (
    <a
      href={href}
      className="sell-button"
      style={{ justifyContent: 'center', textDecoration: 'none', padding: '12px 18px' }}
    >
      {icon}
      {text}
    </a>
  );
}
