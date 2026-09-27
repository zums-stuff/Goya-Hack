'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const [cobro, setCobro] = useState<any>(null);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState<{ id: string; public_key: string; balances?: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    fetch(`/goyahack/api/pay/${id}`).then(r => r.json()).then(d => {
      if (d.cobro) setCobro(d.cobro); else setError(d.error || 'Cobro no encontrado');
    }).catch(() => setError('Error cargando el cobro'));
    const saved = localStorage.getItem('gh_payer_wallet');
    if (saved) setWallet(JSON.parse(saved));
  }, [id]);

  const createWallet = async () => {
    setLoading(true);
    const res = await fetch('/goyahack/api/wallet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'Cliente' }),
    });
    const w = await res.json();
    if (w.id) {
      localStorage.setItem('gh_payer_wallet', JSON.stringify(w));
      setWallet(w);
    } else setError(w.error || 'No se pudo crear la cuenta');
    setLoading(false);
  };

  const pay = async () => {
    if (!wallet) return;
    setLoading(true);
    const res = await fetch(`/goyahack/api/pay/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payer_wallet_id: wallet.id }),
    });
    const data = await res.json();
    if (data.tx_hash) setDone(data); else setError(data.error || 'El pago falló');
    setLoading(false);
  };

  if (error) return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <p className="text-red-400">{error}</p>
    </main>
  );
  if (!cobro) return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse text-zinc-400">Cargando…</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        {!done && cobro.status !== 'paid' && (
          <>
            <div>
              <div className="text-zinc-400 text-sm">{cobro.payee_alias} te cobra</div>
              <div className="text-5xl font-extrabold mt-2">${cobro.amount} <span className="text-xl text-zinc-400">USD</span></div>
              {cobro.concepto && <div className="text-zinc-400 mt-1">{cobro.concepto}</div>}
              <div className="text-zinc-600 text-xs font-mono mt-2">{cobro.id}</div>
            </div>

            {!wallet ? (
              <button onClick={createWallet} disabled={loading}
                className="w-full py-4 rounded-2xl bg-puma-500 font-bold text-lg disabled:opacity-50">
                {loading ? 'Creando tu cuenta…' : 'Pagar ahora'}
              </button>
            ) : (
              <button onClick={pay} disabled={loading}
                className="w-full py-4 rounded-2xl bg-puma-500 font-bold text-lg disabled:opacity-50">
                {loading ? 'Procesando…' : `Confirmar pago de $${cobro.amount}`}
              </button>
            )}
            <p className="text-zinc-600 text-xs">Pago en dólares digitales · se confirma en ~5 segundos · sin comisión</p>
          </>
        )}

        {(done || cobro.status === 'paid') && (
          <div className="bg-green-950 border border-green-700 rounded-3xl p-8 space-y-4">
            <div className="text-5xl">✅</div>
            <div className="text-2xl font-extrabold text-green-300">Pago enviado</div>
            <div className="text-zinc-300">${cobro.amount} USD → {cobro.payee_alias}</div>
            {(done?.explorer_url) && (
              <a href={done.explorer_url} target="_blank"
                className="block text-xs text-green-400 underline break-all">
                Ver transacción en Stellar ↗
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
