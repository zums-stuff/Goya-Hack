// lib/crypto.ts — Cifrado del árbitro + firma de cookies + validación de evidencia.
//
// Diseño de claves (§6.4):
//   APP_SECRET_KEY es el master, único secret en .env local.
//   Por HKDF-SHA256 (RFC 5869) derivamos DOS sub-llaves con `info` distintos:
//     KEY_ENC    = HKDF(...info='pumatrade:v1:aes-gcm')     ← cifrado árbitro
//     KEY_COOKIE = HKDF(...info='pumatrade:v1:hmac-cookie') ← firma de sesión
//   Si una se compromete, la otra no se puede inferir.

import crypto from 'node:crypto';
import { env } from './config';

if (!env.APP_SECRET_KEY) throw new Error('APP_SECRET_KEY no definida');

// Buffer.from() espera hex string — ya validado por Zod.
const MASTER = Buffer.from(env.APP_SECRET_KEY, 'hex');

function subkey(info: string): Buffer {
  // crypto.hkdfSync(algorithm, ikm, salt, info, length) — disponible desde Node 15.
  return crypto.hkdfSync('sha256', MASTER, Buffer.alloc(0), Buffer.from(info), 32);
}

const KEY_ENC = subkey('pumatrade:v1:aes-gcm');
const KEY_COOKIE = subkey('pumatrade:v1:hmac-cookie');

// ─── AES-256-GCM cifrado simétrico (Escrow.arbiterSecretEnc) ─────────────────

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_ENC, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Formato de blob cifrado inválido');
  }
  const [, , ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_ENC, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// ─── HMAC-SHA256 firma de sesión (cookie 'pumatrade-session') ───────────────
// Cookie guarda `${email}.${sig}` — KEY_COOKIE separada de KEY_ENC (HKDF).
export function signCookie(email: string): string {
  const sig = crypto.createHmac('sha256', KEY_COOKIE).update(email).digest('hex');
  return `${email}.${sig}`;
}

export function verifyCookie(blob: string): string | null {
  const idx = blob.lastIndexOf('.');
  if (idx < 1) return null;
  const email = blob.slice(0, idx);
  const sig = blob.slice(idx + 1);
  const expected = crypto.createHmac('sha256', KEY_COOKIE).update(email).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}

// ─── Validación de archivos de evidencia (§12.6 — V3) ───────────────────────
// Sniffing de magic bytes: NO confiamos en File.type (cliente puede mentir).

const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const VALID_EVIDENCE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export type ValidEvidence = { buffer: Buffer; mime: string };

export function validateEvidenceFile(file: File): ValidEvidence {
  if (file.size > EVIDENCE_MAX_BYTES) {
    throw new ApiError(413, 'evidence_too_large', `Máx ${EVIDENCE_MAX_BYTES} bytes`);
  }
  return validateEvidenceBuffer(Buffer.from(file.arrayBuffer()));
}

// Validación sincrónica cuando ya tenemos el buffer (e.g. tests, scripts CLI).
export function validateEvidenceBuffer(buf: Buffer): ValidEvidence {
  const sniffed = sniffMime(buf);
  if (!sniffed || !VALID_EVIDENCE_MIME.has(sniffed)) {
    throw new ApiError(
      415,
      'evidence_unsupported_type',
      'Formato no soportado (jpeg/png/webp)',
    );
  }
  return { buffer: buf, mime: sniffed };
}

// ─── SHA256 hex helper (anclaje on-chain) ──────────────────────────────────
export function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ─── Errores básicos ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
