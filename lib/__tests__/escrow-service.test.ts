// lib/__tests__/escrow-service.test.ts — Regla #2 + idempotencia del state machine.
// Mockeamos lib/stellar para no hablar con Horizon; verificamos las firmas
// y los hashes en asserts.
//
// Si DB_AVAILABLE es false (no hay Postgres alcanzable), los describe salta
// con describe.skipIf — los tests puros (crypto/fees/priceAlert) corren igual.

import { describe as vitestDescribe, it, expect, beforeEach, vi } from 'vitest';
import { DB_AVAILABLE, cleanDb } from './setup';

// Mock lib/stellar SIN vi.importActual — si importáramos actual,
// el module-load intentaría crear lib/server-keypair con un secret
// inválido (para tests no tenemos Stellar keypair real) y failaría.
// En lugar de eso, stub completo.
vi.mock('@/lib/stellar', () => ({
  STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF',
  horizon: { loadAccount: vi.fn(), fetchBaseFee: vi.fn() },
  buildMemoText: vi.fn(() => 'PT-memo-mock'),
  anchorDataEntry: vi.fn(async () => 'MOCK_ANCHOR_TX'),
  createEscrowAccount: vi.fn(async () => ({
    escrowPublicKey: 'G_MOCK_ESC_' + Date.now(),
    arbiterSecretEnc: 'enc:v1:00:00:AAAAAAAAAAAAAAAAAAAAAA',
    txHash: 'MOCK_CREATE_HASH',
  })),
  releaseEscrowWithBarterGuard: vi.fn(async (params: { amountCents: number }) => {
    if (params.amountCents === 0) return { hash: 'MOCK_NOOP_BARTER' };
    return { hash: 'MOCK_TX_HASH_RELEASE_' + Date.now() };
  }),
  refundEscrowWithBarterGuard: vi.fn(async (params: { amountCents: number }) => {
    if (params.amountCents === 0) return { hash: 'MOCK_NOOP_REFUND' };
    return { hash: 'MOCK_TX_HASH_REFUND_' + Date.now() };
  }),
  BASE_FEE: 100,
}));

const { prisma } = await import('@/lib/db');
const { EscrowService } = await import('@/lib/escrow.service');
const stellarMod = await import('@/lib/stellar');
const {
  seedUser,
  seedListing,
  seedOffer,
  seedFundedEscrow,
  seedExchangeRecorded,
} = await import('./helpers/fixtures');

// `describe` se reasigna a `describe.skip` cuando la DB no está disponible.
// Para evitar errores de conexión en CI sin Postgres.
const describe = DB_AVAILABLE ? vitestDescribe : (vitestDescribe.skip as typeof vitestDescribe);

// Re-import vitest namespace para los demás hooks.
import * as vitest from 'vitest';

const releaseSpy = vi.mocked(stellarMod.releaseEscrowWithBarterGuard);
const refundSpy = vi.mocked(stellarMod.refundEscrowWithBarterGuard);

beforeEach(async () => {
  await cleanDb();
  releaseSpy.mockClear();
  refundSpy.mockClear();
  // Control explícito del entorno de fees: este archivo asume fees ACTIVOS
  // (el .env.local generado trae HACKATHON_FREE_FEES=true para el demo).
  process.env.HACKATHON_FREE_FEES = 'false';
  process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS = '200';
});

// ───────────────────────────────────────────────────────────────────────────
// record-exchange: funded → awaiting-exchange
// ───────────────────────────────────────────────────────────────────────────
describe('recordExchange', () => {
  it('transitions funded → awaiting-exchange when buyer is actor', async () => {
    const seller = await seedUser({ balanceXlm: 0 });
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });

    const updated = await EscrowService.recordExchange(escrow.id, buyer.id);

    expect(updated.status).toBe('awaiting-exchange');
    expect(updated.exchangeInitiatorId).toBe(buyer.id);
    expect(updated.confirmWindowExpiresAt).toBeTruthy();

    // Listing aún no se completa (el exchange recorded llega después)
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(listingAfter.status).toBe('active'); // no cambia en esta transición
  });

  it('rejects if actor is not buyer/seller', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const stranger = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });

    await expect(EscrowService.recordExchange(escrow.id, stranger.id)).rejects.toThrow(/buyer|forbidden|forbidden/i);
  });

  it('regla #2: la segunda llamada concurrente pierde (count===0)', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });

    const [r1, r2] = await Promise.allSettled([
      EscrowService.recordExchange(escrow.id, buyer.id),
      EscrowService.recordExchange(escrow.id, buyer.id),
    ]);

    // exactamente 1 éxito, 1 rechazo
    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it('rejects si el estado no es funded', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    // Esperar a que esté awaiting-exchange primero
    await EscrowService.recordExchange(escrow.id, buyer.id);

    await expect(EscrowService.recordExchange(escrow.id, buyer.id)).rejects.toThrow(
      /no-fundable|estado|transición|carrera/i,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// confirm-exchange: awaiting-exchange → exchange-recorded
// ───────────────────────────────────────────────────────────────────────────
describe('confirmExchange', () => {
  it('transitions awaiting-exchange → exchange-recorded cuando actor ≠ initiator', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    await EscrowService.recordExchange(escrow.id, buyer.id);
    // Ahora seller confirma
    const updated = await EscrowService.confirmExchange(escrow.id, seller.id);

    expect(updated.status).toBe('exchange-recorded');
    expect(updated.exchangeConfirmerId).toBe(seller.id);
    expect(updated.ttlExpiresAt).toBeTruthy();
  });

  it('rechaza si el mismo initiator intenta confirmar otra vez', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    await EscrowService.recordExchange(escrow.id, buyer.id);

    // buyer (initiator) NO puede confirmar — debe ser la otra parte.
    await expect(EscrowService.confirmExchange(escrow.id, buyer.id)).rejects.toThrow(/confirmar|initiator/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// accept: exchange-recorded → released (con idempotencia Stellar)
// ───────────────────────────────────────────────────────────────────────────
describe('accept', () => {
  it('buyer acepta → released + listing sold + offer completed', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    await EscrowService.recordExchange(escrow.id, buyer.id);
    await EscrowService.confirmExchange(escrow.id, seller.id);

    const updated = await EscrowService.accept(escrow.id, buyer.id);

    expect(updated.status).toBe('released');
    expect(updated.stellarTxHashRelease).toMatch(/^MOCK_TX_HASH_RELEASE_/);
    expect(updated.platformFeeXlm).toBe(600); // 30_000 × 200 / 10_000 = 600 = 6 XLM
    expect(releaseSpy).toHaveBeenCalledOnce();

    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(listingAfter.status).toBe('sold');
    const offerAfter = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(offerAfter.status).toBe('completed');
  });

  it('M5 idempotencia: dos accepts concurrentes — solo uno firma', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    await EscrowService.recordExchange(escrow.id, buyer.id);
    await EscrowService.confirmExchange(escrow.id, seller.id);

    // ⚠️ Si dos clicks passent a la vez: ¿qué pasa?
    // La transacción Prisma usa updateMany con `where stellarTxHashRelease: null`.
    // El primero setea status='released' y luego stellarTxHashRelease=hash.
    // El segundo ve `count===0` y aborta.
    // ⚠️ Problema: en mi impl actual, si después del updateMany del status
    // la tx Stellar FALLA, el Prisma tx rollbackea — pero la tx Stellar ya se firmó.
    // [Verificable en Bloco 6 revisión]
    const [r1, r2] = await Promise.allSettled([
      EscrowService.accept(escrow.id, buyer.id),
      EscrowService.accept(escrow.id, buyer.id),
    ]);
    const r1ok = r1.status === 'fulfilled';
    const r2ok = r2.status === 'fulfilled';
    expect(r1ok && !r2ok || !r1ok && r2ok).toBe(true);
    // Sólo 1 tx Stellar enviada (el otro perdió con count=0).
    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });

  it('rechaza si el actor no es buyer', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedFundedEscrow({ buyer, seller, listing, offer });
    await EscrowService.recordExchange(escrow.id, buyer.id);
    await EscrowService.confirmExchange(escrow.id, seller.id);

    await expect(EscrowService.accept(escrow.id, seller.id)).rejects.toThrow(/buyer/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// cancel: cualquier estado cancellable → refunded
// ───────────────────────────────────────────────────────────────────────────
describe('cancel', () => {
  it('manual cancel awaiting-funding → refunded + listing active + offer pending', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    // Crear escrow en awaiting-funding directamente
    const escrow = await prisma.escrow.create({
      data: {
        id: 'esc_awaiting',
        offerId: offer.id,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountXlm: 30_000,
        stellarEscrowAccount: 'G_awaiting',
        arbiterSecretEnc: null,
        platformFeeBps: 200,
        status: 'awaiting-funding',
      },
    });

    const r = await EscrowService.cancel(escrow.id, seller.id);

    expect(r.status).toBe('refunded');
    expect(refundSpy).toHaveBeenCalledOnce();
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(listingAfter.status).toBe('active');
    const offerAfter = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(offerAfter.status).toBe('pending');
  });

  it('V1 idempotencia refund: dos cancels concurrentes — solo uno firma', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await prisma.escrow.create({
      data: {
        id: 'esc_idem',
        offerId: offer.id,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountXlm: 30_000,
        stellarEscrowAccount: 'G_idem',
        arbiterSecretEnc: null,
        platformFeeBps: 200,
        status: 'funded',
      },
    });

    const [r1, r2] = await Promise.allSettled([
      EscrowService.cancel(escrow.id, seller.id),
      EscrowService.cancel(escrow.id, seller.id),
    ]);
    const okCount = [r1, r2].filter((r) => r.status === 'fulfilled').length;
    expect(okCount).toBe(1);
    expect(refundSpy).toHaveBeenCalledTimes(1);
  });

  it('rechaza si el estado es exchange-recorded (no cancellable, hay TTL)', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer });

    await expect(EscrowService.cancel(escrow.id, seller.id)).rejects.toThrow(/Cannot|invalid|exchange-recorded/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// auto-resolve: TTL vencido → auto-released
// ───────────────────────────────────────────────────────────────────────────
describe('autoResolve', () => {
  it('TTL vencido → auto-released (sin cliente, server-side)', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer, ttlMinutes: -1 });
    // ttl negativo → ttlExpiresAt ya en el pasado

    const r = await EscrowService.autoResolve(escrow.id);

    expect(r.status).toBe('auto-released');
    expect(releaseSpy).toHaveBeenCalledOnce();
  });

  it('idempotente — llamar 2 veces solo firma 1 release', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer, ttlMinutes: -1 });

    const r1 = await EscrowService.autoResolve(escrow.id);
    const r2 = await EscrowService.autoResolve(escrow.id);

    expect(r1.status).toBe('auto-released');
    expect(r2.status).toBe('auto-released');
    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// dispute: foto inmutable (B1b §12.7)
// ───────────────────────────────────────────────────────────────────────────
describe('dispute', () => {
  it('abrir disputa → disputed + DisputeEvidence', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer });

    const r = await EscrowService.dispute({
      escrowId: escrow.id,
      reporterId: buyer.id,
      reason: 'item-damaged',
      description: 'El artículo tiene defectos.',
      photoBuffer: Buffer.from('fake-photo-bytes'),
      photoMime: 'image/jpeg',
      photoUrl: '/disputes/test.jpg',
      photoHash: 'abc123hash',
      stellarAnchorTxHash: 'MOCK_ANCHOR_TX',
    });

    expect(r.status).toBe('disputed');
    expect(r.disputeEvidenceHash).toBe('abc123hash');
    const ev = await prisma.disputeEvidence.findFirst({
      where: { escrowId: escrow.id },
    });
    expect(ev).not.toBeNull();
  });

  it('rechaza segunda disputa para el mismo escrow (B1b §12.7)', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer });

    await EscrowService.dispute({
      escrowId: escrow.id,
      reporterId: buyer.id,
      reason: 'item-damaged',
      description: 'Primera disputa.',
      photoBuffer: Buffer.from('f'),
      photoMime: 'image/jpeg',
      photoUrl: '/d/h.jpg',
      photoHash: 'h1',
      stellarAnchorTxHash: 'a1',
    });

    await expect(
      EscrowService.dispute({
        escrowId: escrow.id,
        reporterId: buyer.id,
        reason: 'item-different',
        description: 'Segunda.',
        photoBuffer: Buffer.from('f'),
        photoMime: 'image/jpeg',
        photoUrl: '/d/h2.jpg',
        photoHash: 'h2',
        stellarAnchorTxHash: 'a2',
      }),
    ).rejects.toThrow(/disputa|already/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// admin resolve (A5 §12.7): disputed → release o refund
// ───────────────────────────────────────────────────────────────────────────
describe('adminResolve (A5)', () => {
  it('release: disputed → released + listing sold', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer });

    // 1. Abrir la disputa de verdad (crea DisputeEvidence + pasa a disputed).
    await EscrowService.dispute({
      escrowId: escrow.id,
      reporterId: buyer.id,
      reason: 'item-damaged',
      description: description(),
      photoBuffer: Buffer.from('f'),
      photoMime: 'image/jpeg',
      photoUrl: '/d/photo.jpg',
      photoHash: 'hashX',
      stellarAnchorTxHash: 'anchorX',
    });
    const dispute = await prisma.disputeEvidence.findFirstOrThrow({
      where: { escrowId: escrow.id },
    });

    // 2. Admin resuelve → release.
    const r = await EscrowService.adminResolve({
      disputeId: dispute.id,
      adminId: seller.id, // cualquier admin
      decision: 'release',
    });

    expect(r.status).toBe('resolved');
    expect(releaseSpy).toHaveBeenCalled();
    // Listing pasa a sold
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(listingAfter.status).toBe('sold');
  });

  it('refund: disputed → refunded + listing active', async () => {
    const seller = await seedUser();
    const buyer = await seedUser();
    const listing = await seedListing(seller);
    const offer = await seedOffer(listing, buyer, { xlmAmount: 30_000, status: 'accepted' });
    const escrow = await seedExchangeRecorded({ buyer, seller, listing, offer });

    // 1. Abrir la disputa de verdad.
    await EscrowService.dispute({
      escrowId: escrow.id,
      reporterId: buyer.id,
      reason: 'item-damaged',
      description: 'Defectuoso desc',
      photoBuffer: Buffer.from('f'),
      photoMime: 'image/jpeg',
      photoUrl: '/d/photo.jpg',
      photoHash: 'hashY',
      stellarAnchorTxHash: 'anchorY',
    });
    const dispute = await prisma.disputeEvidence.findFirstOrThrow({
      where: { escrowId: escrow.id },
    });

    // 2. Admin resuelve → refund.
    const r = await EscrowService.adminResolve({
      disputeId: dispute.id,
      adminId: seller.id,
      decision: 'refund',
    });

    expect(r.status).toBe('rejected');
    expect(refundSpy).toHaveBeenCalled();
    // Listing vuelve a active, offer a pending
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(listingAfter.status).toBe('active');
    const offerAfter = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(offerAfter.status).toBe('pending');
  });
});

// Helper para description() en el test de adminResolve.
function description(): string {
  return 'Defectuoso description con más de 10 chars';
}
