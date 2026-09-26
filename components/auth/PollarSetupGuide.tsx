// components/auth/PollarSetupGuide.tsx — Guía de configuración de Pollar.
//
// Se muestra SOLO cuando alguna key de Pollar no está 'ok' (modo dev/demo).
// Dice exactamente qué pegar, de dónde sale cada valor y da el estado en vivo
// de las 3 keys (✓ listo / ⚠ marcador / ✗ falta). Botón "Copiar" incluido.

'use client';

import { useState } from 'react';
import type { PollarKeyStatus, PollarSetupStatus } from '@/lib/pollar-status';

const ENV_TEMPLATE = [
  '# .env.local — reemplaza los <TU_KEY_AQUÍ> por tus keys reales (sin <>)',
  'NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=pub_testnet_users_<TU_KEY_AQUÍ>',
  'POLLAR_USERS_SECRET_KEY=sec_testnet_users_<TU_KEY_AQUÍ>',
  'POLLAR_OPS_SECRET_KEY=sec_testnet_ops_<TU_KEY_AQUÍ>',
].join('\n');

type RowKey = 'usersPub' | 'usersSec' | 'opsSec';

const ROWS: Array<{ key: RowKey; varName: string; source: string }> = [
  {
    key: 'usersPub',
    varName: 'NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY',
    source: 'App "PumaTrade Usuarios" → Build → API Keys → Publishable key',
  },
  {
    key: 'usersSec',
    varName: 'POLLAR_USERS_SECRET_KEY',
    source: 'App "PumaTrade Usuarios" → Build → API Keys → Secret key (solo server)',
  },
  {
    key: 'opsSec',
    varName: 'POLLAR_OPS_SECRET_KEY',
    source: 'App "PumaTrade Operacional" → Build → API Keys → Secret key (solo server)',
  },
];

function StatusPill({ status }: { status: PollarKeyStatus }) {
  const map = {
    ok: { dot: 'bg-emerald-400', text: '✓ Lista', cls: 'text-emerald-300' },
    placeholder: {
      dot: 'bg-amber-400',
      text: '⚠ Es un marcador (pk_/sk_) — reemplázalo',
      cls: 'text-amber-300',
    },
    missing: { dot: 'bg-rose-400', text: '✗ Falta en .env.local', cls: 'text-rose-300' },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.cls}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.text}
    </span>
  );
}

export function PollarSetupGuide({ status }: { status: PollarSetupStatus }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de clipboard: el usuario copia a mano.
    }
  }

  if (!open) {
    return (
      <div className="w-full max-w-2xl text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-sky-300 underline-offset-4 hover:underline"
        >
          Mostrar guía de configuración de Pollar
        </button>
      </div>
    );
  }

  return (
    <section
      id="pollar-guide"
      className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1428]/90 p-6 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Configura Pollar para activar el login
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            El login usa wallets de <span className="text-slate-200">Pollar</span>. Las keys
            reales se generan en{' '}
            <a
              href="https://dashboard.pollar.xyz"
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
            >
              dashboard.pollar.xyz
            </a>{' '}
            (crea 2 apps) — no se pueden crear desde el código. Abajo está el estado de cada
            key en tu <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">.env.local</code>.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Ocultar guía"
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          Ocultar
        </button>
      </div>

      {/* Paso 1 — crear las apps */}
      <ol className="mt-5 space-y-4 text-sm">
        <li className="space-y-1">
          <p className="font-medium text-white">
            1. Crea las 2 apps en dashboard.pollar.xyz
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-400">
            <li>
              <span className="text-slate-200">«PumaTrade Usuarios»</span> — Auth providers:
              Google + email OTP · Funding: Immediate · Stellar testnet
            </li>
            <li>
              <span className="text-slate-200">«PumaTrade Operacional»</span> — sin UI,
              solo server-side · Stellar testnet
            </li>
          </ul>
        </li>

        {/* Paso 2 — pegar keys */}
        <li className="space-y-2">
          <p className="font-medium text-white">
            2. Pega las 3 keys en <code className="font-mono text-xs">.env.local</code>
          </p>

          {/* Estado en vivo por key */}
          <ul className="space-y-2">
            {ROWS.map((r) => (
              <li
                key={r.key}
                className="rounded-xl border border-white/10 bg-black/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="font-mono text-xs text-sky-200">{r.varName}</code>
                  <StatusPill status={status[r.key]} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{r.source}</p>
              </li>
            ))}
          </ul>

          {/* Bloque copiable */}
          <div className="relative mt-3">
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs leading-relaxed text-emerald-200">
              {ENV_TEMPLATE}
            </pre>
            <button
              onClick={copyTemplate}
              className="absolute right-2 top-2 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              {copied ? '✓ Copiado' : 'Copiar plantilla'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Reemplaza <span className="font-mono text-slate-400">&lt;TU_KEY_AQUÍ&gt;</span>{' '}
            por el valor exacto que copiaste del dashboard y guarda.
          </p>
        </li>

        {/* Paso 3 — reiniciar */}
        <li className="space-y-1">
          <p className="font-medium text-white">3. Reinicia el servidor</p>
          <p className="text-slate-400">
            Detén <code className="font-mono text-xs">npm run dev</code> y vuelve a levitarlo:
            el modal de Pollar aparecerá en el botón <span className="text-slate-200">«Iniciar
            sesión»</span> y esta guía desaparecerá sola.
          </p>
          <p className="text-xs text-slate-500">
            Nota: si re-corres <code className="font-mono text-xs">npm run setup:env</code>,
            ya <strong className="text-slate-300">no borra</strong> estas keys (si empiezan con{' '}
            <code className="font-mono text-xs">pub_</code>/<code className="font-mono text-xs">sec_</code>).
          </p>
        </li>
      </ol>
    </section>
  );
}