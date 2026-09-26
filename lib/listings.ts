// lib/listings.ts — Helpers de dominio para Listing.
// Todo monto es Int centavos.

import { Prisma } from '@/generated/prisma/client';
import type { ListingType, Major } from './schemas';

export type ListListingsArgs = {
  type?: ListingType;
  major?: Major;
  verifiedOnly?: boolean;
  search?: string;
  take?: number;
  skip?: number;
};

/** Construye el WHERE clause para GET /api/listings. Parametrizado vía Prisma
 *  (anti SQL-injection) y soporta title search case-insensitive. */
export function buildListingsWhere(args: ListListingsArgs): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {
    status: 'active',
  };
  if (args.type) where.type = args.type;
  if (args.verifiedOnly) where.videoVerified = true;
  if (args.major) {
    // `majors` es un JSON array serializado: hacemos match por contención de string
    // (no es perfecto pero suficientemente bueno para 24h) — "Física" matches
    // '["Física","..."]' y similares.
    where.majors = { contains: args.major };
  }
  if (args.search && args.search.length >= 2) {
    // title OR description búsqueda ILIKE.
    where.OR = [
      { title: { contains: args.search, mode: 'insensitive' } },
      { description: { contains: args.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
