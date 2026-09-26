// lib/__tests__/helpers/fixtures.ts — Seeds mínimas reutilizables en tests.
// Crea usuarios con saldos correctos + listings + offers + escrows según el caso.

import { prisma } from '@/lib/db';
import type { User, Listing, Offer, Escrow } from '@/generated/prisma/client';

let counter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++counter}_${Date.now().toString(36)}`;
}

export async function seedUser(overrides?: Partial<User>): Promise<User> {
  const id = overrides?.id ?? nextId('usr');
  return await prisma.user.create({
    data: {
      id,
      email: `${id}@test.local`,
      displayName: overrides?.displayName ?? `User ${id}`,
      major: 'Ing. en Computación',
      bio: '',
      pollarWalletId: `G_PLACEHOLDER_${id}_${Date.now().toString(36)}`,
      balanceXlm: overrides?.balanceXlm ?? 200_000,
    },
  });
}

export async function seedListing(
  seller: User,
  overrides?: Partial<Listing>,
): Promise<Listing> {
  const id = overrides?.id ?? nextId('lst');
  return await prisma.listing.create({
    data: {
      id,
      sellerId: seller.id,
      title: overrides?.title ?? `Test listing ${id}`,
      description: 'description',
      priceXlm: overrides?.priceXlm ?? 50_000,
      type: 'electronica',
      majors: JSON.stringify(['Ing. en Computación']),
      condition: 'bueno',
      photoUrl: 'https://images.unsplash.com/photo-test',
      videoVerified: true,
      status: overrides?.status ?? 'active',
    },
  });
}

export async function seedOffer(
  listing: Listing,
  offerer: User,
  overrides?: Partial<Offer>,
): Promise<Offer> {
  const id = overrides?.id ?? nextId('ofr');
  return await prisma.offer.create({
    data: {
      id,
      listingId: listing.id,
      offererId: offerer.id,
      type: overrides?.type ?? 'saldo-only',
      offeredItems: overrides?.offeredItems ?? null,
      xlmAmount: overrides?.xlmAmount ?? null,
      message: overrides?.message ?? null,
      status: overrides?.status ?? 'pending',
    },
  });
}

export async function seedFundedEscrow(opts: {
  buyer: User;
  seller: User;
  listing: Listing;
  offer: Offer;
  amountCents?: number;
  arbitrerSecret?: string;
}): Promise<Escrow> {
  const id = nextId('esc');
  return await prisma.escrow.create({
    data: {
      id,
      offerId: opts.offer.id,
      listingId: opts.listing.id,
      buyerId: opts.buyer.id,
      sellerId: opts.seller.id,
      amountXlm: opts.amountCents ?? 30_000,
      stellarEscrowAccount: `G_STELLAR_ESCROW_${id}`,
      arbiterSecretEnc: opts.arbitrerSecret
        ? `enc:v1:000000000000000000000000:00000000000000000000000000000000:${opts.arbitrerSecret}`
        : null,
      platformFeeBps: 200,
      status: 'funded', // tests lo usan para empezar acá directamente
    },
  });
}

export async function seedExchangeRecorded(opts: {
  buyer: User;
  seller: User;
  listing: Listing;
  offer: Offer;
  amountCents?: number;
  ttlMinutes?: number;
}): Promise<Escrow> {
  const id = nextId('esc');
  const ttlMinutes = opts.ttlMinutes ?? 60;
  const exchangeConfirmedAt = new Date();
  const ttlExpiresAt = new Date(exchangeConfirmedAt.getTime() + ttlMinutes * 60_000);

  return await prisma.escrow.create({
    data: {
      id,
      offerId: opts.offer.id,
      listingId: opts.listing.id,
      buyerId: opts.buyer.id,
      sellerId: opts.seller.id,
      amountXlm: opts.amountCents ?? 30_000,
      stellarEscrowAccount: `G_STELLAR_${id}`,
      arbiterSecretEnc: null,
      platformFeeBps: 200,
      status: 'exchange-recorded',
      exchangeInitiatorId: opts.seller.id,
      exchangeConfirmerId: opts.buyer.id,
      exchangeInitiatedAt: new Date(Date.now() - 60_000),
      exchangeConfirmedAt,
      ttlExpiresAt,
    },
  });
}
