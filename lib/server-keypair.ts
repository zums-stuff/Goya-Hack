// lib/server-keypair.ts — Keypair de la plataforma (server-only).
// Defensa en profundidad: aunque el bundler de Next se supone que no expone
// módulos server-only al cliente, verificamos typeof window explícitamente
// para abortar si accidentalmente termina en el bundle.

import { Keypair } from '@stellar/stellar-sdk';
import { env } from './config';

if (typeof window !== 'undefined') {
  throw new Error(
    '[security] lib/server-keypair.ts se importó en el cliente. Refactor inmediato.',
  );
}

if (!env.PLATFORM_SECRET_KEY) {
  throw new Error('PLATFORM_SECRET_KEY no definida');
}

export const platformKeypair = Keypair.fromSecret(env.PLATFORM_SECRET_KEY);
export const PLATFORM_PUBLIC_KEY = platformKeypair.publicKey();

// Sanity check contra el env público (mismas public key en ambos lados).
if (env.PLATFORM_PUBLIC_KEY && env.PLATFORM_PUBLIC_KEY !== PLATFORM_PUBLIC_KEY) {
  throw new Error(
    '[security] PLATFORM_PUBLIC_KEY (env) y la public key derivada de PLATFORM_SECRET_KEY no coinciden. ¿secret copiada mal?',
  );
}
