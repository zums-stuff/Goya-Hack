// scripts/capture-wallets.ts — Verifica que las 5 wallets en SEED_WALLET_IDS
// existen en Horizon y tienen saldo XLM. NO captura wallets (las crea Pollar
// al login del usuario); solo verifica que la captura dev-helper hizo bien su
// trabajo.

import 'dotenv/config';
import { Horizon, Networks } from '@stellar/stellar-sdk';

const HORIZON = 'https://horizon-testnet.stellar.org';

if (!process.env.SEED_WALLET_IDS) {
  console.error('❌ SEED_WALLET_IDS no definida — completa §13.3 paso 2 primero.');
  process.exit(1);
}

const walletIds = (() => {
  try { return JSON.parse(process.env.SEED_WALLET_IDS!); }
  catch (e) {
    console.error('SEED_WALLET_IDS no es JSON válido:', (e as Error).message);
    process.exit(1);
  }
}) as Record<string, string>;

const server = new Horizon.Server(HORIZON);

interface VerifyResult {
  userId: string;
  address: string;
  exists: boolean;
  balanceXlm: string | null;
  ok: boolean;
}

async function verify(userId: string, address: string): Promise<VerifyResult> {
  if (!address || !address.startsWith('G_PLACEHOLDER') === false && !address.startsWith('G')) {
    return { userId, address, exists: false, balanceXlm: null, ok: false };
  }
  try {
    const account = await server.loadAccount(address);
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    return {
      userId,
      address,
      exists: true,
      balanceXlm: xlmBalance?.balance ?? null,
      ok: xlmBalance != null,
    };
  } catch (e: unknown) {
    const err = e as { response?: { status?: number }; message?: string };
    if (err.response?.status === 404) {
      return { userId, address, exists: false, balanceXlm: null, ok: false };
    }
    throw e;
  }
}

async function main() {
  console.log(`🔍 Verificando ${Object.keys(walletIds).length} wallets en Horizon testnet...\n`);

  const results: VerifyResult[] = [];
  for (const [userId, address] of Object.entries(walletIds)) {
    const r = await verify(userId, address);
    results.push(r);
    const status = r.ok ? '✅' : (r.exists ? '⚠️  sin balance' : '❌ no existe');
    console.log(`  ${status}  ${userId.padEnd(12)} → ${r.address}   ${r.balanceXlm ?? ''} XLM`);
  }

  const missing = results.filter((r) => !r.exists);
  const noBalance = results.filter((r) => r.exists && !r.ok);

  console.log('');
  if (missing.length > 0) {
    console.log(`❌ Faltan ${missing.length} wallets: ${missing.map((r) => r.userId).join(', ')}`);
    console.log('   Acción: reloguea esos seed users (mail.tm OTP) — el dev helper debería fondear + capturar el G-address.');
    process.exit(1);
  }
  if (noBalance.length > 0) {
    console.log(`⚠️  ${noBalance.length} wallets sin saldo: ${noBalance.map((r) => r.userId).join(', ')}`);
    console.log('   Acción: revisa que el dev helper está llamando POST /v1/wallets/fund tras el login.');
    process.exit(2);
  }
  console.log('✅ Las 5 wallets seed están listas con saldo XLM.');
}

main().catch((e) => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
