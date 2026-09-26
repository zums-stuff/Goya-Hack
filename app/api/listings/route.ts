// app/api/listings/route.ts — GET (list + filters) + POST (create).
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CreateListingSchema, ListListingsQuerySchema } from '@/lib/schemas';
import { buildListingsWhere } from '@/lib/listings';
import { handleApiError, ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const args = ListListingsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!args.success) {
      const flat = args.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return Response.json({ error: 'invalid_query', message: flat }, { status: 422 });
    }
    const listings = await prisma.listing.findMany({
      where: buildListingsWhere(args.data),
      orderBy: { createdAt: 'desc' },
      take: args.data.limit,
    });
    return Response.json({ listings }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = CreateListingSchema.parse(await req.json());
    const listing = await prisma.listing.create({
      data: {
        ...body,
        majors: JSON.stringify(body.majors), // Postgres-friendly; regenerate as JSON type post-MVP.
        sellerId: user.id,
      },
    });
    return Response.json({ listing }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
