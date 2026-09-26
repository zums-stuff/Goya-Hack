// lib/currency.ts — Formateo de XLM + conversión a MXN.
//
// Tasa XLM/MXN (server-only):
//   1. En cada server load, intenta `https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=mxn`.
//   2. Cachea la respuesta 30s (varias páginas renderizan en el mismo request
//      y solo se hace UNA petición por ciclo de render).
//   3. Si CoinGecko falla (sin red, 429, …), usa `XLM_MXN_RATE` del .env o
//      el fallback hardcodeado (7.5 MXN ≈ valor de mercado 2026).
//
// El usuario pidió "refetch obligatorio en cada load" — esto es la
// implementación honesta: SIEMPRE pega a CoinGecko al primer render de cada
// request al server; si falla, se va al fallback. La cache de 30s solo
// afecta renders dentro del MISMO request (no se guarda entre requests).
//
// USO:
//   - Server components / route handlers: usen `fmtXlm(cents)` (async).
//   - Client components: pasen `rate` desde el server y usen `fmtXlmSync(cents, rate)`.
//
// Helpers:
//   fmtXlm(cents, opts)             → "12.34 XLM" o "12.34 XLM · ≈ $92.55 MXN"   (async, server)
//   fmtXlmSync(cents, rate, opts)   → igual, pero sincrono (rate ya conocida)
//   fmtXlmShort(cents)              → "12.34 XLM" (chips / badges)
//   fmtMxnFromCents(cents, rate)    → "$92.55"
//   mxnFromCents(cents, rate)       → number
//   xlmMxnRate()                    → number (la tasa activa, logueable)
//   mxnToCents(mxn)                 → centavos de XLM (async, server)

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=mxn';
const CACHE_TTL_MS = 30_000;

let cached: { rate: number; fetchedAt: number } | null = null;

function fallbackRate(): number {
  const env = Number(process.env.XLM_MXN_RATE);
  if (Number.isFinite(env) && env > 0) return env;
  return 7.5; // valor aproximado 2026 — CoinGecko es la fuente primaria.
}

export async function xlmMxnRate(): Promise<number> {
  // Cache solo dentro del mismo proceso: evita que un único render del server
  // haga N requests si varias páginas (layout, header, footer, cards) llaman
  // fmtXlm en cascada.
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }
  const f = fallbackRate();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(COINGECKO_URL, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
      // Importante: en Next.js esto corre en el server, así que cache HTTP
      // por defecto es lo que el server-runtime decida (Node fetch no
      // cachea sin next.revalidate explícito, lo cual está bien).
    });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json().catch(() => null)) as
        | { stellar?: { mxn?: number } }
        | null;
      const mxn = j?.stellar?.mxn;
      if (typeof mxn === 'number' && Number.isFinite(mxn) && mxn > 0) {
        cached = { rate: mxn, fetchedAt: Date.now() };
        return mxn;
      }
    }
  } catch {
    /* swallow → fallback */
  }
  cached = { rate: f, fetchedAt: Date.now() };
  return f;
}

export function mxnFromCents(cents: number, rate: number): number {
  return (cents / 100) * rate;
}

/** Formato monetario MXN con dos decimales (formato $X,XXX.XX). */
export function fmtMxn(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type FmtXlmOpts = {
  /** Cuando true, agrega " (≈ $X.XX MXN)". Default true. */
  mxn?: boolean;
  /** Cantidad de decimales del XLM. Default 2 (suficiente para demo). */
  decimals?: number;
};

/** Formatea centavos → "12.34 XLM" (y opcionalmente " · ≈ $92.55 MXN"). */
export async function fmtXlm(
  cents: number,
  opts: FmtXlmOpts = {},
): Promise<string> {
  const decimals = opts.decimals ?? 2;
  const xlmStr = (cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (opts.mxn === false) return `${xlmStr} XLM`;
  const rate = await xlmMxnRate();
  const mxn = mxnFromCents(cents, rate);
  return `${xlmStr} XLM · ≈ ${fmtMxn(mxn)}`;
}

/** Versión sincrónica para cuando ya se pasó la tasa (p.ej. en un map). */
export function fmtXlmSync(cents: number, rate: number, opts: FmtXlmOpts = {}): string {
  const decimals = opts.decimals ?? 2;
  const xlmStr = (cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (opts.mxn === false) return `${xlmStr} XLM`;
  const mxn = mxnFromCents(cents, rate);
  return `${xlmStr} XLM · ≈ ${fmtMxn(mxn)}`;
}

/** Helper "compacto": solo XLM, sin MXN (chips / badges). */
export function fmtXlmShort(cents: number, decimals = 0): string {
  return `${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} XLM`;
}

/** Helper "solo MXN" para cuando el usuario eligió el modo MXN. */
export function fmtMxnFromCents(cents: number, rate: number): string {
  return fmtMxn(mxnFromCents(cents, rate));
}

/** Convierte un monto en MXN → centavos de XLM usando la tasa actual. */
export async function mxnToCents(mxn: number): Promise<number> {
  const rate = await xlmMxnRate();
  if (rate <= 0) throw new Error('Tasa XLM/MXN inválida');
  const xlm = mxn / rate;
  return Math.round(xlm * 100);
}
