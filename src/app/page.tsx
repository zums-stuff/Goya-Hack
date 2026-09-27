export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl text-center space-y-8">
        <div>
          <div className="text-puma-gold font-bold tracking-widest text-sm">GOYA HACK 2026 · UNAM</div>
          <h1 className="text-5xl font-extrabold mt-3">PumaPay</h1>
          <p className="text-xl text-zinc-400 mt-4">
            Cobros con QR entre dos personas. Sin apps, sin bancos, sin comisiones.
            La blockchain es la plomería — tú solo ves dólares.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-left">
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="text-2xl">📱</div>
            <div className="font-bold mt-2">1. Genera tu QR</div>
            <div className="text-sm text-zinc-400">Escribe el monto, muestra el código</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="text-2xl">📷</div>
            <div className="font-bold mt-2">2. Te escanean</div>
            <div className="text-sm text-zinc-400">El cliente abre la cámara y confirma</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="text-2xl">⚡</div>
            <div className="font-bold mt-2">3. Liquidación real</div>
            <div className="text-sm text-zinc-400">~5 segundos on-chain, verificable</div>
          </div>
        </div>

        <a href="/goyahack/cobrar"
          className="inline-block px-10 py-4 rounded-2xl bg-puma-500 font-bold text-lg hover:bg-puma-700 transition">
          Probar demo en vivo →
        </a>
        <p className="text-zinc-600 text-xs">Stellar Testnet · Tracks: AI + Blockchain + Impacto</p>
      </div>
    </main>
  );
}
