// app/api/escrow/dispute/route.ts — Rama C: multipart/form-data con foto.
//   - Magic byte validation (lib/crypto.ts validateEvidenceFile).
//   - Storage backend (Vercel Blob prod / disk dev).
//   - Ancla hash en Stellar via manageData (la cuenta del escrow firma; firmada por
//     platform + árbitro — restricciones técnicas pendientes de implementar, ver §6.3 op 6).
//   - Idempotente vía regla #2 + check de DisputeEvidence existente (B1b §12.7).
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { DisputeFormSchema } from '@/lib/schemas';
import { storeEvidence } from '@/lib/evidence-storage';
import { EscrowService } from '@/lib/escrow.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const fields = DisputeFormSchema.parse({
      escrowId: form.get('escrowId'),
      reason: form.get('reason'),
      description: form.get('description'),
    });
    const photo = form.get('photo');
    if (!(photo instanceof File) || photo.size === 0) {
      return Response.json(
        { error: 'missing_photo', message: 'Falta la foto de evidencia.' },
        { status: 422 },
      );
    }

    // 1. Storage (incluye validación magic bytes).
    const { url, hash } = await storeEvidence(fields.escrowId, photo);

    // 2. Anclar hash en Stellar (best-effort: si falla no abortamos — el log
    //    on-chain sería nice-to-have). El anchor wallet + multi-sig firmado
    //    con platform+árbitro requiere un account remoto; Bloque 7 lo termina.
    let stellarAnchorTxHash = 'NOT_ANCHORED_DEV';
    try {
      const { anchorDataEntry } = await import('@/lib/stellar');
      stellarAnchorTxHash = await anchorDataEntry(
        /* TODO source */ 'NOT_SET_IN_BLOCK', // El caller debe ajustar a `escrow.stellarEscrowAccount` con auth firmada por el árbitro.
        'dispute_evidence_hash',
        hash,
      );
    } catch (e) {
      console.warn('[dispute] Stellar anchor failed (no abortamos):', e);
    }

    // 3. Transición a `disputed` (lib/escrow.service.ts hace el updateMany + log).
    const escrow = await EscrowService.dispute({
      escrowId: fields.escrowId,
      reporterId: user.id,
      reason: fields.reason,
      description: fields.description,
      photoBuffer: new Uint8Array(await photo.arrayBuffer()),
      photoMime: photo.type,
      photoUrl: url,
      photoHash: hash,
      stellarAnchorTxHash,
    });

    return Response.json({ escrow, photoUrl: url, photoHash: hash });
  } catch (e) {
    if (e instanceof Error && 'status' in e) return Response.json({ error: (e as { code: string }).code, message: e.message }, { status: (e as { status: number }).status });
    console.error('[dispute] error:', e);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
