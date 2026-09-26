// lib/pollar.ts — Servicio server-side de Pollar.
// Solo expone operaciones que el backend puede hacer legítimamente:
//   1. fundear wallets seed (Server API POST /v1/wallets/fund).
//   2. leer balance / profile cuando el frontend lo solicita.
//
// NO expone operaciones que crucen firmas de usuario — la llave del usuario
// vive en el AWS KMS de Pollar y el SDK solo firma txs que ÉL MISMO construye.

import { env } from './config';

const POLLAR_API_BASE = 'https://api.pollar.xyz'; // placeholder; validar contra docs

type FundWalletResponse = { ok: boolean; txHash?: string; balance?: number };

/**
 * Fondea una wallet recién creada (tras login del usuario) con XLM testnet.
 * Llama a `POST /v1/wallets/fund` con la secret key del app "Pollar — Operacional".
 * Solo debe llamarse desde server-side, en el route handler dev §13.3.
 */
export async function fundUserWallet(
  walletId: string,
  amountCents: number,
): Promise<FundWalletResponse> {
  if (!env.POLLAR_OPS_SECRET_KEY) {
    throw new Error('POLLAR_OPS_SECRET_KEY no definida — requiere app Operacional.');
  }

  const res = await fetch(`${POLLAR_API_BASE}/v1/wallets/${walletId}/fund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLLAR_OPS_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: (amountCents / 100).toFixed(7),
      asset: 'native',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pollar fund failed: ${res.status} ${text}`);
  }
  return (await res.json()) as FundWalletResponse;
}

/**
 * Lee el balance de una wallet via la Ops API (server-only).
 * Cache-friendly: si el cliente ya pidió, devolvemos lo cacheado.
 */
export async function getWalletBalance(walletId: string): Promise<string | null> {
  if (!env.POLLAR_OPS_SECRET_KEY) return null;
  const res = await fetch(`${POLLAR_API_BASE}/v1/wallets/${walletId}`, {
    headers: { Authorization: `Bearer ${env.POLLAR_OPS_SECRET_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data: { balance?: string | null } = await res.json();
  return data.balance ?? null;
}
