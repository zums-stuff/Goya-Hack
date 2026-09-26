// lib/priceAlert.test.ts — Motor de valuación (no estado, sin DB).

import { describe, it, expect, beforeAll } from 'vitest';

describe('lib/priceAlert (sin DB)', () => {
  let checkPrice: typeof import('@/lib/priceAlert/engine').checkPrice;

  beforeAll(async () => {
    process.env.APP_SECRET_KEY = 'a'.repeat(64);
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://x:x@127.0.0.1/x?sslmode=disable';
    process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY = 'pk';
    process.env.POLLAR_USERS_SECRET_KEY = 'sk';
    process.env.POLLAR_OPS_SECRET_KEY = 'sk';
    process.env.PLATFORM_PUBLIC_KEY = 'G' + 'A'.repeat(55);
    process.env.PLATFORM_SECRET_KEY = 'S' + 'A'.repeat(55);
    process.env.ADMIN_EMAILS = 'a@b.com';
    const m = await import('@/lib/priceAlert/engine');
    checkPrice = m.checkPrice;
  });

  it('item conocido + precio justo → "fair" (±50%)', () => {
    const r = checkPrice({ title: 'Calculadora TI-89 Titanium', type: 'calculadoras', priceCents: 80_000 });
    expect(r.verdict).toBe('fair');
  });

  it('precio > +50% del justo → "overpriced"', () => {
    // fair 80_000, pagamos 200_000 → +150% → overpriced
    const r = checkPrice({ title: 'TI-89', type: 'calculadoras', priceCents: 200_000 });
    expect(r.verdict).toBe('overpriced');
  });

  it('precio < -50% del justo → "underpriced"', () => {
    // fair 80_000, pagamos 20_000 → -75% → underpriced
    const r = checkPrice({ title: 'TI-89', type: 'calculadoras', priceCents: 20_000 });
    expect(r.verdict).toBe('underpriced');
  });

  it('item desconocido → "no_reference"', () => {
    const r = checkPrice({ title: 'Lámpara de lava vintage', type: 'otros', priceCents: 30_000 });
    expect(r.verdict).toBe('no_reference');
  });

  it('tipo incorrecto pero keyword matchea → matchea igual (UX-warning)', () => {
    // "Fluke" está en type='laboratorio'; pero un listing de "otros" con título
    // "Mi Fluke 117" — el motor lo encuentra como laboratorio de todas formas.
    const r = checkPrice({ title: 'Mi Fluke 117', type: 'otros', priceCents: 80_000 });
    expect(r.verdict).toBe('fair'); // fair 120_000, 80k es -33% → fair
  });
});
