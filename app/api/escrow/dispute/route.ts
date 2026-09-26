// app/api/escrow/dispute/route.ts — Rama C: multipart/form-data con foto.
//   - Magic byte validation (lib/crypto.ts validateEvidenceFile).
//   - Storage backend (Vercel Blob prod / disk dev).
//   - Idempotente vía regla #2 + check de DisputeEvidence existente (B1b §12.7).
import { requireUser } from '@/lib/auth';
import { DisputeFormSchema } from '@/lib/schemas';
import { storeEvidence } from '@/lib/evidence-storage';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError, ApiError } from '@/lib/errors';

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
      throw new ApiError(422, 'missing_photo', 'Falta la foto de evidencia.');
    }

    // 1. Storage (incluye validación magic bytes — usa async API).
    const { url, hash } = await storeEvidence(fields.escrowId, photo);

    // 2. Anclar hash en Stellar — TODO Bloque 7 con manejo remoto multi-sig.
    const stellarAnchorTxHash = 'NOT_ANCHORED_IN_MVP';

    // 3. Transición a `disputed`.
    const photoBytes = new Uint8Array(await photo.arrayBuffer());
    const escrow = await EscrowService.dispute({
      escrowId: fields.escrowId,
      reporterId: user.id,
      reason: fields.reason,
      description: fields.description,
      photoBuffer: Buffer.from(photoBytes),
      photoMime: photo.type,
      photoUrl: url,
      photoHash: hash,
      stellarAnchorTxHash,
    });

    return Response.json({ escrow, photoUrl: url, photoHash: hash });
  } catch (e) {
    return handleApiError(e);
  }
}
