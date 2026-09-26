// lib/load-env.ts — Carga .env + .env.local para procesos CLI (tsx/Prisma seed).
//
// `import 'dotenv/config'` solo lee `.env` (no `.env.local`). Los scripts de
// CLI (seed, capture-wallets, demo-check, etc.) necesitan las variables de
// .env.local que genera `npm run setup:env`. Este módulo hace la parte
// .env.local con un mini-parser (sintaxis dotenv simple: KEY=VALUE por línea).
//
// Reglas:
//   - líneas vacías y comentarios (#) se ignoran
//   - valores entre comillas simples/dobles se quitan las comillas
//   - una variable ya presente en el entorno NO se sobrescribe (gana el shell)
//   - lazily: llama loadEnvLocal() tú mismo, o usa loadEnvOnce() al arranque

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadEnvLocal(): void {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/^#.*$/, '').trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    const valueRaw = m[2] ?? '';
    if (process.env[key] !== undefined) continue; // cuenta existente gana
    process.env[key] = valueRaw.trim().replace(/^['"]|['"]$/g, '');
  }
}

let loadedOnce = false;

/** Carga .env.local una sola vez por proceso (idempotente). */
export function loadEnvOnce(): void {
  if (loadedOnce) return;
  loadEnvLocal();
  loadedOnce = true;
}