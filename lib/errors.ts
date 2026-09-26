// lib/errors.ts — Errores tipados que el route handler entiende directamente.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class EscrowInvalidTransition extends ApiError {
  constructor(message: string) {
    super(409, 'escrow_invalid_transition', message);
    this.name = 'EscrowInvalidTransition';
  }
}

export class EscrowForbidden extends ApiError {
  constructor(message: string) {
    super(403, 'escrow_forbidden', message);
    this.name = 'EscrowForbidden';
  }
}

export class AuthRequired extends ApiError {
  constructor(message = 'Sesión requerida') {
    super(401, 'auth_required', message);
    this.name = 'AuthRequired';
  }
}

// Helper para mapear cualquier error a una Response JSON consistente.
export function handleApiError(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json(
      { error: e.code, message: e.message, details: e.details },
      { status: e.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (e instanceof z.ZodError) {
    return Response.json(
      {
        error: 'validation_error',
        message: 'Entrada inválida',
        details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  }
  console.error('[api] unhandled error:', e);
  return Response.json({ error: 'internal_error', message: 'Error inesperado' }, { status: 500 });
}

// Late import to avoid circular dep with crypto.ts which exports ApiError.
import { z } from 'zod';
