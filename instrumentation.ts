// instrumentation.ts — Hook oficial de Next.js. Arranca UNA vez cuando el
// servidor Node se inicializa (Next 16). Aquí opt-in para el cron in-process
// de dev, gateado por ENABLE_CRON.
//
// En producción el cron lo ejecuta Vercel Cron (§11.3) llamando a
// `/api/cron/timeout-check` cada minuto con Bearer CRON_SECRET. Sin código
// adicional aquí. Tampoco hace falta vercel.json en el repo si configuras
// el cron desde el dashboard de Vercel contra `/api/cron/timeout-check`.
//
// El import de `lib/cron-dev` es DINÁMICO (await import) a propósito:
// evita que Turbopack tracee estáticamente `lib/db.ts` / `@/generated/prisma`
// al bundle del Edge runtime, donde los módulos node:* fallan.
//
// Opt-in por env: ENABLE_CRON=true (el mismo flag que ya parsea lib/config.ts
// y que boot.sh expone con `ENABLE_CRON=true npm run dev`).

export async function register(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ENABLE_CRON !== 'true') return;

  const { startDevCron } = await import('./lib/cron-dev');
  startDevCron();
  console.log(
    '[instrumentation] dev cron wired (runTimeoutCheck cada 30s). ' +
      'Si quieres apagarlo: ENABLE_CRON no en .env.local.',
  );
}
