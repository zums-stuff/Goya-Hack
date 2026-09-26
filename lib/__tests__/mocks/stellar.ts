// lib/__tests__/mocks/stellar.ts — Helpers para mockear @stellar/stellar-sdk.
//
// Permite interceptar `horizon.loadAccount`, `fetchBaseFee` y
// `submitTransaction` con respuestas deterministas, y capturar las operaciones
// firmadas (operandos, cuentas fuente, memos) para asserts.
//
// Estrategia:exportar dos wrappers en lib/stellar.ts (`horizon`, `submitTx`)
// que internamente delegan a un módulo subyacente `lib/stellar-client.ts`.
// En tests, vi.mock('lib/stellar-client') sustituye las funciones.
//
// Como alternativa más simple (y acorde al alcance del test), exponemos
// `__setStellarMock()` para inyectar respuestas manualmente — útil en tests
// unitarios del state machine cuando el resultado Stellar es un detalle.

import { vi } from 'vitest';

type SubmitResult = { hash: string; ledger: number };

type MockConfig = {
  /** dirección pública de la cuenta escrow */
  escrowPublic: string;
  /** signer público de plataforma (fee payer) */
  platformPublic: string;
  /** resultados por cada submitTransaction (FIFO) */
  submitResults: SubmitResult[];
  /** saldo actual de la cuenta escrow (en XLM) */
  escrowBalanceXlm: number;
};

const mocks = new Map<string, MockConfig & { submitCalls: number }>();

/**
 * Registra un mock para los tests siguientes. El ID es el de cada `describe`
 * o sub-test (útil para reset entre tests).
 */
export function setStellarMock(testId: string, config: MockConfig): void {
  mocks.set(testId, { ...config, submitCalls: 0 });
}

export function getStellarMock(testId: string): (MockConfig & { submitCalls: number }) | undefined {
  return mocks.get(testId);
}

export function clearStellarMock(testId: string): void {
  mocks.delete(testId);
}

export function incrementSubmitCall(testId: string): number {
  const m = mocks.get(testId);
  if (!m) throw new Error(`No stellar mock for ${testId}`);
  m.submitCalls++;
  return m.submitCalls;
}

/**
 * Helper para tests que quieran interceptar `releaseEscrowWithBarterGuard`
 * sin tocar el módulo real: simplemente importa y llama `vi.mock` en el test.
 *
 * Ejemplo en un .test.ts:
 *   vi.mock('@/lib/stellar', async () => {
 *     const actual = await vi.importActual<typeof import('@/lib/stellar')>('@/lib/stellar');
 *     return {
 *       ...actual,
 *       releaseEscrowWithBarterGuard: vi.fn(async () => ({ hash: 'MOCK_TX_HASH' })),
 *       refundEscrowWithBarterGuard: vi.fn(async () => ({ hash: 'MOCK_TX_HASH_REFUND' })),
 *     };
 *   });
 */
export const stellarMockHelpers = {
  setStellarMock,
  getStellarMock,
  clearStellarMock,
  incrementSubmitCall,
  vi,
};
