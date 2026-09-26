// instrumentation.ts — Hook oficial de Next.js (Next 16).
//
// En producción, el cron es manejado por Vercel Cron (§11.3) llamando
// `/api/cron/timeout-check` cada minuto — NO necesita código de
// instrumentación.
//
// En dev local, el cron está disponible vía el comando `npm run cron:once`
// (también manual). Lo dejamos fuera de instrumentation para evitar que
// Next 16 trace los imports de `lib/db.ts`/`generated/prisma` al Edge runtime
// (lo cual falla: db usa node:url/path que Edge no soporta).
//
// Si en el futuro se quiere auto-cron en dev, mover a un cron externo
// (Railway) o un proceso Node separado.

export async function register(): Promise<void> {
  // No-op intencional.
  // Las apps que necesiten el cron en dev lo levantan con `npm run cron:once`
  // o el script `lib/cron-dev.ts` directamente.
  void process.env.NODE_ENV;
}
