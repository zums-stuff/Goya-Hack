// scripts/test-stellar-real.ts — Verifica el ciclo Stellar completo contra
// Horizon testnet + friendbot. Crea un keypair aleatorio, lo fundea, verifica
// el saldo, y ejecuta una payment Alice → Bob usando exactamente el patrón
// que el código producción sigue (`Operation.payment` + `TransactionBuilder`).
//
// AMBIENTE: corre sin credentials. Friendbot no requiere auth; Horizon
// testnet es público. Si no conecta (firewall), el script aborta con un
// mensaje claro, NO falla VITEST.

import 'dotenv/config';
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const HORIZON = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new Horizon.Server(HORIZON);

async function fundAccount(publicKey: string): Promise<void> {
  const url = `${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`friendbot failed for ${publicKey}: ${res.status} ${text}`);
  }
}

async function getNativeBalance(publicKey: string): Promise<number> {
  const account = await server.loadAccount(publicKey);
  const xlm = account.balances.find((b) => b.asset_type === 'native');
  if (!xlm) return 0;
  return Number(xlm.balance);
}

async function payment(params: {
  source: Keypair;
  destination: string;
  amountXlm: string;
}): Promise<string> {
  const source = await server.loadAccount(params.source.publicKey());
  const baseFee = await server.fetchBaseFee();
  const tx = new TransactionBuilder(source, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset: Asset.native(),
        amount: params.amountXlm,
      }),
    )
    .setTimeout(30)
    .build();
  tx.sign(params.source);
  const res = await server.submitTransaction(tx);
  return res.hash;
}

async function step(label: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${label}... `);
  try {
    await fn();
    process.stdout.write('✅\n');
  } catch (e) {
    process.stdout.write('❌\n');
    throw e;
  }
}

async function main(): Promise<void> {
  console.log('🪐 Test contra Horizon testnet + friendbot (sin credenciales)\n');
  console.log(`  HORIZON: ${HORIZON}\n`);

  const alice = Keypair.random();
  const bob = Keypair.random();
  console.log(`  Alice: ${alice.publicKey()}`);
  console.log(`  Bob:   ${bob.publicKey()}\n`);

  // 1. Fondear ambas cuentas via friendbot.
  await step('friendbot fund Alice', () => fundAccount(alice.publicKey()));
  await step('friendbot fund Bob', () => fundAccount(bob.publicKey()));

  // 2. Verificar saldos iniciales (friendbot da ~10 000 XLM).
  let aliceBefore = 0;
  let bobBefore = 0;
  await step('Horizon.loadAccount(Alice)', async () => {
    aliceBefore = await getNativeBalance(alice.publicKey());
    console.log(`     (Alice saldo: ${aliceBefore} XLM)`);
  });
  await step('Horizon.loadAccount(Bob)', async () => {
    bobBefore = await getNativeBalance(bob.publicKey());
    console.log(`     (Bob saldo:   ${bobBefore} XLM)`);
  });

  if (aliceBefore < 5 || bobBefore < 5) {
    throw new Error(`Saldos insuficientes — friendbot no fondeó correctamente`);
  }

  // 3. Alice envía 1 XLM a Bob.
  let txHash = '';
  await step('Alice → Bob 1 XLM', async () => {
    const h = await payment({ source: alice, destination: bob.publicKey(), amountXlm: '1' });
    txHash = h;
    console.log(`     tx hash: ${h}`);
  });

  // 4. Verificar que Bob recibió 1 XLM de más y Alice 1 menos (aprox
  //    descontando fees).
  await step('Verificar saldo Bob post-payment', async () => {
    const bobAfter = await getNativeBalance(bob.publicKey());
    const diff = bobAfter - bobBefore;
    console.log(`     Bob: ${bobBefore} → ${bobAfter} (diff: ${diff} XLM)`);
    if (diff < 0.99 || diff > 1.01) {
      throw new Error(`Esperaba ~+1 XLM, observé ${diff}`);
    }
  });
  await step('Verificar saldo Alice post-payment', async () => {
    const aliceAfter = await getNativeBalance(alice.publicKey());
    const diff = aliceAfter - aliceBefore;
    console.log(`     Alice: ${aliceBefore} → ${aliceAfter} (diff: ${diff} XLM)`);
    // diff ~ -1 menos la fee (~0.0003 XLM).
    if (diff > -0.99) {
      throw new Error(`Esperaba ~-1 XLM, observé ${diff}`);
    }
  });

  // 5. La verificación del tx vía balance diffs es suficiente — el ledger
//    ya quedó confirmado por el balance change. (El endpoint /transactions
//    existe pero la llamada exacta varía entre SDK versions y omite complejidad
//    innecesaria para este smoke test.)

  console.log('\n✅ Stellar cycle OK — Horizon + friendbot + payment + verify.');
  console.log('   El mismo patrón (loadAccount → build → sign → submit → load)');
  console.log('   es el que lib/stellar.ts.releaseEscrow ejecutará en producción.');
}

main()
  .catch((e) => {
    console.error('\n❌ Test failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
