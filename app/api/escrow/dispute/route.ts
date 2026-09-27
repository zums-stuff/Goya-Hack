// app/api/escrow/dispute/route.ts — Rama C: multipart/form-data con foto.
//   - Magic byte validation (lib/crypto.ts validateEvidenceFile).
//   - Storage backend (Vercel Blob prod / disk dev).
//   - Multi-sig 2-of-2 anchoring on Stellar (manageData on the escrow account).
//   - Anchoring is BEST-EFFORT: a Horizon outage must not block the user
//     from escalating a real-world dispute. The DB still stores the SHA-256
//     of the photo in disputeEvidenceHash, which is the authoritative crypto
//     anchor; the on-chain entry is attestational metadata.
//   - Idempotente vía regla #2 + check de DisputeEvidence existente (B1b §12.7).
import { requireUser } from '@/lib/auth';
import { DisputeFormSchema } from '@/lib/schemas';
import { storeEvidence } from '@/lib/evidence-storage';
import { EscrowService } from '@/lib/escrow.service';
import { handleApiError, ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { anchorDataEntry } from '@/lib/stellar';
import { decryptSecret } from '@/lib/crypto';

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

    // 2. Anclar hash en Stellar — manageData multi-sig 2-of-2 sobre la cuenta
    //    del escrow. Best-effort: si Horizon falla, no bloqueamos al usuario.
    const stellarAnchorTxHash = await tryAnchorEvidence({
      escrowId: fields.escrowId,
      userId: user.id,
      photoHash: hash,
    });

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

/**
 * Anchor the SHA-256 of a dispute photo onto the escrow account on Stellar.
 * Best-effort: returns '' on any non-auth failure. The DB already has the
 * authoritative hash; the on-chain entry is attestational metadata only.
 *
 * Authorization is enforced here (not in EscrowService.dispute): only buyer
 * or seller of the escrow may burn fees anchoring evidence for it. A 403
 * propagates so the route surfaces a clean error rather than leaving the
 * dispute half-anchored.
 */
async function tryAnchorEvidence(params: {
  escrowId: string;
  userId: string;
  photoHash: string;
}): Promise<string> {
  try {
    const escrow = await prisma.escrow.findUniqueOrThrow({
      where: { id: params.escrowId },
      select: {
        stellarEscrowAccount: true,
        arbiterSecretEnc: true,
        buyerId: true,
        sellerId: true,
      },
    });
    if (escrow.buyerId !== params.userId && escrow.sellerId !== params.userId) {
      throw new ApiError(
        403,
        'forbidden',
        'No eres participante de este escrow.',
      );
    }
    if (!escrow.stellarEscrowAccount || !escrow.arbiterSecretEnc) {
      console.warn(
        `[dispute] escrow ${params.escrowId} sin stellarEscrowAccount/arbiterSecretEnc — anclaje off-chain`,
      );
      return '';
    }
    const arbiterSecret = decryptSecret(escrow.arbiterSecretEnc);
    return await anchorDataEntry({
      escrowAccountPublic: escrow.stellarEscrowAccount,
      arbiterSecret,
      name: `dispute:${params.escrowId}`.slice(0, 64),
      hexValue: params.photoHash,
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.warn(
      `[dispute] anclaje Stellar falló para ${params.escrowId}:`,
      e instanceof Error ? e.message : e,
    );
    return '';
  }
}
