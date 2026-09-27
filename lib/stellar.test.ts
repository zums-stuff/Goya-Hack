// lib/stellar.test.ts — anchorDataEntry (Rama C — manageData multi-sig 2-of-2)
//
// Pure unit test. Mocks @stellar/stellar-sdk at the package level so the
// real `anchorDataEntry` runs end-to-end without talking to Horizon. The
// assertions target the precise contract this function must satisfy:
//
//   1. fee-payer = platform account (not the escrow),
//   2. manageData op source = escrow account (data lives ON the escrow),
//   3. tx envelope is signed twice (platform + arbiter — the threshold-2).
//
// The PRE-fix behavior would fail assertions 1 and 3: it loaded the escrow
// as fee-payer (also wrong economically — escrow has 3 XLM minus reserves)
// and signed only once (which Horizon would reject with txBAD_AUTH because
// the escrow has masterWeight:0 and med-threshold 2).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// SDK mocks — shared mutable state declared via vi.hoisted so that
// `vi.mock` factory (which Vitest hoists above module imports) can
// reference the same state that test bodies later assert on.
// ────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
  // Force a known platform keypair. setup.ts uses ??= which is overriden by
  // .env.local (carrying a real GATEI2TZO…); we explicitly set both names so
  // lib/config.ts -> lib/server-keypair.ts's sanity-check matches the stub
  // publicKey() we return below.
  process.env.PLATFORM_PUBLIC_KEY = 'G' + 'A'.repeat(55);
  process.env.PLATFORM_SECRET_KEY = 'S' + 'A'.repeat(55);

  const PLATFORM_PUB = 'G' + 'A'.repeat(55);
  const ARBITER_PUB = 'G' + 'B'.repeat(55);
  const PLATFORM_SECRET_FALLBACK = 'S' + 'A'.repeat(55);

  const loadAccountCalls: string[] = [];
  const loadAccountMock = vi.fn(async (addr: string) => {
    loadAccountCalls.push(addr);
    return { _id: PLATFORM_PUB, _which: 'platform' };
  });
  const fetchBaseFeeMock = vi.fn(async () => 100);

  const manageDataCalls: Array<Record<string, unknown>> = [];
  const buildCalls: Array<{
    source: unknown;
    opts: Record<string, unknown>;
    ops: unknown[];
  }> = [];
  const signMock = vi.fn();
  const submitMock = vi.fn(async () => ({
    hash: 'mock-tx-hash-DEADBEEF-0123456789abcdef',
    ledger: 12345,
  }));

  return {
    PLATFORM_PUB,
    ARBITER_PUB,
    PLATFORM_SECRET_FALLBACK,
    loadAccountCalls,
    loadAccountMock,
    fetchBaseFeeMock,
    manageDataCalls,
    buildCalls,
    signMock,
    submitMock,
  };
});

vi.mock('@stellar/stellar-sdk', () => {
  class MockServer {
    constructor(_url: string) { /* url ignored */ }
    loadAccount(addr: string): Promise<unknown> {
      return h.loadAccountMock(addr);
    }
    fetchBaseFee(): Promise<number> {
      return h.fetchBaseFeeMock();
    }
    submitTransaction(): Promise<{ hash: string; ledger: number }> {
      return h.submitMock();
    }
  }
  return {
    Networks: { TESTNET: 'Test SDF Network ; September 2015' },
    BASE_FEE: 100,
    Asset: { native: () => ({ type: 'native' }) },
    Memo: { text: (t: string) => ({ type: 'memoText', value: t }) },
    Horizon: { Server: MockServer },
    Keypair: {
      fromSecret: vi.fn((secret: string) => {
        const isPlatform = secret === h.PLATFORM_SECRET_FALLBACK;
        return {
          _secret: secret,
          publicKey: () => (isPlatform ? h.PLATFORM_PUB : h.ARBITER_PUB),
          sign: vi.fn(),
        };
      }),
    },
    Operation: {
      manageData: vi.fn((opts: Record<string, unknown>) => {
        h.manageDataCalls.push(opts);
        return { type: 'manageData', ...opts };
      }),
    },
    TransactionBuilder: vi.fn(
      (source: unknown, opts: Record<string, unknown>) => {
        const entry = { source, opts, ops: [] as unknown[] };
        h.buildCalls.push(entry);
        const builder: Record<string, unknown> = {};
        builder.addOperation = vi.fn((op: unknown) => {
          entry.ops.push(op);
          return builder;
        });
        builder.setTimeout = vi.fn(() => builder);
        builder.build = vi.fn(() => ({ sign: h.signMock }));
        return builder;
      },
    ),
    Transaction: vi.fn(),
    AccountResponse: vi.fn(),
  };
});

// Import AFTER mocks so the module wires up against the stubs above.
import { anchorDataEntry } from './stellar';

const ESCROW_PUB = 'G' + 'E'.repeat(55); // distinct from PLATFORM_PUB
const HASH_64 = 'a'.repeat(64); // SHA-256 hex length
const ARBITER_SECRET_TEST = 'S' + 'B'.repeat(55).slice(0, 55); // arbitrary 56-char S-key

describe('anchorDataEntry (Rama C — manageData multi-sig 2-of-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.loadAccountCalls.length = 0;
    h.manageDataCalls.length = 0;
    h.buildCalls.length = 0;
    h.loadAccountMock.mockImplementation(async (addr: string) => {
      h.loadAccountCalls.push(addr);
      return { _id: h.PLATFORM_PUB, _which: 'platform' };
    });
    h.submitMock.mockImplementation(async () => ({
      hash: 'mock-tx-hash-DEADBEEF-0123456789abcdef',
      ledger: 12345,
    }));
  });

  it('uses the PLATFORM account as fee-payer — never loads the escrow from Horizon', async () => {
    await anchorDataEntry({
      escrowAccountPublic: ESCROW_PUB,
      arbiterSecret: ARBITER_SECRET_TEST,
      name: 'dispute:test123',
      hexValue: HASH_64,
    });

    // PRE-fix bug: loaded the escrow account on Horizon, attempting to make
    // it pay its own fee (forbidden by masterWeight:0). Fix: only the
    // platform account is loaded.
    expect(h.loadAccountCalls).toHaveLength(1);
    expect(h.loadAccountCalls).toEqual([h.PLATFORM_PUB]);
    expect(h.loadAccountCalls).not.toContain(ESCROW_PUB);
  });

  it('builds TransactionBuilder over the platform account on TESTNET', async () => {
    await anchorDataEntry({
      escrowAccountPublic: ESCROW_PUB,
      arbiterSecret: ARBITER_SECRET_TEST,
      name: 'dispute:abc',
      hexValue: HASH_64,
    });
    expect(h.buildCalls).toHaveLength(1);
    const firstBuild = h.buildCalls[0];
    expect(firstBuild).toBeDefined();
    expect(firstBuild!.source).toEqual({ _id: h.PLATFORM_PUB, _which: 'platform' });
    expect(firstBuild!.opts.fee).toBe('100');
    expect(firstBuild!.opts.networkPassphrase).toBe(
      'Test SDF Network ; September 2015',
    );
  });

  it('places the manageData op on the ESCROW account (not the platform)', async () => {
    await anchorDataEntry({
      escrowAccountPublic: ESCROW_PUB,
      arbiterSecret: ARBITER_SECRET_TEST,
      name: 'dispute:escrowXYZ',
      hexValue: HASH_64,
    });
    expect(h.manageDataCalls).toHaveLength(1);
    expect(h.manageDataCalls[0]).toEqual({
      name: 'dispute:escrowXYZ',
      value: HASH_64,
      source: ESCROW_PUB,
    });
  });

  it('signs the tx envelope TWICE — platform + arbiter (the 2-of-2)', async () => {
    await anchorDataEntry({
      escrowAccountPublic: ESCROW_PUB,
      arbiterSecret: ARBITER_SECRET_TEST,
      name: 'dispute:abc',
      hexValue: HASH_64,
    });

    // PRE-fix: signed only once (platformKeypair), which Horizon rejects
    // with txBAD_AUTH because the escrow's med-threshold is 2 and the
    // arbiter signature is missing. POST-fix: two signatures.
    expect(h.signMock).toHaveBeenCalledTimes(2);
  });

  it('submits exactly one transaction and returns its hash', async () => {
    const result = await anchorDataEntry({
      escrowAccountPublic: ESCROW_PUB,
      arbiterSecret: ARBITER_SECRET_TEST,
      name: 'dispute:abc',
      hexValue: HASH_64,
    });
    expect(h.submitMock).toHaveBeenCalledTimes(1);
    expect(result).toBe('mock-tx-hash-DEADBEEF-0123456789abcdef');
  });

  describe('input validation', () => {
    it('throws when name exceeds 64 UTF-8 bytes', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'x'.repeat(65),
          hexValue: HASH_64,
        }),
      ).rejects.toThrow(/name excede 64 bytes/);
    });

    it('accepts a 64-byte name (boundary)', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'x'.repeat(64),
          hexValue: HASH_64,
        }),
      ).resolves.toBeTruthy();
    });

    it('throws when hexValue is empty', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'dispute:abc',
          hexValue: '',
        }),
      ).rejects.toThrow(/hex chars/);
    });

    it('throws when hexValue exceeds 64 chars', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'dispute:abc',
          hexValue: 'a'.repeat(65),
        }),
      ).rejects.toThrow(/hex chars/);
    });

    it('throws when hexValue contains non-hex characters', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'dispute:abc',
          hexValue: 'z'.repeat(64),
        }),
      ).rejects.toThrow(/debe ser hex/);
    });

    it('accepts mixed-case hex', async () => {
      await expect(
        anchorDataEntry({
          escrowAccountPublic: ESCROW_PUB,
          arbiterSecret: ARBITER_SECRET_TEST,
          name: 'dispute:abc',
          hexValue: ('aAbBcCdDeEfF' + '0'.repeat(52)),
        }),
      ).resolves.toBeTruthy();
    });
  });

  it('does not call Horizon.submitTransaction when validation fails', async () => {
    await expect(
      anchorDataEntry({
        escrowAccountPublic: ESCROW_PUB,
        arbiterSecret: ARBITER_SECRET_TEST,
        name: 'x'.repeat(65),
        hexValue: HASH_64,
      }),
    ).rejects.toThrow();
    expect(h.submitMock).not.toHaveBeenCalled();
    expect(h.loadAccountMock).not.toHaveBeenCalled();
  });
});
