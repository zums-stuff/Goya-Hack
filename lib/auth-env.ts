// lib/auth-env.ts — Helper compartido server/cliente para saber si el
// login de demo está habilitado.
//
// Doble-guardia (doble defensa): la flag puede estar en `true` por error en
// producción, pero el chequeo `NODE_ENV !== 'production'` cierra esa puerta.
// La ruta /api/auth/dev-login también chequea ambos lados, defensa en
// profundidad (§8.3 / §12.7 A2).

export function isDevLoginAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.DEV_LOGIN_ENABLED === 'true';
}