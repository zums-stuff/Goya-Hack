import { requireUser } from '@/lib/auth';
import { isAdmin } from '@/lib/config';
import { prisma } from '@/lib/db';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdmin(user.email)) {
      throw new ApiError(403, 'forbidden', 'Acceso denegado: se requiere rol de administrador.');
    }

    const disputes = await prisma.disputeEvidence.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        escrow: {
          include: {
            listing: true,
            buyer: true,
            seller: true,
          },
        },
        reporter: true,
      },
    });

    return Response.json({ disputes });
  } catch (error) {
    return handleApiError(error);
  }
}
