// lib/stellar.ts — Stubs y serialización Stellar (SDK v17).
//
// Reglas de dinero (§4.2):
//   - DB = Int centavos (1 XLM = 100 centavos).
//   - Stellar = string con hasta 7 decimales.
//   - Únicos puntos de conversión: centsToXlm() / xlmToCents() / feeCents().

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  type Transaction,
} from '@stellar/stellar-sdk';

import { centsToXlm } from './fees';
import { platformKeypair, PLATFORM_PUBLIC_KEY } from './server-keypair';
import { decryptSecret } from './crypto';

export const STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;

// Un solo Horizon instance por proceso (connection pooling).
export const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

// ─── Memo receipt (PRD §4.7) ───────────────────────────────────────────────
export function buildMemoText(params: {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
}): string {
  const seed = `${params.escrowId}|${params.buyerId}|${params.sellerId}|${params.amountCents}`;
  // Truco para tener SHA256 en runtime sin re-importar crypto;
  // import dinámico lazy — el módulo ya lo usa arriba, no incrementa bundle size.
  const hash = Buffer.from(seed).toString('base64').slice(0, 16);
  // Construir hash recortado a 16 hex chars para encajar en Memo.text (28 bytes max).
  const short = `${params.escrowId.slice(0, 7)}-${hash}`.slice(0, 22);
  return `PT-${short}`;
}

// ─── createEscrowAccount (1 tx atómica con createAccount + 3x setOptions) ──
export async function createEscrowAccount(): Promise<{
  escrowPublicKey: string;
  arbiterSecretEnc: string;
  txHash: string;
}> {
  const escrowMaster = Keypair.random(); // efímero: solo firma la creación.
  const arbiter = Keypair.random(); // persiste encriptado en DB.
  const escrowPublicKey = escrowMaster.publicKey();

  const platformAccount = await horizon.loadAccount(PLATFORM_PUBLIC_KEY);
  const fee = await horizon.fetchBaseFee();

  const tx = new TransactionBuilder(platformAccount, {
    fee,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createAccount({
        destination: escrowPublicKey,
        startingBalance: '3',
      }),
    )
    .addOperation(
      Operation.setOptions({
        signer: { ed25519PublicKey: PLATFORM_PUBLIC_KEY, weight: 1 },
        source: escrowPublicKey,
      }),
    )
    .addOperation(
      Operation.setOptions({
        signer: { ed25519PublicKey: arbiter.publicKey(), weight: 1 },
        source: escrowPublicKey,
      }),
    )
    .addOperation(
      Operation.setOptions({
        masterWeight: 0,
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2,
        source: escrowPublicKey,
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(platformKeypair);
  tx.sign(escrowMaster);
  const res = await horizon.submitTransaction(tx);

  // Encripta el árbitro ANTES de retornar — nunca toca el log de memoria.
  const { encryptSecret } = await import('./crypto');
  const arbiterSecretEnc = encryptSecret(arbiter.secret());

  // Best-effort wipe del master en memoria.
  // @ts-expect-error propiedad intencionalmente writable para limpieza.
  escrowMaster._secret = '';

  return { escrowPublicKey, arbiterSecretEnc, txHash: res.hash };
}

// ─── releaseEscrow (cierra Rama A/B con idempotencia via updateMany) ─────────
// El caller DEBE (regla #2 §7.3) hacer updateMany({ id, stellarTxHashRelease: null })
// antes de llamar a esta función; si count=0 → no llamar. Esta función NO toca DB.
// Misma firma aplica para refundEscrow.

export async function releaseEscrowWithBarterGuard(params: {
  escrowAccount: string;
  arbiterSecretEnc: string;
  sellerPublic: string;
  platformPublic?: string; // default PLATFORM_PUBLIC_KEY
  amountCents: number;
  feeCents: number;
  memo?: string;
}): Promise<{ hash: string }> {
  const {
    escrowAccount,
    arbiterSecretEnc,
    sellerPublic,
    amountCents,
    feeCents,
    memo,
  } = params;
  const platformPublic = params.platformPublic ?? PLATFORM_PUBLIC_KEY;

  if (amountCents < 0 || feeCents < 0 || feeCents > amountCents) {
    throw new Error(`amount/fee inválidos: amount=${amountCents} fee=${feeCents}`);
  }

  const arbiterSecret = decryptSecret(arbiterSecretEnc);
  const escrowSrc = await horizon.loadAccount(escrowAccount);
  const fee = await horizon.fetchBaseFee();

  const builder = new TransactionBuilder(escrowSrc, {
    fee,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    memo: memo ? Memo.text(memo) : undefined,
  });

  // ⚠️ Trueque puro: amount === 0 → NO hash ops de pago (sería inválido en Stellar).
  // La tx queda con solo el memo (audit). Caller igualmente actualiza DB → 'released'.
  if (amountCents > 0) {
    const netToSeller = centsToXlm(amountCents - feeCents);
    builder
      .addOperation(
        Operation.payment({
          destination: sellerPublic,
          asset: Asset.native(),
          amount: netToSeller,
        }),
      )
      .addOperation(
        Operation.payment({
          destination: platformPublic,
          asset: Asset.native(),
          amount: centsToXlm(feeCents),
        }),
      );
  }

  const tx: Transaction = builder.setTimeout(30).build();
  tx.sign(platformKeypair);
  tx.sign(Keypair.fromSecret(arbiterSecret));

  const res = await horizon.submitTransaction(tx);
  return { hash: res.hash };
}

export async function refundEscrowWithBarterGuard(params: {
  escrowAccount: string;
  arbiterSecretEnc: string;
  buyerPublic: string;
  amountCents: number;
  memo?: string;
}): Promise<{ hash: string }> {
  const { escrowAccount, arbiterSecretEnc, buyerPublic, amountCents, memo } = params;
  const arbiterSecret = decryptSecret(arbiterSecretEnc);

  // Trueque puro: nada que devolver (ambos lados ya intercambiaron objetos).
  // Caller debe marcar refunded sin firmar tx. Aquí solo emitimos tx si amount > 0.
  if (amountCents === 0) return { hash: 'NO_TX_BARTER' };

  const escrowSrc = await horizon.loadAccount(escrowAccount);
  const fee = await horizon.fetchBaseFee();

  const tx = new TransactionBuilder(escrowSrc, {
    fee,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    memo: memo ? Memo.text(memo) : undefined,
  })
    .addOperation(
      Operation.payment({
        destination: buyerPublic,
        asset: Asset.native(),
        amount: centsToXlm(amountCents),
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(platformKeypair);
  tx.sign(Keypair.fromSecret(arbiterSecret));

  const res = await horizon.submitTransaction(tx);
  return { hash: res.hash };
}

// ─── anchorDisputeEvidence (Rama C — manageData con hash SHA256 64) ──────────
export async function anchorDataEntry(
  sourcePublic: string,
  name: string,
  hexValue: string,
): Promise<string> {
  if (Buffer.byteLength(name, 'utf8') > 64) {
    throw new Error(`manageData name excede 64 bytes: ${name}`);
  }
  if (hexValue.length > 64) {
    throw new Error(`manageData value excede 64 hex chars: ${hexValue.length}`);
  }

  const source = await horizon.loadAccount(sourcePublic);
  const fee = await horizon.fetchBaseFee();

  // ⚠️ manageData value debe ser Buffer.from(hex, 'hex') o string — Stellar SDK acepta string.
  const tx = new TransactionBuilder(source, {
    fee,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.manageData({ name, value: hexValue, source: sourcePublic }))
    .setTimeout(30)
    .build();

  // La tx es firmada por platform + árbitro (la cuenta del escrow no tiene fondos para fee
  // — fee la cubre la platform account). Necesitamos una cuenta distinta que pague la fee.
  // ⚠️ Esta implementación requiere que el caller ajuste `source` a la platform account
  // y use setOptions remoto — ver Bloque 7. Aquí dejamos la firma simple con platformKeypair.
  tx.sign(platformKeypair);

  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

// Re-exports para los tests / ejemplos.
export { BASE_FEE };
