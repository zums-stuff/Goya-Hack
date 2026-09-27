import {
  Horizon, Keypair, TransactionBuilder, Networks,
  Operation, Asset, Memo, BASE_FEE
} from '@stellar/stellar-sdk';

/**
 * PumaPay — capa Stellar TESTNET.
 * Todo es real on-chain: cuentas, trustlines y pagos se verifican en
 * stellar.expert/testnet. USDC de demo es emitido por nuestro issuer.
 */

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const server = new Horizon.Server(HORIZON_URL);

// Issuer del USDC de demo — se crea una vez y persiste vía env.
// Si no está en env, se genera efímero (los trustlines viejos quedarán huérfanos).
let issuerKeypair: Keypair | null = null;
export function getIssuer(): Keypair {
  if (!issuerKeypair) {
    const envSecret = process.env.DEMO_USDC_ISSUER_SECRET;
    issuerKeypair = envSecret ? Keypair.fromSecret(envSecret) : null as any;
  }
  return issuerKeypair!;
}

export function hasIssuer(): boolean {
  return !!process.env.DEMO_USDC_ISSUER_SECRET;
}

export function usdcAsset(): Asset {
  return new Asset('USDC', getIssuer().publicKey());
}

export async function fundFriendbot(publicKey: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) throw new Error(`friendbot ${res.status}`);
  return res.json();
}

/** Crea wallet demo: keypair + friendbot + trustline USDC + mint de USDC de prueba. */
export async function createDemoWallet(mintAmount = '1000') {
  const kp = Keypair.random();
  await fundFriendbot(kp.publicKey());

  const account = await server.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset() }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await server.submitTransaction(tx);

  if (hasIssuer()) {
    await mintUsdc(kp.publicKey(), mintAmount);
  }
  return kp;
}

/** Emite USDC de demo desde el issuer hacia una cuenta con trustline. */
export async function mintUsdc(destination: string, amount: string) {
  const issuer = getIssuer();
  const issuerAccount = await server.loadAccount(issuer.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({
      destination,
      asset: usdcAsset(),
      amount,
    }))
    .setTimeout(60)
    .build();
  tx.sign(issuer);
  return server.submitTransaction(tx);
}

/** Pago USDC real entre dos cuentas, con memo = ref del cobro. */
export async function payUsdc(fromSecret: string, toPublic: string, amount: string, memoText: string) {
  const kp = Keypair.fromSecret(fromSecret);
  const account = await server.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({
      destination: toPublic,
      asset: usdcAsset(),
      amount,
    }))
    .addMemo(Memo.text(memoText.slice(0, 28)))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  return server.submitTransaction(tx);
}

export async function getBalances(publicKey: string) {
  const account = await server.loadAccount(publicKey);
  return account.balances.map((b: any) => ({
    asset: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    balance: b.balance,
  }));
}

export function explorerTxUrl(hash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export { server };
