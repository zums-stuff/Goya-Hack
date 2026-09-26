// lib/cron-dev.ts — Cron in-process para desarrollo (Next 16 / Node 22).
// Solo se importa desde `instrumentation.ts` (gate por ENABLE_CRON).
// En prod, Vercel Cron ejecuta `runTimeoutCheck` vía `/api/cron/timeout-check`
// (Bearer CRON_SECRET).

import { runTimeoutCheck } from './cron';

let timer: NodeJS.Timeout | null = null;

export function startDevCron() {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await runTimeoutCheck();
      if (r.released + r.autoCancelled > 0) {
        console.log(`[cron-dev] ${r.released} auto-resueltos, ${r.autoCancelled} auto-cancelados`);
      }
    } catch (e) {
      console.error('[cron-dev] error:', e);
    }
  };
  // Primera pasada inmediata, luego cada 30s.
  tick();
  timer = setInterval(tick, 30_000);
}

export function stopDevCron() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
