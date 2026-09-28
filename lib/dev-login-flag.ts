// lib/dev-login-flag.ts
//
// Single source of truth for "¿el dev-login está habilitado en este
// proceso?". Reside en `globalThis` con una clave sembrada una sola vez
// por `instrumentation.ts::register()` antes de que cualquier ruta
// API arranque.
//
// Por que lo necesitamos
// ----------------------
// Antes: /api/auth/dev-users (que usa `isDevLoginAvailable()` en
// `lib/auth-env.ts`) devolvía 200 mientras /api/auth/dev-login (que
// evaluaba `process.env.NODE_ENV === 'production'` directo en su
// `POST`) devolvía 404 en el mismo proceso. Las dos rutas tienen la MISMA
// compuerta lógica pero resultados opuestos bajo Turbopack, porque
// Turbopack re-evalúa módulos dinamicamente y nuestro `next dev` está
// corriendo bajo `output: 'standalone'` en next.config.ts, lo cual
// congela partes del entorno por ruta. Repro: cero cambios de código,
// cero cambios de env local, sólo reinicio del proceso. Frustrante.
//
// Lo arreglamos con un patrón clásico: sembrar un flag en `globalThis`
// una sola vez al boot. Todas las rutas leen de ese flag. Si el flag
// no existe (caso de borde: dev-login siendo compilada sin pasar por
// instrumentation), hay fallback a `process.env` para no romper
// arranque. Pero Tan pronto como `instrumentation.ts::register()`
// corre, el flag domina y es inmutable.

const FLAG_KEY = '__gremium_dev_login_enabled__';

declare global {
  // eslint-disable-next-line no-var
  var __gremium_dev_login_enabled__: boolean | undefined;
}

/** Llamado una sola vez desde instrumentation.ts antes de que el server
 *  Node acepte requests.  Si ya fue sembrado (p. ej. test runner),
 *  podemos forzarlo a re-evaluarse con `force=true`. */
export function initDevLoginFlag(force = false): boolean {
  const next =
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_LOGIN_ENABLED === 'true';
  if (!force && globalThis[FLAG_KEY] !== undefined) {
    return globalThis[FLAG_KEY]!;
  }
  globalThis[FLAG_KEY] = next;
  return next;
}

/** Lectura segura desde cualquier ruta (server o cliente). Si la flag
 *  no fue sembrada todavía (caso raro de una API route invocada fuera de
 *  instrumentation), caemos a `process.env` directo, idéntico a la
 *  semántica original. */
export function isDevLoginEnabled(): boolean {
  const v = globalThis[FLAG_KEY];
  if (typeof v === 'boolean') return v;
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_LOGIN_ENABLED === 'true'
  );
}

/** Reset heroico para tests que cambian el entorno entre casos. */
export function _resetDevLoginFlagForTests(): void {
  delete globalThis[FLAG_KEY];
}
