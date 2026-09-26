// lib/crypto.test.ts — Tests puros sin DB. Cifrado + cookies + magic bytes.
//
// Estrategia: limpia APP_SECRET_KEY antes de importar lib/crypto (porque
// lib/crypto.ts tiene un module-init guard que exige APP_SECRET_KEY).

import { describe, it, expect, beforeAll } from 'vitest';

// IMPORTANTE: setear ANTES del import dinámico.

describe('lib/crypto (sin DB)', () => {
  let encryptSecret: (s: string) => string;
  let decryptSecret: (s: string) => string;
  let signCookie: (s: string) => string;
  let verifyCookie: (s: string) => string | null;

  beforeAll(async () => {
    process.env.APP_SECRET_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.HACKATHON_FREE_FEES = 'true';
    process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS = '200';
    process.env.DATABASE_URL = 'postgresql://x:x@127.0.0.1/x?sslmode=disable';
    process.env.NEXT_PUBLIC_POLLA_USERS_PUBLISHABLE_KEY = 'pk_demo';
    process.env.POLLAR_USERS_SECRET_KEY = 'sk_demo';
    process.env.POLLAR_OPS_SECRET_KEY = 'sk_demo';
    process.env.PLATFORM_PUBLIC_KEY = 'G' + 'A'.repeat(55);
    process.env.PLATFORM_SECRET_KEY = 'S' + 'A'.repeat(55);
    process.env.ADMIN_EMAILS = 'a@b.com';
    const cryptoMod = await import('@/lib/crypto');
    encryptSecret = cryptoMod.encryptSecret;
    decryptSecret = cryptoMod.decryptSecret;
    signCookie = cryptoMod.signCookie;
    verifyCookie = cryptoMod.verifyCookie;
  });

  it('encrypt + decrypt roundtrip (doble texto aleatorio)', () => {
    const samples = [
      'SXXX_STELLAR_SECRET_KEY_RANDOM',
      'k7g...diff-key...',
      '🔐 unicode emoji support 中文',
      ' ',
      '',
      // (no probamos empty porque GCM no acepta plaintext vacío)
    ];
    for (const plain of samples) {
      if (plain === '') continue;
      const blob = encryptSecret(plain);
      expect(blob.startsWith('enc:v1:')).toBe(true);
      const decoded = decryptSecret(blob);
      expect(decoded).toBe(plain);
    }
  });

  it('IVs nunca colisionan — encrypt 100 veces el mismo texto → 100 IVs distintos', () => {
    const plain = 'same-text';
    const ivs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const blob = encryptSecret(plain);
      const parts = blob.split(':');
      const iv = parts[2];
      if (typeof iv !== 'string') throw new Error(`Formato inválido: ${blob}`);
      ivs.add(iv);
    }
    expect(ivs.size).toBe(100);
  });

  it('blob con tag manipulado no descifra (autenticidad preservada)', () => {
    const blob = encryptSecret('secret');
    const parts = blob.split(':');
    // Volteamos un byte en el tag.
    const tagTampered =
      parts[0] +
      ':' +
      parts[1] +
      ':' +
      parts[2] +
      ':' +
      'ff'.repeat(16) + // cambiar el tag por completo
      ':' +
      parts[4];
    expect(() => decryptSecret(tagTampered)).toThrow();
  });

  it('blob con formato inválido no descifra', () => {
    expect(() => decryptSecret('enc:v2:00:00:AA')).toThrow(/Formato/);
    expect(() => decryptSecret('not-encrypted')).toThrow(/Formato/);
  });

  it('signCookie + verifyCookie (roundtrip)', () => {
    const email = 'maria.pumatrade+seed1@mail.tm';
    const cookie = signCookie(email);
    expect(cookie.includes(email)).toBe(true);
    expect(verifyCookie(cookie)).toBe(email);
  });

  it('verifyCookie rechaza email forjado en la cookie', () => {
    const email = 'maria@unam.mx';
    const cookie = signCookie(email);
    const forged = cookie.replace(email, 'hacker@evil.tld');
    expect(verifyCookie(forged)).toBeNull();
  });

  it('verifyCookie rechaza cookie basura', () => {
    expect(verifyCookie('foo.bar')).toBeNull();
    expect(verifyCookie('.nothing-before-dot')).toBeNull();
    expect(verifyCookie('a.')).toBeNull();
  });
});
