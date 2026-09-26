// instrumentation.ts — Hook oficial de Next.js (Next 16).
// Se ejecuta una vez por arranque del proceso Node del server.
//
// Dev: arranca el cron de 30s (regla #11.1/§11.2) si `ENABLE_CRON=true`.
// Prod (Vercel): no hace nada — Vercel Cron maneja el scheduling (§11.3).

export async function register() {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ENABLE_CRON !== 'true') return;

  const { startDevCron } = await import('./lib/cron-dev');
  startDevCron();
}
