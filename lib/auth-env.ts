// lib/auth-env.ts — Helper compartido server/cliente para saber si el
// login de demo está habilitado.
//
// Doble-guardia (defensa en profundidad): la flag puede estar en `true`
// por error en producción, pero el chequeo `NODE_ENV !== 'production'`
// cierra esa puerta. La ruta /api/auth/dev-login también chequea
// ambos lados vía `isDevLoginAvailable()`, defensa en profundidad
// (§8.3 / §12.7 A2).
//
// **Origen de la verdad único**: `lib/dev-login-flag.ts`.  En arranque,
// `instrumentation.ts::register()` siembra un flag en `globalThis` con
// la misma lógica. Aquí leemos primero el flag (que es estable a lo
// largo del proceso) y caemos a `process.env` si por alguna razón
// aún no fue sembrado (p. ej. código ejecutado antes de que Next
// corra el hook de instrumentation, como un test runner aislado).

import { isDevLoginEnabled } from './dev-login-flag';

export function isDevLoginAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  // Fuente primaria: globalThis flag sembrado por instrumentation.
  const flag = isDevLoginEnabled();
  if (typeof flag === 'boolean') return flag;

  // Fallback legacy (mismo comportamiento histórico) por si la flag
  // nunca fue sembrada.
  return env.NODE_ENV !== 'production' && env.DEV_LOGIN_ENABLED === 'true';
}
