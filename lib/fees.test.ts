// lib/fees.test.ts — Doctrina de dinero: floor en centavos.
//
// verify:
// - feeCents(amountCents, bps) = floor(amountCents * bps / 10000)
// - HACKATHON_FREE_FEES → 0
// - HACKATHON_FREE_FEES=false → comportamiento normal
// - centsToXlm / xlmToCents roundtrip (sin pérdida)
//
// HACKATHON_FREE_FEES se lee de process.env en cada llamada (no es const).

import { describe, it, expect, beforeAll } from 'vitest';

describe('lib/fees (sin DB)', () => {
  let feeCents: (amountCents: number, bps?: number) => number;
  let centsToXlm: (cents: number) => string;
  let xlmToCents: (xlm: string) => number;

  beforeAll(async () => {
    process.env.APP_SECRET_KEY = 'a'.repeat(64);
    process.env.DATABASE_URL = 'postgresql://x:x@127.0.0.1/x?sslmode=disable';
    process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY = 'pk';
    process.env.POLLAR_USERS_SECRET_KEY = 'sk';
    process.env.POLLAR_OPS_SECRET_KEY = 'sk';
    process.env.PLATFORM_PUBLIC_KEY = 'G' + 'A'.repeat(55);
    process.env.PLATFORM_SECRET_KEY = 'S' + 'A'.repeat(55);
    process.env.ADMIN_EMAILS = 'a@b.com';
    const m = await import('@/lib/fees');
    feeCents = m.feeCents;
    centsToXlm = m.centsToXlm;
    xlmToCents = m.xlmToCents;
  });

  it('floor de 30_000 × 200 / 10000 = 600 centavos', () => {
    process.env.HACKATHON_FREE_FEES = 'false';
    process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS = '200';
    expect(feeCents(30_000, 200)).toBe(600);
  });

  it('floor de 30_001 × 200 / 10000 = 600 (no redondea)', () => {
    process.env.HACKATHON_FREE_FEES = 'false';
    expect(feeCents(30_001, 200)).toBe(600); // 30_001 × 200 / 10000 = 600.02 → 600
  });

  it('floor de 100 × 100 / 10000 = 1 (no es 0)', () => {
    process.env.HACKATHON_FREE_FEES = 'false';
    expect(feeCents(100, 100)).toBe(1);
  });

  it('HACKATHON_FREE_FEES=true → siempre 0', () => {
    process.env.HACKATHON_FREE_FEES = 'true';
    expect(feeCents(30_000, 200)).toBe(0);
    expect(feeCents(1, 9999)).toBe(0);
    expect(feeCents(0, 9999)).toBe(0);
  });

  it('amount=0 → fee=0 incluso sin HACKATHON_FREE_FEES', () => {
    process.env.HACKATHON_FREE_FEES = 'false';
    expect(feeCents(0, 200)).toBe(0);
  });

  it('bps fuera de rango → throw', () => {
    process.env.HACKATHON_FREE_FEES = 'false';
    expect(() => feeCents(100, -1)).toThrow(/rango/i);
    expect(() => feeCents(100, 10001)).toThrow(/rango/i);
  });

  it('centsToXlm invierte xlmToCents (roundtrip)', () => {
    for (const cents of [0, 1, 50, 100, 12_345, 1_234_567]) {
      const xlm = centsToXlm(cents);
      const back = xlmToCents(xlm);
      expect(back).toBe(cents);
    }
  });

  it('centsToXlm produce string con exactamente 7 decimales', () => {
    expect(centsToXlm(1)).toBe('0.0100000');
    expect(centsToXlm(100)).toBe('1.0000000');
    expect(centsToXlm(50)).toBe('0.5000000');
  });

  it('centsToXlm rechaza negativos', () => {
    expect(() => centsToXlm(-1)).toThrow(/negativos/);
  });
});

// Para forzar "false" en los tests de arriba (HACKATHON_FREE_FEES='false'),
// necesitamos resetear el env al inicio del bloque. Vitest antes de los
// describe ejecuta esto — pero como configuramos PLATFORM_SECRET_KEY antes
// de cargar lib/config (que importa lib/fees), el orden ya está safe.
