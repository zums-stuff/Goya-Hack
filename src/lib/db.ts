import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'goyahack.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    public_key TEXT UNIQUE NOT NULL,
    secret TEXT NOT NULL,
    alias TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cobros (
    id TEXT PRIMARY KEY,           -- ref corta para memo, ej. GH-A1B2C3
    payee_wallet_id TEXT NOT NULL, -- quien cobra
    amount REAL NOT NULL,
    asset TEXT NOT NULL DEFAULT 'USDC',
    concepto TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|paid|expired
    payer_wallet_id TEXT,
    tx_hash TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (payee_wallet_id) REFERENCES wallets(id)
  );
  CREATE INDEX IF NOT EXISTS ix_cobros_status ON cobros(status);
`);

export function createWallet(alias?: string) {
  const id = crypto.randomUUID();
  return { id, alias };
}

export function insertWallet(id: string, publicKey: string, secret: string, alias?: string) {
  db.prepare('INSERT INTO wallets (id, public_key, secret, alias) VALUES (?, ?, ?, ?)')
    .run(id, publicKey, secret, alias || null);
}

export function getWallet(id: string) {
  return db.prepare('SELECT * FROM wallets WHERE id = ?').get(id) as any;
}

export function makeCobroRef() {
  return 'GH-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function createCobro(payeeWalletId: string, amount: number, concepto?: string) {
  const id = makeCobroRef();
  db.prepare('INSERT INTO cobros (id, payee_wallet_id, amount, concepto) VALUES (?, ?, ?, ?)')
    .run(id, payeeWalletId, amount, concepto || null);
  return getCobro(id);
}

export function getCobro(id: string) {
  return db.prepare('SELECT * FROM cobros WHERE id = ?').get(id) as any;
}

export function markCobroPaid(id: string, payerWalletId: string, txHash: string) {
  db.prepare(`UPDATE cobros SET status='paid', payer_wallet_id=?, tx_hash=?, paid_at=datetime('now') WHERE id=?`)
    .run(payerWalletId, txHash, id);
  return getCobro(id);
}

export function listCobros(payeeWalletId?: string) {
  if (payeeWalletId) {
    return db.prepare('SELECT id, amount, asset, concepto, status, tx_hash, paid_at, created_at FROM cobros WHERE payee_wallet_id=? ORDER BY created_at DESC LIMIT 50').all(payeeWalletId);
  }
  return db.prepare('SELECT id, amount, asset, concepto, status, tx_hash, paid_at, created_at FROM cobros ORDER BY created_at DESC LIMIT 50').all();
}

export default db;
