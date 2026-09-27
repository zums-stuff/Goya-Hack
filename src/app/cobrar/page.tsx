'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';

type Cobro = { id: string; amount: number; status: string; tx_hash?: string; paid_at?: string };

export default function CobrarPage() {
  const [wallet, setWallet] = useState<{ id: string; public_key: string } | null>(null);
  const [amount, setAmount] = useState('5');
  const [concepto, setConcepto] = useState('');
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [paid, setPaid] = useState<Cobro | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Wallet del comercio: persiste en localStorage del dispositivo
  useEffect(() => {
    const saved = localStorage.getItem('gh_wallet');
    if (saved) setWallet(JSON.parse(saved));
  }, []);

  const createWallet = async () => {
    setLoading(true);
    const res = await fetch('/goyahack/api/wallet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'Mi comercio' }),
    });
    const w = await res.json();
    if (w.id) {
      localStorage.setItem('gh_wallet', JSON.stringify(w));
      setWallet(w);
    }
    setLoading(false);
  };

  const createCobro = async () => {
    if (!wallet) return;
    setLoading(true);
    setPaid(null);
    const res = await fetch('/goyahack/api/cobros', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_id: wallet.id, amount: Number(amount), concepto }),
    });
    const data = await res.json();
    if (data.cobro) setCobro(data.cobro);
    setLoading(false);
  };

  // Polling: esperar el pago
  useEffect(() => {
    if (!cobro || paid) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/goyahack/api/cobros?id=${cobro.id}`);
      const data = await res.json();
      if (data.cobro?.status === 'paid') {
        setPaid(data.cobro);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [cobro, paid]);

  const payUrl = cobro ? `${typeof window !== 'undefined' ? window.location.origin : ''}/goyahack/pay/${cobro.id}` : '';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold">PumaPay · Cobrar</h1>
          <p className="text-zinc-400 text-sm mt-1">El cliente escanea y paga. Tú ves el dinero al instante.</p>
        </header>

        {!wallet && (
          <button onClick={createWallet} disabled={loading}
            className="w-full py-4 rounded-2xl bg-puma-500 font-bold text-lg disabled:opacity-50">
            {loading ? 'Creando…' : 'Crear mi cuenta de cobros'}
          </button>
        )}

        {wallet && !cobro && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-4 text-xs text-zinc-400 break-all">
              Tu cuenta: <span className="font-mono">{wallet.public_key.slice(0, 12)}…</span>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Monto (USD)</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0.01" step="0.01"
                className="mt-1 w-full bg-zinc-900 rounded-xl px-4 py-3 text-2xl font-bold text-center" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Concepto (opcional)</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="ej. Tacos mesa 4"
                className="mt-1 w-full bg-zinc-900 rounded-xl px-4 py-3" />
            </div>
            <button onClick={createCobro} disabled={loading}
              className="w-full py-4 rounded-2xl bg-puma-500 font-bold text-lg disabled:opacity-50">
              {loading ? 'Generando…' : 'Generar QR de cobro'}
            </button>
          </div>
        )}

        {cobro && !paid && (
          <div className="text-center space-y-4">
            <div className="bg-white rounded-3xl p-6 inline-block">
              <QRCode value={payUrl} size={220} />
            </div>
            <div className="text-3xl font-extrabold">${cobro.amount} USD</div>
            <div className="text-zinc-400 text-sm font-mono">{cobro.id}</div>
            <div className="animate-pulse text-puma-300 text-sm">Esperando el pago…</div>
            <button onClick={() => { setCobro(null); }} className="text-zinc-500 text-sm underline">
              Cancelar
            </button>
          </div>
        )}

        {paid && (
          <div className="text-center space-y-4 bg-green-950 border border-green-700 rounded-3xl p-8">
            <div className="text-5xl">✅</div>
            <div className="text-2xl font-extrabold text-green-300">¡Pagado! ${paid.amount} USD</div>
            <a href={`https://stellar.expert/explorer/testnet/tx/${paid.tx_hash}`} target="_blank"
              className="block text-xs text-green-400 underline break-all">
              Ver transacción en Stellar ↗
            </a>
            <button onClick={() => { setCobro(null); setPaid(null); }}
              className="mt-2 px-6 py-3 rounded-xl bg-green-700 font-bold">Nuevo cobro</button>
          </div>
        )}
      </div>
    </main>
  );
}
