// app/api/cron/timeout-check/route.ts — Job de Vercel Cron (Bearer CRON_SECRET).
// Llama a runTimeoutCheck (compartido con el cron dev de lib/cron-dev.ts).
import { runTimeoutCheck } from '@/lib/cron';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Bearer CRON_SECRET (Vercel Cron envía header Authorization: Bearer <secret>).
    const auth = req.headers.get('authorization') ?? '';
    const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
    if (!process.env.CRON_SECRET || auth !== expected) {
      throw new ApiError(401, 'unauthorized', 'CRON secret inválido');
    }
    const result = await runTimeoutCheck();
    return Response.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export const POST = GET;
