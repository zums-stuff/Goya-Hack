// lib/auth.ts — Server-side session helpers.
//
// Sesión = cookie HMAC (`pumatrade-session`) con shape `email.signature`.
// El backend la verifica con KEY_COOKIE (HKDF de APP_SECRET_KEY, §6.4) y
// resuelve el User desde la DB.
//
// ⚠️ NO usar como JWT propiamente (sin revocación server-side, sin rotación
// en cada login). Aceptado en MVP demo (A4 §12.7); tabla `Session` post-MVP.
import { cookies } from 'next/headers';
import { prisma } from './db';
import { verifyCookie, signCookie } from './crypto';
import type { User } from '@/generated/prisma/client';
import { AuthRequired } from './errors';

const COOKIE_NAME = 'pumatrade-session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

/** Lee la cookie y devuelve el email si la firma es válida; null si no. */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies(); // Next 16: await
  const cookie = store.get(COOKIE_NAME);
  if (!cookie) return null;
  return verifyCookie(cookie.value);
}

/** Necesita sesión válida + user existe en DB. Lanza 401 si no. */
export async function requireUser(): Promise<User> {
  const email = await getSessionEmail();
  if (!email) throw new AuthRequired('Sesión inválida — sincroniza primero.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthRequired('Sesión sin usuario — llama /api/auth/sync primero.');
  }
  return user;
}

/** Devuelve el user si hay sesión válida, o null si no (no tira). */
export async function tryGetUser(): Promise<User | null> {
  const email = await getSessionEmail();
  if (!email) return null;
  return prisma.user.findUnique({ where: { email } });
}

/** Setea la cookie de sesión HMAC para un email. Server-only. */
export async function setSessionCookie(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signCookie(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Borra la cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
