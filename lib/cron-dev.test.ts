// lib/cron-dev.test.ts — startDevCron wiring (instrumentation.ts → cron-dev → cron).
//
// startDevCron() does two things, synchronously, when invoked:
//   1. Calls tick() once, which synchronously calls runTimeoutCheck() (the
//      `await` inside tick is preceded by zero sync statements).
//   2. Schedules tick() to run every 30s via setInterval.
// The test should reflect those semantics without racing timers.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/cron', () => ({
  runTimeoutCheck: vi.fn(async () => ({ released: 0, autoCancelled: 0 })),
}));

describe('startDevCron (instrumentation wiring)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(runTimeoutCheck).mockClear();
    stopDevCron(); // defensive — each test starts with no live timer
  });
  afterEach(() => {
    stopDevCron();
    vi.useRealTimers();
  });

  it('calls runTimeoutCheck once immediately on startup', () => {
    // runTimeoutCheck is invoked inside tick() BEFORE the await — so the
    // call count is incremented synchronously by the time startDevCron
    // returns. No need to drain microtasks.
    startDevCron();
    expect(runTimeoutCheck).toHaveBeenCalledTimes(1);
  });

  it('does not double-start when called twice', () => {
    startDevCron();
    startDevCron();
    // startDevCron guards with `if (timer) return;` so the second call
    // is a no-op. The single immediate tick still produces exactly 1
    // runTimeoutCheck call.
    expect(runTimeoutCheck).toHaveBeenCalledTimes(1);
  });

  it('fires runTimeoutCheck once every 30s after startup', async () => {
    startDevCron();
    expect(runTimeoutCheck).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(runTimeoutCheck).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(runTimeoutCheck).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(runTimeoutCheck).toHaveBeenCalledTimes(4);
  });

  it('stopDevCron halts further ticks', async () => {
    startDevCron();
    expect(runTimeoutCheck).toHaveBeenCalledTimes(1);

    stopDevCron();
    await vi.advanceTimersByTimeAsync(120_000);
    // No tick beyond the immediate one fired.
    expect(runTimeoutCheck).toHaveBeenCalledTimes(1);
  });
});

// Imported AFTER vi.mock so React-style occurs-then-imports keeps the
// mock around them.
import { startDevCron, stopDevCron } from './cron-dev';
import { runTimeoutCheck } from './cron';
