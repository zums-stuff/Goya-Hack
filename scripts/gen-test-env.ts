// scripts/gen-test-env.ts — Genera un .env.local con keys Stellar de testnet
// válidas (checksum correcto) + addresses válidos. Útil para `next dev`
// local sin necesidad de crear treasury en dashboard.pollar.xyz.
//
// Lo que hace:
// 1. Genera una keypair Stellar aleatoria (arbitrary-account).
// 2. Genera una segunda keypair que será "treasury/platform" (cualquier key vale
//    mientras pase el checksum de Stellar SDK).
// 3. FUNDEA ambas cuentas via friendbot testnet — quedan con 10 000 XLM c/u.
// 4. Escribe .env.local con los valores reales (necesita valid G-address de 56 chars
//    con checksum + S-secret con su checksum).
//
// Uso:  npx tsx scripts/gen-test-env.ts
// ⚠️ Sobrescribe .env.local. No correr en prod.

import 'dotenv/config';
import {
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const HORIZON = 'https://horizon-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function friendbotFund(addr: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(addr)}`);
  if (!res.ok) throw new Error(`friendbot failed for ${addr}: ${res.status}`);
}

/**
 * Genera una `STR` de 32 hex chars representable como `APP_SECRET_KEY`.
 * No depende de Stellar — solo crypto.
 */
function generateAppSecretKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lee el `.env.local` actual si existe (para NO pisar keys reales de Pollar
 * al re-correr este script). Devuelve un mapa KEY → valor.
 */
function readExistingEnvLocal(): Record<string, string> {
  if (!existsSync('.env.local')) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]!] = (m[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/** Una key de Pollar es real si viene del dashboard (prefijo pub_/sec_) y no
 *  es placeholder (xxxx…). Las fake generadas aquí usan prefijo pk_/sk_. */
function isRealPollarKey(v: string | undefined, prefix: 'pub' | 'sec'): boolean {
  if (!v) return false;
  if (!v.startsWith(`${prefix}_`)) return false;
  if (/xxxx/i.test(v)) return false;
  return true;
}

async function main(): Promise<void> {
  // Generamos 2 keypairs válidos (checksum Stellar correcto).
  // ⚠️ No las guardamos como "platform treasury" — son keys de testnet.
  const platformMaster = Keypair.random();
  const platformOps = Keypair.random();

  console.log('🪐 Generando keys Stellar de TESTNET (no usar en prod)\n');
  console.log(`PLATFORM_PUBLIC_KEY:  ${platformMaster.publicKey()}`);
  console.log(`PLATFORM_SECRET_KEY:  ${platformMaster.secret()}`);
  console.log(`PLATFORM_OPS_SECRET:  ${platformOps.secret()}`);

  // Genera APP_SECRET_KEY (32 hex chars).
  const appSecretKey = generateAppSecretKey();

  // Friendbot fondea ambas con 10 000 XLM.
  console.log('\n💸 Fondeando vía friendbot testnet…');
  await friendbotFund(platformMaster.publicKey());
  console.log(`   ${platformMaster.publicKey()} → friendbot ✅`);
  await friendbotFund(platformOps.publicKey());
  console.log(`   ${platformOps.publicKey()} → friendbot ✅`);

  // Keys de Pollar: SOLO se escriben reales (dashboard.pollar.xyz). Si el
  // .env.local actual ya trae keys válidas (pub_*/sec_), se PRESERVAN — nunca
  // las pisamos con placeholders. Si no existen, escribimos marcadores y
  // avisamos alto y claro: el login no funcionará hasta pegarlas.
  const prev = readExistingEnvLocal();
  const pollarUsersPublishable = isRealPollarKey(
    prev.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY,
    'pub',
  )
    ? prev.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY!
    : 'pk_test_pollar_users_' + appSecretKey.slice(0, 32);
  const pollarUsersSecret = isRealPollarKey(prev.POLLAR_USERS_SECRET_KEY, 'sec')
    ? prev.POLLAR_USERS_SECRET_KEY!
    : 'sk_test_pollar_users_' + appSecretKey.slice(0, 32);
  const pollarOpsSecret = isRealPollarKey(prev.POLLAR_OPS_SECRET_KEY, 'sec')
    ? prev.POLLAR_OPS_SECRET_KEY!
    : 'sk_test_pollar_ops_' + appSecretKey.slice(0, 32);

  const pollarKeysAreFake =
    !isRealPollarKey(pollarUsersPublishable, 'pub') ||
    !isRealPollarKey(pollarUsersSecret, 'sec') ||
    !isRealPollarKey(pollarOpsSecret, 'sec');

  // Email admin is arbitrary but must be a valid email.
  const adminEmail = 'admin@pumatrade.local';

  // DATABASE_URL: apunta al Postgres local de Docker que levanta
  // `npm run db:up` (scripts/db-up.sh, puerto 5433 por defecto para no
  // chocar con un Postgres existente en 5432). Si prefieres otro hosting
  // (Neon/Supabase/Railway en la nube, o un local distinto), solo cambia
  // esta línea — el resto del stack es idéntico.
  const databaseUrl =
    process.env.PT_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/pumatrade?sslmode=disable';

  const envContent = `# Generado por scripts/gen-test-env.ts — verificado ✅ friendbot funded 2 accounts.
# ⚠️ NO USAR EN PRODUCCIÓN. Las keys de Stellar son de testnet (gratis).

# === Pollar ===
# ⚠️ El login NO funciona hasta pegar las keys reales del dashboard
# dashboard.pollar.xyz (app "PumaTrade Usuarios" → pub_testnet_users_… /
# sec_testnet_users_…; app "Operacional" → sec_testnet_ops_…). Estas son
# marcadores generados por setup:env.
NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY=${pollarUsersPublishable}
POLLAR_USERS_SECRET_KEY=${pollarUsersSecret}
POLLAR_OPS_SECRET_KEY=${pollarOpsSecret}

# === Stellar platform/treasury (testnet, friendbot-funded) ===
PLATFORM_PUBLIC_KEY=${platformMaster.publicKey()}
PLATFORM_SECRET_KEY=${platformMaster.secret()}

# === Crypto ===
APP_SECRET_KEY=${appSecretKey}

# === Postgres local (Docker) ===
# Levanta la DB con:  npm run db:up
# Para usar otro host (Neon/Supabase/Railway), cambia solo esta línea.
DATABASE_URL=${databaseUrl}
# Puerta del contenedor: 5433 (definida en scripts/db-up.sh, editable vía
# PT_DB_PORT). Si tu máquina ya tiene algo en 5433, ajusta ambos.

# === App ===
NEXT_PUBLIC_PLATFORM_FEE_BPS=200
DEMO_TTL_MINUTES=3
CONFIRM_WINDOW_MINUTES=10
HACKATHON_FREE_FEES=true
ENABLE_CRON=false
ADMIN_EMAILS=${adminEmail}

# === Deploy ===
CRON_SECRET=${appSecretKey.slice(0, 32)}
# BLOB_READ_WRITE_TOKEN= (vacío en dev)
`;

  writeFileSync('.env.local', envContent);
  console.log('\n✅ .env.local escrito con:');
  console.log('   - PLATFORM_PUBLIC_KEY válida (pasa regex /lib/config.ts)');
  console.log('   - PLATFORM_SECRET_KEY con checksum Stellar válido');
  console.log('   - APP_SECRET_KEY de 64 hex chars');
  console.log('   - 2 cuentas en testnet fondeadas (10 000 XLM cada una)');
  if (pollarKeysAreFake) {
    console.log(
      '\n⚠️  POLLAR KEYS SON MARCARES — el LOGIN NO FUNCIONA todavía.\n' +
        '   Crea las 2 apps en dashboard.pollar.xyz y pega las keys reales ' +
        '(pub_*/sec_*) en .env.local:\n' +
        '   - NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY | POLLAR_USERS_SECRET_KEY  (app Usuarios)\n' +
        '   - POLLAR_OPS_SECRET_KEY                                             (app Operacional)\n' +
        '   Re-correr este script YA NO las pisa (se preservan).',
    );
  } else {
    console.log('   - Keys reales de Pollar preservadas ✅');
  }
}

main().catch((e) => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
