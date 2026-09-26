// components/escrow/EscrowActions.tsx — Botones según estado + rol.
// (Sección §10.4 — implementado con separación KISS de ramas.)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      // Pago via Pollar runTx (verificado §5.4). NO usamos SendModal.
      const client = getClient();
      await client.runTx('payment', {
        destination: data.paymentParams.destination,
        amount: data.paymentParams.amount,
        asset: data.paymentParams.asset,
      });
      await client.refreshBalance();
      // Re-call para confirmar funded tras pago.
      await callApi('/api/escrow/fund', { escrowId: escrow.id });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Switch por estado. Sigue §10.4 del ARCHITECTURE. */
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {escrow.status === 'awaiting-funding' && isBuyer && (
        <button
          disabled={busy || escrow.amountXlm === 0}
          onClick={() => void fund()}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {escrow.amountXlm === 0
            ? '(trueque puro)'
            : `Fondear escrow (${(escrow.amountXlm / 100).toFixed(2)} XLM)`}
        </button>
      )}

      {escrow.status === 'awaiting-funding' &&
        (isBuyer || isSeller) && (
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
            className="w-full text-gray-500 py-2 text-sm"
          >
            Cancelar y reembolsar
          </button>
        )}

      {escrow.status === 'funded' &&
        (isBuyer || isSeller) && (
          <>
            <p className="text-sm text-gray-600">
              Coordina el encuentro entre las dos partes (Biblioteca central…).
              Cuando intercambien los objetos, pulsen "Intercambio realizado".
            </p>
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/record-exchange', { escrowId: escrow.id })}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              🤝 Intercambio realizado
            </button>
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
              className="w-full text-gray-500 py-2 text-sm"
            >
              Cancelar y reembolso
            </button>
          </>
        )}

      {escrow.status === 'awaiting-exchange' &&
        (isBuyer || isSeller) && (
          <>
            {escrow.exchangeInitiatorId === me?.id ? (
              <p className="text-sm text-gray-600">
                Esperando que la otra parte confirme el intercambio.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  La otra parte registró que hicieron el intercambio. ¿Lo confirmas?
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    callApi('/api/escrow/confirm-exchange', { escrowId: escrow.id })
                  }
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  ✅ Sí, confirmar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    router.push(`/escrow/${escrow.id}/report?reason=exchange-never-happened`)
                  }
                  className="w-full text-red-600 py-2 text-sm"
                >
                  ⚠ No, eso no pasó
                </button>
              </>
            )}
            <button
              disabled={busy}
              onClick={() => callApi('/api/escrow/cancel', { escrowId: escrow.id })}
              className="w-full text-gray-500 py-2 text-sm"
            >
              Cancelar y reembolsar
            </button>
          </>
        )}

      {escrow.status === 'exchange-recorded' && isBuyer && (
        <>
          <p className="text-sm">¿Funciona el artículo?</p>
          <button
            disabled={busy}
            onClick={() => callApi('/api/escrow/accept', { escrowId: escrow.id })}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            ✅ Aceptar artículo
          </button>
          <button
            disabled={busy}
            onClick={() => router.push(`/escrow/${escrow.id}/report`)}
            className="w-full text-red-600 py-2 text-sm"
          >
            ⚠ Reportar problema
          </button>
        </>
      )}

      {escrow.status === 'exchange-recorded' && isSeller && (
        <p className="text-sm text-gray-600">
          Esperando que el comprador pruebe el artículo…
        </p>
      )}

      {(escrow.status === 'released' || escrow.status === 'auto-released') && (
        <button
          onClick={() => router.push(`/receipt/${escrow.id}`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
        >
          Ver recibo
        </button>
      )}

      {escrow.status === 'disputed' && (
        <p className="text-red-600">⚠ Disputa abierta. Nuestro equipo la revisará.</p>
      )}

      {escrow.status === 'refunded' && (
        <p className="text-gray-500">Este intercambio fue cancelado y reembolsado.</p>
      )}
    </div>
  );
}
