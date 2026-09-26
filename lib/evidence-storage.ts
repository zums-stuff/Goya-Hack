// lib/evidence-storage.ts — Subida de fotos de disputa a Vercel Blob (prod)
// o filesystem local (dev). Validación de MIME/tamaño ANTES de subir
// (`validateEvidenceFile` en lib/crypto.ts usa magic bytes — §12.6 / V3).

import { del, put } from '@vercel/blob';
import { env } from './config';
import {
  validateEvidenceBuffer,
  validateEvidenceFile,
  type ValidEvidence,
} from './crypto';
import crypto from 'node:crypto';

export type StoredEvidence = { url: string; hash: string };

/** Sube una evidencia al storage backend que toque (Vercel Blob o disco). */
export async function storeEvidence(
  escrowId: string,
  file: File,
): Promise<StoredEvidence> {
  const { buffer }: ValidEvidence = await validateEvidenceFile(file);
  return storeEvidenceBuffer(escrowId, buffer);
}

/** Variante sincrónica cuando el caller ya tiene el buffer (e.g., tests). */
export async function storeEvidenceBuffer(
  escrowId: string,
  bufInput: Buffer,
): Promise<StoredEvidence> {
  const { buffer }: ValidEvidence = validateEvidenceBuffer(bufInput);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  if (env.NODE_ENV === 'production') {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN requerida en producción.');
    }
    const blob = await put(`disputes/${escrowId}.${extFromMime(buffer)}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false, // B1b §12.7: foto inmutable una vez anclada en Stellar.
    });
    return { url: blob.url, hash };
  }

  // Dev: filesystem local (público).
  const fs = await import('node:fs/promises');
  const path = `${process.cwd()}/public/disputes/${escrowId}.${extFromMime(buffer)}`;
  await fs.mkdir(`${process.cwd()}/public/disputes`, { recursive: true });
  await fs.writeFile(path, buffer);
  const url = `/disputes/${escrowId}.${extFromMime(buffer)}`;
  return { url, hash };
}

export async function deleteEvidence(_escrowId: string, url: string): Promise<void> {
  if (env.NODE_ENV === 'production') {
    await del(url).catch(() => {/* idempotent */});
    return;
  }
  const fs = await import('node:fs/promises');
  // Extraer basename de la URL (e.g. /disputes/abc.jpg → abc.jpg)
  const filename = url.split('/').pop();
  if (!filename) return;
  await fs
    .unlink(`${process.cwd()}/public/disputes/${filename}`)
    .catch(() => {/* idempotent */});
}

function extFromMime(buf: Buffer): 'jpg' | 'png' | 'webp' {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  return 'webp';
}
