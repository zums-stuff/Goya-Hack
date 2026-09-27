// components/auth/PollarSetupGuide.tsx — Guía de setup de Pollar.
//
// Sistema visual: light theme, dentro del `.sell-modal` blanco. Bloques `.ai-bubble`
// para los code blocks, .profile-row para status por key. Reusa el mismo
// lenguaje que el resto de la app.

'use client';

import { useState } from 'react';
import { Check, Copy, ChevronRight, CircleAlert, ShieldCheck } from 'lucide-react';
import type { PollarKeyStatus, PollarSetupStatus } from '@/lib/pollar-status';

const ENV_TEMPLATE = [
  '# PumaTrade — reemplaza los <TU_KEY_AQUÍ> por tus keys reales del dashboard',
  'NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=pub_testnet_users_<TU_KEY_AQUÍ>',
  'POLLAR_USERS_SECRET_KEY=sec_testnet_users_<TU_KEY_AQUÍ>',
  'POLLAR_OPS_SECRET_KEY=sec_testnet_ops_<TU_KEY_AQUÍ>',
].join('\n');

const ROWS: Array<{
  key: 'usersPub' | 'usersSec' | 'opsSec';
  varName: string;
  source: string;
}> = [
  {
    key: 'usersPub',
    varName: 'NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY',
    source: 'App "PumaTrade Usuarios" → Build → API Keys → Publishable key',
  },
  {
    key: 'usersSec',
    varName: 'POLLAR_USERS_SECRET_KEY',
    source: 'App "PumaTrade Usuarios" → Build → API Keys → Secret key',
  },
  {
    key: 'opsSec',
    varName: 'POLLAR_OPS_SECRET_KEY',
    source: 'App "PumaTrade Operacional" → Build → API Keys → Secret key',
  },
];

function statusBadge(s: PollarKeyStatus) {
  if (s === 'ok')
    return (
      <span className="verified">
        <Check />
        Lista
      </span>
    );
  if (s === 'placeholder')
    return (
      <span className="warning-text">
        <CircleAlert />
        Marcador
      </span>
    );
  return (
    <span className="warning-text" style={{ color: 'var(--primary)' }}>
      <CircleAlert />
      Falta
    </span>
  );
}

export function PollarSetupGuide({ status }: { status: PollarSetupStatus }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // No permiso — el usuario copia a mano.
    }
  }

  return (
    <ol className="space-y-7 mt-2">
      {/* Paso 1 — crear las apps */}
      <li>
        <p className="eyebrow">PASO 1</p>
        <p
          className="text-base font-bold tracking-tight mb-2.5"
          style={{ letterSpacing: '-0.3px' }}
        >
          Crea las 2 apps en dashboard.pollar.xyz
        </p>
        <ul className="list-disc pl-5 text-xs text-[var(--muted)] space-y-1">
          <li>
            <strong className="text-[var(--ink)]">«PumaTrade Usuarios»</strong> —
            Auth: Google + email OTP · Funding: Immediate · Stellar testnet
          </li>
          <li>
            <strong className="text-[var(--ink)]">
              «PumaTrade Operacional»
            </strong>{' '}
            — sin UI, solo server-side · Stellar testnet
          </li>
        </ul>
      </li>

      {/* Paso 2 — pegar las keys */}
      <li>
        <p className="eyebrow">PASO 2</p>
        <p
          className="text-base font-bold tracking-tight mb-2.5"
          style={{ letterSpacing: '-0.3px' }}
        >
          Pega las 3 keys en <code className="font-mono">.env.local</code>
        </p>

        <ul className="space-y-2">
          {ROWS.map((r) => (
            <li key={r.key}>
              <div
                style={{
                  border: '1px solid var(--line)',
                  background: '#fff',
                  borderRadius: 9,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <code
                    style={{ fontSize: 10, color: 'var(--ink)', letterSpacing: 0 }}
                  >
                    {r.varName}
                  </code>
                  {statusBadge(status[r.key])}
                </div>
                <p style={{ fontSize: 9, color: '#94a0b0', marginTop: 4 }}>
                  {r.source}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Bloque copiable */}
        <div className="relative mt-3.5">
          <pre
            style={{
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: 7,
              padding: '11px 12px',
              fontSize: 10,
              lineHeight: 1.55,
              color: '#516174',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
          >
            {ENV_TEMPLATE}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute right-2 top-2 flex items-center gap-1.5 bg-white border border-[var(--line)] rounded-md px-2 py-1 text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--yellow)] transition"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted)]">
          Reemplaza <code className="font-mono">&lt;TU_KEY_AQUÍ&gt;</code> por
          el valor exacto que copiaste del dashboard.
        </p>
      </li>

      {/* Paso 3 — reiniciar */}
      <li>
        <p className="eyebrow">PASO 3</p>
        <p
          className="text-base font-bold tracking-tight mb-2.5"
          style={{ letterSpacing: '-0.3px' }}
        >
          Reinicia el dev server
        </p>
        <div className="detail-trust">
          <ShieldCheck />
          <span>
            <strong>Modo dev sigue funcionando</strong>
            <small>
              Re-correr <code className="font-mono">npm run setup:env</code> ya no
              pisa tus keys reales (las preserva si empiezan con{' '}
              <code className="font-mono">pub_</code>/<code className="font-mono">sec_</code>).
            </small>
          </span>
        </div>
      </li>

      <li>
        <a
          href="https://dashboard.pollar.xyz"
          target="_blank"
          rel="noreferrer"
          className="sell-button"
          style={{ background: '#fff', color: 'var(--primary)', boxShadow: 'none' }}
        >
          Ir a dashboard.pollar.xyz
          <ChevronRight />
        </a>
      </li>
    </ol>
  );
}