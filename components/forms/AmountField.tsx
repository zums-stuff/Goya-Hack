// components/forms/AmountField.tsx — Input con toggle XLM ⇄ MXN.
//
// Comportamiento:
//   - Internamente todo se guarda en **centavos de XLM** (entero).
//   - El usuario elige si escribir en XLM o en MXN. Al tipear, el campo
//     refleja el otro valor: si escribe MXN, mostramos "≈ X.XX XLM" abajo.
//   - Al enviar, el padre recibe `cents` (entero).
//   - Si la red no responde, el toggle sigue funcionando con el fallback
//     (mostramos "tasa aproximada").
//
// Props:
//   value: number (centavos de XLM) — controlado.
//   onChange(cents): void.
//   min?: number — mínimo en centavos (default 1).
//   max?: number — máximo en centavos (default 50_000_000 = 500k XLM).
//   step?: number — decimals del input.
//   label?: string.
//   hint?: string.
//   id?: string.
//   required?: boolean.
//   disabled?: boolean.

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

type Props = {
  value: number; // centavos
  onChange: (cents: number) => void;
  min?: number;
  max?: number;
  label?: string;
  hint?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
};

type Mode = 'XLM' | 'MXN';

const FALLBACK_RATE = 7.5;

function fmt2(n: number): string {
  return n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmt(n: number, decimals: number): string {
  return n.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function AmountField({
  value,
  onChange,
  min = 1,
  max = 50_000_000,
  label = 'Monto',
  hint,
  id = 'amount',
  required,
  disabled,
}: Props) {
  const [mode, setMode] = useState<Mode>('XLM');
  const [rate, setRate] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<'coingecko' | 'env' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch('/api/fx', { cache: 'no-store' });
        if (!r.ok) throw new Error('fx http');
        const j = (await r.json()) as { rate: number; source: string };
        if (cancelled) return;
        setRate(j.rate);
        setRateSource(
          j.source === 'env' ? 'env' : j.source === 'coingecko-or-fallback' ? 'coingecko' : 'fallback',
        );
      } catch {
        if (cancelled) return;
        setRate(FALLBACK_RATE);
        setRateSource('fallback');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveRate = rate ?? FALLBACK_RATE;
  const xlm = value / 100;
  const mxn = xlm * effectiveRate;

  // El input que mostráramos: si mode='XLM' el valor es xlm, sino es mxn.
  const inputValue = mode === 'XLM' ? xlm : mxn;

  // Handlers: actualizamos en centavos.
  function onInputChange(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      onChange(0);
      return;
    }
    let cents: number;
    if (mode === 'XLM') {
      cents = Math.round(n * 100);
    } else {
      // MXN → XLM (usando la misma tasa actual del toggle).
      const xlmVal = n / effectiveRate;
      cents = Math.round(xlmVal * 100);
    }
    if (cents < min) cents = min;
    if (cents > max) cents = max;
    onChange(cents);
  }

  const centsForMode = (cents: number) => (mode === 'XLM' ? cents / 100 : (cents / 100) * effectiveRate);

  return (
    <div className="form-label" style={{ gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <button
          type="button"
          aria-label={`Cambiar a ${mode === 'XLM' ? 'MXN' : 'XLM'}`}
          onClick={() => setMode((m) => (m === 'XLM' ? 'MXN' : 'XLM'))}
          className="amount-toggle"
          disabled={disabled}
        >
          <ArrowLeftRight />
          <span>{mode}</span>
        </button>
      </span>

      <div className="amount-input-row">
        <input
          id={id}
          className="form-field"
          type="number"
          min={centsForMode(min)}
          max={centsForMode(max)}
          step={0.01}
          value={Number.isFinite(inputValue) ? inputValue : ''}
          onChange={(e) => onInputChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={mode === 'XLM' ? '0.00' : '0.00'}
          aria-label={`${label} en ${mode}`}
        />
        <span className="amount-suffix">{mode}</span>
      </div>

      <span
        className="form-hint"
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      >
        {mode === 'XLM' ? (
          <>
            ≈ {fmtMxn(mxn)} MXN ·{' '}
            <small>
              1 XLM ≈ {fmt2(effectiveRate)} MXN
              {rateSource === 'fallback' && ' (tasa aproximada)'}
              {rateSource === 'env' && ' (env)'}
            </small>
          </>
        ) : (
          <>
            ≈ {fmt2(xlm)} XLM ·{' '}
            <small>
              1 XLM ≈ {fmt2(effectiveRate)} MXN
              {rateSource === 'fallback' && ' (tasa aproximada)'}
              {rateSource === 'env' && ' (env)'}
            </small>
          </>
        )}
      </span>

      {hint && (
        <span className="form-hint" style={{ marginTop: -4 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function fmtMxn(n: number): string {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
